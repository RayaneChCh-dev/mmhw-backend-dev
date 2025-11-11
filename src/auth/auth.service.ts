import {
  Injectable,
  Inject,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { eq, and } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../database/database.module';
import { users, otpCodes, refreshTokens, sessions } from '../database/schema';
import {
  SignUpDto,
  SignInDto,
  VerifyEmailDto,
  ResetPasswordDto,
  ForgotPasswordDto,
  AuthResponseDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: any,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signUp(signUpDto: SignUpDto): Promise<{ message: string; email: string }> {
    const { email, password, phone } = signUpDto;

    // Check if user exists
    const existingUser = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [newUser] = await this.db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        emailVerified: false,
      })
      .returning();

    // Generate OTP
    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.db.insert(otpCodes).values({
      userId: newUser.id,
      email,
      code: otp,
      type: 'email_verification',
      expiresAt,
    });

    // TODO: Send email with OTP
    console.log(`OTP for ${email}: ${otp}`);

    return {
      message: 'Verification code sent to your email',
      email,
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
    const { email, code } = verifyEmailDto;

    const otpRecord = await this.db.query.otpCodes.findFirst({
      where: and(
        eq(otpCodes.email, email),
        eq(otpCodes.code, code),
        eq(otpCodes.type, 'email_verification'),
      ),
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid verification code');
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException('Verification code has expired');
    }

    if (otpRecord.verifiedAt) {
      throw new BadRequestException('Code already used');
    }

    // Mark code as verified
    await this.db
      .update(otpCodes)
      .set({ verifiedAt: new Date() })
      .where(eq(otpCodes.id, otpRecord.id));

    // Update user
    await this.db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, otpRecord.userId));

    return { message: 'Email verified successfully' };
  }

  async signIn(signInDto: SignInDto): Promise<AuthResponseDto> {
    const { email, password } = signInDto;

    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Update last login
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    // Check if MFA is enabled
    if (user.isMfaEnabled) {
      // Generate temporary token for MFA verification
      const mfaToken = this.jwtService.sign(
        { userId: user.id, type: 'mfa' },
        { expiresIn: '5m' },
      );

      return {
        requiresMfa: true,
        mfaToken,
        accessToken: '',
        refreshToken: '',
        user: this.sanitizeUser(user),
      };
    }

    return this.generateTokens(user);
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      // Don't reveal if email exists
      return { message: 'If the email exists, a reset code has been sent' };
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.db.insert(otpCodes).values({
      userId: user.id,
      email,
      code: otp,
      type: 'password_reset',
      expiresAt,
    });

    // TODO: Send email with OTP
    console.log(`Password reset OTP for ${email}: ${otp}`);

    return { message: 'If the email exists, a reset code has been sent' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { email, code, newPassword } = resetPasswordDto;

    const otpRecord = await this.db.query.otpCodes.findFirst({
      where: and(
        eq(otpCodes.email, email),
        eq(otpCodes.code, code),
        eq(otpCodes.type, 'password_reset'),
      ),
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid reset code');
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException('Reset code has expired');
    }

    if (otpRecord.verifiedAt) {
      throw new BadRequestException('Code already used');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, otpRecord.userId));

    await this.db
      .update(otpCodes)
      .set({ verifiedAt: new Date() })
      .where(eq(otpCodes.id, otpRecord.id));

    return { message: 'Password reset successfully' };
  }

  async enableMfa(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isMfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(
      user.email,
      this.configService.get('OTP_ISSUER') || 'NomadConnect',
      secret,
    );

    const qrCode = await QRCode.toDataURL(otpauth);

    // Store secret temporarily (will be confirmed when user verifies)
    await this.db
      .update(users)
      .set({ mfaSecret: secret })
      .where(eq(users.id, userId));

    return { secret, qrCode };
  }

  async verifyMfaSetup(userId: string, code: string): Promise<{ message: string }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA setup not initiated');
    }

    const isValid = authenticator.verify({
      token: code,
      secret: user.mfaSecret,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.db
      .update(users)
      .set({ isMfaEnabled: true })
      .where(eq(users.id, userId));

    return { message: 'MFA enabled successfully' };
  }

  async verifyMfaLogin(mfaToken: string, code: string): Promise<AuthResponseDto> {
    let payload: any;
    try {
      payload = this.jwtService.verify(mfaToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    if (payload.type !== 'mfa') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });

    if (!user || !user.mfaSecret) {
      throw new UnauthorizedException('Invalid user');
    }

    const isValid = authenticator.verify({
      token: code,
      secret: user.mfaSecret,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    return this.generateTokens(user);
  }

  async refreshToken(token: string): Promise<AuthResponseDto> {
    const tokenRecord = await this.db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.token, token),
    });

    if (!tokenRecord || tokenRecord.revokedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.db.query.users.findFirst({
      where: eq(users.id, tokenRecord.userId),
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Revoke old token
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, tokenRecord.id));

    return this.generateTokens(user);
  }

  private async generateTokens(user: any): Promise<AuthResponseDto> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN') || '7d',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRES_IN') || '30d',
    });

    // Store refresh token
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await this.db.insert(refreshTokens).values({
      userId: user.id,
      token: refreshToken,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private sanitizeUser(user: any) {
    const { password, mfaSecret, ...sanitized } = user;
    return sanitized;
  }
}
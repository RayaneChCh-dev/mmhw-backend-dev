import {
  Injectable,
  Inject,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
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
  private readonly logger = new Logger(AuthService.name);

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

    // Check if phone verification is required
      if (user.phone && !user.phoneVerified) {
      // Send phone OTP
      const otp = this.generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await this.db.insert(otpCodes).values({
        userId: user.id,
        phone: user.phone,
        code: otp,
        type: 'phone_verification',
        expiresAt,
      });

      // TODO: Send SMS with OTP
      console.log(`Phone OTP for ${user.phone}: ${otp}`);

      return {
        requiresPhoneVerification: true,
        accessToken: '',
        refreshToken: '',
        user: this.sanitizeUser(user),
      };
    }

    return this.generateTokens(user);
  }

  async sendPhoneOtp(userId: string): Promise<{ message: string }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.phone) {
      throw new BadRequestException('Phone number not set');
    }

    if (user.phoneVerified) {
      throw new BadRequestException('Phone already verified');
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.db.insert(otpCodes).values({
      userId: user.id,
      phone: user.phone,
      code: otp,
      type: 'phone_verification',
      expiresAt,
    });

    // TODO: Send SMS with OTP
    console.log(`Phone OTP for ${user.phone}: ${otp}`);

    return { message: 'Verification code sent to your phone' };
  }

  async verifyPhone(userId: string, phone: string, code: string): Promise<{ message: string }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const otpRecord = await this.db.query.otpCodes.findFirst({
      where: and(
        eq(otpCodes.phone, phone),
        eq(otpCodes.code, code),
        eq(otpCodes.type, 'phone_verification'),
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
      .set({ 
        phone,
        phoneVerified: true 
      })
      .where(eq(users.id, user.id));

    return { message: 'Phone verified successfully' };
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
    // START: MFA Verification Debug Logging
    const requestTimestamp = new Date().toISOString();
    this.logger.debug(`[MFA VERIFY] === START REQUEST at ${requestTimestamp} ===`);
    this.logger.debug(`[MFA VERIFY] Received token: ${mfaToken ? mfaToken.substring(0, 20) + '...' : 'null'}`);
    this.logger.debug(`[MFA VERIFY] Received code: ${code ? code.length + ' digits' : 'null'}`);

    let payload: any;
    try {
      this.logger.debug(`[MFA VERIFY] Attempting to verify JWT token...`);
      payload = this.jwtService.verify(mfaToken);

      // Log successful verification with timing details
      const now = Math.floor(Date.now() / 1000);
      const issuedAt = payload.iat ? new Date(payload.iat * 1000).toISOString() : 'unknown';
      const expiresAt = payload.exp ? new Date(payload.exp * 1000).toISOString() : 'unknown';
      const secondsUntilExpiry = payload.exp ? payload.exp - now : 'unknown';

      this.logger.debug(`[MFA VERIFY] ✅ JWT verification successful`);
      this.logger.debug(`[MFA VERIFY] Token payload: ${JSON.stringify({ userId: payload.userId, type: payload.type, iat: issuedAt, exp: expiresAt })}`);
      this.logger.debug(`[MFA VERIFY] Time until expiry: ${secondsUntilExpiry} seconds`);
    } catch (error) {
      // Detailed error logging
      const errorTimestamp = new Date().toISOString();
      this.logger.error(`[MFA VERIFY] ❌ JWT verification failed at ${errorTimestamp}`);
      this.logger.error(`[MFA VERIFY] Error name: ${error.name}`);
      this.logger.error(`[MFA VERIFY] Error message: ${error.message}`);

      if (error.name === 'TokenExpiredError') {
        const expiredAt = error.expiredAt ? new Date(error.expiredAt).toISOString() : 'unknown';
        this.logger.error(`[MFA VERIFY] Token expired at: ${expiredAt}`);
        this.logger.error(`[MFA VERIFY] Current time: ${errorTimestamp}`);
      } else if (error.name === 'JsonWebTokenError') {
        this.logger.error(`[MFA VERIFY] JWT validation error: ${error.message}`);
      }

      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    // Verify token type
    this.logger.debug(`[MFA VERIFY] Checking token type: ${payload.type}`);
    if (payload.type !== 'mfa') {
      this.logger.error(`[MFA VERIFY] ❌ Invalid token type: expected 'mfa', got '${payload.type}'`);
      throw new UnauthorizedException('Invalid token type');
    }

    // Fetch user
    this.logger.debug(`[MFA VERIFY] Fetching user with ID: ${payload.userId}`);
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });

    if (!user || !user.mfaSecret) {
      this.logger.error(`[MFA VERIFY] ❌ User validation failed for ID ${payload.userId}`);
      this.logger.error(`[MFA VERIFY] User exists: ${!!user}`);
      this.logger.error(`[MFA VERIFY] MFA secret exists: ${!!user?.mfaSecret}`);
      throw new UnauthorizedException('Invalid user');
    }

    this.logger.debug(`[MFA VERIFY] ✅ User found and MFA secret exists`);
    this.logger.debug(`[MFA VERIFY] Verifying TOTP code...`);

    // Verify TOTP code
    const isValid = authenticator.verify({
      token: code,
      secret: user.mfaSecret,
    });

    if (!isValid) {
      this.logger.error(`[MFA VERIFY] ❌ Invalid TOTP code provided`);
      this.logger.error(`[MFA VERIFY] Code length: ${code.length}`);
      throw new BadRequestException('Invalid verification code');
    }

    this.logger.debug(`[MFA VERIFY] ✅ TOTP code verification successful`);
    this.logger.debug(`[MFA VERIFY] Generating auth tokens for user ${user.id}...`);

    // Generate final access and refresh tokens
    const authResponse = await this.generateTokens(user);

    this.logger.debug(`[MFA VERIFY] ✅ Auth tokens generated successfully`);
    this.logger.debug(`[MFA VERIFY] === END REQUEST at ${new Date().toISOString()} ===`);

    return authResponse;
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
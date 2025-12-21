import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  SignUpDto,
  SignInDto,
  VerifyEmailDto,
  VerifyPhoneDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  EnableMfaDto,
  VerifyMfaDto,
  AuthResponseDto,
} from './dto/auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with OTP code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiResponse({ status: 200, description: 'Signed in successfully', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async signIn(@Body() signInDto: SignInDto): Promise<AuthResponseDto> {
    return this.authService.signIn(signInDto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Reset code sent if email exists' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with code' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('verify-phone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify phone number with OTP code' })
  @ApiResponse({ status: 200, description: 'Phone verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  async verifyPhone(@Request() req, @Body() verifyPhoneDto: VerifyPhoneDto) {
    return this.authService.verifyPhone(
      req.user.userId,
      verifyPhoneDto.phone,
      verifyPhoneDto.code,
    );
  }

  @Post('send-phone-otp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to phone number' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  async sendPhoneOtp(@Request() req) {
    return this.authService.sendPhoneOtp(req.user.userId);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable MFA for user' })
  @ApiResponse({ status: 200, description: 'MFA setup initiated' })
  async enableMfa(@Request() req) {
    return this.authService.enableMfa(req.user.userId);
  }

  @Post('mfa/verify-setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify MFA setup' })
  @ApiResponse({ status: 200, description: 'MFA enabled successfully' })
  async verifyMfaSetup(@Request() req, @Body() enableMfaDto: EnableMfaDto) {
    return this.authService.verifyMfaSetup(req.user.userId, enableMfaDto.code);
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify MFA code during login',
    description: 'Send the temporary MFA token in the Authorization header as "Bearer <mfaToken>"'
  })
  @ApiResponse({ status: 200, description: 'MFA verified', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired MFA token' })
  @ApiResponse({ status: 400, description: 'Invalid verification code' })
  async verifyMfa(
    @Headers('authorization') authorization: string,
    @Body() verifyMfaDto: VerifyMfaDto,
  ): Promise<AuthResponseDto> {
    // Extract token from Authorization header
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('MFA token must be provided in Authorization header');
    }

    const mfaToken = authorization.substring(7); // Remove 'Bearer ' prefix

    return this.authService.verifyMfaLogin(mfaToken, verifyMfaDto.code);
  }
}
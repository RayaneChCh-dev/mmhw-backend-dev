import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  Request,
  Post,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  UpdateProfileDto,
  UpdateSkillsDto,
  UpdateAttitudesDto,
  UpdateInterestsDto,
  CompleteProfileDto,
  UpdateLocationDto,
  UpdatePushTokenDto,
  UserResponseDto,
} from './dto/user.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved', type: UserResponseDto })
  async getProfile(@Request() req): Promise<UserResponseDto> {
    return this.usersService.getProfile(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.getUserById(id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated', type: UserResponseDto })
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(req.user.userId, updateProfileDto);
  }

  @Post('profile/complete')
  @ApiOperation({ summary: 'Complete user profile (onboarding)' })
  @ApiResponse({ status: 200, description: 'Profile completed', type: UserResponseDto })
  async completeProfile(
    @Request() req,
    @Body() completeProfileDto: CompleteProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.completeProfile(req.user.userId, completeProfileDto);
  }

  @Patch('skills')
  @ApiOperation({ summary: 'Update user skills' })
  @ApiResponse({ status: 200, description: 'Skills updated' })
  async updateSkills(@Request() req, @Body() updateSkillsDto: UpdateSkillsDto) {
    return this.usersService.updateSkills(req.user.userId, updateSkillsDto);
  }

  @Patch('attitudes')
  @ApiOperation({ summary: 'Update user attitudes' })
  @ApiResponse({ status: 200, description: 'Attitudes updated' })
  async updateAttitudes(@Request() req, @Body() updateAttitudesDto: UpdateAttitudesDto) {
    return this.usersService.updateAttitudes(req.user.userId, updateAttitudesDto);
  }

  @Patch('interests')
  @ApiOperation({ summary: 'Update user interests' })
  @ApiResponse({ status: 200, description: 'Interests updated' })
  async updateInterests(@Request() req, @Body() updateInterestsDto: UpdateInterestsDto) {
    return this.usersService.updateInterests(req.user.userId, updateInterestsDto);
  }

  @Post('location')
  @ApiOperation({ summary: 'Update current location' })
  @ApiResponse({ status: 200, description: 'Location updated' })
  async updateLocation(@Request() req, @Body() updateLocationDto: UpdateLocationDto) {
    return this.usersService.updateLocation(req.user.userId, updateLocationDto);
  }

  @Get('location/history')
  @ApiOperation({ summary: 'Get location history' })
  @ApiResponse({ status: 200, description: 'Location history retrieved' })
  async getLocations(@Request() req) {
    return this.usersService.getLocations(req.user.userId);
  }

  @Delete('account')
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  async deleteAccount(@Request() req) {
    return this.usersService.deleteAccount(req.user.userId);
  }

  // Get available options
  @Get('options/skills')
  @ApiOperation({ summary: 'Get available skills' })
  @ApiResponse({ status: 200, description: 'Skills retrieved' })
  async getAvailableSkills() {
    return this.usersService.getAvailableSkills();
  }

  @Get('options/attitudes')
  @ApiOperation({ summary: 'Get available attitudes' })
  @ApiResponse({ status: 200, description: 'Attitudes retrieved' })
  async getAvailableAttitudes() {
    return this.usersService.getAvailableAttitudes();
  }

  @Get('options/interests')
  @ApiOperation({ summary: 'Get available interests' })
  @ApiResponse({ status: 200, description: 'Interests retrieved' })
  async getAvailableInterests() {
    return this.usersService.getAvailableInterests();
  }

  @Patch('push-token')
  @ApiOperation({ summary: 'Update push notification token' })
  @ApiResponse({ status: 200, description: 'Push token updated' })
  async updatePushToken(@Request() req, @Body() updatePushTokenDto: UpdatePushTokenDto) {
    return this.usersService.updatePushToken(req.user.userId, updatePushTokenDto);
  }

  @Delete('push-token')
  @ApiOperation({ summary: 'Remove push notification token (logout)' })
  @ApiResponse({ status: 200, description: 'Push token removed' })
  async removePushToken(@Request() req) {
    return this.usersService.removePushToken(req.user.userId);
  }
}
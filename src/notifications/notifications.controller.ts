import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  NotificationPreferencesDto,
  NotificationPreferencesResponseDto,
} from './dto/notification-preferences.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences retrieved',
    type: NotificationPreferencesResponseDto,
  })
  async getPreferences(@Request() req): Promise<NotificationPreferencesResponseDto> {
    return this.notificationsService.getNotificationPreferences(req.user.userId);
  }

  @Patch('preferences')
  @UsePipes(new ValidationPipe({
    whitelist: true, // Strip properties that don't have decorators
    forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
    transform: true, // Transform payloads to DTO instances
  }))
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences updated',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid preference value (must provide pushEnabled boolean)',
  })
  async updatePreferences(
    @Request() req,
    @Body() preferencesDto: NotificationPreferencesDto,
  ) {
    // Additional validation: ensure pushEnabled field is provided
    if (preferencesDto.pushEnabled === undefined) {
      throw new BadRequestException('pushEnabled field must be provided');
    }

    return this.notificationsService.updateNotificationPreferences(
      req.user.userId,
      preferencesDto,
    );
  }
}

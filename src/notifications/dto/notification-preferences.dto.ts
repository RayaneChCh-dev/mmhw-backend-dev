import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for updating notification preferences
 * Simplified to use only pushEnabled as master toggle for all notifications
 * When pushEnabled is true: all notification types are enabled
 * When pushEnabled is false: all notification types are disabled
 */
export class NotificationPreferencesDto {
  @ApiProperty({
    description: 'Master toggle for all push notifications (events, messages, cancellations)',
    example: true,
    required: false,
  })
  @IsBoolean({ message: 'pushEnabled must be a boolean value' })
  @IsOptional()
  pushEnabled?: boolean;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty({
    description: 'Current notification preferences',
    example: {
      pushEnabled: true,
    },
  })
  pushEnabled: boolean;
}

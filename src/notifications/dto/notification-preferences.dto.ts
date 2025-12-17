import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NotificationPreferencesDto {
  @ApiProperty({
    description: 'Enable/disable all push notifications',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;

  @ApiProperty({
    description: 'Receive notifications when someone requests to join your event',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  eventRequests?: boolean;

  @ApiProperty({
    description: 'Receive notifications when your event request is accepted',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  eventAccepted?: boolean;

  @ApiProperty({
    description: 'Receive notifications for new chat messages',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  newMessages?: boolean;

  @ApiProperty({
    description: 'Receive notifications when an event is cancelled',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  eventCancelled?: boolean;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty({
    description: 'Current notification preferences',
    example: {
      pushEnabled: true,
      eventRequests: true,
      eventAccepted: true,
      newMessages: true,
      eventCancelled: true,
    },
  })
  preferences: {
    pushEnabled: boolean;
    eventRequests: boolean;
    eventAccepted: boolean;
    newMessages: boolean;
    eventCancelled: boolean;
  };
}

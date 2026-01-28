import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, MaxLength, IsObject } from 'class-validator';

export class CreateBugReportDto {
  @ApiPropertyOptional({
    description: 'Optional title/summary of the bug',
    example: 'Map markers not loading',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({
    description: 'Detailed description of the bug',
    example: 'When I open the map screen, the hub markers take a long time to load and sometimes don\'t appear at all.',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'Device and app information',
    example: {
      platform: 'android',
      osVersion: '13',
      appVersion: '1.0.0',
      deviceModel: 'Pixel 6',
    },
  })
  @IsOptional()
  @IsObject()
  deviceInfo?: {
    platform?: string;
    osVersion?: string;
    appVersion?: string;
    deviceModel?: string;
  };
}

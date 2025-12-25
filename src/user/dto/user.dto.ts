import { IsString, IsOptional, IsInt, Min, Max, IsArray, IsUrl, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 28 })
  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(120)
  age?: number;

  @ApiPropertyOptional({ example: 'Digital nomad passionate about tech and travel' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'US' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ example: 'upload', enum: ['emoji', 'upload'] })
  @IsOptional()
  @IsEnum(['emoji', 'upload'])
  avatarType?: 'emoji' | 'upload';
}

export class UpdateSkillsDto {
  @ApiProperty({
    example: ['239c1e04-8a5e-4c3b-9f1e-2d3c4b5a6e7f', '7ecffb3c-9d2e-4f5a-8b6c-1e2d3c4b5a6e'],
    description: 'Array of skill UUIDs to associate with the user'
  })
  @IsArray()
  @IsString({ each: true })
  skills: string[];
}

export class UpdateAttitudesDto {
  @ApiProperty({
    example: ['5a6b7c8d-9e0f-4a1b-2c3d-4e5f6a7b8c9d', '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d'],
    description: 'Array of attitude UUIDs to associate with the user'
  })
  @IsArray()
  @IsString({ each: true })
  attitudes: string[];
}

export class UpdateInterestsDto {
  @ApiProperty({
    example: ['9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d', '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f'],
    description: 'Array of interest UUIDs to associate with the user'
  })
  @IsArray()
  @IsString({ each: true })
  interests: string[];
}

export class UpdateLanguagesDto {
  @ApiProperty({
    example: ['1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d', '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e'],
    description: 'Array of language UUIDs to associate with the user'
  })
  @IsArray()
  @IsString({ each: true })
  languages: string[];
}

export class UpdateCountriesDto {
  @ApiProperty({
    example: ['3d4e5f6a-7b8c-9d0e-1f2a-3b4c5d6e7f8a', '4e5f6a7b-8c9d-0e1f-2a3b-4c5d6e7f8a9b'],
    description: 'Array of country UUIDs to associate with the user'
  })
  @IsArray()
  @IsString({ each: true })
  countries: string[];
}

export class CompleteProfileDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: 28 })
  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(120)
  age?: number;

  @ApiPropertyOptional({ example: 'Digital nomad passionate about tech and travel' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'US' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ example: 'upload' })
  @IsOptional()
  @IsEnum(['emoji', 'upload'])
  avatarType?: 'emoji' | 'upload';

  @ApiPropertyOptional({
    example: ['239c1e04-8a5e-4c3b-9f1e-2d3c4b5a6e7f'],
    description: 'Array of skill UUIDs'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({
    example: ['5a6b7c8d-9e0f-4a1b-2c3d-4e5f6a7b8c9d'],
    description: 'Array of attitude UUIDs'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attitudes?: string[];

  @ApiPropertyOptional({
    example: ['9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d'],
    description: 'Array of interest UUIDs'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional({
    example: ['1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d'],
    description: 'Array of language UUIDs'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({
    example: ['3d4e5f6a-7b8c-9d0e-1f2a-3b4c5d6e7f8a'],
    description: 'Array of country UUIDs'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  emailVerified: boolean;

  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiPropertyOptional()
  age?: number;

  @ApiPropertyOptional()
  bio?: string;

  @ApiPropertyOptional()
  country?: string;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiPropertyOptional()
  avatarType?: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  isMfaEnabled: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  profileCompletedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  skills?: Array<{ id: string; name: string; icon: string }>;

  @ApiPropertyOptional()
  attitudes?: Array<{ id: string; name: string; icon: string }>;

  @ApiPropertyOptional()
  interests?: Array<{ id: string; name: string; icon: string }>;

  @ApiPropertyOptional()
  languages?: Array<{ id: string; name: string; icon: string }>;

  @ApiPropertyOptional()
  countries?: Array<{ id: string; name: string; icon: string }>;
}

export class UpdateLocationDto {
  @ApiProperty({ example: 'Lisbon' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'PT' })
  @IsString()
  country: string;

  @ApiPropertyOptional({ example: '38.7223' })
  @IsOptional()
  @IsString()
  latitude?: string;

  @ApiPropertyOptional({ example: '-9.1393' })
  @IsOptional()
  @IsString()
  longitude?: string;
}

export class UpdatePushTokenDto {
  @ApiProperty({
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    description: 'Expo push notification token'
  })
  @IsString()
  pushToken: string;

  @ApiPropertyOptional({
    example: 'uuid-or-device-specific-id',
    description: 'Unique device identifier'
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    example: 'ios',
    description: 'Device type (ios, android, web)'
  })
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional({
    example: 'iPhone 14 Pro',
    description: 'Device name or model'
  })
  @IsOptional()
  @IsString()
  deviceName?: string;
}
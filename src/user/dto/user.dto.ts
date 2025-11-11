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
  @ApiProperty({ example: ['web-dev', 'design', 'marketing'] })
  @IsArray()
  @IsString({ each: true })
  skills: string[];
}

export class UpdateAttitudesDto {
  @ApiProperty({ example: ['cool', 'chill', 'networking'] })
  @IsArray()
  @IsString({ each: true })
  attitudes: string[];
}

export class UpdateInterestsDto {
  @ApiProperty({ example: ['tech', 'travel', 'fitness'] })
  @IsArray()
  @IsString({ each: true })
  interests: string[];
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

  @ApiPropertyOptional({ example: ['web-dev', 'design'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ example: ['cool', 'networking'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attitudes?: string[];

  @ApiPropertyOptional({ example: ['tech', 'travel'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];
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
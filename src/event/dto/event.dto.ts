import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, IsUUID, IsInt, Min, Max, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum EventActivity {
  COFFEE = 'coffee',
  COWORK = 'cowork',
  MEAL = 'meal',
  DRINKS = 'drinks',
  WALK = 'walk',
}

export enum EventStatus {
  SCHEDULED = 'scheduled',
  MATCHED = 'matched',
  REVALIDATION_PENDING = 'revalidation_pending',
  ACTIVE = 'active',
  ON_SITE_PARTIAL = 'on_site_partial',
  ON_SITE_CONFIRMED = 'on_site_confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  CANCELLED_NO_REVALIDATION = 'cancelled_no_revalidation',
  CANCELLED_GEO_MISMATCH = 'cancelled_geo_mismatch',
  EXPIRED = 'expired',
}

export enum CheckInStatus {
  PENDING = 'pending',
  CHECKED_IN = 'checked_in',
  NO_SHOW = 'no_show',
}

export enum EventRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
}

export enum FeedbackRating {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
}

// ============================================
// CREATE EVENT
// ============================================

export class CreateEventDto {
  @ApiProperty({ description: 'Google Places ID of the hub' })
  @IsString()
  @IsNotEmpty()
  hubId: string;

  @ApiProperty({ description: 'Name of the hub' })
  @IsString()
  @IsNotEmpty()
  hubName: string;

  @ApiProperty({ description: 'Type of hub (restaurant, cafe, bar, etc.)' })
  @IsString()
  @IsNotEmpty()
  hubType: string;

  @ApiProperty({ description: 'Hub location', example: { lat: 48.8566, lng: 2.3522 } })
  @IsNotEmpty()
  hubLocation: { lat: number; lng: number };

  @ApiPropertyOptional({ description: 'Hub address' })
  @IsOptional()
  @IsString()
  hubAddress?: string;

  @ApiProperty({ enum: EventActivity, description: 'Type of activity' })
  @IsEnum(EventActivity)
  activityType: EventActivity;

  @ApiProperty({ description: 'Scheduled start time (ISO 8601 format)', example: '2026-06-14T14:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  scheduledStartTime: string;

  @ApiProperty({ description: 'Event duration in minutes', example: 120, minimum: 30, maximum: 480 })
  @IsInt()
  @Min(30)
  @Max(480)
  duration: number;
}

// ============================================
// EVENT REQUEST
// ============================================

export class CreateEventRequestDto {
  @ApiProperty({ description: 'Event ID to join' })
  @IsUUID()
  @IsNotEmpty()
  eventId: string;
}

export class RespondToEventRequestDto {
  @ApiProperty({ enum: ['accepted', 'declined'], description: 'Response to the request' })
  @IsEnum(['accepted', 'declined'])
  @IsNotEmpty()
  response: 'accepted' | 'declined';
}

// ============================================
// SEND MESSAGE
// ============================================

export class SendEventMessageDto {
  @ApiProperty({ description: 'Message content', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  content: string;
}

// ============================================
// FEEDBACK
// ============================================

export class SubmitEventFeedbackDto {
  @ApiProperty({ enum: FeedbackRating, description: 'Rating for the other user' })
  @IsEnum(FeedbackRating)
  rating: FeedbackRating;

  @ApiPropertyOptional({ description: 'Optional comment', maxLength: 500 })
  @IsOptional()
  @IsString()
  comment?: string;
}

// ============================================
// REPORT USER
// ============================================

export class ReportUserDto {
  @ApiProperty({ description: 'User ID to report' })
  @IsUUID()
  reportedId: string;

  @ApiPropertyOptional({ description: 'Event ID if related to an event' })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiProperty({ description: 'Reason for report' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  @IsOptional()
  @IsString()
  description?: string;
}

// ============================================
// BLOCK USER
// ============================================

export class BlockUserDto {
  @ApiProperty({ description: 'User ID to block' })
  @IsUUID()
  blockedId: string;

  @ApiPropertyOptional({ description: 'Reason for blocking' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ============================================
// QUERY DTOS
// ============================================

export class GetNearbyEventsDto {
  @ApiProperty({ description: 'Latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ description: 'Longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({ description: 'Search radius in meters', default: 1500 })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(5000)
  radius?: number = 1500;

  @ApiPropertyOptional({ enum: EventActivity, description: 'Filter by activity type' })
  @IsOptional()
  @IsEnum(EventActivity)
  activityType?: EventActivity;
}

export class GetEventsAtHubDto {
  @ApiProperty({ description: 'Google Places ID of the hub' })
  @IsString()
  @IsNotEmpty()
  hubId: string;

  @ApiPropertyOptional({ enum: EventActivity, description: 'Filter by activity type' })
  @IsOptional()
  @IsEnum(EventActivity)
  activityType?: EventActivity;
}

export class GetPendingRequestsDto {
  @ApiPropertyOptional({ description: 'Filter by specific event ID' })
  @IsOptional()
  @IsUUID()
  eventId?: string;
}

// ============================================
// REVALIDATION
// ============================================

export class RevalidateEventDto {
  @ApiProperty({ description: 'Confirm attendance (true) or cancel event (false)' })
  @IsBoolean()
  @IsNotEmpty()
  confirmed: boolean;

  @ApiProperty({ description: 'Current location', example: { lat: 48.8566, lng: 2.3522 } })
  @IsNotEmpty()
  location: { lat: number; lng: number };
}

// ============================================
// CHECK-IN
// ============================================

export class CheckInEventDto {
  @ApiProperty({ description: 'Current location', example: { lat: 48.8566, lng: 2.3522 } })
  @IsNotEmpty()
  location: { lat: number; lng: number };
}
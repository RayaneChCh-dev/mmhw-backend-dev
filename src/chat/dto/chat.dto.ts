import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================
// START CONVERSATION
// ============================================

export class StartConversationDto {
  @ApiProperty({ description: 'User ID to start conversation with' })
  @IsUUID()
  @IsNotEmpty()
  otherUserId: string;
}

// ============================================
// SEND MESSAGE
// ============================================

export class SendMessageDto {
  @ApiProperty({ description: 'Message content', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  content: string;
}

// ============================================
// MARK AS READ
// ============================================

export class MarkAsReadDto {
  @ApiProperty({ description: 'Message IDs to mark as read', type: [String] })
  @IsUUID('4', { each: true })
  messageIds: string[];
}
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StartConversationDto, SendMessageDto } from './dto/chat.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ============================================
  // START OR GET CONVERSATION
  // ============================================

  @Post('conversations')
  @ApiOperation({ summary: 'Start or get existing conversation with a user' })
  @ApiResponse({ status: 201, description: 'Conversation created or retrieved' })
  @ApiResponse({ status: 400, description: 'Cannot chat with yourself' })
  @ApiResponse({ status: 403, description: 'User is blocked' })
  async startConversation(
    @Request() req,
    @Body() dto: StartConversationDto
  ) {
    return this.chatService.getOrCreateConversation(req.user.userId, dto.otherUserId);
  }

  // ============================================
  // GET MY CONVERSATIONS
  // ============================================

  @Get('conversations')
  @ApiOperation({ summary: 'Get all my conversations' })
  @ApiResponse({ status: 200, description: 'Returns list of conversations' })
  async getMyConversations(@Request() req) {
    return this.chatService.getMyConversations(req.user.userId);
  }

  // ============================================
  // GET CONVERSATION MESSAGES
  // ============================================

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  @ApiResponse({ status: 200, description: 'Returns messages' })
  @ApiResponse({ status: 403, description: 'Not part of conversation' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  async getConversationMessages(
    @Request() req,
    @Param('conversationId') conversationId: string
  ) {
    return this.chatService.getConversationMessages(req.user.userId, conversationId);
  }

  // ============================================
  // SEND MESSAGE
  // ============================================

  @Post('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  @ApiResponse({ status: 403, description: 'Not part of conversation or blocked' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  async sendMessage(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto
  ) {
    return this.chatService.sendMessage(req.user.userId, conversationId, dto);
  }

  // ============================================
  // MARK AS READ
  // ============================================

  @Post('conversations/:conversationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all messages in conversation as read' })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  @ApiResponse({ status: 403, description: 'Not part of conversation' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  async markAsRead(
    @Request() req,
    @Param('conversationId') conversationId: string
  ) {
    return this.chatService.markAsRead(req.user.userId, conversationId);
  }

  // ============================================
  // DELETE CONVERSATION
  // ============================================

  @Delete('conversations/:conversationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiResponse({ status: 200, description: 'Conversation deleted' })
  @ApiResponse({ status: 403, description: 'Not part of conversation' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  async deleteConversation(
    @Request() req,
    @Param('conversationId') conversationId: string
  ) {
    return this.chatService.deleteConversation(req.user.userId, conversationId);
  }
}
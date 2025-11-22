import { Injectable, Inject, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.module';
import { conversations, messages, users, blockedUsers } from '../database/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { StartConversationDto, SendMessageDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(@Inject(DATABASE_CONNECTION) private db: any) {}

  // ============================================
  // GET OR CREATE CONVERSATION
  // ============================================

  async getOrCreateConversation(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new BadRequestException('Cannot start conversation with yourself');
    }

    // Check if users are blocking each other
    const isBlocked = await this.checkIfBlocked(userId, otherUserId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot start conversation');
    }

    // Find existing conversation
    let conversation = await this.db.query.conversations.findFirst({
      where: or(
        and(
          eq(conversations.user1Id, userId),
          eq(conversations.user2Id, otherUserId)
        ),
        and(
          eq(conversations.user1Id, otherUserId),
          eq(conversations.user2Id, userId)
        )
      ),
      with: {
        user1: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            avatarType: true,
          },
        },
        user2: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            avatarType: true,
          },
        },
      },
    });

    // Create if doesn't exist
    if (!conversation) {
      const [newConversation] = await this.db
        .insert(conversations)
        .values({
          user1Id: userId,
          user2Id: otherUserId,
        })
        .returning();

      // Fetch with relations
      conversation = await this.db.query.conversations.findFirst({
        where: eq(conversations.id, newConversation.id),
        with: {
          user1: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              avatarType: true,
            },
          },
          user2: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              avatarType: true,
            },
          },
        },
      });
    }

    return conversation;
  }

  // ============================================
  // GET MY CONVERSATIONS
  // ============================================

  async getMyConversations(userId: string) {
    const myConversations = await this.db.query.conversations.findMany({
      where: or(
        eq(conversations.user1Id, userId),
        eq(conversations.user2Id, userId)
      ),
      with: {
        user1: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            avatarType: true,
          },
        },
        user2: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            avatarType: true,
          },
        },
      },
      orderBy: [desc(conversations.lastMessageAt)],
    });

    // Transform to include other user and unread count
    return myConversations.map((conv) => {
      const isUser1 = conv.user1Id === userId;
      const otherUser = isUser1 ? conv.user2 : conv.user1;
      const unreadCount = isUser1 ? conv.user1UnreadCount : conv.user2UnreadCount;

      return {
        id: conv.id,
        otherUser,
        lastMessage: conv.lastMessageContent,
        lastMessageAt: conv.lastMessageAt,
        unreadCount,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };
    });
  }

  // ============================================
  // GET CONVERSATION MESSAGES
  // ============================================

  async getConversationMessages(userId: string, conversationId: string) {
    const conversation = await this.db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check if user is part of conversation
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('You are not part of this conversation');
    }

    // Get messages
    const conversationMessages = await this.db.query.messages.findMany({
      where: eq(messages.conversationId, conversationId),
      with: {
        sender: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            avatarType: true,
          },
        },
      },
      orderBy: [messages.createdAt],
      limit: 100, // Last 100 messages
    });

    return conversationMessages;
  }

  // ============================================
  // SEND MESSAGE
  // ============================================

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto
  ) {
    const conversation = await this.db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check if user is part of conversation
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('You are not part of this conversation');
    }

    // Check if conversation is blocked
    if (conversation.isBlocked) {
      throw new ForbiddenException('This conversation is blocked');
    }

    // Create message
    const [message] = await this.db
      .insert(messages)
      .values({
        conversationId,
        senderId: userId,
        content: dto.content,
      })
      .returning();

    // Update conversation
    const isUser1 = conversation.user1Id === userId;
    await this.db
      .update(conversations)
      .set({
        lastMessageContent: dto.content,
        lastMessageAt: new Date(),
        lastMessageSenderId: userId,
        // Increment unread count for other user
        user1UnreadCount: isUser1
          ? conversation.user1UnreadCount
          : conversation.user1UnreadCount + 1,
        user2UnreadCount: isUser1
          ? conversation.user2UnreadCount + 1
          : conversation.user2UnreadCount,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    // Fetch message with sender info
    const messageWithSender = await this.db.query.messages.findFirst({
      where: eq(messages.id, message.id),
      with: {
        sender: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            avatarType: true,
          },
        },
      },
    });

    // TODO: Send push notification to other user
    // const otherUserId = isUser1 ? conversation.user2Id : conversation.user1Id;
    // this.notificationsService.sendNewMessage(otherUserId, userId, dto.content);

    return messageWithSender;
  }

  // ============================================
  // MARK MESSAGES AS READ
  // ============================================

  async markAsRead(userId: string, conversationId: string) {
    const conversation = await this.db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check if user is part of conversation
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('You are not part of this conversation');
    }

    // Mark unread messages as read
    await this.db
      .update(messages)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          sql`${messages.senderId} != ${userId}`,
          eq(messages.isRead, false)
        )
      );

    // Reset unread count
    const isUser1 = conversation.user1Id === userId;
    await this.db
      .update(conversations)
      .set({
        user1UnreadCount: isUser1 ? 0 : conversation.user1UnreadCount,
        user2UnreadCount: isUser1 ? conversation.user2UnreadCount : 0,
      })
      .where(eq(conversations.id, conversationId));

    return { message: 'Messages marked as read' };
  }

  // ============================================
  // DELETE CONVERSATION
  // ============================================

  async deleteConversation(userId: string, conversationId: string) {
    const conversation = await this.db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check if user is part of conversation
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('You are not part of this conversation');
    }

    // Delete conversation (cascade will delete messages)
    await this.db
      .delete(conversations)
      .where(eq(conversations.id, conversationId));

    return { message: 'Conversation deleted' };
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  private async checkIfBlocked(userId: string, otherUserId: string): Promise<boolean> {
    const block = await this.db.query.blockedUsers.findFirst({
      where: or(
        and(
          eq(blockedUsers.blockerId, userId),
          eq(blockedUsers.blockedId, otherUserId)
        ),
        and(
          eq(blockedUsers.blockerId, otherUserId),
          eq(blockedUsers.blockedId, userId)
        )
      ),
    });

    return !!block;
  }
}
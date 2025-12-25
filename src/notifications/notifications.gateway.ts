import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * WebSocket Gateway for real-time notifications
 * Handles socket connections, user authentication, and real-time event broadcasting
 */
@WebSocketGateway({
  cors: {
    origin: '*', // Configure based on your CORS_ORIGINS env variable
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Map of userId -> socketId for efficient user lookups
  private userSockets = new Map<string, string>();

  // Map of socketId -> userId for cleanup on disconnect
  private socketUsers = new Map<string, string>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Called after WebSocket server initialization
   */
  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  /**
   * Handle new client connections
   * Authenticates user via JWT token in handshake
   */
  async handleConnection(client: Socket) {
    try {
      // Extract token from handshake auth or query params
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        client.handshake.query?.token;

      if (!token) {
        throw new UnauthorizedException('No authentication token provided');
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const userId = payload.sub || payload.userId;

      if (!userId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // Store user-socket mapping
      this.userSockets.set(userId, client.id);
      this.socketUsers.set(client.id, userId);

      // Store userId in socket data for easy access
      client.data.userId = userId;

      this.logger.debug(`Client connected: ${client.id} (User: ${userId})`);

      // Send connection confirmation to client
      client.emit('connected', {
        message: 'Successfully connected to notifications',
        userId,
      });
    } catch (error) {
      this.logger.error(`Connection authentication failed: ${error.message}`);
      client.emit('error', {
        message: 'Authentication failed',
        error: error.message,
      });
      client.disconnect();
    }
  }

  /**
   * Handle client disconnections
   */
  handleDisconnect(client: Socket) {
    const userId = this.socketUsers.get(client.id);

    if (userId) {
      this.userSockets.delete(userId);
      this.socketUsers.delete(client.id);
      this.logger.debug(`Client disconnected: ${client.id} (User: ${userId})`);
    } else {
      this.logger.debug(`Client disconnected: ${client.id}`);
    }
  }

  /**
   * Handle ping messages from clients (for connection health checks)
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() });
  }

  /**
   * Emit event request notification to event creator
   */
  emitEventRequest(creatorId: string, data: {
    eventId: string;
    requesterId: string;
    requesterName: string;
    event: any;
  }) {
    const socketId = this.userSockets.get(creatorId);

    if (socketId) {
      this.server.to(socketId).emit('event_request', {
        type: 'event_request',
        ...data,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`Emitted event_request to user ${creatorId}`);
    } else {
      this.logger.debug(`User ${creatorId} not connected, skipping real-time notification`);
    }
  }

  /**
   * Emit request accepted notification to participant
   */
  emitRequestAccepted(participantId: string, data: {
    eventId: string;
    creatorId: string;
    creatorName: string;
    event: any;
  }) {
    const socketId = this.userSockets.get(participantId);

    if (socketId) {
      this.server.to(socketId).emit('request_accepted', {
        type: 'request_accepted',
        ...data,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`Emitted request_accepted to user ${participantId}`);
    } else {
      this.logger.debug(`User ${participantId} not connected, skipping real-time notification`);
    }
  }

  /**
   * Emit new message notification to recipient
   */
  emitNewMessage(recipientId: string, data: {
    eventId: string;
    senderId: string;
    senderName: string;
    message: any;
  }) {
    const socketId = this.userSockets.get(recipientId);

    if (socketId) {
      this.server.to(socketId).emit('new_message', {
        type: 'new_message',
        ...data,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`Emitted new_message to user ${recipientId}`);
    } else {
      this.logger.debug(`User ${recipientId} not connected, skipping real-time notification`);
    }
  }

  /**
   * Emit event cancelled notification to participant
   */
  emitEventCancelled(participantId: string, data: {
    eventId: string;
    event: any;
  }) {
    const socketId = this.userSockets.get(participantId);

    if (socketId) {
      this.server.to(socketId).emit('event_cancelled', {
        type: 'event_cancelled',
        ...data,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`Emitted event_cancelled to user ${participantId}`);
    } else {
      this.logger.debug(`User ${participantId} not connected, skipping real-time notification`);
    }
  }

  /**
   * Emit revalidation request notification to creator
   */
  emitRevalidationRequest(creatorId: string, data: {
    eventId: string;
    event: any;
  }) {
    const socketId = this.userSockets.get(creatorId);

    if (socketId) {
      this.server.to(socketId).emit('revalidation_request', {
        type: 'revalidation_request',
        ...data,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`Emitted revalidation_request to user ${creatorId}`);
    } else {
      this.logger.debug(`User ${creatorId} not connected, skipping real-time notification`);
    }
  }

  /**
   * Emit user checked in notification
   */
  emitUserCheckedIn(recipientId: string, data: {
    eventId: string;
    userId: string;
    userName?: string;
  }) {
    const socketId = this.userSockets.get(recipientId);

    if (socketId) {
      this.server.to(socketId).emit('user_checked_in', {
        type: 'user_checked_in',
        ...data,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`Emitted user_checked_in to user ${recipientId}`);
    } else {
      this.logger.debug(`User ${recipientId} not connected, skipping real-time notification`);
    }
  }

  /**
   * Emit both users checked in notification
   */
  emitBothCheckedIn(userId: string, data: {
    eventId: string;
  }) {
    const socketId = this.userSockets.get(userId);

    if (socketId) {
      this.server.to(socketId).emit('both_checked_in', {
        type: 'both_checked_in',
        ...data,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`Emitted both_checked_in to user ${userId}`);
    } else {
      this.logger.debug(`User ${userId} not connected, skipping real-time notification`);
    }
  }

  /**
   * Emit feedback reminder notification
   */
  emitFeedbackReminder(userId: string, data: {
    eventId: string;
    event: any;
  }) {
    const socketId = this.userSockets.get(userId);

    if (socketId) {
      this.server.to(socketId).emit('feedback_reminder', {
        type: 'feedback_reminder',
        ...data,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`Emitted feedback_reminder to user ${userId}`);
    } else {
      this.logger.debug(`User ${userId} not connected, skipping real-time notification`);
    }
  }

  /**
   * Get connection status for a user
   */
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  /**
   * Get number of connected clients
   */
  getConnectedCount(): number {
    return this.userSockets.size;
  }
}

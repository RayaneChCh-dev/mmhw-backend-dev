import { Injectable, Inject, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { DATABASE_CONNECTION } from '../database/database.module';
import { users } from '../database/schema';
import { eq } from 'drizzle-orm';

/**
 * NotificationsService handles push notifications via Expo
 * and coordinates with WebSocket gateway for real-time updates
 */
@Injectable()
export class NotificationsService {
  private expo: Expo;
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Inject(DATABASE_CONNECTION) private db: any) {
    this.expo = new Expo();
  }

  /**
   * Send notification when someone requests to join an event
   * @param creatorId - Event creator's user ID
   * @param requesterId - User who requested to join
   * @param event - Event details
   */
  async sendEventRequest(creatorId: string, requesterId: string, event: any) {
    try {
      // Get requester details
      const requester = await this.db.query.users.findFirst({
        where: eq(users.id, requesterId),
        columns: {
          firstName: true,
          avatar: true,
          avatarType: true,
        },
      });

      const title = '🤝 New Event Request';
      const body = `${requester?.firstName || 'Someone'} wants to join your ${event.activityType} at ${event.hubName}`;
      const data = {
        type: 'event_request',
        eventId: event.id,
        requesterId,
        requesterName: requester?.firstName,
      };

      await this.sendPushNotification(creatorId, title, body, data);
    } catch (error) {
      this.logger.error(`Failed to send event request notification: ${error.message}`);
    }
  }

  /**
   * Send notification when event request is accepted
   * @param participantId - User whose request was accepted
   * @param creatorId - Event creator's user ID
   * @param event - Event details
   */
  async sendEventAccepted(participantId: string, creatorId: string, event: any) {
    try {
      // Get creator details
      const creator = await this.db.query.users.findFirst({
        where: eq(users.id, creatorId),
        columns: {
          firstName: true,
          avatar: true,
          avatarType: true,
        },
      });

      const title = '🎉 Request Accepted!';
      const body = `${creator?.firstName || 'The creator'} accepted your request! Chat is now open for ${event.hubName}`;
      const data = {
        type: 'request_accepted',
        eventId: event.id,
        creatorId,
        creatorName: creator?.firstName,
      };

      await this.sendPushNotification(participantId, title, body, data);
    } catch (error) {
      this.logger.error(`Failed to send event accepted notification: ${error.message}`);
    }
  }

  /**
   * Send notification for new chat message
   * @param recipientId - User receiving the message
   * @param senderId - User who sent the message
   * @param messageContent - Message text
   * @param eventId - Event ID
   */
  async sendNewMessage(recipientId: string, senderId: string, messageContent: string, eventId: string) {
    try {
      // Get sender details
      const sender = await this.db.query.users.findFirst({
        where: eq(users.id, senderId),
        columns: {
          firstName: true,
          avatar: true,
          avatarType: true,
        },
      });

      const title = `💬 ${sender?.firstName || 'Someone'}`;
      const body = messageContent.length > 100
        ? messageContent.substring(0, 100) + '...'
        : messageContent;

      const data = {
        type: 'new_message',
        eventId,
        senderId,
        senderName: sender?.firstName,
      };

      await this.sendPushNotification(recipientId, title, body, data);
    } catch (error) {
      this.logger.error(`Failed to send new message notification: ${error.message}`);
    }
  }

  /**
   * Send notification when event is cancelled
   * @param participantId - Participant to notify
   * @param event - Event details
   */
  async sendEventCancelled(participantId: string, event: any) {
    try {
      const title = '❌ Event Cancelled';
      const body = `The ${event.activityType} at ${event.hubName} has been cancelled by the creator`;
      const data = {
        type: 'event_cancelled',
        eventId: event.id,
      };

      await this.sendPushNotification(participantId, title, body, data);
    } catch (error) {
      this.logger.error(`Failed to send event cancelled notification: ${error.message}`);
    }
  }

  /**
   * Core method to send push notification to a user
   * @param userId - Target user ID
   * @param title - Notification title
   * @param body - Notification body
   * @param data - Additional data payload
   */
  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data: Record<string, any>,
  ) {
    try {
      // Get user's push token and notification preferences
      const user = await this.db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          pushToken: true,
          notificationPreferences: true,
        },
      });

      if (!user?.pushToken) {
        this.logger.debug(`No push token found for user ${userId}`);
        return;
      }

      // Check if push notifications are enabled globally
      const preferences = user.notificationPreferences || {
        pushEnabled: true,
        eventRequests: true,
        eventAccepted: true,
        newMessages: true,
        eventCancelled: true,
      };

      if (!preferences.pushEnabled) {
        this.logger.debug(`Push notifications disabled for user ${userId}`);
        return;
      }

      // Check specific notification type preferences
      const notificationType = data.type;
      if (notificationType === 'event_request' && !preferences.eventRequests) {
        this.logger.debug(`Event request notifications disabled for user ${userId}`);
        return;
      }
      if (notificationType === 'request_accepted' && !preferences.eventAccepted) {
        this.logger.debug(`Request accepted notifications disabled for user ${userId}`);
        return;
      }
      if (notificationType === 'new_message' && !preferences.newMessages) {
        this.logger.debug(`New message notifications disabled for user ${userId}`);
        return;
      }
      if (notificationType === 'event_cancelled' && !preferences.eventCancelled) {
        this.logger.debug(`Event cancelled notifications disabled for user ${userId}`);
        return;
      }

      // Validate push token
      if (!Expo.isExpoPushToken(user.pushToken)) {
        this.logger.warn(`Invalid push token for user ${userId}: ${user.pushToken}`);
        return;
      }

      // Create message
      const message: ExpoPushMessage = {
        to: user.pushToken,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        channelId: 'default', // For Android
      };

      // Send notification
      const chunks = this.expo.chunkPushNotifications([message]);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          this.logger.error(`Error sending push notification chunk: ${error.message}`);
        }
      }

      // Check for errors in tickets
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          this.logger.error(
            `Push notification error: ${ticket.message} (${ticket.details?.error})`,
          );

          // If token is invalid, clear it from database
          if (ticket.details?.error === 'DeviceNotRegistered') {
            await this.db
              .update(users)
              .set({ pushToken: null })
              .where(eq(users.id, userId));
            this.logger.debug(`Cleared invalid push token for user ${userId}`);
          }
        }
      }

      this.logger.debug(`Push notification sent to user ${userId}: ${title}`);
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user's push token
   * @param userId - User ID
   * @param pushToken - Expo push token
   */
  async updatePushToken(userId: string, pushToken: string) {
    try {
      // Validate token format
      if (!Expo.isExpoPushToken(pushToken)) {
        throw new Error('Invalid Expo push token format');
      }

      await this.db
        .update(users)
        .set({ pushToken })
        .where(eq(users.id, userId));

      this.logger.debug(`Push token updated for user ${userId}`);
      return { message: 'Push token updated successfully' };
    } catch (error) {
      this.logger.error(`Failed to update push token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove user's push token (e.g., on logout)
   * @param userId - User ID
   */
  async removePushToken(userId: string) {
    try {
      await this.db
        .update(users)
        .set({ pushToken: null })
        .where(eq(users.id, userId));

      this.logger.debug(`Push token removed for user ${userId}`);
      return { message: 'Push token removed successfully' };
    } catch (error) {
      this.logger.error(`Failed to remove push token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's notification preferences
   * @param userId - User ID
   */
  async getNotificationPreferences(userId: string) {
    try {
      const user = await this.db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          notificationPreferences: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Default preferences
      const defaultPreferences = {
        pushEnabled: true,
        eventRequests: true,
        eventAccepted: true,
        newMessages: true,
        eventCancelled: true,
      };

      // Merge with user preferences to ensure all fields are present
      return {
        preferences: {
          ...defaultPreferences,
          ...(user.notificationPreferences || {}),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get notification preferences: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user's notification preferences
   * @param userId - User ID
   * @param preferences - New preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<{
      pushEnabled: boolean;
      eventRequests: boolean;
      eventAccepted: boolean;
      newMessages: boolean;
      eventCancelled: boolean;
    }>,
  ) {
    try {
      // Get current preferences
      const currentPrefs = await this.getNotificationPreferences(userId);

      // Merge with new preferences
      const updatedPreferences = {
        ...currentPrefs.preferences,
        ...preferences,
      };

      // Update in database
      await this.db
        .update(users)
        .set({ notificationPreferences: updatedPreferences })
        .where(eq(users.id, userId));

      this.logger.debug(`Notification preferences updated for user ${userId}`);
      return {
        message: 'Notification preferences updated successfully',
        preferences: updatedPreferences,
      };
    } catch (error) {
      this.logger.error(`Failed to update notification preferences: ${error.message}`);
      throw error;
    }
  }
}

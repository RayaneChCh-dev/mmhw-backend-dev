import { Injectable, Inject, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { DATABASE_CONNECTION } from '../database/database.module';
import { users, userDevices } from '../database/schema';
import { eq, ne } from 'drizzle-orm';

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

      // CRITICAL: Pass requesterId as senderId to prevent requester from receiving notification
      await this.sendPushNotification(creatorId, title, body, data, requesterId);
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

      // CRITICAL: Pass creatorId as senderId to prevent creator from receiving notification
      await this.sendPushNotification(participantId, title, body, data, creatorId);
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

      // CRITICAL: Pass senderId to prevent sender from receiving their own message notification
      await this.sendPushNotification(recipientId, title, body, data, senderId);
    } catch (error) {
      this.logger.error(`Failed to send new message notification: ${error.message}`);
    }
  }

  /**
   * Send notification when event is cancelled
   * @param participantId - Participant to notify
   * @param event - Event details
   * @param creatorId - Optional creator ID (sender) to exclude from notifications
   */
  async sendEventCancelled(participantId: string, event: any, creatorId?: string) {
    try {
      const title = '❌ Event Cancelled';
      const body = `The ${event.activityType} at ${event.hubName} has been cancelled by the creator`;
      const data = {
        type: 'event_cancelled',
        eventId: event.id,
      };

      // CRITICAL: Pass creatorId as senderId to prevent creator from receiving notification
      await this.sendPushNotification(participantId, title, body, data, creatorId);
    } catch (error) {
      this.logger.error(`Failed to send event cancelled notification: ${error.message}`);
    }
  }

  /**
   * Send revalidation request notification (T-30min)
   * @param creatorId - Event creator's user ID
   * @param event - Event details
   */
  async sendRevalidationRequest(creatorId: string, event: any) {
    try {
      const title = '⏰ Event Revalidation Required';
      const body = `Your event is starting in 30 minutes at ${event.hubName}. Are you still going?`;
      const data = {
        type: 'revalidation_request',
        eventId: event.id,
        scheduledStartTime: event.scheduledStartTime,
      };

      await this.sendPushNotification(creatorId, title, body, data);
    } catch (error) {
      this.logger.error(`Failed to send revalidation request notification: ${error.message}`);
    }
  }

  /**
   * Send notification when creator confirms revalidation
   * @param participantId - Participant to notify
   * @param event - Event details
   */
  async sendRevalidationConfirmed(participantId: string, event: any) {
    try {
      const title = '✅ Event Confirmed';
      const body = `The creator confirmed attendance for ${event.activityType} at ${event.hubName}. See you soon!`;
      const data = {
        type: 'revalidation_confirmed',
        eventId: event.id,
      };

      await this.sendPushNotification(participantId, title, body, data);
    } catch (error) {
      this.logger.error(`Failed to send revalidation confirmed notification: ${error.message}`);
    }
  }

  /**
   * Send notification when a user checks in
   * @param recipientId - User receiving the notification
   * @param event - Event details
   * @param checkedInUserId - User who checked in
   * @param checkedInUserName - Name of user who checked in
   */
  async sendUserCheckedIn(recipientId: string, event: any, checkedInUserId: string, checkedInUserName?: string) {
    try {
      const title = '📍 Partner Arrived';
      const body = `${checkedInUserName || 'Your partner'} is on site at ${event.hubName}, awaiting for you`;
      const data = {
        type: 'user_checked_in',
        eventId: event.id,
        checkedInUserId,
      };

      await this.sendPushNotification(recipientId, title, body, data, checkedInUserId);
    } catch (error) {
      this.logger.error(`Failed to send user checked in notification: ${error.message}`);
    }
  }

  /**
   * Send notification when both users check in
   * @param userId - User to notify
   * @param event - Event details
   * @param otherUserName - Name of the other user
   */
  async sendBothCheckedIn(userId: string, event: any, otherUserName?: string) {
    try {
      const title = '🎉 You are both on site!';
      const body = `Good ${event.activityType}!`;
      const data = {
        type: 'both_checked_in',
        eventId: event.id,
      };

      await this.sendPushNotification(userId, title, body, data);
    } catch (error) {
      this.logger.error(`Failed to send both checked in notification: ${error.message}`);
    }
  }

  /**
   * Send feedback reminder notification when event duration expires
   * @param userId - User to notify
   * @param event - Event details
   * @param otherUserName - Name of the other user
   */
  async sendFeedbackReminder(userId: string, event: any, otherUserName?: string) {
    try {
      const title = '⭐ How was your experience?';
      const body = `Your ${event.activityType} at ${event.hubName} has ended. Please rate your experience${otherUserName ? ` with ${otherUserName}` : ''}!`;
      const data = {
        type: 'feedback_reminder',
        eventId: event.id,
      };

      await this.sendPushNotification(userId, title, body, data);
    } catch (error) {
      this.logger.error(`Failed to send feedback reminder notification: ${error.message}`);
    }
  }

  /**
   * Get all valid push tokens for a user (from all their devices)
   * Excludes the sender if senderId is provided
   * @param userId - User ID to get tokens for
   * @param senderId - Optional sender ID to exclude (CRITICAL for preventing self-notifications)
   */
  private async getUserPushTokens(userId: string, senderId?: string): Promise<string[]> {
    // CRITICAL: If userId is the same as senderId, return empty array
    // This prevents users from receiving notifications about their own actions
    if (senderId && userId === senderId) {
      this.logger.debug(`Excluding sender ${senderId} from receiving their own notification`);
      return [];
    }

    const tokens: string[] = [];

    // Get tokens from user_devices table (new approach)
    const devices = await this.db.query.userDevices.findMany({
      where: eq(userDevices.userId, userId),
      columns: {
        pushToken: true,
      },
    });

    tokens.push(...devices.map(d => d.pushToken));

    // Get legacy push token from users table (for backward compatibility)
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        pushToken: true,
      },
    });

    if (user?.pushToken && !tokens.includes(user.pushToken)) {
      tokens.push(user.pushToken);
    }

    return tokens.filter(token => token && Expo.isExpoPushToken(token));
  }

  /**
   * Core method to send push notification to a user
   * @param userId - Target user ID
   * @param title - Notification title
   * @param body - Notification body
   * @param data - Additional data payload
   * @param senderId - Optional sender ID to exclude from recipients (CRITICAL!)
   */
  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data: Record<string, any>,
    senderId?: string,
  ) {
    try {
      // CRITICAL: Check if userId is the sender - if so, DON'T send notification
      if (senderId && userId === senderId) {
        this.logger.debug(`Skipping notification for sender ${senderId}`);
        return;
      }

      // Get user's notification preferences
      const user = await this.db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          notificationPreferences: true,
        },
      });

      if (!user) {
        this.logger.debug(`User ${userId} not found`);
        return;
      }

      // Check if push notifications are enabled globally
      const preferences = user.notificationPreferences || { pushEnabled: true };

      if (!preferences.pushEnabled) {
        this.logger.debug(`Push notifications disabled for user ${userId}`);
        return;
      }

      // Get all valid push tokens for this user (excluding sender)
      const pushTokens = await this.getUserPushTokens(userId, senderId);

      if (pushTokens.length === 0) {
        this.logger.debug(`No push tokens found for user ${userId}`);
        return;
      }

      // Create messages for all devices
      const messages: ExpoPushMessage[] = pushTokens.map(token => ({
        to: token,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        channelId: 'default', // For Android
      }));

      // Send notifications
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          this.logger.error(`Error sending push notification chunk: ${error.message}`);
        }
      }

      // Check for errors in tickets and clean up invalid tokens
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const token = pushTokens[i];

        if (ticket.status === 'error') {
          this.logger.error(
            `Push notification error for token ${token}: ${ticket.message} (${ticket.details?.error})`,
          );

          // If token is invalid, remove it from database
          if (ticket.details?.error === 'DeviceNotRegistered') {
            // Remove from user_devices table
            await this.db
              .delete(userDevices)
              .where(eq(userDevices.pushToken, token));

            // Also clear from users table if it matches
            await this.db
              .update(users)
              .set({ pushToken: null })
              .where(eq(users.pushToken, token));

            this.logger.debug(`Removed invalid push token: ${token}`);
          }
        }
      }

      this.logger.debug(`Push notification sent to user ${userId} (${pushTokens.length} devices): ${title}`);
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
   * Simplified to return only pushEnabled (master toggle for all notifications)
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

      // Default preference: pushEnabled = true
      const defaultPreferences = {
        pushEnabled: true,
      };

      // Return pushEnabled from user preferences or default
      return {
        pushEnabled: user.notificationPreferences?.pushEnabled ?? defaultPreferences.pushEnabled,
      };
    } catch (error) {
      this.logger.error(`Failed to get notification preferences: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user's notification preferences
   * Simplified to only update pushEnabled (master toggle for all notifications)
   * @param userId - User ID
   * @param preferences - Object containing pushEnabled boolean
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: { pushEnabled?: boolean },
  ) {
    try {
      // Validate that pushEnabled field is provided
      if (preferences.pushEnabled === undefined) {
        throw new Error('pushEnabled field must be provided');
      }

      // Log the update request for debugging
      this.logger.debug(
        `Updating notification preferences for user ${userId}: ${JSON.stringify(preferences)}`
      );

      // Simple update - just set pushEnabled
      const updatedPreferences = {
        pushEnabled: preferences.pushEnabled,
      };

      // Update in database
      await this.db
        .update(users)
        .set({ notificationPreferences: updatedPreferences })
        .where(eq(users.id, userId));

      this.logger.debug(
        `Notification preferences successfully updated for user ${userId}: ${JSON.stringify(updatedPreferences)}`
      );

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

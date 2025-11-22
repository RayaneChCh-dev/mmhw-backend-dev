import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { events, eventChats, eventMessages, eventRequests, userStats } from '../../database/schema';
import { eq, and, lte, inArray } from 'drizzle-orm';

@Injectable()
export class EventsCronService {
  private readonly logger = new Logger(EventsCronService.name);

  constructor(@Inject(DATABASE_CONNECTION) private db: any) {}

  // ============================================
  // EXPIRE EVENTS (Every minute)
  // ============================================

  @Cron(CronExpression.EVERY_MINUTE)
  async expireEvents() {
    try {
      const now = new Date();

      // Find expired events that are still active or matched
      const expiredEvents = await this.db
        .update(events)
        .set({ status: 'expired' })
        .where(
          and(
            lte(events.expiresAt, now),
            inArray(events.status, ['active', 'matched'])
          )
        )
        .returning({ id: events.id });

      if (expiredEvents.length > 0) {
        this.logger.log(`Expired ${expiredEvents.length} events`);
      }
    } catch (error) {
      this.logger.error('Failed to expire events', error);
    }
  }

  // ============================================
  // DELETE OLD CHATS (Every hour)
  // ============================================

  @Cron(CronExpression.EVERY_HOUR)
  async deleteOldChats() {
    try {
      const now = new Date();

      // Find expired chats
      const expiredChats = await this.db.query.eventChats.findMany({
        where: lte(eventChats.expiresAt, now),
        columns: { id: true },
      });

      if (expiredChats.length === 0) return;

      const chatIds = expiredChats.map(c => c.id);

      // Delete messages first (due to foreign key)
      await this.db
        .delete(eventMessages)
        .where(inArray(eventMessages.chatId, chatIds));

      // Delete chats
      await this.db
        .delete(eventChats)
        .where(inArray(eventChats.id, chatIds));

      this.logger.log(`Deleted ${expiredChats.length} expired chats`);
    } catch (error) {
      this.logger.error('Failed to delete old chats', error);
    }
  }

  // ============================================
  // DELETE OLD EVENTS (Daily at 3 AM)
  // ============================================

  @Cron('0 3 * * *')
  async deleteOldEvents() {
    try {
      // Delete events older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const deletedEvents = await this.db
        .delete(events)
        .where(
          and(
            lte(events.createdAt, sevenDaysAgo),
            inArray(events.status, ['completed', 'cancelled', 'expired'])
          )
        )
        .returning({ id: events.id });

      if (deletedEvents.length > 0) {
        this.logger.log(`Deleted ${deletedEvents.length} old events`);
      }
    } catch (error) {
      this.logger.error('Failed to delete old events', error);
    }
  }

  // ============================================
  // DECLINE PENDING REQUESTS (Every 30 minutes)
  // ============================================

  @Cron('*/30 * * * *')
  async declinePendingRequests() {
    try {
      // Auto-decline requests older than 15 minutes
      const fifteenMinutesAgo = new Date();
      fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);

      const declinedRequests = await this.db
        .update(eventRequests)
        .set({ 
          status: 'declined',
          respondedAt: new Date(),
        })
        .where(
          and(
            eq(eventRequests.status, 'pending'),
            lte(eventRequests.createdAt, fifteenMinutesAgo)
          )
        )
        .returning({ id: eventRequests.id });

      if (declinedRequests.length > 0) {
        this.logger.log(`Auto-declined ${declinedRequests.length} old pending requests`);
      }
    } catch (error) {
      this.logger.error('Failed to decline pending requests', error);
    }
  }

  // ============================================
  // UNSUSPEND USERS (Every hour)
  // ============================================

  @Cron(CronExpression.EVERY_HOUR)
  async unsuspendUsers() {
    try {
      const now = new Date();

      const unsuspended = await this.db
        .update(userStats)
        .set({
          isSuspended: false,
          suspendedUntil: null,
        })
        .where(
          and(
            eq(userStats.isSuspended, true),
            lte(userStats.suspendedUntil, now)
          )
        )
        .returning({ userId: userStats.userId });

      if (unsuspended.length > 0) {
        this.logger.log(`Unsuspended ${unsuspended.length} users`);
      }
    } catch (error) {
      this.logger.error('Failed to unsuspend users', error);
    }
  }
}
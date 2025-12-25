import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { events, eventChats, eventMessages, eventRequests, userStats, users } from '../../database/schema';
import { eq, and, lte, gte, inArray, isNull, sql } from 'drizzle-orm';

const REVALIDATION_MINUTES_BEFORE = 30;
const REVALIDATION_TIMEOUT_MINUTES = 10;
const FEEDBACK_REMINDER_HOURS = 24; // Auto-complete after 24 hours without feedback

@Injectable()
export class EventsCronService {
  private readonly logger = new Logger(EventsCronService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private db: any,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  // ============================================
  // EXPIRE EVENTS (Every minute)
  // ============================================

  @Cron(CronExpression.EVERY_MINUTE)
  async expireEvents() {
    try {
      const now = new Date();

      // Find scheduled events that never got matched (past expiration time)
      const expiredEvents = await this.db
        .update(events)
        .set({ status: 'expired' })
        .where(
          and(
            eq(events.status, 'scheduled'),
            lte(events.expiresAt, now)
          )
        )
        .returning({ id: events.id });

      if (expiredEvents.length > 0) {
        this.logger.log(`Expired ${expiredEvents.length} unmatched events`);
      }
    } catch (error) {
      this.logger.error('Failed to expire events', error);
    }
  }

  // ============================================
  // SEND REVALIDATION NOTIFICATIONS (Every minute)
  // ============================================

  @Cron(CronExpression.EVERY_MINUTE)
  async sendRevalidationNotifications() {
    try {
      const now = new Date();
      const revalidationTime = new Date(now.getTime() + REVALIDATION_MINUTES_BEFORE * 60 * 1000);

      // Find matched events that need revalidation (T-30min)
      const eventsNeedingRevalidation = await this.db.query.events.findMany({
        where: and(
          eq(events.status, 'matched'),
          lte(events.scheduledStartTime, revalidationTime),
          gte(events.scheduledStartTime, now)
        ),
        with: {
          creator: {
            columns: {
              id: true,
              firstName: true,
            },
          },
          participant: {
            columns: {
              id: true,
              firstName: true,
            },
          },
        },
      });

      for (const event of eventsNeedingRevalidation) {
        // Update status to revalidation_pending
        await this.db
          .update(events)
          .set({
            status: 'revalidation_pending',
            revalidationSentAt: now,
          })
          .where(eq(events.id, event.id));

        // Send notification to creator
        await this.notificationsService.sendRevalidationRequest(event.creatorId, event);
        this.notificationsGateway.emitRevalidationRequest(event.creatorId, {
          eventId: event.id,
          event,
        });

        this.logger.log(`Sent revalidation notification for event ${event.id}`);
      }

      if (eventsNeedingRevalidation.length > 0) {
        this.logger.log(`Sent ${eventsNeedingRevalidation.length} revalidation notifications`);
      }
    } catch (error) {
      this.logger.error('Failed to send revalidation notifications', error);
    }
  }

  // ============================================
  // CHECK REVALIDATION TIMEOUTS (Every minute)
  // ============================================

  @Cron(CronExpression.EVERY_MINUTE)
  async checkRevalidationTimeouts() {
    try {
      const now = new Date();
      const timeoutThreshold = new Date(now.getTime() - REVALIDATION_TIMEOUT_MINUTES * 60 * 1000);

      // Find events with timed-out revalidation
      const timedOutEvents = await this.db.query.events.findMany({
        where: and(
          eq(events.status, 'revalidation_pending'),
          lte(events.revalidationSentAt, timeoutThreshold)
        ),
        with: {
          participant: true,
        },
      });

      for (const event of timedOutEvents) {
        // Cancel event due to no revalidation
        await this.db
          .update(events)
          .set({ status: 'cancelled_no_revalidation' })
          .where(eq(events.id, event.id));

        // Notify participant
        if (event.participantId) {
          await this.notificationsService.sendEventCancelled(event.participantId, event);
          this.notificationsGateway.emitEventCancelled(event.participantId, {
            eventId: event.id,
            event,
          });
        }

        this.logger.log(`Cancelled event ${event.id} due to revalidation timeout`);
      }

      if (timedOutEvents.length > 0) {
        this.logger.log(`Cancelled ${timedOutEvents.length} events due to revalidation timeout`);
      }
    } catch (error) {
      this.logger.error('Failed to check revalidation timeouts', error);
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
            inArray(events.status, [
              'completed',
              'cancelled',
              'cancelled_no_revalidation',
              'cancelled_geo_mismatch',
              'expired'
            ])
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

  // ============================================
  // SEND FEEDBACK REMINDERS (Every 5 minutes)
  // ============================================

  @Cron('*/5 * * * *')
  async sendFeedbackReminders() {
    try {
      const now = new Date();

      // Find events that are on_site_confirmed and past their end time (scheduledStartTime + duration)
      // but haven't had feedback reminder sent yet
      const eventsNeedingReminder = await this.db.query.events.findMany({
        where: and(
          eq(events.status, 'on_site_confirmed'),
          isNull(events.feedbackReminderSentAt)
        ),
        with: {
          creator: {
            columns: {
              id: true,
              firstName: true,
            },
          },
          participant: {
            columns: {
              id: true,
              firstName: true,
            },
          },
        },
      });

      for (const event of eventsNeedingReminder) {
        // Calculate end time (scheduledStartTime + duration in minutes)
        const endTime = new Date(event.scheduledStartTime);
        endTime.setMinutes(endTime.getMinutes() + event.duration);

        // If current time is past end time, send feedback reminder
        if (now >= endTime) {
          // Mark feedback reminder as sent
          await this.db
            .update(events)
            .set({
              feedbackReminderSentAt: now,
            })
            .where(eq(events.id, event.id));

          // Send notification to both users
          await this.notificationsService.sendFeedbackReminder(
            event.creatorId,
            event,
            event.participant?.firstName
          );
          this.notificationsGateway.emitFeedbackReminder(event.creatorId, {
            eventId: event.id,
            event,
          });

          if (event.participantId) {
            await this.notificationsService.sendFeedbackReminder(
              event.participantId,
              event,
              event.creator?.firstName
            );
            this.notificationsGateway.emitFeedbackReminder(event.participantId, {
              eventId: event.id,
              event,
            });
          }

          this.logger.log(`Sent feedback reminder for event ${event.id}`);
        }
      }

      if (eventsNeedingReminder.length > 0) {
        this.logger.log(`Processed ${eventsNeedingReminder.length} events for feedback reminders`);
      }
    } catch (error) {
      this.logger.error('Failed to send feedback reminders', error);
    }
  }

  // ============================================
  // AUTO-COMPLETE EVENTS (Every hour)
  // ============================================

  @Cron(CronExpression.EVERY_HOUR)
  async autoCompleteEvents() {
    try {
      const now = new Date();
      const autoCompleteThreshold = new Date(now.getTime() - FEEDBACK_REMINDER_HOURS * 60 * 60 * 1000);

      // Find events that had feedback reminder sent 24+ hours ago and still not completed
      const eventsToComplete = await this.db.query.events.findMany({
        where: and(
          eq(events.status, 'on_site_confirmed'),
          lte(events.feedbackReminderSentAt, autoCompleteThreshold)
        ),
        with: {
          creator: true,
          participant: true,
        },
      });

      for (const event of eventsToComplete) {
        // Auto-complete the event
        await this.db
          .update(events)
          .set({
            status: 'completed',
            completedAt: now,
          })
          .where(eq(events.id, event.id));

        // Award completion points even without feedback
        await this.db
          .update(userStats)
          .set({
            eventsCompleted: sql`${userStats.eventsCompleted} + 1`,
          })
          .where(eq(userStats.userId, event.creatorId));

        if (event.participantId) {
          await this.db
            .update(userStats)
            .set({
              eventsCompleted: sql`${userStats.eventsCompleted} + 1`,
            })
            .where(eq(userStats.userId, event.participantId));
        }

        this.logger.log(`Auto-completed event ${event.id} after 24 hours without feedback`);
      }

      if (eventsToComplete.length > 0) {
        this.logger.log(`Auto-completed ${eventsToComplete.length} events`);
      }
    } catch (error) {
      this.logger.error('Failed to auto-complete events', error);
    }
  }
}
import { Injectable, Inject, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.module';
import {
  events,
  eventRequests,
  eventChats,
  eventMessages,
  userStats,
  eventFeedback,
  blockedUsers,
  userReports,
  users
} from '../database/schema';
import { eq, and, gte, lte, sql, isNull, inArray } from 'drizzle-orm';
import {
  CreateEventDto,
  CreateEventRequestDto,
  RespondToEventRequestDto,
  SendEventMessageDto,
  SubmitEventFeedbackDto,
  GetNearbyEventsDto,
  GetEventsAtHubDto,
  EventStatus,
  EventRequestStatus,
  FeedbackRating,
  ReportUserDto,
  BlockUserDto,
} from './dto/event.dto';

const MESSAGE_LIMIT = 5; // Messages per person
const EVENT_DURATION_HOURS = 2; // Default event duration

@Injectable()
export class EventsService {
  constructor(@Inject(DATABASE_CONNECTION) private db: any) {}

  // ============================================
  // CREATE EVENT
  // ============================================
  
  async createEvent(userId: string, dto: CreateEventDto) {
    // Check if user has suspension
    const stats = await this.getUserStats(userId);
    if (stats?.isSuspended && stats.suspendedUntil && new Date(stats.suspendedUntil) > new Date()) {
      throw new ForbiddenException('Your account is temporarily suspended from creating events');
    }

    // Check if user already has an active event
    const existingEvent = await this.db.query.events.findFirst({
      where: and(
        eq(events.creatorId, userId),
        eq(events.status, 'active')
      ),
    });

    if (existingEvent) {
      throw new BadRequestException('You already have an active event. Cancel it first.');
    }

    // Calculate expiration based on time of day
    const expiresAt = this.calculateExpiration();

    // Create event
    const [event] = await this.db
      .insert(events)
      .values({
        creatorId: userId,
        hubId: dto.hubId,
        hubName: dto.hubName,
        hubType: dto.hubType,
        hubLocation: dto.hubLocation,
        hubAddress: dto.hubAddress,
        activityType: dto.activityType,
        expiresAt,
      })
      .returning();

    // Update user stats
    await this.incrementStats(userId, { eventsCreated: 1 });
    await this.addPoints(userId, 5); // 5 points for creating event

    return this.enrichEventWithUser(event);
  }

  // ============================================
  // GET NEARBY EVENTS
  // ============================================
  
  async getNearbyEvents(userId: string, dto: GetNearbyEventsDto) {
    const { latitude, longitude, radius = 1500, activityType } = dto;

    // Get blocked users
    const blocked = await this.getBlockedUserIds(userId);

    // Query events with distance calculation
    const nearbyEvents = await this.db.query.events.findMany({
      where: and(
        eq(events.status, 'active'),
        gte(events.expiresAt, new Date()),
        // Exclude own events and blocked users
        sql`${events.creatorId} != ${userId}`,
        blocked.length > 0 ? sql`${events.creatorId} NOT IN (${blocked})` : undefined,
        activityType ? eq(events.activityType, activityType) : undefined
      ),
      with: {
        creator: {
          columns: {
            id: true,
            firstName: true,
            avatar: true,
            avatarType: true,
          },
          with: {
            stats: true,
          },
        },
      },
      limit: 50,
    });

    // Filter by distance (haversine formula)
    const filteredEvents = nearbyEvents.filter(event => {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        event.hubLocation.lat,
        event.hubLocation.lng
      );
      return distance <= radius;
    });

    return filteredEvents;
  }

  // ============================================
  // GET EVENTS AT HUB
  // ============================================
  
  async getEventsAtHub(userId: string, dto: GetEventsAtHubDto) {
    const blocked = await this.getBlockedUserIds(userId);

    const hubEvents = await this.db.query.events.findMany({
      where: and(
        eq(events.hubId, dto.hubId),
        eq(events.status, 'active'),
        gte(events.expiresAt, new Date()),
        sql`${events.creatorId} != ${userId}`,
        blocked.length > 0 ? sql`${events.creatorId} NOT IN (${blocked})` : undefined,
        dto.activityType ? eq(events.activityType, dto.activityType) : undefined
      ),
      with: {
        creator: {
          columns: {
            id: true,
            firstName: true,
            avatar: true,
            avatarType: true,
          },
          with: {
            stats: true,
          },
        },
      },
    });

    return hubEvents;
  }

  // ============================================
  // REQUEST TO JOIN EVENT
  // ============================================
  
  async requestToJoinEvent(userId: string, dto: CreateEventRequestDto) {
    const event = await this.db.query.events.findFirst({
      where: eq(events.id, dto.eventId),
      with: { creator: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.status !== 'active') {
      throw new BadRequestException('Event is no longer active');
    }

    if (event.creatorId === userId) {
      throw new BadRequestException('You cannot join your own event');
    }

    if (event.expiresAt < new Date()) {
      throw new BadRequestException('Event has expired');
    }

    // Check if already requested
    const existingRequest = await this.db.query.eventRequests.findFirst({
      where: and(
        eq(eventRequests.eventId, dto.eventId),
        eq(eventRequests.requesterId, userId)
      ),
    });

    if (existingRequest) {
      throw new BadRequestException('You already requested to join this event');
    }

    // Create request
    const [request] = await this.db
      .insert(eventRequests)
      .values({
        eventId: dto.eventId,
        requesterId: userId,
      })
      .returning();

    // TODO: Send push notification to event creator
    // this.notificationsService.sendEventRequest(event.creatorId, userId, event);

    return request;
  }

  // ============================================
  // RESPOND TO EVENT REQUEST
  // ============================================
  
  async respondToEventRequest(userId: string, requestId: string, dto: RespondToEventRequestDto) {
    const request = await this.db.query.eventRequests.findFirst({
      where: eq(eventRequests.id, requestId),
      with: { 
        event: true,
        requester: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.event.creatorId !== userId) {
      throw new ForbiddenException('You can only respond to requests for your own events');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Request has already been responded to');
    }

    // Update request
    await this.db
      .update(eventRequests)
      .set({
        status: dto.response === 'accepted' ? 'accepted' : 'declined',
        respondedAt: new Date(),
      })
      .where(eq(eventRequests.id, requestId));

    if (dto.response === 'accepted') {
      // Update event
      await this.db
        .update(events)
        .set({
          status: 'matched',
          participantId: request.requesterId,
          matchedAt: new Date(),
        })
        .where(eq(events.id, request.eventId));

      // Decline all other pending requests
      await this.db
        .update(eventRequests)
        .set({
          status: 'declined',
          respondedAt: new Date(),
        })
        .where(and(
          eq(eventRequests.eventId, request.eventId),
          eq(eventRequests.status, 'pending'),
          sql`${eventRequests.id} != ${requestId}`
        ));

      // Create chat
      const chatExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
      await this.db
        .insert(eventChats)
        .values({
          eventId: request.eventId,
          expiresAt: chatExpiresAt,
        });

      // Update stats
      await this.incrementStats(request.requesterId, { eventsJoined: 1 });
      await this.addPoints(userId, 10); // Creator gets points for accepting
      await this.addPoints(request.requesterId, 10); // Requester gets points

      // TODO: Send notification to requester
      // this.notificationsService.sendEventAccepted(request.requesterId, userId, request.event);
    }

    return { message: `Request ${dto.response}` };
  }

  // ============================================
  // GET MY EVENTS
  // ============================================
  
  async getMyEvents(userId: string) {
    const myEvents = await this.db.query.events.findMany({
      where: and(
        sql`(${events.creatorId} = ${userId} OR ${events.participantId} = ${userId})`,
        inArray(events.status, ['active', 'matched'])
      ),
      with: {
        creator: {
          columns: {
            id: true,
            firstName: true,
            avatar: true,
            avatarType: true,
          },
        },
        participant: {
          columns: {
            id: true,
            firstName: true,
            avatar: true,
            avatarType: true,
          },
        },
        chat: true,
      },
      orderBy: (events, { desc }) => [desc(events.createdAt)],
    });

    return myEvents;
  }

  // ============================================
  // GET EVENT CHAT
  // ============================================
  
  async getEventChat(userId: string, eventId: string) {
    const event = await this.db.query.events.findFirst({
      where: eq(events.id, eventId),
      with: {
        creator: {
          columns: {
            id: true,
            firstName: true,
            avatar: true,
            avatarType: true,
          },
        },
        participant: {
          columns: {
            id: true,
            firstName: true,
            avatar: true,
            avatarType: true,
          },
        },
        chat: {
          with: {
            messages: {
              with: {
                sender: {
                  columns: {
                    id: true,
                    firstName: true,
                    avatar: true,
                    avatarType: true,
                  },
                },
              },
              orderBy: (messages, { asc }) => [asc(messages.createdAt)],
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.creatorId !== userId && event.participantId !== userId) {
      throw new ForbiddenException('You are not part of this event');
    }

    return event;
  }

  // ============================================
  // SEND MESSAGE
  // ============================================
  
  async sendMessage(userId: string, eventId: string, dto: SendEventMessageDto) {
    const event = await this.db.query.events.findFirst({
      where: eq(events.id, eventId),
      with: { chat: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.creatorId !== userId && event.participantId !== userId) {
      throw new ForbiddenException('You are not part of this event');
    }

    if (!event.chat) {
      throw new BadRequestException('Chat not available yet');
    }

    if (event.chat.isLocked) {
      throw new BadRequestException('Chat is locked. Time to meet in person!');
    }

    const isCreator = event.creatorId === userId;
    const currentCount = isCreator 
      ? event.chat.creatorMessageCount 
      : event.chat.participantMessageCount;

    if (currentCount >= MESSAGE_LIMIT) {
      throw new BadRequestException('Message limit reached');
    }

    // Create message
    const [message] = await this.db
      .insert(eventMessages)
      .values({
        chatId: event.chat.id,
        senderId: userId,
        content: dto.content,
        messageNumber: currentCount + 1,
      })
      .returning();

    // Update counter
    if (isCreator) {
      await this.db
        .update(eventChats)
        .set({ creatorMessageCount: currentCount + 1 })
        .where(eq(eventChats.id, event.chat.id));
    } else {
      await this.db
        .update(eventChats)
        .set({ participantMessageCount: currentCount + 1 })
        .where(eq(eventChats.id, event.chat.id));
    }

    // Check if both hit limit → lock chat
    const updatedChat = await this.db.query.eventChats.findFirst({
      where: eq(eventChats.id, event.chat.id),
    });

    if (
      updatedChat.creatorMessageCount >= MESSAGE_LIMIT &&
      updatedChat.participantMessageCount >= MESSAGE_LIMIT
    ) {
      await this.lockChat(event.chat.id);
    }

    // TODO: Send push notification to other user
    const otherUserId = isCreator ? event.participantId : event.creatorId;
    // this.notificationsService.sendNewMessage(otherUserId, userId, message.content);

    return message;
  }

  // ============================================
  // CANCEL EVENT
  // ============================================
  
  async cancelEvent(userId: string, eventId: string) {
    const event = await this.db.query.events.findFirst({
      where: eq(events.id, eventId),
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.creatorId !== userId) {
      throw new ForbiddenException('You can only cancel your own events');
    }

    if (event.status !== 'active' && event.status !== 'matched') {
      throw new BadRequestException('Event cannot be cancelled');
    }

    await this.db
      .update(events)
      .set({ status: 'cancelled' })
      .where(eq(events.id, eventId));

    await this.incrementStats(userId, { eventsCancelled: 1 });

    // TODO: Notify participant if matched
    if (event.participantId) {
      // this.notificationsService.sendEventCancelled(event.participantId, event);
    }

    return { message: 'Event cancelled' };
  }

  // ============================================
  // COMPLETE EVENT & SUBMIT FEEDBACK
  // ============================================
  
  async submitFeedback(userId: string, eventId: string, dto: SubmitEventFeedbackDto) {
    const event = await this.db.query.events.findFirst({
      where: eq(events.id, eventId),
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.creatorId !== userId && event.participantId !== userId) {
      throw new ForbiddenException('You are not part of this event');
    }

    if (event.status !== 'matched') {
      throw new BadRequestException('Event must be matched to submit feedback');
    }

    const toUserId = event.creatorId === userId ? event.participantId : event.creatorId;

    // Check if already submitted
    const existing = await this.db.query.eventFeedback.findFirst({
      where: and(
        eq(eventFeedback.eventId, eventId),
        eq(eventFeedback.fromUserId, userId)
      ),
    });

    if (existing) {
      throw new BadRequestException('Feedback already submitted');
    }

    // Submit feedback
    await this.db
      .insert(eventFeedback)
      .values({
        eventId,
        fromUserId: userId,
        toUserId,
        rating: dto.rating,
        comment: dto.comment,
      });

    // Update stats for the other user
    const ratingField = 
      dto.rating === 'positive' ? 'positiveRatings' :
      dto.rating === 'neutral' ? 'neutralRatings' :
      'negativeRatings';
    
    await this.incrementStats(toUserId, { [ratingField]: 1 });

    // Check if both submitted feedback
    const allFeedback = await this.db.query.eventFeedback.findMany({
      where: eq(eventFeedback.eventId, eventId),
    });

    if (allFeedback.length === 2) {
      // Both submitted → complete event
      await this.db
        .update(events)
        .set({ 
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(events.id, eventId));

      // Award completion points and update streaks
      await this.incrementStats(event.creatorId, { eventsCompleted: 1 });
      await this.incrementStats(event.participantId, { eventsCompleted: 1 });
      await this.addPoints(event.creatorId, 20);
      await this.addPoints(event.participantId, 20);
      await this.updateStreak(event.creatorId);
      await this.updateStreak(event.participantId);
    }

    return { message: 'Feedback submitted' };
  }

  // ============================================
  // BLOCK USER
  // ============================================
  
  async blockUser(userId: string, dto: BlockUserDto) {
    if (userId === dto.blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    // Check if already blocked
    const existing = await this.db.query.blockedUsers.findFirst({
      where: and(
        eq(blockedUsers.blockerId, userId),
        eq(blockedUsers.blockedId, dto.blockedId)
      ),
    });

    if (existing) {
      throw new BadRequestException('User already blocked');
    }

    await this.db
      .insert(blockedUsers)
      .values({
        blockerId: userId,
        blockedId: dto.blockedId,
        reason: dto.reason,
      });

    return { message: 'User blocked' };
  }

  // ============================================
  // REPORT USER
  // ============================================
  
  async reportUser(userId: string, dto: ReportUserDto) {
    if (userId === dto.reportedId) {
      throw new BadRequestException('You cannot report yourself');
    }

    await this.db
      .insert(userReports)
      .values({
        reporterId: userId,
        reportedId: dto.reportedId,
        eventId: dto.eventId,
        reason: dto.reason,
        description: dto.description,
      });

    // Increment report counter
    await this.incrementStats(dto.reportedId, { reportsReceived: 1 });
    await this.incrementStats(userId, { reportsMade: 1 });

    // Auto-suspend if too many reports
    const reportedStats = await this.getUserStats(dto.reportedId);
    if (reportedStats && reportedStats.reportsReceived >= 5) {
      const suspendedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await this.db
        .update(userStats)
        .set({ 
          isSuspended: true,
          suspendedUntil,
        })
        .where(eq(userStats.userId, dto.reportedId));
    }

    return { message: 'Report submitted' };
  }

  // ============================================
  // GET USER STATS
  // ============================================
  
  async getUserStats(userId: string) {
    let stats = await this.db.query.userStats.findFirst({
      where: eq(userStats.userId, userId),
    });

    if (!stats) {
      // Create stats if doesn't exist
      [stats] = await this.db
        .insert(userStats)
        .values({ userId })
        .returning();
    }

    return stats;
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  private async lockChat(chatId: string) {
    await this.db
      .update(eventChats)
      .set({ 
        isLocked: true, 
        lockedAt: new Date() 
      })
      .where(eq(eventChats.id, chatId));
  }

  private calculateExpiration(): Date {
    const now = new Date();
    const hour = now.getHours();
    
    let hoursToAdd: number;
    if (hour >= 6 && hour < 12) hoursToAdd = 1; // Morning
    else if (hour >= 12 && hour < 18) hoursToAdd = 2; // Afternoon
    else if (hour >= 18 && hour < 24) hoursToAdd = 1.5; // Evening
    else hoursToAdd = 0.5; // Late night
    
    return new Date(now.getTime() + hoursToAdd * 60 * 60 * 1000);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocked = await this.db.query.blockedUsers.findMany({
      where: eq(blockedUsers.blockerId, userId),
      columns: { blockedId: true },
    });
    return blocked.map(b => b.blockedId);
  }

  private async enrichEventWithUser(event: any) {
    const creator = await this.db.query.users.findFirst({
      where: eq(users.id, event.creatorId),
      columns: {
        id: true,
        firstName: true,
        avatar: true,
        avatarType: true,
      },
      with: { stats: true },
    });

    return { ...event, creator };
  }

  private async incrementStats(userId: string, fields: Partial<typeof userStats.$inferInsert>) {
    const stats = await this.getUserStats(userId);
    
    const updates: any = {};
    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === 'number') {
        updates[key] = stats[key] + value;
      }
    }

    await this.db
      .update(userStats)
      .set(updates)
      .where(eq(userStats.userId, userId));
  }

  private async addPoints(userId: string, points: number) {
    await this.db
      .update(userStats)
      .set({ totalPoints: sql`${userStats.totalPoints} + ${points}` })
      .where(eq(userStats.userId, userId));
  }

  private async updateStreak(userId: string) {
    const stats = await this.getUserStats(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastMeetup = stats.lastMeetupDate ? new Date(stats.lastMeetupDate) : null;
    
    if (lastMeetup) {
      lastMeetup.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - lastMeetup.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        // Consecutive day → increment streak
        const newStreak = stats.currentStreak + 1;
        await this.db
          .update(userStats)
          .set({
            currentStreak: newStreak,
            longestStreak: Math.max(newStreak, stats.longestStreak),
            lastMeetupDate: today,
          })
          .where(eq(userStats.userId, userId));
      } else if (diffDays > 1) {
        // Streak broken → reset
        await this.db
          .update(userStats)
          .set({
            currentStreak: 1,
            lastMeetupDate: today,
          })
          .where(eq(userStats.userId, userId));
      }
    } else {
      // First meetup
      await this.db
        .update(userStats)
        .set({
          currentStreak: 1,
          longestStreak: 1,
          lastMeetupDate: today,
        })
        .where(eq(userStats.userId, userId));
    }
  }
}
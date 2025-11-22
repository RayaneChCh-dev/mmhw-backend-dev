import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  json,
  numeric,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm/sql';

// Enums
export const userRoleEnum = pgEnum('user_role', ['user', 'admin', 'moderator']);
export const accountTypeEnum = pgEnum('account_type', ['email', 'google', 'apple']);
export const mediaTypeEnum = pgEnum('media_type', ['image', 'video']);
export const eventStatusEnum = pgEnum('event_status', ['active', 'matched', 'completed', 'cancelled', 'expired']);
export const eventActivityEnum = pgEnum('event_activity', ['coffee', 'cowork', 'meal', 'drinks', 'walk']);
export const eventRequestStatusEnum = pgEnum('event_request_status', ['pending', 'accepted', 'declined', 'cancelled']);
export const feedbackRatingEnum = pgEnum('feedback_rating', ['positive', 'neutral', 'negative']);

// Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  phone: varchar('phone', { length: 20 }),
  phoneVerified: boolean('phone_verified').default(false),
  password: text('password').notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  age: integer('age'),
  bio: text('bio'),
  country: varchar('country', { length: 2 }), // ISO country code
  avatar: text('avatar'), // URL or emoji ID
  avatarType: varchar('avatar_type', { length: 10 }), // 'emoji' | 'upload'
  role: userRoleEnum('role').default('user'),
  isActive: boolean('is_active').default(true),
  isMfaEnabled: boolean('is_mfa_enabled').default(false),
  mfaSecret: text('mfa_secret'),
  lastLoginAt: timestamp('last_login_at'),
  profileCompletedAt: timestamp('profile_completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User Skills (Many-to-Many relationship)
export const skills = pgTable('skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  icon: varchar('icon', { length: 10 }),
  category: varchar('category', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userSkills = pgTable('user_skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  skillId: uuid('skill_id')
    .notNull()
    .references(() => skills.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// User Attitudes
export const attitudes = pgTable('attitudes', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  icon: varchar('icon', { length: 10 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userAttitudes = pgTable('user_attitudes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  attitudeId: uuid('attitude_id')
    .notNull()
    .references(() => attitudes.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// User Interests
export const interests = pgTable('interests', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  icon: varchar('icon', { length: 10 }),
  category: varchar('category', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userInterests = pgTable('user_interests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  interestId: uuid('interest_id')
    .notNull()
    .references(() => interests.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Refresh Tokens
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  revokedAt: timestamp('revoked_at'),
});

// OTP Codes (for email verification and password reset)
export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  code: varchar('code', { length: 6 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'email_verification', 'password_reset', 'phone_verification'
  expiresAt: timestamp('expires_at').notNull(),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Sessions
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  lastActivityAt: timestamp('last_activity_at').defaultNow(),
});

// User Locations (for nomad tracking)
export const userLocations = pgTable('user_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 2 }),
  latitude: varchar('latitude', { length: 20 }),
  longitude: varchar('longitude', { length: 20 }),
  isCurrent: boolean('is_current').default(true),
  startDate: timestamp('start_date').defaultNow(),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// EVENT SYSTEM TABLES
// ============================================

// Events Table
export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  // Hub information (from Google Places)
  hubId: varchar('hub_id', { length: 255 }).notNull(), // Google Places ID
  hubName: varchar('hub_name', { length: 255 }).notNull(),
  hubType: varchar('hub_type', { length: 50 }).notNull(), // restaurant, cafe, bar, etc.
  hubLocation: json('hub_location').notNull().$type<{ lat: number; lng: number }>(),
  hubAddress: text('hub_address'),
  
  // Event details
  activityType: eventActivityEnum('activity_type').notNull(),
  status: eventStatusEnum('status').default('active').notNull(),
  
  // Participant info
  participantId: uuid('participant_id').references(() => users.id, { onDelete: 'cascade' }),
  matchedAt: timestamp('matched_at'),
  completedAt: timestamp('completed_at'),
  
  // Timing
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  statusIdx: index('idx_events_status').on(table.status),
  hubIdIdx: index('idx_events_hub_id').on(table.hubId),
  creatorIdx: index('idx_events_creator').on(table.creatorId),
  expiresIdx: index('idx_events_expires').on(table.expiresAt),
}));

// Event Requests (for handshake)
export const eventRequests = pgTable('event_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  requesterId: uuid('requester_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: eventRequestStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  respondedAt: timestamp('responded_at'),
}, (table) => ({
  uniqueRequest: uniqueIndex('unique_event_request').on(table.eventId, table.requesterId),
  eventIdx: index('idx_event_requests_event').on(table.eventId),
  requesterIdx: index('idx_event_requests_requester').on(table.requesterId),
}));

// Event Chats
export const eventChats = pgTable('event_chats', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' })
    .unique(),
  
  // Message counts for limit enforcement
  creatorMessageCount: integer('creator_message_count').default(0).notNull(),
  participantMessageCount: integer('participant_message_count').default(0).notNull(),
  
  // Lock state
  isLocked: boolean('is_locked').default(false).notNull(),
  lockedAt: timestamp('locked_at'),
  
  // Timing
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
});

// Event Messages
export const eventMessages = pgTable('event_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatId: uuid('chat_id')
    .notNull()
    .references(() => eventChats.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  content: text('content').notNull(),
  
  // For message limit enforcement
  messageNumber: integer('message_number').notNull(),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  chatIdx: index('idx_event_messages_chat').on(table.chatId),
}));

// User Stats (for gamification)
export const userStats = pgTable('user_stats', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  // Points & streaks
  totalPoints: integer('total_points').default(0).notNull(),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  lastMeetupDate: timestamp('last_meetup_date', { mode: 'date' }),
  
  // Counts
  eventsCreated: integer('events_created').default(0).notNull(),
  eventsJoined: integer('events_joined').default(0).notNull(),
  eventsCompleted: integer('events_completed').default(0).notNull(),
  eventsCancelled: integer('events_cancelled').default(0).notNull(),
  noShows: integer('no_shows').default(0).notNull(),
  
  // Ratings
  positiveRatings: integer('positive_ratings').default(0).notNull(),
  neutralRatings: integer('neutral_ratings').default(0).notNull(),
  negativeRatings: integer('negative_ratings').default(0).notNull(),
  
  // Safety
  reportsReceived: integer('reports_received').default(0).notNull(),
  reportsMade: integer('reports_made').default(0).notNull(),
  isSuspended: boolean('is_suspended').default(false).notNull(),
  suspendedUntil: timestamp('suspended_until'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Event Feedback
export const eventFeedback = pgTable('event_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  fromUserId: uuid('from_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  toUserId: uuid('to_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  rating: feedbackRatingEnum('rating').notNull(),
  comment: text('comment'),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueFeedback: uniqueIndex('unique_event_feedback').on(table.eventId, table.fromUserId),
}));

// Blocked Users
export const blockedUsers = pgTable('blocked_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  blockerId: uuid('blocker_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  blockedId: uuid('blocked_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueBlock: uniqueIndex('unique_block').on(table.blockerId, table.blockedId),
}));

// User Reports
export const userReports = pgTable('user_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reporterId: uuid('reporter_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  reportedId: uuid('reported_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
  
  reason: varchar('reason', { length: 50 }).notNull(), // harassment, inappropriate, spam, etc.
  description: text('description'),
  
  // Admin review
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, reviewed, actioned
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  actionTaken: text('action_taken'),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  reporterIdx: index('idx_reports_reporter').on(table.reporterId),
  reportedIdx: index('idx_reports_reported').on(table.reportedId),
  statusIdx: index('idx_reports_status').on(table.status),
}));

// ============================================
// RELATIONS
// ============================================

export const usersRelations = relations(users, ({ many, one }) => ({
  skills: many(userSkills),
  attitudes: many(userAttitudes),
  interests: many(userInterests),
  refreshTokens: many(refreshTokens),
  sessions: many(sessions),
  locations: many(userLocations),
  createdEvents: many(events, { relationName: 'creator' }),
  joinedEvents: many(events, { relationName: 'participant' }),
  eventRequests: many(eventRequests),
  sentMessages: many(eventMessages),
  stats: one(userStats),
  feedbackGiven: many(eventFeedback, { relationName: 'feedbackFrom' }),
  feedbackReceived: many(eventFeedback, { relationName: 'feedbackTo' }),
  blockedUsers: many(blockedUsers, { relationName: 'blocker' }),
  blockedBy: many(blockedUsers, { relationName: 'blocked' }),
  reportsMade: many(userReports, { relationName: 'reporter' }),
  reportsReceived: many(userReports, { relationName: 'reported' }),
  conversationsAsUser1: many(conversations, { relationName: 'conversationsAsUser1' }),
  conversationsAsUser2: many(conversations, { relationName: 'conversationsAsUser2' }),
  sentEventMessages: many(messages),
}));

export const skillsRelations = relations(skills, ({ many }) => ({
  users: many(userSkills),
}));

export const attitudesRelations = relations(attitudes, ({ many }) => ({
  users: many(userAttitudes),
}));

export const interestsRelations = relations(interests, ({ many }) => ({
  users: many(userInterests),
}));

export const userSkillsRelations = relations(userSkills, ({ one }) => ({
  user: one(users, {
    fields: [userSkills.userId],
    references: [users.id],
  }),
  skill: one(skills, {
    fields: [userSkills.skillId],
    references: [skills.id],
  }),
}));

export const userAttitudesRelations = relations(userAttitudes, ({ one }) => ({
  user: one(users, {
    fields: [userAttitudes.userId],
    references: [users.id],
  }),
  attitude: one(attitudes, {
    fields: [userAttitudes.attitudeId],
    references: [attitudes.id],
  }),
}));

export const userInterestsRelations = relations(userInterests, ({ one }) => ({
  user: one(users, {
    fields: [userInterests.userId],
    references: [users.id],
  }),
  interest: one(interests, {
    fields: [userInterests.interestId],
    references: [interests.id],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  creator: one(users, {
    fields: [events.creatorId],
    references: [users.id],
    relationName: 'creator',
  }),
  participant: one(users, {
    fields: [events.participantId],
    references: [users.id],
    relationName: 'participant',
  }),
  requests: many(eventRequests),
  chat: one(eventChats),
  feedback: many(eventFeedback),
}));

export const eventRequestsRelations = relations(eventRequests, ({ one }) => ({
  event: one(events, {
    fields: [eventRequests.eventId],
    references: [events.id],
  }),
  requester: one(users, {
    fields: [eventRequests.requesterId],
    references: [users.id],
  }),
}));

export const eventChatsRelations = relations(eventChats, ({ one, many }) => ({
  event: one(events, {
    fields: [eventChats.eventId],
    references: [events.id],
  }),
  messages: many(eventMessages),
}));

export const eventMessagesRelations = relations(eventMessages, ({ one }) => ({
  chat: one(eventChats, {
    fields: [eventMessages.chatId],
    references: [eventChats.id],
  }),
  sender: one(users, {
    fields: [eventMessages.senderId],
    references: [users.id],
  }),
}));

export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(users, {
    fields: [userStats.userId],
    references: [users.id],
  }),
}));

export const eventFeedbackRelations = relations(eventFeedback, ({ one }) => ({
  event: one(events, {
    fields: [eventFeedback.eventId],
    references: [events.id],
  }),
  fromUser: one(users, {
    fields: [eventFeedback.fromUserId],
    references: [users.id],
    relationName: 'feedbackFrom',
  }),
  toUser: one(users, {
    fields: [eventFeedback.toUserId],
    references: [users.id],
    relationName: 'feedbackTo',
  }),
}));

export const blockedUsersRelations = relations(blockedUsers, ({ one }) => ({
  blocker: one(users, {
    fields: [blockedUsers.blockerId],
    references: [users.id],
    relationName: 'blocker',
  }),
  blocked: one(users, {
    fields: [blockedUsers.blockedId],
    references: [users.id],
    relationName: 'blocked',
  }),
}));

export const userReportsRelations = relations(userReports, ({ one }) => ({
  reporter: one(users, {
    fields: [userReports.reporterId],
    references: [users.id],
    relationName: 'reporter',
  }),
  reported: one(users, {
    fields: [userReports.reportedId],
    references: [users.id],
    relationName: 'reported',
  }),
  event: one(events, {
    fields: [userReports.eventId],
    references: [events.id],
  }),
  reviewer: one(users, {
    fields: [userReports.reviewedBy],
    references: [users.id],
  }),
}));

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Participants (always store in order: user1_id < user2_id lexicographically)
  user1Id: uuid('user1_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  user2Id: uuid('user2_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  // Last message info (for conversation list preview)
  lastMessageContent: text('last_message_content'),
  lastMessageAt: timestamp('last_message_at'),
  lastMessageSenderId: uuid('last_message_sender_id'),
  
  // Unread counts per user
  user1UnreadCount: integer('user1_unread_count').default(0).notNull(),
  user2UnreadCount: integer('user2_unread_count').default(0).notNull(),
  
  // Blocking (if either user blocks, conversation becomes inactive)
  isBlocked: boolean('is_blocked').default(false).notNull(),
  blockedBy: uuid('blocked_by').references(() => users.id),
  blockedAt: timestamp('blocked_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Unique constraint: ensure only one conversation between two users
  // Uses LEAST/GREATEST to normalize user order
  uniqueConversation: uniqueIndex('unique_conversation_users').on(
    sql`LEAST(${table.user1Id}::text, ${table.user2Id}::text)`,
    sql`GREATEST(${table.user1Id}::text, ${table.user2Id}::text)`
  ),
  
  // Indexes for efficient queries
  user1Idx: index('idx_conversations_user1').on(table.user1Id),
  user2Idx: index('idx_conversations_user2').on(table.user2Id),
  lastMessageIdx: index('idx_conversations_last_message').on(table.lastMessageAt),
}));

// ============================================
// MESSAGES TABLE
// ============================================

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Foreign keys
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  // Content
  content: text('content').notNull(),
  
  // Read status
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Indexes for efficient queries
  conversationIdx: index('idx_messages_conversation').on(table.conversationId),
  senderIdx: index('idx_messages_sender').on(table.senderId),
  createdIdx: index('idx_messages_created').on(table.createdAt),
  // Composite index for unread messages query
  conversationUnreadIdx: index('idx_messages_conversation_unread').on(
    table.conversationId,
    table.isRead
  ),
}));

// ============================================
// RELATIONS
// ============================================

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  // User relations
  user1: one(users, {
    fields: [conversations.user1Id],
    references: [users.id],
    relationName: 'conversationsAsUser1',
  }),
  user2: one(users, {
    fields: [conversations.user2Id],
    references: [users.id],
    relationName: 'conversationsAsUser2',
  }),
  
  // Messages in this conversation
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  // Parent conversation
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  
  // Message sender
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));
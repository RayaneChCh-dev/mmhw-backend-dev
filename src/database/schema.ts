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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['user', 'admin', 'moderator']);
export const accountTypeEnum = pgEnum('account_type', ['email', 'google', 'apple']);
export const mediaTypeEnum = pgEnum('media_type', ['image', 'video']);

// Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  skills: many(userSkills),
  attitudes: many(userAttitudes),
  interests: many(userInterests),
  refreshTokens: many(refreshTokens),
  sessions: many(sessions),
  locations: many(userLocations),
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
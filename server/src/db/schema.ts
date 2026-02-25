import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// --- Users ---
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: text('role', { enum: ['owner', 'user'] }).notNull().default('user'),
  public_key: text('public_key'),
  encrypted_group_key: text('encrypted_group_key'),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// --- Sessions ---
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull().references(() => users.id),
  refresh_token_hash: text('refresh_token_hash').notNull(),
  expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('idx_sessions_user_id').on(table.user_id),
]);

// --- Invites ---
export const invites = sqliteTable('invites', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  token: text('token').notNull().unique(),
  created_by: text('created_by').notNull().references(() => users.id),
  revoked: integer('revoked', { mode: 'boolean' }).notNull().default(false),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// --- Bans ---
export const bans = sqliteTable('bans', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull().references(() => users.id),
  banned_by: text('banned_by').notNull().references(() => users.id),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('idx_bans_user_id').on(table.user_id),
]);

// --- Channels ---
export const channels = sqliteTable('channels', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  type: text('type', { enum: ['text', 'voice'] }).notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('idx_channels_type').on(table.type),
]);

// --- Messages ---
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  channel_id: text('channel_id').notNull().references(() => channels.id),
  user_id: text('user_id').notNull().references(() => users.id),
  encrypted_content: text('encrypted_content').notNull(),
  nonce: text('nonce').notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_messages_channel_id').on(table.channel_id),
  index('idx_messages_created_at').on(table.created_at),
]);

// --- Inferred Types ---
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

export type Invite = InferSelectModel<typeof invites>;
export type NewInvite = InferInsertModel<typeof invites>;

export type Ban = InferSelectModel<typeof bans>;
export type NewBan = InferInsertModel<typeof bans>;

export type Channel = InferSelectModel<typeof channels>;
export type NewChannel = InferInsertModel<typeof channels>;

export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;

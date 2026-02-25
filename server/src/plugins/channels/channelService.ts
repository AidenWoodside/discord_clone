import { eq, sql } from 'drizzle-orm';
import { MAX_CHANNELS_PER_SERVER } from 'discord-clone-shared';
import { channels, messages } from '../../db/schema.js';
import type { AppDatabase } from '../../db/connection.js';

export function getAllChannels(db: AppDatabase) {
  return db.select({
    id: channels.id,
    name: channels.name,
    type: channels.type,
    createdAt: channels.created_at,
  }).from(channels).all();
}

export function createChannel(db: AppDatabase, name: string, type: 'text' | 'voice') {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 50) {
    throw new ChannelValidationError('Channel name must be between 1 and 50 characters');
  }

  const countResult = db.select({ count: sql<number>`count(*)` }).from(channels).get();
  if (countResult && countResult.count >= MAX_CHANNELS_PER_SERVER) {
    throw new ChannelValidationError(`Channel limit reached (max ${MAX_CHANNELS_PER_SERVER})`);
  }

  const existing = db.select({ id: channels.id }).from(channels).where(eq(channels.name, trimmed)).get();
  if (existing) {
    throw new ChannelValidationError('A channel with this name already exists');
  }

  return db.insert(channels).values({
    name: trimmed,
    type,
  }).returning({
    id: channels.id,
    name: channels.name,
    type: channels.type,
    createdAt: channels.created_at,
  }).get();
}

export function deleteChannel(db: AppDatabase, channelId: string) {
  const channel = db.select({ id: channels.id }).from(channels).where(eq(channels.id, channelId)).get();
  if (!channel) {
    throw new ChannelNotFoundError('Channel not found');
  }

  db.transaction((tx) => {
    tx.delete(messages).where(eq(messages.channel_id, channelId)).run();
    tx.delete(channels).where(eq(channels.id, channelId)).run();
  });
}

export class ChannelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChannelValidationError';
  }
}

export class ChannelNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChannelNotFoundError';
  }
}

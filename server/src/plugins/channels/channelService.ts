import { eq } from 'drizzle-orm';
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

  db.delete(messages).where(eq(messages.channel_id, channelId)).run();
  db.delete(channels).where(eq(channels.id, channelId)).run();
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

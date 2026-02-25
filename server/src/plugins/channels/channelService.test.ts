import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.hoisted(() => {
  process.env.JWT_ACCESS_SECRET = 'test-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
  process.env.GROUP_ENCRYPTION_KEY = 'rSxlHxEjeJC7RY079zu0Kg9fHWEIdAtGE4s76zAI9Rw';
});
vi.stubEnv('DATABASE_PATH', ':memory:');

import { setupApp, seedOwner } from '../../test/helpers.js';
import { channels, messages } from '../../db/schema.js';
import { createChannel, deleteChannel, ChannelValidationError, ChannelNotFoundError } from './channelService.js';

describe('channelService', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await setupApp();
  });

  describe('createChannel', () => {
    it('creates and returns a channel', () => {
      const channel = createChannel(app.db, 'general', 'text');

      expect(channel).toHaveProperty('id');
      expect(channel.name).toBe('general');
      expect(channel.type).toBe('text');
      expect(channel).toHaveProperty('createdAt');
    });

    it('trims channel name', () => {
      const channel = createChannel(app.db, '  spaced  ', 'text');
      expect(channel.name).toBe('spaced');
    });

    it('throws ChannelValidationError for empty name', () => {
      expect(() => createChannel(app.db, '', 'text')).toThrow(ChannelValidationError);
      expect(() => createChannel(app.db, '   ', 'text')).toThrow(ChannelValidationError);
    });

    it('throws ChannelValidationError for name over 50 chars', () => {
      const longName = 'a'.repeat(51);
      expect(() => createChannel(app.db, longName, 'text')).toThrow(ChannelValidationError);
    });

    it('allows name of exactly 50 chars', () => {
      const name = 'a'.repeat(50);
      const channel = createChannel(app.db, name, 'text');
      expect(channel.name).toBe(name);
    });

    it('throws ChannelValidationError for duplicate name', () => {
      createChannel(app.db, 'general', 'text');
      expect(() => createChannel(app.db, 'general', 'voice')).toThrow(ChannelValidationError);
      expect(() => createChannel(app.db, 'general', 'voice')).toThrow('already exists');
    });

    it('throws ChannelValidationError when channel limit is reached', () => {
      // Seed channels up to the limit
      for (let i = 0; i < 50; i++) {
        app.db.insert(channels).values({ name: `channel-${i}`, type: 'text' }).run();
      }

      expect(() => createChannel(app.db, 'one-too-many', 'text')).toThrow(ChannelValidationError);
      expect(() => createChannel(app.db, 'one-too-many', 'text')).toThrow('Channel limit reached');
    });
  });

  describe('deleteChannel', () => {
    it('deletes a channel', () => {
      const channel = app.db.insert(channels).values({ name: 'to-delete', type: 'text' }).returning().get();

      deleteChannel(app.db, channel.id);

      const remaining = app.db.select().from(channels).all();
      expect(remaining).toHaveLength(0);
    });

    it('deletes channel messages before deleting channel', async () => {
      const { id: ownerId } = await seedOwner(app);
      const channel = app.db.insert(channels).values({ name: 'with-msgs', type: 'text' }).returning().get();

      app.db.insert(messages).values([
        { channel_id: channel.id, user_id: ownerId, encrypted_content: 'msg1', nonce: 'n1' },
        { channel_id: channel.id, user_id: ownerId, encrypted_content: 'msg2', nonce: 'n2' },
      ]).run();

      deleteChannel(app.db, channel.id);

      const remainingMessages = app.db.select().from(messages).all();
      expect(remainingMessages).toHaveLength(0);
      const remainingChannels = app.db.select().from(channels).all();
      expect(remainingChannels).toHaveLength(0);
    });

    it('throws ChannelNotFoundError for non-existent channel', () => {
      expect(() => deleteChannel(app.db, 'non-existent')).toThrow(ChannelNotFoundError);
    });
  });
});

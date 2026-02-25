import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.hoisted(() => {
  process.env.JWT_ACCESS_SECRET = 'test-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
  process.env.OWNER_USERNAME = 'owner';
  process.env.OWNER_PASSWORD = 'ownerPass123';
});
vi.stubEnv('DATABASE_PATH', ':memory:');

import { setupApp, seedUserWithSession } from '../../test/helpers.js';
import { channels } from '../../db/schema.js';

describe('channelRoutes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('returns channels for authenticated users', async () => {
    app = await setupApp();
    app.db.insert(channels).values([
      { name: 'general', type: 'text' },
      { name: 'Gaming', type: 'voice' },
    ]).run();
    const { accessToken } = await seedUserWithSession(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/channels',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.count).toBe(body.data.length);
    expect(body.data.some((channel: { name: string; type: string }) => channel.name === 'general' && channel.type === 'text')).toBe(true);
    expect(body.data.some((channel: { name: string; type: string }) => channel.name === 'Gaming' && channel.type === 'voice')).toBe(true);
  });

  it('returns 401 without auth', async () => {
    app = await setupApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/channels',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });
});

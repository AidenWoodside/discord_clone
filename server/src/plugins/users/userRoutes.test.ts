import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.hoisted(() => {
  process.env.JWT_ACCESS_SECRET = 'test-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
});
vi.stubEnv('DATABASE_PATH', ':memory:');

import { setupApp, seedOwner, seedRegularUser } from '../../test/helpers.js';

describe('userRoutes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('returns safe user fields only', async () => {
    app = await setupApp();
    const { token: ownerToken } = await seedOwner(app);
    await seedRegularUser(app, 'member');

    const response = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.count).toBe(body.data.length);

    for (const user of body.data as Array<Record<string, unknown>>) {
      expect(user.id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.createdAt).toBeDefined();
      expect(user.passwordHash).toBeUndefined();
      expect(user.password_hash).toBeUndefined();
      expect(user.publicKey).toBeUndefined();
      expect(user.public_key).toBeUndefined();
      expect(user.encryptedGroupKey).toBeUndefined();
      expect(user.encrypted_group_key).toBeUndefined();
    }
  });

  it('returns 401 without auth', async () => {
    app = await setupApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/users',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });
});

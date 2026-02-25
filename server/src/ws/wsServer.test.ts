import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.hoisted(() => {
  process.env.JWT_ACCESS_SECRET = 'test-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
  process.env.GROUP_ENCRYPTION_KEY = 'rSxlHxEjeJC7RY079zu0Kg9fHWEIdAtGE4s76zAI9Rw';
});
vi.stubEnv('DATABASE_PATH', ':memory:');

import { setupApp, seedUserWithSession } from '../test/helpers.js';
import { getClients } from './wsServer.js';
import { clearAllPresence } from '../plugins/presence/presenceService.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await setupApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  getClients().clear();
  clearAllPresence();
});

describe('WebSocket Server', () => {
  describe('Authentication', () => {
    it('should accept connection with valid token', async () => {
      const { accessToken } = await seedUserWithSession(app, 'wsuser1');
      const ws = await app.injectWS(`/ws?token=${accessToken}`);

      expect(ws.readyState).toBe(ws.OPEN);
      ws.close();
    });

    it('should reject connection without token (close code 4001)', async () => {
      const closePromise = new Promise<number>((resolve) => {
        app.injectWS('/ws', undefined, {
          onInit(ws) {
            ws.on('close', (code: number) => resolve(code));
          },
        });
      });

      const code = await closePromise;
      expect(code).toBe(4001);
    });

    it('should reject connection with invalid token (close code 4001)', async () => {
      const closePromise = new Promise<number>((resolve) => {
        app.injectWS('/ws?token=invalid-token', undefined, {
          onInit(ws) {
            ws.on('close', (code: number) => resolve(code));
          },
        });
      });

      const code = await closePromise;
      expect(code).toBe(4001);
    });
  });

  describe('Connection tracking', () => {
    it('should track connected client in clients map', async () => {
      const { id, accessToken } = await seedUserWithSession(app, 'wstrack1');
      const ws = await app.injectWS(`/ws?token=${accessToken}`);

      expect(getClients().has(id)).toBe(true);
      ws.close();
    });

    it('should remove client from map on disconnect', async () => {
      const { id, accessToken } = await seedUserWithSession(app, 'wstrack2');
      const ws = await app.injectWS(`/ws?token=${accessToken}`);

      expect(getClients().has(id)).toBe(true);

      ws.terminate();

      // Wait for server-side close handler to process
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (!getClients().has(id)) {
            clearInterval(interval);
            resolve();
          }
        }, 20);
      });

      expect(getClients().has(id)).toBe(false);
    });
  });

  describe('Presence sync on connect', () => {
    it('should send presence:sync message to newly connected client', async () => {
      const { accessToken } = await seedUserWithSession(app, 'prsync1');

      const messagePromise = new Promise<string>((resolve) => {
        app.injectWS(`/ws?token=${accessToken}`, undefined, {
          onInit(ws) {
            ws.on('message', (data: Buffer) => resolve(data.toString()));
          },
        });
      });

      const raw = await messagePromise;
      const parsed = JSON.parse(raw);
      expect(parsed.type).toBe('presence:sync');
      expect(parsed.payload).toHaveProperty('users');
      expect(Array.isArray(parsed.payload.users)).toBe(true);
    });
  });

  describe('Presence broadcast', () => {
    it('should broadcast presence:update to other clients on connect', async () => {
      const { accessToken: token1 } = await seedUserWithSession(app, 'prbcast1');

      // Connect first client and set up listener for 2 messages (sync + update)
      let ws1Messages: string[] = [];
      const ws1 = await new Promise<WebSocket>((resolve) => {
        app.injectWS(`/ws?token=${token1}`, undefined, {
          onInit(ws) {
            ws.on('message', (data: Buffer) => {
              ws1Messages.push(data.toString());
            });
          },
          onOpen(ws) {
            resolve(ws);
          },
        });
      });

      // Wait for presence:sync message
      await new Promise<void>((resolve) => {
        const check = () => {
          if (ws1Messages.length >= 1) return resolve();
          setTimeout(check, 10);
        };
        check();
      });

      // Reset messages to capture only new ones
      ws1Messages = [];

      // Connect second client
      const { accessToken: token2, id: user2Id } = await seedUserWithSession(app, 'prbcast2');
      await app.injectWS(`/ws?token=${token2}`);

      // Wait for the broadcast to ws1
      await new Promise<void>((resolve) => {
        const check = () => {
          if (ws1Messages.length >= 1) return resolve();
          setTimeout(check, 10);
        };
        check();
      });

      const parsed = JSON.parse(ws1Messages[0]);
      expect(parsed.type).toBe('presence:update');
      expect(parsed.payload.userId).toBe(user2Id);
      expect(parsed.payload.status).toBe('online');

      ws1.close();
    });
  });
});

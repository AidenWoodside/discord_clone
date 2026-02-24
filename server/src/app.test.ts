import { describe, it, expect, afterEach } from 'vitest';
import { type FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

describe('Server App', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('should return health check response', async () => {
    app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { status: 'ok' } });
  });
});

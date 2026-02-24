import { describe, it, expect } from 'vitest';
import { buildApp } from './app.js';

describe('Server App', () => {
  it('should return health check response', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { status: 'ok' } });
  });
});

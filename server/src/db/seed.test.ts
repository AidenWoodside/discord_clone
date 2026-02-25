import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_ACCESS_SECRET = 'test-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
});

import { createDatabase } from './connection.js';
import { runMigrations } from './migrate.js';
import { runSeed } from './seed.js';
import { channels } from './schema.js';
import type { AppDatabase } from './connection.js';

function setupTestDb(): AppDatabase {
  const { db } = createDatabase(':memory:');
  runMigrations(db);
  return db;
}

describe('runSeed', () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = setupTestDb();
  });

  it('should seed default channels on empty database', async () => {
    await runSeed(db);

    const allChannels = db.select().from(channels).all();
    expect(allChannels).toHaveLength(2);

    const general = allChannels.find(c => c.name === 'general');
    const gaming = allChannels.find(c => c.name === 'Gaming');

    expect(general).toBeDefined();
    expect(general!.type).toBe('text');
    expect(gaming).toBeDefined();
    expect(gaming!.type).toBe('voice');
  });

  it('should be idempotent (running twice does not duplicate channels)', async () => {
    await runSeed(db);
    await runSeed(db);

    const allChannels = db.select().from(channels).all();
    expect(allChannels).toHaveLength(2);
  });

  it('should skip seeding when channels already exist', async () => {
    // Manually insert a channel
    db.insert(channels).values({ name: 'existing', type: 'text' }).run();

    const infoMessages: string[] = [];
    const logger = {
      info: (msg: string) => { infoMessages.push(msg); },
      warn: () => {},
    };

    await runSeed(db, logger);

    // Should not have added default channels
    const allChannels = db.select().from(channels).all();
    expect(allChannels).toHaveLength(1);
    expect(allChannels[0].name).toBe('existing');
    expect(infoMessages).toContain('Seeding skipped — channels already exist');
  });
});

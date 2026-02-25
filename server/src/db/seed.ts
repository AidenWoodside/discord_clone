import { count } from 'drizzle-orm';
import { channels } from './schema.js';
import type { AppDatabase } from './connection.js';

export async function runSeed(db: AppDatabase, logger?: { info: (msg: string) => void; warn: (msg: string) => void }): Promise<void> {
  const log = logger ?? { info: () => {}, warn: () => {} };

  // Seed default channels if none exist (fallback for existing DBs)
  const channelCount = db.select({ value: count() }).from(channels).get();
  if ((channelCount?.value ?? 0) > 0) {
    log.info('Seeding skipped — channels already exist');
    return;
  }

  db.insert(channels).values([
    { name: 'general', type: 'text' },
    { name: 'Gaming', type: 'voice' },
  ]).run();

  log.info('Default channels seeded');
}

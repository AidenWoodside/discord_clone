import { asc } from 'drizzle-orm';
import { channels } from '../../db/schema.js';
import type { AppDatabase } from '../../db/connection.js';
import type { Channel } from 'discord-clone-shared';

export async function getAllChannels(db: AppDatabase): Promise<Channel[]> {
  const rows = db
    .select({
      id: channels.id,
      name: channels.name,
      type: channels.type,
      createdAt: channels.created_at,
    })
    .from(channels)
    .orderBy(asc(channels.type), asc(channels.name))
    .all();

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    createdAt: row.createdAt.toISOString(),
  }));
}

import { asc } from 'drizzle-orm';
import { users } from '../../db/schema.js';
import type { AppDatabase } from '../../db/connection.js';
import type { UserPublic } from 'discord-clone-shared';

export async function getAllUsers(db: AppDatabase): Promise<UserPublic[]> {
  const rows = db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.created_at,
    })
    .from(users)
    .orderBy(asc(users.username))
    .all();

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  }));
}

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export function createDatabase(dbPath?: string): { db: AppDatabase; sqlite: Database.Database } {
  const resolvedPath = dbPath ?? process.env.DATABASE_PATH ?? './data/discord_clone.db';

  // Ensure data directory exists (skip for in-memory databases)
  if (resolvedPath !== ':memory:') {
    const dbDir = path.dirname(resolvedPath);
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqlite = new Database(resolvedPath);

  // Enable WAL mode for concurrent read performance (skip for in-memory)
  if (resolvedPath !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');
  }

  // SQLite does NOT enforce foreign keys by default — must enable explicitly
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}


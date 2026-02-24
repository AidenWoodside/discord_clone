import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { createDatabase, type AppDatabase } from './connection.js';
import { users, sessions, invites, bans, channels } from './schema.js';

describe('Database Connection', () => {
  let testDb: AppDatabase;
  let testSqlite: Database.Database;

  afterEach(() => {
    testSqlite?.close();
  });

  it('creates an in-memory database connection', () => {
    const result = createDatabase(':memory:');
    testDb = result.db;
    testSqlite = result.sqlite;

    expect(testDb).toBeDefined();
    expect(testSqlite).toBeDefined();
  });

  it('enforces foreign keys', () => {
    const result = createDatabase(':memory:');
    testDb = result.db;
    testSqlite = result.sqlite;

    const fkStatus = testSqlite.pragma('foreign_keys', { simple: true });
    expect(fkStatus).toBe(1);
  });

  it('enables WAL mode for file-based databases', () => {
    const tmpPath = path.join(os.tmpdir(), `test-wal-${crypto.randomUUID()}.db`);
    try {
      const result = createDatabase(tmpPath);
      testDb = result.db;
      testSqlite = result.sqlite;

      const journalMode = testSqlite.pragma('journal_mode', { simple: true });
      expect(journalMode).toBe('wal');
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* cleanup best-effort */ }
      try { fs.unlinkSync(`${tmpPath}-wal`); } catch { /* WAL file cleanup */ }
      try { fs.unlinkSync(`${tmpPath}-shm`); } catch { /* SHM file cleanup */ }
    }
  });

  it('runs migrations successfully', () => {
    const result = createDatabase(':memory:');
    testDb = result.db;
    testSqlite = result.sqlite;

    migrate(testDb, { migrationsFolder: './drizzle' });

    // Verify all 5 tables exist by querying sqlite_master
    const tables = testSqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('invites');
    expect(tableNames).toContain('bans');
    expect(tableNames).toContain('channels');
  });

  describe('CRUD operations', () => {
    function setupTestDb(): { db: AppDatabase; sqlite: Database.Database } {
      const result = createDatabase(':memory:');
      migrate(result.db, { migrationsFolder: './drizzle' });
      return result;
    }

    it('inserts and selects a user', () => {
      const result = setupTestDb();
      testDb = result.db;
      testSqlite = result.sqlite;

      testDb.insert(users).values({
        username: 'testuser',
        password_hash: 'hashed_password',
        role: 'user',
      }).run();

      const allUsers = testDb.select().from(users).all();
      expect(allUsers).toHaveLength(1);
      expect(allUsers[0].username).toBe('testuser');
      expect(allUsers[0].password_hash).toBe('hashed_password');
      expect(allUsers[0].role).toBe('user');
      expect(allUsers[0].id).toBeDefined();
      expect(allUsers[0].created_at).toBeInstanceOf(Date);
    });

    it('inserts and selects a session', () => {
      const result = setupTestDb();
      testDb = result.db;
      testSqlite = result.sqlite;

      // Create a user first (FK requirement)
      const user = testDb.insert(users).values({
        username: 'sessionuser',
        password_hash: 'hash',
      }).returning().get();

      testDb.insert(sessions).values({
        user_id: user.id,
        refresh_token_hash: 'refresh_hash',
        expires_at: new Date(Date.now() + 86400000),
      }).run();

      const allSessions = testDb.select().from(sessions).all();
      expect(allSessions).toHaveLength(1);
      expect(allSessions[0].user_id).toBe(user.id);
      expect(allSessions[0].refresh_token_hash).toBe('refresh_hash');
      expect(allSessions[0].expires_at).toBeInstanceOf(Date);
    });

    it('inserts and selects an invite', () => {
      const result = setupTestDb();
      testDb = result.db;
      testSqlite = result.sqlite;

      const user = testDb.insert(users).values({
        username: 'inviter',
        password_hash: 'hash',
      }).returning().get();

      testDb.insert(invites).values({
        token: 'unique-invite-token',
        created_by: user.id,
      }).run();

      const allInvites = testDb.select().from(invites).all();
      expect(allInvites).toHaveLength(1);
      expect(allInvites[0].token).toBe('unique-invite-token');
      expect(allInvites[0].created_by).toBe(user.id);
      expect(allInvites[0].revoked).toBe(false);
    });

    it('inserts and selects a ban', () => {
      const result = setupTestDb();
      testDb = result.db;
      testSqlite = result.sqlite;

      const admin = testDb.insert(users).values({
        username: 'admin',
        password_hash: 'hash',
        role: 'owner',
      }).returning().get();

      const banned = testDb.insert(users).values({
        username: 'banned_user',
        password_hash: 'hash',
      }).returning().get();

      testDb.insert(bans).values({
        user_id: banned.id,
        banned_by: admin.id,
      }).run();

      const allBans = testDb.select().from(bans).all();
      expect(allBans).toHaveLength(1);
      expect(allBans[0].user_id).toBe(banned.id);
      expect(allBans[0].banned_by).toBe(admin.id);
    });

    it('inserts and selects a channel', () => {
      const result = setupTestDb();
      testDb = result.db;
      testSqlite = result.sqlite;

      testDb.insert(channels).values({
        name: 'general',
        type: 'text',
      }).run();

      testDb.insert(channels).values({
        name: 'voice-chat',
        type: 'voice',
      }).run();

      const allChannels = testDb.select().from(channels).all();
      expect(allChannels).toHaveLength(2);
      expect(allChannels.map((c) => c.name)).toContain('general');
      expect(allChannels.map((c) => c.type)).toContain('text');
      expect(allChannels.map((c) => c.type)).toContain('voice');
    });
  });

  describe('Foreign key constraints', () => {
    function setupTestDb(): { db: AppDatabase; sqlite: Database.Database } {
      const result = createDatabase(':memory:');
      migrate(result.db, { migrationsFolder: './drizzle' });
      return result;
    }

    it('rejects session with non-existent user_id', () => {
      const result = setupTestDb();
      testDb = result.db;
      testSqlite = result.sqlite;

      expect(() => {
        testDb.insert(sessions).values({
          user_id: 'non-existent-user-id',
          refresh_token_hash: 'hash',
          expires_at: new Date(Date.now() + 86400000),
        }).run();
      }).toThrow();
    });

    it('rejects invite with non-existent created_by', () => {
      const result = setupTestDb();
      testDb = result.db;
      testSqlite = result.sqlite;

      expect(() => {
        testDb.insert(invites).values({
          token: 'invite-token',
          created_by: 'non-existent-user-id',
        }).run();
      }).toThrow();
    });

    it('rejects ban with non-existent user_id', () => {
      const result = setupTestDb();
      testDb = result.db;
      testSqlite = result.sqlite;

      const admin = testDb.insert(users).values({
        username: 'admin',
        password_hash: 'hash',
        role: 'owner',
      }).returning().get();

      expect(() => {
        testDb.insert(bans).values({
          user_id: 'non-existent-user-id',
          banned_by: admin.id,
        }).run();
      }).toThrow();
    });

    it('rejects ban with non-existent banned_by', () => {
      const result = setupTestDb();
      testDb = result.db;
      testSqlite = result.sqlite;

      const user = testDb.insert(users).values({
        username: 'user',
        password_hash: 'hash',
      }).returning().get();

      expect(() => {
        testDb.insert(bans).values({
          user_id: user.id,
          banned_by: 'non-existent-admin-id',
        }).run();
      }).toThrow();
    });
  });
});

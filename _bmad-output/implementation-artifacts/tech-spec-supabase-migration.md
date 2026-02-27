---
title: 'Supabase Migration — SQLite to PostgreSQL'
slug: 'supabase-migration'
created: '2026-02-27'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['postgres (postgres.js)', 'drizzle-orm/pg-core', 'drizzle-orm/postgres-js', 'drizzle-orm/pglite', '@electric-sql/pglite', 'Supabase (managed Postgres)', 'Fastify v5.7.x', 'TypeScript 5.x strict', 'Vitest']
files_to_modify: ['server/src/db/schema.ts', 'server/src/db/connection.ts', 'server/src/db/migrate.ts', 'server/src/db/seed.ts', 'server/drizzle.config.ts', 'server/src/plugins/db.ts', 'server/src/index.ts', 'server/src/plugins/auth/authRoutes.ts', 'server/src/plugins/auth/sessionService.ts', 'server/src/plugins/channels/channelRoutes.ts', 'server/src/plugins/channels/channelService.ts', 'server/src/plugins/messages/messageRoutes.ts', 'server/src/plugins/messages/messageService.ts', 'server/src/plugins/messages/messageWsHandler.ts', 'server/src/plugins/invites/inviteService.ts', 'server/src/plugins/users/userService.ts', 'server/src/plugins/admin/adminRoutes.ts', 'server/src/plugins/admin/adminService.ts', 'server/src/plugins/voice/voiceWsHandler.ts', 'server/src/ws/wsRouter.ts', 'server/src/test/helpers.ts', 'server/src/plugins/auth/sessionService.test.ts', 'server/src/plugins/channels/channelService.test.ts', 'server/src/plugins/messages/messageRoutes.test.ts', 'server/src/plugins/admin/adminService.test.ts', 'server/package.json', 'docker-compose.yml', 'docker-compose.dev.yml', '.env.example', 'shared/src/ws-messages.ts', 'shared/src/types.ts', 'shared/src/index.ts', 'client/src/renderer/src/services/messageService.ts', 'client/src/renderer/src/services/apiClient.ts', 'client/src/renderer/src/services/wsClient.ts', 'client/src/renderer/src/stores/useMessageStore.ts']
code_patterns: ['pgTable schema definitions with pgEnum', 'uuid().defaultRandom() replaces text + crypto.randomUUID()', 'timestamp({ withTimezone: true }).defaultNow() replaces integer mode timestamp', 'boolean() replaces integer mode boolean', 'async/await on ALL db.* calls', '[result] = await db.insert().returning() destructure replaces .returning().get()', 'await db.select().from() replaces .all()', '[result] = await db.select().from().where() replaces .get()', 'await db.transaction(async (tx) => { await tx... }) replaces sync transaction', 'PGlite in-memory for tests via drizzle-orm/pglite', 'opaque base64url cursor encoding (created_at + id composite)', 'TEXT_ERROR WS frame for transient DB failures (no ws.close on recoverable errors)', 'withRetry() wrapper for idempotent GET requests on client']
test_patterns: ['PGlite in-process Postgres for test database', 'Two test tiers: raw DB (sessionService) and full app (others)', 'sessionService.test.ts creates DB directly via createDatabase — no Fastify app', 'channelService/messageRoutes/adminService tests use setupApp() helper', 'authService.test.ts has NO DB — pure function tests — no changes needed', 'vi.stubEnv DATABASE_PATH :memory: pattern needs replacement for PGlite', 'beforeEach creates fresh DB instance per test for isolation', 'afterEach calls teardownApp() or close() for deterministic PGlite cleanup', 'Direct DB assertions in tests use .get() .all() .run() — all need await']
---

# Tech-Spec: Supabase Migration — SQLite to PostgreSQL

**Created:** 2026-02-27

## Overview

### Problem Statement

The app uses embedded SQLite (better-sqlite3) which ties database storage to the EC2 instance, offers no managed backups or point-in-time recovery, and provides no data inspection dashboard. The single-file database cannot scale storage independently from compute.

### Solution

Database layer swap — rewrite Drizzle schema from `sqliteTable` to `pgTable`, replace `better-sqlite3` with `postgres` (postgres.js) driver, async-ify all ~27 server files with DB calls, use PGlite for in-memory test database, and update client pagination and error handling for the external database architecture. Custom JWT auth, WebSocket layer, E2E encryption, and Electron shell remain untouched.

### Scope

**In Scope (server):**
- Schema translation (`sqliteTable` -> `pgTable`, native UUID/timestamp/boolean/enum types)
- Connection layer rewrite (`postgres` driver, env-var-driven connection pooling, graceful shutdown, connection validation)
- Sync-to-async migration of all services, routes, and WebSocket handlers
- Cursor pagination rewrite (SQLite `rowid` -> opaque composite cursor with `created_at` + `id` tiebreaker)
- WebSocket error handling upgrade (`TEXT_ERROR` frame for transient DB failures instead of connection termination)
- Test infrastructure swap (PGlite in-memory replaces SQLite `:memory:`, explicit teardown)
- Dual-mode migration runner (postgres.js migrator for production, PGlite migrator for tests)
- Supabase-specific configuration (disable RLS, enforce SSL, document connection limits)
- Deployment config updates (Docker Compose, env vars, Drizzle config)
- Documentation updates (project-context, data-models, architecture-server, development-guide)

**In Scope (shared):**
- Add `TEXT_ERROR` to `WS_TYPES` constant and `TextErrorPayload` interface
- Add `ApiPaginatedList<T>` type for cursor-based pagination responses

**In Scope (client):**
- Migrate message pagination from message-ID cursor to opaque server-provided cursor
- Add retry wrapper for transient GET request failures
- Handle `TEXT_ERROR` WebSocket frame to mark failed messages without full reconnect

**Out of Scope:**
- Data migration (fresh start — no SQLite data carried over)
- Supabase Auth / Realtime / Storage adoption (we keep custom implementations)
- UI changes, E2E encryption changes, Electron shell changes
- Supabase project creation (already provisioned, connection string available)
- CI/CD pipeline changes (deferred to separate spec)

## Context for Development

### Codebase Patterns

**Current State (SQLite / better-sqlite3):**
- All DB operations are **synchronous** — zero `await` on any DB call in entire codebase
- Drizzle terminal methods: `.get()` (single row), `.all()` (array), `.run()` (fire-and-forget), `.returning().get()` (insert+return), `.returning().all()` (delete+return all)
- `AppDatabase` type = `BetterSQLite3Database<typeof schema>`
- Schema uses `sqliteTable`, `text` for UUIDs with `$defaultFn(() => crypto.randomUUID())`, `integer({ mode: 'timestamp' })` for dates, `integer({ mode: 'boolean' })` for booleans, `text({ enum: [...] })` for enums
- Messages table uses `sql\`(unixepoch())\`` for default timestamp — SQLite-specific, returns **seconds** not milliseconds
- `messageService.ts` uses SQLite's `rowid` for cursor-based pagination — **not available in Postgres**
- `messageService.ts` exports a `toISOTimestamp()` helper that handles both `Date` objects and raw Unix-second numbers — this is a SQLite-only workaround
- Client passes message IDs as the `before` cursor parameter; `fetchOlderMessages()` reads `getOldestMessageId()` and passes it directly
- `messageWsHandler.ts` calls `ws.close(4003)` on DB errors — terminates the entire WS connection for a single failed message
- `wsRouter.ts` defines `WsHandler` return type as `void` (not `Promise<void>`) — handlers are invoked synchronously via `handler(ws, message, userId)`
- Two sync transactions: `authRoutes.ts` (registration race condition) and `channelService.ts` (cascade delete)
- Many functions declared `async` but body is entirely sync (e.g., `runSeed`, test helpers)
- Plugin architecture: each domain is a Fastify plugin with service + routes files

**Target State (Postgres / postgres.js):**
- All DB operations **async** with `await`
- `.get()` -> `[result] = await ...` (destructure first element)
- `.all()` -> `await ...` (already returns array in Postgres)
- `.run()` -> `await ...`
- `.returning().get()` -> `[result] = await .returning()`
- `db.transaction((tx) => {...})` -> `await db.transaction(async (tx) => { await tx... })`
- `AppDatabase` type = `PgDatabase<any, typeof schema>` from `drizzle-orm/pg-core` (common base for both postgres.js and PGlite — `any` for HKT slot is intentional since query surface is identical between drivers)
- Schema uses `pgTable`, `uuid().defaultRandom()`, `timestamp({ withTimezone: true })`, `boolean()`, `pgEnum()`
- `toISOTimestamp()` deleted — Postgres timestamps are native `Date` objects, use `.toISOString()` directly
- Cursor pagination: opaque base64url-encoded cursor containing `(created_at, id)` composite pair with deterministic tiebreaker ordering
- Client receives `cursor: string | null` in pagination responses, passes it back opaquely — no client knowledge of cursor internals
- `messageWsHandler.ts` sends `TEXT_ERROR` frame on DB failures — connection stays open for recovery
- `wsRouter.ts` WsHandler type updated to `void | Promise<void>`, `routeMessage` awaits async handlers

**Files that do NOT need DB changes:**
- `server/src/plugins/auth/authService.ts` — pure bcrypt/JWT/crypto, no DB calls
- `server/src/plugins/auth/authService.test.ts` — pure function tests, no DB
- `server/src/plugins/presence/presenceService.ts` — in-memory only
- `server/src/plugins/voice/voiceService.ts` — in-memory state only
- All WebSocket/mediasoup infrastructure files — no DB calls (except `wsRouter.ts` type update)

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `_bmad-output/planning-artifacts/supabase-migration-architecture.md` | Full architecture document — schema translations, connection patterns, implementation sequence |
| `_bmad-output/project-context.md` | Project conventions and rules — must be updated post-migration |
| `docs/data-models-server.md` | Data model documentation — must be updated post-migration |
| `docs/architecture-server.md` | Server architecture documentation — must be updated post-migration |

### Investigation Results — File-by-File DB Call Audit

#### Database Core

| File | Current State | Changes Required |
|------|--------------|-----------------|
| `schema.ts` | 6 `sqliteTable` definitions, `text` UUIDs + `crypto.randomUUID()`, `integer` timestamps/booleans, `text` enums, `sql\`(unixepoch())\`` | Full rewrite: `pgTable`, `uuid().defaultRandom()`, `timestamp({ withTimezone: true })`, `boolean()`, `pgEnum()`, `defaultNow()`. Add composite index `(channel_id, created_at, id)` on messages for cursor pagination. |
| `connection.ts` | Sync `createDatabase()`, returns `{ db, sqlite }`, WAL + FK pragmas, `BetterSQLite3Database` type | Full rewrite: `createDatabase()` returns `{ db, close, migrate }`, dual mode (postgres.js when `DATABASE_URL` set, PGlite when not), env-var-driven connection pool config, connection string validation |
| `migrate.ts` | Sync `runMigrations()`, `drizzle-orm/better-sqlite3/migrator` | Make async, dual-mode: use `drizzle-orm/postgres-js/migrator` for postgres.js, `drizzle-orm/pglite/migrator` for PGlite. Accept migrate function from `createDatabase()` return. |
| `seed.ts` | Declared async but sync body, `.get()` + `.run()` | Add `await`, replace `.get()` -> destructure, `.run()` -> `await`. Coerce `count()` result with `Number()`. |
| `drizzle.config.ts` | `dialect: 'sqlite'`, `DATABASE_PATH` env var | `dialect: 'postgresql'`, `DATABASE_URL` env var |

#### Auth Domain

| File | Functions with DB Calls | Drizzle Methods Used |
|------|------------------------|---------------------|
| `authRoutes.ts` | `onReady` hook, `GET /server/status`, `POST /register` (transaction with 7+ DB calls), `POST /login`, `POST /refresh`, `POST /logout` | `.get()` x10, `.returning().get()` x1, `.run()` x2, `db.transaction()` x1 |
| `sessionService.ts` | `createSession`, `findSessionByTokenHash`, `deleteSession`, `deleteUserSessions`, `cleanExpiredSessions` — ALL sync | `.returning().get()` x1, `.get()` x1, `.run()` x2, `.returning().all()` x1 |

#### Channel Domain

| File | Functions with DB Calls | Drizzle Methods Used |
|------|------------------------|---------------------|
| `channelService.ts` | `getAllChannels`, `getChannelById`, `createChannel` (3 DB calls), `deleteChannel` (transaction) — ALL sync | `.all()` x1, `.get()` x3, `.returning({...}).get()` x1, `.run()` x2, `db.transaction()` x1 |
| `channelRoutes.ts` | Delegates only — `getAllChannels()`, `createChannel()`, `deleteChannel()` | No direct DB calls — but return values from now-async services need `await` |

#### Message Domain

| File | Functions with DB Calls | Drizzle Methods Used |
|------|------------------------|---------------------|
| `messageService.ts` | `createMessage`, `getMessagesByChannel` (2 variants with/without cursor) — ALL sync. **Uses `rowid` for cursor pagination**. Exports `toISOTimestamp()` helper for SQLite timestamp workaround. | `.returning().get()` x1, `.all()` x2 (with raw SQL `rowid` references) |
| `messageRoutes.ts` | Channel existence check inline, delegates `getMessagesByChannel`, maps rows with `toISOTimestamp()` | `.get()` x1 inline |
| `messageWsHandler.ts` | Delegates `createMessage` in sync callback. **Calls `ws.close(4003)` on DB errors — kills entire WS connection.** | No direct DB — but sync callback calling now-async service needs async conversion |

#### Other Domains

| File | Functions with DB Calls | Drizzle Methods Used |
|------|------------------------|---------------------|
| `inviteService.ts` | `createInvite`, `revokeInvite`, `validateInvite`, `getInvites` — ALL sync | `.returning().get()` x1, `.run()` x1, `.get()` x1, `.all()` x1 |
| `userService.ts` | `getAllUsers` — sync | `.all()` x1 |
| `adminService.ts` | `kickUser`, `banUser`, `unbanUser`, `resetPassword` (async for bcrypt), `getBannedUsers` | `.get()` x5, `.returning().get()` x1, `.run()` x2, `.all()` x1 |
| `adminRoutes.ts` | Delegates only | No direct DB calls — but return values from now-async services need `await` |
| `voiceWsHandler.ts` | Delegates `getChannelById` in sync handler | No direct DB — sync callback calling now-async service needs async conversion |

#### Infrastructure & Tests

| File | Current State | Changes Required |
|------|--------------|-----------------|
| `wsRouter.ts` | `WsHandler` type returns `void`. `routeMessage` calls `handler(ws, message, userId)` synchronously. | Update `WsHandler` to `void \| Promise<void>`. Await handler result in `routeMessage` if it returns a Promise. |
| `db.ts` plugin | `createDatabase()` sync, `sqlite.close()` onClose hook, type augmentation | Async `createDatabase()`, `close()` onClose hook, `onReady` health check, update `AppDatabase` type augmentation |
| `index.ts` | `runMigrations(app.db)` sync, `await runSeed(app.db)` | Guarded `await runMigrations(app.db)` with error handling and fatal abort |
| `test/helpers.ts` | `setupApp()`, seed functions use `.returning().get()` and `.run()`, `createDatabase(':memory:')` via env var. No `afterEach` teardown. | PGlite auto-detection, all seeds get `await`, `.returning().get()` -> destructure. Add `teardownApp()` export for deterministic PGlite cleanup. |
| `sessionService.test.ts` | Raw `createDatabase(':memory:')`, local `setupTestDb()`, direct DB assertions | PGlite instance, async `setupTestDb()`, `await` all assertions. Add `afterEach` to close PGlite. |
| `channelService.test.ts` | `setupApp()`, direct DB inserts/reads in tests | `await` all DB calls in test bodies. Add `afterEach` teardown. |
| `messageRoutes.test.ts` | `setupApp()`, direct DB inserts in `beforeEach` | `await` all DB calls. Update cursor tests for opaque cursors. Add `afterEach` teardown. |
| `adminService.test.ts` | `setupApp()`, heavy DB assertions (select/verify state) | `await` all DB assertions. Add `afterEach` teardown. |

#### Shared & Client

| File | Current State | Changes Required |
|------|--------------|-----------------|
| `shared/src/ws-messages.ts` | No `TEXT_ERROR` type. `WS_TYPES` has `TEXT_SEND` and `TEXT_RECEIVE` only for text messaging. | Add `TEXT_ERROR: 'text:error'` to `WS_TYPES`. Add `TextErrorPayload` interface. |
| `shared/src/types.ts` | `ApiList<T>` has `{ data: T[]; count: number }`. No cursor pagination type. | Add `ApiPaginatedList<T>` with `{ data: T[]; cursor: string \| null; count: number }`. |
| `shared/src/index.ts` | Exports all types and constants. | Add exports for `TextErrorPayload` and `ApiPaginatedList`. |
| `client/.../messageService.ts` | `fetchOlderMessages` passes `getOldestMessageId()` (message UUID) as `before` cursor. `hasMore` inferred from `result.length === PAGE_LIMIT`. | Replace `before` with opaque `cursor` from server response. Store `nextCursor` per channel. Use `cursor !== null` for `hasMore`. |
| `client/.../apiClient.ts` | Zero retry logic. Failed requests throw immediately. | Add `withRetry()` wrapper for idempotent GET requests (2 retries, linear backoff). |
| `client/.../wsClient.ts` | No `TEXT_ERROR` handler. `handleMessage` routes by `WS_TYPES`. | Add `TEXT_ERROR` case that calls `markMessageFailed(message.id)`. |
| `client/.../useMessageStore.ts` | `getOldestMessageId` returns `msgs[0].id`. No cursor state. | Add `cursors: Map<string, string \| null>` state. Add `getCursor(channelId)` and `setCursor(channelId, cursor)` methods. |

### Technical Decisions

1. **Driver:** `postgres` (postgres.js) — fastest Node.js Postgres driver, ESM-native, built-in connection pooling, first-class Drizzle support
2. **Connection mode:** Session mode (port 5432) — long-lived Fastify server, full transaction and prepared statement support
3. **Schema strategy:** Mechanical translation — `sqliteTable` -> `pgTable`, `text` UUIDs -> `uuid().defaultRandom()`, `integer` timestamps -> `timestamp({ withTimezone: true })`, `integer` booleans -> `boolean()`, text enums -> `pgEnum`
4. **Test database:** PGlite (`@electric-sql/pglite`) via `drizzle-orm/pglite` — in-process Postgres engine, no Docker dependency for tests, compatible with `pgTable` schemas
5. **Data strategy:** Fresh start — no data migration. Delete old SQLite migrations (backup to `server/drizzle-sqlite-backup/`), regenerate from Postgres schema
6. **Connection pooling:** Built into `postgres` driver. All pool settings env-var-driven with defaults: `DB_POOL_MAX=10`, `DB_IDLE_TIMEOUT=20`, `DB_CONNECT_TIMEOUT=10`. Documented against Supabase tier connection limits (60 direct connections on Pro).
7. **Supabase usage:** Managed Postgres only — no Auth, no Realtime, no Storage, no client SDK. RLS disabled on all application tables (app uses custom JWT auth, not Supabase Auth). SSL enforced via `?sslmode=require`.
8. **Cursor pagination:** Opaque base64url-encoded cursor containing `{ t: ISO-timestamp, id: UUID }`. The `(created_at, id)` composite pair provides deterministic ordering even for same-millisecond messages. Server returns `cursor: string | null` in responses; client passes it back without interpretation. Composite index `(channel_id, created_at, id)` on messages table supports the query.
9. **Transaction conversion:** Both existing transactions (`authRoutes.ts` registration, `channelService.ts` deleteChannel) become `await db.transaction(async (tx) => { await tx... })`
10. **Dual-mode connection:** `createDatabase()` auto-detects mode — if `DATABASE_URL` env var is set, use postgres.js; if not, use PGlite. Returns unified `{ db, close, migrate }` interface. The `migrate` function is driver-matched (uses `drizzle-orm/postgres-js/migrator` or `drizzle-orm/pglite/migrator` respectively). Tests run without setting any env var.
11. **AppDatabase type:** `PgDatabase<any, typeof schema>` from `drizzle-orm/pg-core`. The `any` for the HKT (Higher-Kinded Type) slot is intentional — `PostgresJsQueryResultHKT` and `PgliteQueryResultHKT` differ at the adapter level but the query-building surface is identical. The HKT difference is encapsulated inside `createDatabase()`.
12. **WebSocket async handlers:** `WsHandler` type in `wsRouter.ts` updated to `void | Promise<void>`. `routeMessage` checks the handler return and awaits Promises. Handlers that call async DB operations use try/catch with `TEXT_ERROR` frame fallback instead of `ws.close()`.
13. **Connection validation:** `createDatabase()` validates `DATABASE_URL` format before connecting. Supabase URLs are checked for `sslmode=require`. The db plugin adds an `onReady` hook that executes `SELECT 1` to verify the connection before accepting traffic.
14. **Client resilience:** Idempotent GET requests (message fetches, channel lists) use a `withRetry()` wrapper with 2 retries and linear backoff (500ms, 1000ms). Mutations (POST/PUT/DELETE) are not retried.
15. **Test cleanup:** All test suites use explicit `afterEach` hooks to call `teardownApp()` (Fastify tests) or `close()` (raw DB tests) for deterministic PGlite disposal. No reliance on garbage collection.

### Critical Migration Patterns

**Pattern 1: Single-row fetch**
```typescript
// BEFORE: db.select().from(users).where(eq(users.id, id)).get()
// AFTER:  const [user] = await db.select().from(users).where(eq(users.id, id));
```

**Pattern 2: Multi-row fetch**
```typescript
// BEFORE: db.select().from(channels).all()
// AFTER:  await db.select().from(channels)
```

**Pattern 3: Insert and return**
```typescript
// BEFORE: db.insert(users).values({...}).returning().get()
// AFTER:  const [user] = await db.insert(users).values({...}).returning();
```

**Pattern 4: Fire-and-forget write**
```typescript
// BEFORE: db.delete(sessions).where(eq(sessions.id, id)).run()
// AFTER:  await db.delete(sessions).where(eq(sessions.id, id));
```

**Pattern 5: Transaction**
```typescript
// BEFORE: db.transaction((tx) => { tx.insert(...).run(); const r = tx.select(...).get(); })
// AFTER:  await db.transaction(async (tx) => { await tx.insert(...); const [r] = await tx.select(...); })
```

**Pattern 6: Delete and return all**
```typescript
// BEFORE: db.delete(sessions).where(...).returning().all()
// AFTER:  await db.delete(sessions).where(...).returning()
```

**Pattern 7: Opaque cursor pagination (messageService-specific)**
```typescript
// BEFORE:
//   db.select().from(messages)
//     .where(sql`...rowid < (SELECT rowid...WHERE id = ${before})`)
//     .orderBy(sql`rowid DESC`).limit(limit).all()
//
// AFTER:
//   Decode opaque cursor -> { t: ISO-timestamp, id: UUID }
//   await db.select().from(messages)
//     .where(and(
//       eq(messages.channel_id, channelId),
//       or(
//         lt(messages.created_at, cursorDate),
//         and(eq(messages.created_at, cursorDate), lt(messages.id, cursorId))
//       )
//     ))
//     .orderBy(desc(messages.created_at), desc(messages.id))
//     .limit(limit)
//   Encode last row as next cursor -> base64url({ t, id })
```

**Pattern 8: Timestamp serialization (replaces toISOTimestamp)**
```typescript
// BEFORE: toISOTimestamp(row.created_at) — handles Date | number with * 1000 workaround
// AFTER:  row.created_at.toISOString() — Postgres timestamps are always native Date objects
```

## Implementation Plan

### Tasks

#### Phase 1: Dependencies & Schema Foundation

- [ ] Task 1: Swap database driver dependencies
  - File: `server/package.json`
  - Action: `npm install postgres` and `npm install -D @electric-sql/pglite`. Then `npm uninstall better-sqlite3 @types/better-sqlite3`.
  - Notes: `drizzle-orm/pglite` and `drizzle-orm/postgres-js` are sub-paths of `drizzle-orm` (already installed) — no separate install needed.

- [ ] Task 2: Rewrite schema definitions from SQLite to PostgreSQL
  - File: `server/src/db/schema.ts`
  - Action: Full rewrite. Replace all imports from `drizzle-orm/sqlite-core` with `drizzle-orm/pg-core`. Apply these changes:
    - Add `import { pgTable, pgEnum, text, uuid, timestamp, boolean, index } from 'drizzle-orm/pg-core';`
    - Remove `import crypto from 'node:crypto';` (no longer needed — Postgres generates UUIDs natively)
    - Remove `import { sql } from 'drizzle-orm';` (no longer needed for `unixepoch()`)
    - Create `export const roleEnum = pgEnum('role', ['owner', 'user']);`
    - Create `export const channelTypeEnum = pgEnum('channel_type', ['text', 'voice']);`
    - All `sqliteTable` -> `pgTable`
    - All `text('id').$defaultFn(() => crypto.randomUUID())` -> `uuid('id').primaryKey().defaultRandom()`
    - All `integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())` -> `timestamp('created_at', { withTimezone: true }).notNull().defaultNow()`
    - `integer('revoked', { mode: 'boolean' })` -> `boolean('revoked')`
    - `text('role', { enum: ['owner', 'user'] })` -> `roleEnum('role')`
    - `text('type', { enum: ['text', 'voice'] })` -> `channelTypeEnum('type')`
    - Messages `created_at` with `sql\`(unixepoch())\`` -> `timestamp('created_at', { withTimezone: true }).notNull().defaultNow()`
    - All `.references()`, `.index()`, `.unique()` calls remain identical
    - All `InferSelectModel` / `InferInsertModel` type exports remain identical
    - **Add composite index on messages table for cursor pagination:**
      ```typescript
      (table) => ({
        channelCreatedIdx: index('messages_channel_created_idx')
          .on(table.channel_id, table.created_at, table.id),
      })
      ```
  - Notes: See architecture doc section "Detailed Schema Translation" for the complete target schema code. The inferred TypeScript types will change slightly: `created_at` stays `Date`, `id` stays `string`, `revoked` stays `boolean`. Net impact on consuming code: minimal. The composite index supports the opaque cursor pagination query.

- [ ] Task 3: Rewrite database connection layer with dual-mode support
  - File: `server/src/db/connection.ts`
  - Action: Full rewrite. Create a dual-mode connection function:
    - Remove all `better-sqlite3` imports, `fs` imports, `path` imports
    - Import `postgres` from `'postgres'`, `drizzle` from `'drizzle-orm/postgres-js'`, and `PGlite` from `'@electric-sql/pglite'`, `drizzle as drizzlePglite` from `'drizzle-orm/pglite'`
    - Import `migrate as pgMigrate` from `'drizzle-orm/postgres-js/migrator'` and `migrate as pgliteMigrate` from `'drizzle-orm/pglite/migrator'`
    - Export `AppDatabase` type as `PgDatabase<any, typeof schema>` from `'drizzle-orm/pg-core'`. The `any` for the HKT slot is intentional — both postgres.js and PGlite return compatible query builders but their HKT types differ. The difference is encapsulated here.
    - Add `validateConnectionUrl(url: string)` internal function:
      - Parse with `new URL(url)` — throws on malformed
      - Verify protocol starts with `postgres`
      - If hostname includes `supabase.com`, verify URL contains `sslmode=require`
    - Export `createDatabase(connectionString?: string): { db: AppDatabase; close: () => Promise<void>; migrate: (folder: string) => Promise<void> }`:
      - If `connectionString` is provided OR `process.env.DATABASE_URL` is set:
        - Call `validateConnectionUrl()` on the resolved URL
        - Use `postgres()` driver with env-var-driven pool config:
          ```typescript
          const poolConfig = {
            max: parseInt(process.env.DB_POOL_MAX || '10', 10),
            idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '20', 10),
            connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10', 10),
          };
          ```
        - Return `{ db: drizzle(client, { schema }), close: () => client.end(), migrate: (folder) => pgMigrate(db, { migrationsFolder: folder }) }`
      - If neither is set: use `new PGlite()` (in-memory), return `{ db: drizzlePglite(pglite, { schema }), close: () => pglite.close(), migrate: (folder) => pgliteMigrate(db, { migrationsFolder: folder }) }`
    - Remove all SQLite PRAGMAs (WAL, foreign keys) — Postgres handles natively
    - Remove `fs.mkdirSync` for data directory
  - Notes: The dual-mode approach means tests automatically get PGlite (no DATABASE_URL set) while production gets postgres.js (DATABASE_URL from .env). The `migrate` function in the return value ensures the correct migrator is always paired with the correct driver — callers never need to know which driver is active. Unified `{ db, close, migrate }` return type simplifies plugin and test code.

- [ ] Task 4: Update Drizzle Kit configuration
  - File: `server/drizzle.config.ts`
  - Action: Change `dialect: 'sqlite'` -> `dialect: 'postgresql'`. Change `dbCredentials.url` from `process.env.DATABASE_PATH || './data/discord_clone.db'` to `process.env.DATABASE_URL || ''`.
  - Notes: The `schema` and `out` paths remain unchanged.

- [ ] Task 5: Rewrite migration runner to use dual-mode migrate function
  - File: `server/src/db/migrate.ts`
  - Action: Full rewrite. Remove the `drizzle-orm/better-sqlite3/migrator` import. The function now accepts a `migrate` function (from `createDatabase()` return) instead of a `db` instance:
    ```typescript
    export async function runMigrations(migrate: (folder: string) => Promise<void>): Promise<void> {
      await migrate(migrationsFolder);
    }
    ```
    The `migrationsFolder` path resolution stays the same. Alternatively, accept `{ db, migrate }` and call `migrate(migrationsFolder)` — choose whichever is cleaner for call sites.
  - Notes: This approach ensures PGlite tests use `drizzle-orm/pglite/migrator` and production uses `drizzle-orm/postgres-js/migrator` without the migration runner needing to know which driver is active. The migrator selection is co-located with driver selection in `connection.ts`.

- [ ] Task 6: Backup old migrations, generate fresh Postgres migrations, disable RLS
  - Action:
    1. Copy `server/drizzle/` to `server/drizzle-sqlite-backup/` (add to `.gitignore`)
    2. Delete all files in `server/drizzle/` directory
    3. Run `cd server && npx drizzle-kit generate` to create a clean initial Postgres migration
    4. Append RLS disable statements to the generated migration SQL (or create a second migration):
       ```sql
       ALTER TABLE users DISABLE ROW LEVEL SECURITY;
       ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
       ALTER TABLE channels DISABLE ROW LEVEL SECURITY;
       ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
       ALTER TABLE invites DISABLE ROW LEVEL SECURITY;
       ALTER TABLE bans DISABLE ROW LEVEL SECURITY;
       ```
  - Notes: Supabase enables RLS by default on new tables. Since the app uses custom JWT auth (not Supabase Auth), RLS policies based on `auth.uid()` are not applicable. Disabling RLS is the correct approach — if RLS is desired later, it requires a dedicated spec. The SQLite migration backup is kept until the migration is verified in production, then removed.

- [ ] Task 7: Update seed file to use async DB calls
  - File: `server/src/db/seed.ts`
  - Action: Add `await` to both DB calls and coerce the `count()` result:
    - `db.select({ value: count() }).from(channels).get()` -> `const [channelCount] = await db.select({ value: count() }).from(channels);` then check `Number(channelCount.value) > 0` (PGlite may return `string` or `bigint` for aggregates — `Number()` coercion handles all cases)
    - `db.insert(channels).values([...]).run()` -> `await db.insert(channels).values([...])`
  - Notes: Function is already declared `async` — just needs actual `await` statements. The `Number()` coercion is defensive against driver-specific aggregate return types.

#### Phase 2: Fastify Infrastructure & Shared Types

- [ ] Task 8: Update database Fastify plugin with health check
  - File: `server/src/plugins/db.ts`
  - Action:
    - Update import: `AppDatabase` type from new `connection.ts`
    - Change `const { db, sqlite } = createDatabase()` -> `const { db, close, migrate } = createDatabase()`
    - Decorate both `db` and the `migrate` function on the Fastify instance (or store `migrate` for use in `index.ts`)
    - Change `onClose` hook: `sqlite.close()` -> `await close()` (make the hook `async`)
    - Add `onReady` health check hook:
      ```typescript
      fastify.addHook('onReady', async () => {
        await fastify.db.execute(sql`SELECT 1`);
        fastify.log.info('Database connection verified');
      });
      ```
    - Update type augmentation: `FastifyInstance.db` stays `AppDatabase` (type is re-exported from connection.ts)
  - Notes: The `onReady` health check catches misconfigurations at startup instead of on first user request. The `createDatabase()` call with no args will auto-detect mode (PGlite in tests, postgres.js in production when DATABASE_URL is set).

- [ ] Task 9: Make startup sequence fully async with migration error handling
  - File: `server/src/index.ts`
  - Action: Replace the bare `runMigrations(app.db)` call with a guarded migration block:
    ```typescript
    try {
      await runMigrations(app.migrate); // or however migrate is accessed
      app.log.info('Database migrations completed');
    } catch (err) {
      app.log.fatal({ err }, 'Migration failed — aborting startup');
      process.exit(1);
    }
    ```
    The `await runSeed(app.db, app.log)` call already has `await` — no change needed.
  - Notes: Migration failure is fatal — the server cannot serve requests with an inconsistent schema. The `process.exit(1)` ensures container orchestrators restart the process.

- [ ] Task 10: Update shared WebSocket types for TEXT_ERROR
  - File: `shared/src/ws-messages.ts`
  - Action:
    - Add `TextErrorPayload` interface:
      ```typescript
      export interface TextErrorPayload {
        error: string;
      }
      ```
    - Add `TEXT_ERROR` to `WS_TYPES`:
      ```typescript
      TEXT_ERROR: 'text:error',
      ```
  - Notes: Place `TextErrorPayload` next to the existing `TextSendPayload` and `TextReceivePayload`. The `TEXT_ERROR` constant goes after `TEXT_RECEIVE` in `WS_TYPES`.

- [ ] Task 11: Update shared API types for cursor pagination
  - File: `shared/src/types.ts`
  - Action: Add `ApiPaginatedList<T>` interface:
    ```typescript
    export interface ApiPaginatedList<T> {
      data: T[];
      cursor: string | null;
      count: number;
    }
    ```
  - Notes: The existing `ApiList<T>` (`{ data: T[]; count: number }`) remains for non-paginated list endpoints. `ApiPaginatedList<T>` is used only by the message list endpoint.

- [ ] Task 12: Update shared package exports
  - File: `shared/src/index.ts`
  - Action:
    - Add `TextErrorPayload` to the ws-messages type exports
    - Add `ApiPaginatedList` to the types exports

#### Phase 3: Auth Domain

- [ ] Task 13: Convert session service to async
  - File: `server/src/plugins/auth/sessionService.ts`
  - Action: Make all 5 functions `async` and add `await` to all DB calls:
    - `createSession`: `async`, `const [session] = await db.insert(sessions).values({...}).returning();`
    - `findSessionByTokenHash`: `async`, `const [session] = await db.select().from(sessions).where(...);` return `session ?? null`
    - `deleteSession`: `async`, `await db.delete(sessions).where(...);`
    - `deleteUserSessions`: `async`, `await db.delete(sessions).where(...);`
    - `cleanExpiredSessions`: `async`, `const deleted = await db.delete(sessions).where(...).returning();` (returns array directly, remove `.all()`)
  - Notes: All callers of these functions already use them in async contexts (route handlers). Just need to add `await` at call sites in authRoutes.ts (Task 14).

- [ ] Task 14: Convert auth routes to async DB operations
  - File: `server/src/plugins/auth/authRoutes.ts`
  - Action: Add `await` to every DB call and service call that now returns a Promise:
    - `onReady` hook: `await cleanExpiredSessions(fastify.db)` — make hook function `async` if not already
    - `GET /server/status`: `const [result] = await fastify.db.select({ value: count() }).from(users);`
    - `POST /register`: Convert the `db.transaction((tx) => {...})` to `await db.transaction(async (tx) => {...})`. Inside the transaction, add `await` to ALL tx calls:
      - `const [countResult] = await tx.select({ value: count() }).from(users);`
      - `const [banCheck] = await tx.select(...).from(bans).innerJoin(...).where(...);`
      - `const [existingUser] = await tx.select().from(users).where(...);`
      - `const [newUser] = await tx.insert(users).values({...}).returning();`
      - `const [channelCountResult] = await tx.select({ value: count() }).from(channels);`
      - `await tx.insert(channels).values([...]);`
      - `await tx.update(invites).set({ revoked: true }).where(...);`
    - `POST /login`: `const [user] = await fastify.db.select().from(users).where(...);` and `const [ban] = await fastify.db.select().from(bans).where(...);`
    - `POST /refresh`: `await findSessionByTokenHash(...)`, `await deleteSession(...)`, `await createSession(...)`
    - `POST /logout`: `await findSessionByTokenHash(...)`, `await deleteSession(...)`
  - Notes: This is the most complex file. The transaction in `POST /register` has 7+ DB calls that all need `await`. The transaction callback must become `async`. The transaction returns a discriminated union (`{ error: string } | { error: null, user }`) — the outer `const result = await db.transaction(...)` must capture the return value.

#### Phase 4: Channel Domain

- [ ] Task 15: Convert channel service to async
  - File: `server/src/plugins/channels/channelService.ts`
  - Action: Make all functions `async` and add `await`:
    - `getAllChannels`: `async`, `return await db.select({...}).from(channels);` (remove `.all()`)
    - `getChannelById`: `async`, `const [channel] = await db.select({...}).from(channels).where(...);` return `channel ?? null` or `channel`
    - `createChannel`: `async`, add `await` to count check, dupe check, and insert. `const [channel] = await db.insert(channels).values({...}).returning({...});`
    - `deleteChannel`: `async`, add `await` to existence check. Convert transaction: `await db.transaction(async (tx) => { await tx.delete(messages).where(...); await tx.delete(channels).where(...); })`
  - Notes: The `deleteChannel` transaction callback must become `async`.

- [ ] Task 16: Add await to channel route handler service calls
  - File: `server/src/plugins/channels/channelRoutes.ts`
  - Action: Add `await` before all service function calls:
    - `await getAllChannels(fastify.db)`
    - `await createChannel(fastify.db, ...)`
    - `await deleteChannel(fastify.db, ...)`
  - Notes: Route handlers are already `async` — just need `await` on the now-async service calls.

#### Phase 5: Message Domain

- [ ] Task 17: Convert message service to async with opaque cursor pagination
  - File: `server/src/plugins/messages/messageService.ts`
  - Action: Full rewrite of pagination logic and timestamp handling:
    - **Delete `toISOTimestamp` function entirely.** Postgres `timestamp with time zone` returns native `Date` objects through Drizzle — no conversion workaround needed. All call sites (in this file and `messageRoutes.ts`) replace `toISOTimestamp(row.created_at)` with `row.created_at.toISOString()`.
    - **Add cursor encoding/decoding utilities:**
      ```typescript
      interface Cursor { t: string; id: string; }

      function encodeCursor(msg: { created_at: Date; id: string }): string {
        return Buffer.from(JSON.stringify({
          t: msg.created_at.toISOString(),
          id: msg.id,
        })).toString('base64url');
      }

      function decodeCursor(cursor: string): Cursor {
        return JSON.parse(Buffer.from(cursor, 'base64url').toString());
      }
      ```
    - **`createMessage`**: Make `async`. `const [message] = await db.insert(messages).values({...}).returning();`. Return value uses `row.created_at.toISOString()` instead of `toISOTimestamp()`.
    - **`getMessagesByChannel`**: Make `async`. Full rewrite:
      ```typescript
      export async function getMessagesByChannel(
        db: AppDatabase,
        channelId: string,
        limit = 50,
        cursor?: string,
      ): Promise<{ rows: typeof messages.$inferSelect[]; nextCursor: string | null }> {
        const conditions = [eq(messages.channel_id, channelId)];

        if (cursor) {
          const { t, id } = decodeCursor(cursor);
          const ts = new Date(t);
          conditions.push(
            or(
              lt(messages.created_at, ts),
              and(eq(messages.created_at, ts), lt(messages.id, id))
            )!
          );
        }

        const rows = await db.select().from(messages)
          .where(and(...conditions))
          .orderBy(desc(messages.created_at), desc(messages.id))
          .limit(limit);

        const nextCursor = rows.length === limit
          ? encodeCursor(rows[rows.length - 1])
          : null;

        return { rows, nextCursor };
      }
      ```
    - Remove all `rowid` references and `sql` import for `rowid`
    - Remove `.all()` calls — Postgres returns arrays directly
    - Update imports: add `and`, `or`, `lt`, `desc` from `drizzle-orm`
  - Notes: The `(created_at, id)` composite cursor provides deterministic ordering even when multiple messages share the same timestamp — strictly superior to both the old `rowid` approach and a timestamp-only approach. The composite index from Task 2 (`messages_channel_created_idx`) supports this query efficiently. The return type changes to `{ rows, nextCursor }` — callers must adapt.

- [ ] Task 18: Convert message routes to async with cursor response
  - File: `server/src/plugins/messages/messageRoutes.ts`
  - Action:
    - Remove import of `toISOTimestamp` — no longer exists
    - Channel existence check: `const [channel] = await fastify.db.select().from(channels).where(...);`
    - Rename query parameter from `before` to `cursor` in both the TypeScript type and the schema:
      ```typescript
      Querystring: { limit?: number; cursor?: string };
      // schema:
      querystring: { properties: { limit: {...}, cursor: { type: 'string' } } }
      ```
    - Service call: `const { rows, nextCursor } = await getMessagesByChannel(fastify.db, channelId, limit, cursor);`
    - Row mapping: replace `toISOTimestamp(row.created_at)` with `row.created_at.toISOString()`
    - Update response schema to include `cursor` field:
      ```typescript
      response: { 200: {
        type: 'object',
        required: ['data', 'cursor', 'count'],
        properties: {
          data: { type: 'array', items: {...} },
          cursor: { type: ['string', 'null'] },
          count: { type: 'number' },
        },
      }}
      ```
    - Return: `reply.send({ data, cursor: nextCursor, count: data.length })`
  - Notes: This changes the API contract. The `before` query param (message ID) is replaced by `cursor` (opaque string). The response gains a `cursor` field. Client updates in Phase 9 consume this new contract.

- [ ] Task 19: Convert message WebSocket handler to async with TEXT_ERROR
  - File: `server/src/plugins/messages/messageWsHandler.ts`
  - Action:
    - Change the `TEXT_SEND` handler callback to `async`:
      ```typescript
      registerHandler(WS_TYPES.TEXT_SEND, async (ws, message, userId) => {
      ```
    - Replace the DB error handling block. Currently:
      ```typescript
      } catch (err) {
        log.error({...}, 'Failed to store message');
        ws.close(4003, 'Failed to store message');
        return;
      }
      ```
      Change to:
      ```typescript
      } catch (err) {
        log.error({ error: (err as Error).message, channelId: payload.channelId }, 'Failed to store message');
        try {
          ws.send(JSON.stringify({
            type: WS_TYPES.TEXT_ERROR,
            payload: { error: 'MESSAGE_STORE_FAILED' } satisfies TextErrorPayload,
            id: message.id,
          }));
        } catch {
          // WS send failed — connection is dead, nothing to do
        }
        return;
      }
      ```
    - Add import: `import type { TextErrorPayload } from 'discord-clone-shared';`
    - Add `await` before `createMessage(db, ...)`
  - Notes: This keeps the WebSocket connection alive when a single message fails to persist — the client can retry or show the user an error. `message.id` carries the `tempId` so the client can match the failure to the specific optimistic message. The `satisfies TextErrorPayload` ensures type safety.

- [ ] Task 20: Update WebSocket router to support async handlers
  - File: `server/src/ws/wsRouter.ts`
  - Action:
    - Update `WsHandler` type: `export type WsHandler = (ws: WebSocket, message: WsMessage, userId: string) => void | Promise<void>;`
    - Update `routeMessage` to handle async handler returns:
      ```typescript
      const result = handler(ws, message, userId);
      if (result instanceof Promise) {
        result.catch((err) => {
          log.error({ err, userId, type: message.type }, 'Async WS handler error');
        });
      }
      ```
  - Notes: This ensures unhandled rejections from async handlers are logged instead of crashing the process. The fire-and-forget pattern (`.catch()` without await) is intentional — `routeMessage` itself is called synchronously from the WS `onmessage` event.

#### Phase 6: Other Domains

- [ ] Task 21: Convert invite service to async
  - File: `server/src/plugins/invites/inviteService.ts`
  - Action: Make DB-calling functions `async` with `await`:
    - `createInvite`: `async`, `const [invite] = await db.insert(invites).values({...}).returning();`
    - `revokeInvite`: `async`, `await db.update(invites).set({...}).where(...);`
    - `validateInvite`: `async`, `const [invite] = await db.select().from(invites).where(...);` return `invite ?? null`
    - `getInvites`: `async`, `return await db.select().from(invites);` (remove `.all()`)
  - Notes: `generateInviteToken` has no DB calls — leave as sync.

- [ ] Task 22: Convert user service to async
  - File: `server/src/plugins/users/userService.ts`
  - Action: `getAllUsers`: make `async`, `return await db.select({...}).from(users);` (remove `.all()`)
  - Notes: Single function, minimal change.

- [ ] Task 23: Convert admin service to async
  - File: `server/src/plugins/admin/adminService.ts`
  - Action: Make all functions `async` (or keep async where already async) and add `await` to all DB calls:
    - `kickUser`: `async`, `const [user] = await db.select().from(users).where(...);`
    - `banUser`: `async`, all 3 DB calls get `await`: user lookup, ban check, ban insert. `const [ban] = await db.insert(bans).values({...}).returning();`
    - `unbanUser`: `async`, both DB calls get `await`: ban lookup, ban delete
    - `resetPassword`: already `async` for bcrypt — add `await` to the 2 DB calls (user lookup, password update)
    - `getBannedUsers`: `async`, `return await db.select({...}).from(bans).innerJoin(...);` (remove `.all()`)
  - Notes: `resetPassword` already has `await` for `hashPassword()` — just needs `await` on its DB calls too.

- [ ] Task 24: Add await to admin route handler service calls
  - File: `server/src/plugins/admin/adminRoutes.ts`
  - Action: Add `await` before all service calls that are now async:
    - `await kickUser(fastify.db, ...)`
    - `await banUser(fastify.db, ...)`
    - `await unbanUser(fastify.db, ...)`
    - `await resetPassword(...)` (already has `await` — verify)
    - `await getBannedUsers(fastify.db)`
  - Notes: Route handlers are already `async`. `resetPassword` already has `await` in the route — verify the others.

- [ ] Task 25: Convert voice WebSocket handler to async where needed
  - File: `server/src/plugins/voice/voiceWsHandler.ts`
  - Action: The `handleVoiceJoin` function calls `getChannelById(db, channelId)` which is now `async`. Make `handleVoiceJoin` `async` and add `await` before `getChannelById(...)`. Wrap the DB call in try/catch:
    ```typescript
    let channel;
    try {
      channel = await getChannelById(db, channelId);
    } catch (err) {
      log.error({ err, channelId }, 'Failed to look up voice channel');
      ws.close(4003, 'Internal error');
      return;
    }
    ```
  - Notes: Only one DB call in this file. All other voice handlers are in-memory mediasoup state — no changes needed. Voice join failures are fatal for the voice session (unlike text messages), so `ws.close()` is appropriate here.

#### Phase 7: Test Infrastructure

- [ ] Task 26: Rewrite test helpers for PGlite with explicit cleanup
  - File: `server/src/test/helpers.ts`
  - Action:
    - Remove `vi.stubEnv('DATABASE_PATH', ':memory:')` if present in helpers (it's in test files — but check)
    - Track the current app instance for cleanup:
      ```typescript
      let currentApp: FastifyInstance | null = null;

      export async function setupApp(): Promise<FastifyInstance> {
        const app = await buildApp();
        await runMigrations(app.migrate); // or however migrate is accessed
        currentApp = app;
        return app;
      }

      export async function teardownApp(): Promise<void> {
        if (currentApp) {
          await currentApp.close(); // triggers onClose hook -> close()
          currentApp = null;
        }
      }
      ```
    - `seedOwner()`: Add `await` to DB insert: `const [user] = await app.db.insert(users).values({...}).returning();`
    - `seedRegularUser()`: Same — `const [user] = await app.db.insert(users).values({...}).returning();`
    - `seedUserWithSession()`: Add `await` to user insert: `const [user] = await app.db.insert(users).values({...}).returning();`. Add `await` to `createSession()` call: `await createSession(app.db, user.id, refreshToken)`
    - `seedInvite()`: Add `await` to invite insert: `await app.db.insert(invites).values({...});`. Make function `async`, return type changes to `Promise<string>`.
  - Notes: All callers of seed functions are in `beforeEach` hooks which are already `async`. The `seedInvite` sync -> async change requires updating its callers to add `await`. `teardownApp()` provides deterministic PGlite disposal — no reliance on garbage collection.

- [ ] Task 27: Update session service tests for PGlite with cleanup
  - File: `server/src/plugins/auth/sessionService.test.ts`
  - Action:
    - Replace the local `setupTestDb()` function: instead of `createDatabase(':memory:')`, call `createDatabase()` with no args (auto-detects PGlite). Make `setupTestDb` `async`:
      ```typescript
      let closeDb: () => Promise<void>;
      async function setupTestDb() {
        const { db: testDb, close, migrate } = createDatabase();
        await migrate(migrationsFolder);
        closeDb = close;
        return testDb;
      }
      ```
    - Remove `vi.stubEnv('DATABASE_PATH', ':memory:')` — PGlite is used when no DATABASE_URL is set
    - Local `seedUser()`: `const [user] = await db.insert(users).values({...}).returning();` — make `async`
    - All direct DB calls in test bodies: add `await` and use destructure pattern
    - `beforeEach` becomes `async` (may already be) and calls `db = await setupTestDb()`
    - **Add `afterEach`:** `afterEach(async () => { await closeDb(); });`
  - Notes: This file bypasses Fastify entirely — tests the service against a raw DB instance. The PGlite swap is transparent since it speaks Postgres. Explicit `close()` in `afterEach` prevents resource leaks.

- [ ] Task 28: Update channel service tests for async DB calls with cleanup
  - File: `server/src/plugins/channels/channelService.test.ts`
  - Action: Add `await` to all direct DB calls in test bodies:
    - `await app.db.insert(channels).values({...});` (remove `.run()`)
    - `const [channel] = await app.db.insert(channels).values({...}).returning();` (remove `.get()`)
    - `await app.db.insert(messages).values([...]);` (remove `.run()`)
    - `const msgs = await app.db.select().from(messages);` (remove `.all()`)
    - `const chs = await app.db.select().from(channels);` (remove `.all()`)
    - Remove `vi.stubEnv('DATABASE_PATH', ':memory:')` — PGlite auto-detected
    - **Add `afterEach`:** `afterEach(async () => { await teardownApp(); });`
  - Notes: Service calls like `createChannel()` and `deleteChannel()` are tested through the service functions (already `await`-ed by the test since they're called directly).

- [ ] Task 29: Update message routes tests for async DB calls and opaque cursors
  - File: `server/src/plugins/messages/messageRoutes.test.ts`
  - Action:
    - `beforeEach`: `const [channel] = await app.db.insert(channels).values({...}).returning();` (remove `.get()`)
    - All `createMessage()` calls in test bodies: add `await` (service is now async)
    - Remove `vi.stubEnv('DATABASE_PATH', ':memory:')`
    - **Update cursor pagination tests:** The `before` query parameter is now `cursor`. Tests that verify pagination must:
      1. Fetch the first page: `GET /:channelId/messages?limit=N`
      2. Extract the `cursor` from the response body
      3. Fetch the next page: `GET /:channelId/messages?limit=N&cursor=<value from step 2>`
      4. Verify the returned messages are the next page in order
    - **Add `afterEach`:** `afterEach(async () => { await teardownApp(); });`
  - Notes: HTTP inject tests (`app.inject()`) are already async — no changes to the inject calls themselves. The cursor value should be treated as opaque in tests — don't construct cursors manually, always use the value returned by the server.

- [ ] Task 30: Update admin service tests for async DB calls with cleanup
  - File: `server/src/plugins/admin/adminService.test.ts`
  - Action: Add `await` to all direct DB assertions:
    - `const sessions = await app.db.select().from(sessions).where(...);` (remove `.all()`)
    - `const [ban] = await app.db.select().from(bans).where(...);` (remove `.get()`)
    - `const [user] = await app.db.select().from(users).where(...);` (remove `.get()`)
    - All service calls: add `await` where missing (`await kickUser(...)`, `await banUser(...)`, etc.)
    - `await createSession(...)` calls in test setup
    - Remove `vi.stubEnv('DATABASE_PATH', ':memory:')`
    - **Add `afterEach`:** `afterEach(async () => { await teardownApp(); });`
  - Notes: This is the most DB-assertion-heavy test file. Every verification step needs `await`.

#### Phase 8: Deployment & Configuration

- [ ] Task 31: Update environment variable example
  - File: `.env.example`
  - Action:
    - Replace `DATABASE_PATH=./data/discord_clone.db` with:
      ```
      # Database — Supabase managed Postgres
      # Use session mode (port 5432) for full transaction support. SSL required.
      # Supabase connection limits: 60 direct connections on Pro tier.
      # If running multiple server instances, use Supavisor pooler (port 6543) with transaction mode.
      DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require
      ```
    - Add pool configuration variables (after DATABASE_URL):
      ```
      # Connection pool settings (defaults are suitable for single-instance deployment)
      # DB_POOL_MAX=10
      # DB_IDLE_TIMEOUT=20
      # DB_CONNECT_TIMEOUT=10
      ```
  - Notes: Keep all other env vars unchanged.

- [ ] Task 32: Remove SQLite volume from production Docker Compose
  - File: `docker-compose.yml`
  - Action: Remove `./data/sqlite:/app/data` volume from the `app` service. Add `DATABASE_URL` to the environment or `env_file` block if not already using `.env`.
  - Notes: No new containers needed — Supabase is external. The `env_file: .env` already exists in the current compose file, so `DATABASE_URL` will be picked up automatically from `.env`.

- [ ] Task 33: Add local dev Postgres to dev Docker Compose
  - File: `docker-compose.dev.yml`
  - Action: Add a `postgres` service with health check for local development:
    ```yaml
    services:
      postgres:
        image: postgres:15-alpine
        environment:
          POSTGRES_USER: discord_clone
          POSTGRES_PASSWORD: dev_password
          POSTGRES_DB: discord_clone_dev
        ports:
          - "5432:5432"
        volumes:
          - pgdata:/var/lib/postgresql/data
        healthcheck:
          test: ["CMD-SHELL", "pg_isready -U discord_clone"]
          interval: 5s
          timeout: 3s
          retries: 5

      coturn:
        image: coturn/coturn:latest
        network_mode: host
        volumes:
          - ./docker/coturn/turnserver.conf:/etc/coturn/turnserver.conf:ro
        restart: unless-stopped

    volumes:
      pgdata:
    ```
  - Notes: This provides a local Postgres for manual dev/testing against a real Postgres without needing Supabase. The health check ensures `pg_isready` passes before dependent services start. Tests still use PGlite. To use: set `DATABASE_URL=postgresql://discord_clone:dev_password@localhost:5432/discord_clone_dev` in `.env`.

#### Phase 9: Client Updates

- [ ] Task 34: Update client message store for cursor state
  - File: `client/src/renderer/src/stores/useMessageStore.ts`
  - Action:
    - Add cursor state: `cursors: new Map<string, string | null>()` in the store initial state
    - Add `setCursor` method:
      ```typescript
      setCursor: (channelId: string, cursor: string | null) => {
        const newCursors = new Map(get().cursors);
        newCursors.set(channelId, cursor);
        set({ cursors: newCursors });
      },
      ```
    - Add `getCursor` method:
      ```typescript
      getCursor: (channelId: string): string | null => {
        return get().cursors.get(channelId) ?? null;
      },
      ```
    - Update `setMessages` to also accept and store a cursor:
      ```typescript
      setMessages: (channelId: string, msgs: DecryptedMessage[], hasMore?: boolean, cursor?: string | null) => {
        // ... existing logic ...
        const newCursors = new Map(get().cursors);
        newCursors.set(channelId, cursor ?? null);
        set({ messages: newMessages, hasMoreMessages: newHasMore, cursors: newCursors });
      },
      ```
    - Update `prependMessages` similarly to accept and store a cursor
  - Notes: `getOldestMessageId` can remain for non-pagination uses but is no longer used for cursor construction. The cursor state is per-channel.

- [ ] Task 35: Update client message service for opaque cursor pagination
  - File: `client/src/renderer/src/services/messageService.ts`
  - Action:
    - Update `fetchAndDecryptMessages` to use `cursor` parameter and return cursor:
      ```typescript
      async function fetchAndDecryptMessages(
        channelId: string,
        options?: { cursor?: string },
      ): Promise<{ messages: DecryptedMessage[]; hasMore: boolean; cursor: string | null } | null> {
        let url = `/api/channels/${encodeURIComponent(channelId)}/messages?limit=${PAGE_LIMIT}`;
        if (options?.cursor) {
          url += `&cursor=${encodeURIComponent(options.cursor)}`;
        }

        const result = await apiRequest<{ data: TextReceivePayload[]; cursor: string | null; count: number }>(url, undefined, true);

        // ... decrypt result.data ...

        return { messages: decrypted, hasMore: result.cursor !== null, cursor: result.cursor };
      }
      ```
    - **Note on apiRequest:** The message list endpoint now returns `{ data, cursor, count }` instead of just `data`. The `apiRequest` function currently extracts `body.data`. For this endpoint we need the full response body. Either:
      - Add a `raw` parameter to `apiRequest` that returns the full body instead of `body.data`, OR
      - Call `fetch` directly for this endpoint, OR
      - Have `apiRequest` return `body` when a flag is set
      Choose the approach that is least invasive. The simplest is to add an optional `returnFullBody` parameter.
    - Update `fetchMessages`: pass cursor to `setMessages`:
      ```typescript
      useMessageStore.getState().setMessages(channelId, data.messages, data.hasMore, data.cursor);
      ```
    - Update `fetchOlderMessages`: use cursor instead of message ID:
      ```typescript
      export async function fetchOlderMessages(channelId: string): Promise<void> {
        const store = useMessageStore.getState();
        const cursor = store.getCursor(channelId);
        if (!cursor) return; // no more pages

        store.setLoadingMore(true);
        try {
          const data = await fetchAndDecryptMessages(channelId, { cursor });
          if (!data) {
            useMessageStore.getState().setLoadingMore(false);
            return;
          }
          useMessageStore.getState().prependMessages(channelId, data.messages, data.hasMore, data.cursor);
          useMessageStore.getState().setLoadingMore(false);
        } catch {
          useMessageStore.getState().setLoadingMore(false);
        }
      }
      ```
  - Notes: The `hasMore` check changes from `result.length === PAGE_LIMIT` (a heuristic that produces a redundant empty fetch when total messages are an exact multiple of page size) to `cursor !== null` (deterministic — the server knows if there are more pages).

- [ ] Task 36: Add retry wrapper to API client for transient GET failures
  - File: `client/src/renderer/src/services/apiClient.ts`
  - Action: Add a `withRetry` utility and integrate it for GET requests:
    ```typescript
    async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (err) {
          if (attempt === maxRetries) throw err;
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
      throw new Error('unreachable');
    }
    ```
    Export a convenience function for retriable GET requests:
    ```typescript
    export async function apiGet<T>(path: string): Promise<T> {
      return withRetry(() => apiRequest<T>(path));
    }
    ```
    Update `messageService.ts` and any other GET-only callers to use `apiGet` instead of `apiRequest` for read operations.
  - Notes: Only idempotent GET requests are retried. Mutations (POST/PUT/DELETE) continue using `apiRequest` directly — no retry. The linear backoff (500ms, 1000ms) is deliberately simple. No exponential backoff or circuit breakers needed at this scale.

- [ ] Task 37: Add TEXT_ERROR WebSocket handler on client
  - File: `client/src/renderer/src/services/wsClient.ts`
  - Action: Add a case for `TEXT_ERROR` in the `handleMessage` method, after the `TEXT_RECEIVE` case:
    ```typescript
    } else if (message.type === WS_TYPES.TEXT_ERROR) {
      if (message.id) {
        import('../stores/useMessageStore').then(({ default: useMessageStore }) => {
          useMessageStore.getState().markMessageFailed(message.id!);
        }).catch((err) => {
          console.warn('[wsClient] Failed to mark message as failed:', err);
        });
      }
    }
    ```
  - Notes: The `message.id` carries the `tempId` from the original `TEXT_SEND`. The existing `markMessageFailed` method already sets the message status to `'failed'` and displays an error to the user — no additional UI work needed. This replaces the `ws.close(4003)` behavior where the entire connection would drop and trigger a full reconnect cycle.

#### Phase 10: Documentation Updates

- [ ] Task 38: Update project context for AI agents
  - File: `_bmad-output/project-context.md`
  - Action: Update Technology Stack table: `better-sqlite3 v12.6.x` -> `postgres (postgres.js)`, `SQLite` -> `PostgreSQL (Supabase)`. Add `@electric-sql/pglite` to test tools. Update "Database Naming" section to remove SQLite-specific notes. Update "Dates" rule: `Unix timestamps in SQLite storage` -> `Postgres timestamps with timezone`. Update Docker Compose volumes description. Update JWT note: `refresh tokens stored hashed in SQLite` -> `in PostgreSQL`. Add note about opaque cursor pagination pattern.
  - Notes: Keep all non-database rules unchanged.

- [ ] Task 39: Update data models documentation
  - File: `docs/data-models-server.md`
  - Action: Update ORM/Database sections. Replace SQLite config references with Postgres connection details. Update type columns documentation (uuid, timestamp, boolean, pgEnum). Remove SQLite PRAGMA references. Add composite messages index documentation.
  - Notes: Check if file exists first — only update if present.

- [ ] Task 40: Update server architecture documentation
  - File: `docs/architecture-server.md`
  - Action: Update Database Architecture section. Update deployment diagram to show external Supabase instead of local SQLite volume. Update connection layer description. Document dual-mode connection, TEXT_ERROR WebSocket pattern, and opaque cursor pagination.
  - Notes: Check if file exists first — only update if present.

#### Phase 11: Validation

- [ ] Task 41: TypeScript compilation check
  - Action: Run `cd server && npx tsc --noEmit` to verify zero type errors after all changes. Then run `cd shared && npx tsc --noEmit` and `cd client && npx tsc --noEmit`.
  - Notes: Fix any type errors before proceeding. Common issues: `AppDatabase` type mismatches, missing `await` causing type inference issues, PGlite vs postgres.js type compatibility, new shared type imports. Verify `PgDatabase<any, typeof schema>` compiles cleanly for both driver contexts.

- [ ] Task 42: Run full test suite
  - Action: Run `cd server && npm test` to execute all tests against PGlite.
  - Notes: All tests should pass. Specific things to verify:
    - Cursor pagination tests use opaque cursors from server responses, not manually constructed values
    - PGlite `pgEnum` and `uuid` generation work correctly
    - `count()` aggregate returns a value that `Number()` coercion handles correctly
    - `afterEach` teardown doesn't cause test runner issues (e.g., double-close)
    - Migrations apply successfully against PGlite (the dual-mode migrator uses `drizzle-orm/pglite/migrator`)

- [ ] Task 43: Verify rollback procedure
  - Action:
    1. From the migration branch, create a test rollback: `git stash` or note the commit
    2. `git checkout` the pre-migration commit
    3. Verify `npm install && npm test` passes on the pre-migration state
    4. Return to the migration branch
  - Notes: This is a verification task, not a destructive action. It confirms the pre-migration state is functional and reachable. The SQLite migration backup (`server/drizzle-sqlite-backup/`) should be intact.

### Acceptance Criteria

#### Schema & Connection

- [ ] AC 1: Given the new schema.ts, when Drizzle Kit generates migrations, then a valid Postgres migration is produced with all 6 tables, 2 enums, all indexes (including the composite `messages_channel_created_idx`), and all foreign key constraints.
- [ ] AC 2: Given `DATABASE_URL` is set to a valid Postgres connection string, when `createDatabase()` is called, then it returns a working `{ db, close, migrate }` using postgres.js driver with connection pooling.
- [ ] AC 3: Given `DATABASE_URL` is NOT set, when `createDatabase()` is called, then it returns a working `{ db, close, migrate }` using PGlite in-memory.
- [ ] AC 4: Given the new connection layer, when `close()` is called, then the connection pool is drained (postgres.js) or the PGlite instance is closed cleanly with no hanging processes.
- [ ] AC 5: Given `DATABASE_URL` is set to a malformed string, when `createDatabase()` is called, then it throws a descriptive error before attempting to connect.
- [ ] AC 6: Given `DATABASE_URL` points to a Supabase URL without `sslmode=require`, when `createDatabase()` is called, then it throws an error requiring SSL.

#### Supabase Configuration

- [ ] AC 7: Given the generated Postgres migration is applied to a fresh Supabase database, then RLS is disabled on all 6 application tables.

#### Async Migration

- [ ] AC 8: Given any service function that previously used `.get()`, when called with `await`, then it returns a single row (or undefined/null) via array destructuring `[result]`.
- [ ] AC 9: Given any service function that previously used `.all()`, when called with `await`, then it returns an array of rows directly (no `.all()` needed).
- [ ] AC 10: Given any service function that previously used `.run()`, when called with `await`, then the write operation completes without returning data.
- [ ] AC 11: Given the registration transaction in `authRoutes.ts`, when a race condition occurs (two simultaneous first-user registrations), then only one user gets the `owner` role — the transaction provides atomicity.
- [ ] AC 12: Given the deleteChannel transaction in `channelService.ts`, when a channel with messages is deleted, then both the messages and the channel are removed atomically.

#### Cursor Pagination

- [ ] AC 13: Given a channel with 100 messages, when `getMessagesByChannel` is called with `limit=50` and no cursor, then the 50 most recent messages are returned ordered by newest first, and a non-null `nextCursor` is returned.
- [ ] AC 14: Given a channel with 100 messages, when `getMessagesByChannel` is called with the `nextCursor` from the first page, then the next 50 messages are returned ordered by newest first, and `nextCursor` is null (no more pages).
- [ ] AC 15: Given 3 messages inserted with the same `created_at` timestamp, when paginated with `limit=1`, then each page returns exactly one message with no duplicates or skipped messages across pages.

#### WebSocket Error Handling

- [ ] AC 16: Given a `TEXT_SEND` message where `createMessage` throws a DB error, when the error is caught, then a `TEXT_ERROR` frame is sent to the sender with the original `tempId`, and the WebSocket connection remains open.
- [ ] AC 17: Given the client receives a `TEXT_ERROR` frame, when the `tempId` matches an optimistic message, then that message is marked as `'failed'` in the message store.

#### Test Infrastructure

- [ ] AC 18: Given no `DATABASE_URL` environment variable, when `setupApp()` is called in a test, then a PGlite in-memory database is created, migrations are applied using `drizzle-orm/pglite/migrator`, and the app is ready for testing.
- [ ] AC 19: Given a test suite with `beforeEach` creating a fresh app and `afterEach` calling `teardownApp()`, when multiple tests run sequentially, then each test gets a clean database with no cross-test contamination and no resource leaks.
- [ ] AC 20: Given the full test suite, when `npm test` is run, then all existing tests pass against PGlite with no behavioral regressions.

#### Client

- [ ] AC 21: Given the updated client message service, when `fetchOlderMessages` is called, then it uses the opaque `cursor` from the previous server response instead of constructing a cursor from the oldest message ID.
- [ ] AC 22: Given a transient server error (500) on a GET request, when `apiGet` is called, then the request is retried up to 2 times with linear backoff before throwing.
- [ ] AC 23: Given the client receives a `TEXT_ERROR` frame via WebSocket, when the frame contains a `tempId`, then the corresponding optimistic message is marked as failed and the connection remains open.

#### Deployment

- [ ] AC 24: Given the updated `docker-compose.yml`, when the app container starts with `DATABASE_URL` pointing to Supabase, then the server connects, runs migrations, seeds default channels, and starts listening.
- [ ] AC 25: Given the Fastify server is running, when a graceful shutdown is triggered (SIGTERM), then the database connection pool is drained via the `onClose` hook before the process exits.
- [ ] AC 26: Given the db plugin's `onReady` hook, when the database is reachable, then `SELECT 1` succeeds and a log message confirms the connection.

#### End-to-End Behavioral

- [ ] AC 27: Given a fresh Supabase database, when the full registration -> login -> send message -> fetch messages -> paginate flow is exercised, then all operations succeed with correct data in Postgres and the client receives opaque cursors for pagination.
- [ ] AC 28: Given the server is running against Supabase, when an admin bans a user, then the ban record exists in Postgres and the banned user cannot log in.

## Additional Context

### Dependencies

**Add:**
- `postgres` — Postgres driver for Node.js (production)
- `@electric-sql/pglite` (devDependency) — In-process Postgres for tests

**Remove:**
- `better-sqlite3` — SQLite driver
- `@types/better-sqlite3` — Type definitions for SQLite driver

**Already available (sub-paths of drizzle-orm):**
- `drizzle-orm/pg-core` — Postgres schema builders
- `drizzle-orm/postgres-js` — postgres.js Drizzle adapter
- `drizzle-orm/pglite` — PGlite Drizzle adapter
- `drizzle-orm/postgres-js/migrator` — Async Postgres migration runner (production)
- `drizzle-orm/pglite/migrator` — Async PGlite migration runner (tests)

### Testing Strategy

- **PGlite in-memory:** Each test suite creates a fresh PGlite instance — no shared state, no Docker dependency
- **Two test tiers preserved:**
  - `sessionService.test.ts`: Direct `createDatabase()` -> PGlite — no Fastify app, lightweight
  - `channelService/messageRoutes/adminService tests`: Full `setupApp()` with PGlite-backed DB
  - `authService.test.ts`: No changes — pure function tests, no DB involvement
- **Dual-mode migration:** `createDatabase()` returns a driver-matched `migrate` function. Tests use `drizzle-orm/pglite/migrator`, production uses `drizzle-orm/postgres-js/migrator`. Same migration SQL files, different execution engine.
- **Test isolation:** `beforeEach` creates fresh PGlite instance per test (new `setupApp()` or new `createDatabase()`). **`afterEach` calls `teardownApp()` or `close()` for deterministic cleanup** — PGlite manages an embedded Postgres engine with file descriptors and memory-mapped state, so explicit disposal prevents resource leaks.
- **Migration in tests:** `await runMigrations(migrate)` runs the same Postgres migrations as production — tests validate the real schema

### Rollback Procedure

If the migration fails in production, follow this checklist:

1. `git revert <migration-merge-commit>` — creates a new revert commit
2. `cd server && npm install` — restores `better-sqlite3`, removes `postgres`
3. Restore SQLite volume mount in `docker-compose.yml` (`./data/sqlite:/app/data`)
4. Restore `.env` with `DATABASE_PATH=./data/discord_clone.db` (remove `DATABASE_URL`)
5. Copy `server/drizzle-sqlite-backup/` back to `server/drizzle/`
6. Verify locally: `npm test` passes
7. Deploy the revert commit
8. Verify production: server starts and connects to existing SQLite file

The SQLite backup (`server/drizzle-sqlite-backup/`) must not be deleted until the migration is verified in production.

### Notes

- Architecture document (`supabase-migration-architecture.md`) is the authoritative reference for schema translations and connection patterns
- `authService.ts` does NOT need changes — confirmed no DB calls (pure bcrypt/JWT/crypto)
- `toISOTimestamp()` is deleted — Postgres timestamps are native `Date` objects through Drizzle, `.toISOString()` is used directly
- Supabase connection string must use `?sslmode=require` for production, session mode port 5432
- **Supabase RLS:** Disabled on all tables via migration. The app uses custom JWT auth, not Supabase Auth — Supabase RLS policies (`auth.uid()`) are not applicable.
- **Supabase connection limits:** 60 direct connections on Pro tier. `DB_POOL_MAX=10` is suitable for single-instance deployment. If running multiple replicas, use Supavisor pooler (port 6543) with transaction mode.
- **Opaque cursor design:** The `base64url({ t, id })` cursor encoding is intentionally simple. If cursor tampering is a concern in the future, add HMAC signing. For now, the worst case of a malformed cursor is a 400 error.
- **WsHandler async support:** The `routeMessage` function uses `.catch()` on the handler Promise (fire-and-forget) rather than `await`, because `routeMessage` is called from the synchronous `ws.onmessage` event. Errors are logged, not propagated.
- **Risk: PGlite compatibility** — PGlite supports most Postgres features but may have edge cases with `pgEnum` or `uuid` generation. If issues arise during Task 42, document and patch.

# Data Models — Server

**Generated:** 2026-02-26 | **Scan Level:** Exhaustive | **Source:** All schema and migration files read

## Overview

- **ORM:** Drizzle ORM 0.45.1
- **Database:** SQLite via better-sqlite3 12.6.2
- **Schema File:** `server/src/db/schema.ts`
- **Connection:** `server/src/db/connection.ts` (WAL mode, foreign keys enabled)
- **Migrations:** `server/drizzle/` (4 sequential migrations via drizzle-kit)
- **Tables:** 6
- **Total Columns:** 33
- **Foreign Keys:** 6
- **Indexes:** 7

## Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │     │   sessions   │     │    invites   │
│──────────────│     │──────────────│     │──────────────│
│ id (PK)      │◄────│ user_id (FK) │     │ id (PK)      │
│ username     │     │ id (PK)      │     │ token        │
│ password_hash│     │ refresh_token│     │ created_by───│──► users.id
│ role         │     │ _hash        │     │ revoked      │
│ public_key   │     │ expires_at   │     │ created_at   │
│ encrypted_   │     │ created_at   │     └──────────────┘
│ group_key    │     └──────────────┘
│ created_at   │
└──────┬───────┘
       │
       │  ┌──────────────┐     ┌──────────────┐
       │  │     bans     │     │   channels   │
       │  │──────────────│     │──────────────│
       ├──│ user_id (FK) │     │ id (PK)      │◄─┐
       └──│ banned_by(FK)│     │ name         │  │
          │ id (PK)      │     │ type         │  │
          │ created_at   │     │ created_at   │  │
          └──────────────┘     └──────────────┘  │
                                                  │
                               ┌──────────────┐  │
                               │   messages   │  │
                               │──────────────│  │
                               │ id (PK)      │  │
                               │ channel_id───│──┘
                               │ user_id (FK) │──► users.id
                               │ encrypted_   │
                               │ content      │
                               │ nonce        │
                               │ created_at   │
                               └──────────────┘
```

## Table Definitions

### `users`

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | TEXT | PRIMARY KEY | `crypto.randomUUID()` | Unique user identifier |
| `username` | TEXT | NOT NULL, UNIQUE | — | Login username (3-32 chars, alphanumeric + underscore) |
| `password_hash` | TEXT | NOT NULL | — | bcrypt hash (cost factor 12) |
| `role` | TEXT | NOT NULL | `'user'` | `'owner'` or `'user'` |
| `public_key` | TEXT | nullable | — | Base64-encoded X25519 public key for E2E encryption |
| `encrypted_group_key` | TEXT | nullable | — | Base64-encoded sealed box (group key encrypted for this user) |
| `created_at` | INTEGER | NOT NULL | `new Date()` | Unix timestamp (milliseconds) |

**Indexes:** `users_username_unique` (UNIQUE on `username`)

**Notes:**
- First registered user gets `role = 'owner'` automatically
- `public_key` sent during registration; server uses it to encrypt group key via `crypto_box_seal`
- `encrypted_group_key` returned on login/register for client-side decryption

### `sessions`

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | TEXT | PRIMARY KEY | `crypto.randomUUID()` | Session identifier |
| `user_id` | TEXT | NOT NULL, FK → users.id | — | Owner of this session |
| `refresh_token_hash` | TEXT | NOT NULL | — | SHA-256 hash of the refresh token |
| `expires_at` | INTEGER | NOT NULL | — | Unix timestamp when refresh token expires |
| `created_at` | INTEGER | NOT NULL | `new Date()` | Session creation time |

**Indexes:** `idx_sessions_user_id` on `user_id`

**Notes:**
- Refresh tokens are never stored in plaintext; only SHA-256 hashes are persisted
- Token rotation: on refresh, old session deleted, new session created
- All sessions deleted on kick/ban/password reset (force logout)
- Expired sessions cleaned on server startup

### `invites`

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | TEXT | PRIMARY KEY | `crypto.randomUUID()` | Invite record identifier |
| `token` | TEXT | NOT NULL, UNIQUE | — | Invite token string (used in URLs) |
| `created_by` | TEXT | NOT NULL, FK → users.id | — | Owner who created the invite |
| `revoked` | INTEGER | NOT NULL | `false` (0) | Whether invite has been revoked |
| `created_at` | INTEGER | NOT NULL | `new Date()` | Creation timestamp |

**Indexes:** `invites_token_unique` (UNIQUE on `token`)

### `bans`

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | TEXT | PRIMARY KEY | `crypto.randomUUID()` | Ban record identifier |
| `user_id` | TEXT | NOT NULL, FK → users.id | — | Banned user |
| `banned_by` | TEXT | NOT NULL, FK → users.id | — | Admin who issued the ban |
| `created_at` | INTEGER | NOT NULL | `new Date()` | Ban timestamp |

**Indexes:** `idx_bans_user_id` on `user_id`

**Notes:**
- Ban check occurs at login time (returns `ACCOUNT_BANNED` error)
- Unbanning deletes the ban record entirely
- Banning also deletes all user sessions (immediate force-logout)

### `channels`

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | TEXT | PRIMARY KEY | `crypto.randomUUID()` | Channel identifier |
| `name` | TEXT | NOT NULL, UNIQUE | — | Channel display name (1-32 chars) |
| `type` | TEXT | NOT NULL | — | `'text'` or `'voice'` |
| `created_at` | INTEGER | NOT NULL | `new Date()` | Creation timestamp |

**Indexes:** `idx_channels_type` on `type`, `channels_name_unique` (UNIQUE on `name`)

**Notes:**
- Maximum 50 channels per server (enforced in `channelService`)
- Default seed channels: `general` (text), `Gaming` (voice)

### `messages`

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | TEXT | PRIMARY KEY | `crypto.randomUUID()` | Message identifier |
| `channel_id` | TEXT | NOT NULL, FK → channels.id | — | Channel this message belongs to |
| `user_id` | TEXT | NOT NULL, FK → users.id | — | Message author |
| `encrypted_content` | TEXT | NOT NULL | — | E2E encrypted message content (base64 ciphertext) |
| `nonce` | TEXT | NOT NULL | — | Encryption nonce (base64, 24 bytes) |
| `created_at` | INTEGER | NOT NULL | `unixepoch()` | Message timestamp (SQLite function) |

**Indexes:** `idx_messages_channel_id` on `channel_id`, `idx_messages_created_at` on `created_at`

**Notes:**
- Server never sees plaintext message content
- Pagination via cursor: `GET /api/channels/:channelId/messages?before=<messageId>&limit=50`
- Maximum message length: 2000 characters (validated before encryption on client)

## Migration History

| # | File | Changes |
|---|------|---------|
| 0000 | `0000_groovy_mojo.sql` | Initial schema: `users`, `sessions`, `invites`, `bans`, `channels` tables with all indexes |
| 0001 | `0001_thin_leader.sql` | Added `encrypted_group_key` column to `users` table |
| 0002 | `0002_rainy_namorita.sql` | Added `messages` table with foreign keys and indexes |
| 0003 | `0003_cloudy_red_skull.sql` | Added unique index on `channels.name` |

## Database Configuration

- **WAL Mode:** Enabled for file-based databases (concurrent reads during writes)
- **Foreign Keys:** Explicitly enabled via `PRAGMA foreign_keys = ON`
- **In-Memory Support:** `:memory:` path for testing (WAL not used)
- **Connection:** Synchronous via better-sqlite3 (no connection pool needed for SQLite)
- **Location:** Configurable via `DATABASE_PATH` env var (default: `./data/discord_clone.db`)
- **Docker Volume:** `./data/sqlite:/app/data` maps host directory into container

## Seeding

Seeds default channels if the channels table is empty:
- `general` (type: `text`)
- `Gaming` (type: `voice`)

Also triggered during first-user registration (within a transaction).

## In-Memory State (Not Persisted)

| Data | Storage | Purpose |
|------|---------|---------|
| WebSocket connections | `Map<userId, WebSocket>` | Active connection tracking |
| Online presence | `Set<userId>` | Who is currently online |
| Voice peers | `Map<userId, VoicePeer>` | Active voice participants with mediasoup transports/producers/consumers |
| mediasoup Worker/Router | Singleton objects | SFU media processing |

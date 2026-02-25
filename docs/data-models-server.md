# Data Models - Server

**Generated:** 2026-02-24 | **Scan Level:** Quick | **Part:** server

## Overview

- **Database:** SQLite (via better-sqlite3)
- **ORM:** Drizzle ORM 0.45.1
- **Schema Location:** `server/src/db/schema.ts`
- **Migrations:** `server/drizzle/` (Drizzle Kit managed)

## Tables

### users

Primary user account table.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `username` | TEXT | UNIQUE, NOT NULL | Unique username |
| `password_hash` | TEXT | NOT NULL | bcrypt hashed password |
| `role` | TEXT | NOT NULL, DEFAULT 'user' | 'owner' or 'user' |
| `public_key` | TEXT | NULLABLE | X25519 public key for E2E encryption |
| `encrypted_group_key` | TEXT | NULLABLE | Sealed box encrypted group key |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |

**Indexes:** `users_username_unique`

### sessions

Active authentication sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `user_id` | TEXT | FK → users.id, NOT NULL | Session owner |
| `refresh_token_hash` | TEXT | NOT NULL | bcrypt hash of refresh token |
| `expires_at` | INTEGER | NOT NULL | Unix timestamp expiration |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |

**Indexes:** `idx_sessions_user_id`

### invites

Single-use registration invite tokens.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `token` | TEXT | UNIQUE, NOT NULL | Invite token string |
| `created_by` | TEXT | FK → users.id, NOT NULL | Owner who created invite |
| `revoked` | INTEGER | DEFAULT false | Boolean (0/1) |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |

**Indexes:** `invites_token_unique`

### bans

User ban records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `user_id` | TEXT | FK → users.id, NOT NULL | Banned user |
| `banned_by` | TEXT | FK → users.id, NOT NULL | Admin who issued ban |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |

**Indexes:** `idx_bans_user_id`

### channels

Communication channels (text and voice).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `name` | TEXT | NOT NULL | Channel display name |
| `type` | TEXT | NOT NULL | 'text' or 'voice' |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |

**Indexes:** `idx_channels_type`

## Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐
│    users     │       │   sessions   │
│──────────────│       │──────────────│
│ id (PK)      │←──┐   │ id (PK)      │
│ username     │   │   │ user_id (FK) │──→ users.id
│ password_hash│   │   │ refresh_hash │
│ role         │   │   │ expires_at   │
│ public_key   │   │   │ created_at   │
│ enc_group_key│   │   └──────────────┘
│ created_at   │   │
└──────────────┘   │   ┌──────────────┐
                   │   │   invites    │
                   │   │──────────────│
                   │   │ id (PK)      │
                   ├──→│ created_by   │──→ users.id
                   │   │ token        │
                   │   │ revoked      │
                   │   │ created_at   │
                   │   └──────────────┘
                   │
                   │   ┌──────────────┐
                   │   │    bans      │
                   │   │──────────────│
                   │   │ id (PK)      │
                   ├──→│ user_id (FK) │──→ users.id
                   └──→│ banned_by(FK)│──→ users.id
                       │ created_at   │
                       └──────────────┘

┌──────────────┐
│   channels   │  (no FKs currently - standalone)
│──────────────│
│ id (PK)      │
│ name         │
│ type         │
│ created_at   │
└──────────────┘
```

## Migrations

| Migration | File | Description |
|-----------|------|-------------|
| 0000 | `0000_steep_galactus.sql` | Initial schema: all 5 tables, PKs, FKs, indexes, unique constraints |
| 0001 | `0001_add_encrypted_group_key.sql` | Added `encrypted_group_key` column to users table |

## Drizzle Configuration

```typescript
// server/drizzle.config.ts
{
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_PATH || './data/discord_clone.db'
  }
}
```

## Database Commands

```bash
npm run db:generate   # Generate migration from schema changes
npm run db:migrate    # Run pending migrations
npm run db:push       # Push schema directly (dev only)
npm run db:studio     # Open Drizzle Studio GUI
```

## Planned Tables (from shared types)

Based on the shared library's `Message` type and WebSocket protocol, these tables are likely planned:
- **messages** - Text messages (id, channelId, authorId, content, encrypted, nonce, timestamps)
- Additional server/guild management tables may be added in future epics

# Architecture - Server (Fastify Backend API)

**Generated:** 2026-02-24 | **Scan Level:** Quick | **Part:** server | **Type:** Backend

## Executive Summary

The server is a Fastify 5-based REST API with SQLite as the database (via better-sqlite3 and Drizzle ORM). It follows a plugin-based architecture where each domain (auth, users, invites, channels) is an isolated Fastify plugin with its own routes and service layer. Authentication uses JWT with access/refresh token pattern and bcrypt for password hashing.

## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Fastify | 5.7.0 |
| Language | TypeScript | ~5.9.3 |
| ORM | Drizzle ORM | 0.45.1 |
| Database | SQLite (better-sqlite3) | 12.6.2 |
| Auth | jsonwebtoken | 9.0.3 |
| Password Hashing | bcrypt | 6.0.0 |
| Encryption | libsodium-wrappers | 0.8.2 |
| CORS | @fastify/cors | 11.2.0 |
| Config | dotenv | 16.6.1 |
| Logging | Pino (via Fastify) + pino-pretty | 13.1.3 |
| Dev Tool | tsx | 4.21.0 |
| Testing | Vitest | 4.0.0 |

## Architecture Pattern

**Plugin-Based Fastify with Domain-Driven Organization**

```
┌──────────────────────────────────────────┐
│            Fastify Application           │
│  (app.ts - factory pattern)              │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │        Domain Plugins            │    │
│  │                                  │    │
│  │  ┌──────┐ ┌──────┐ ┌─────────┐  │    │
│  │  │ Auth │ │Users │ │ Invites │  │    │
│  │  │Routes│ │Routes│ │ Routes  │  │    │
│  │  │Service││Service││ Service │  │    │
│  │  │Middle.│ └──────┘ └─────────┘  │    │
│  │  │Session│                       │    │
│  │  └──────┘ ┌──────────┐          │    │
│  │           │ Channels │          │    │
│  │           │ Routes   │          │    │
│  │           │ Service  │          │    │
│  │           └──────────┘          │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │        Database Layer            │    │
│  │  schema.ts → connection.ts       │    │
│  │  migrate.ts → seed.ts           │    │
│  │  Drizzle ORM + SQLite           │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │        Shared Services           │    │
│  │  encryptionService.ts           │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

## Plugin Architecture

Each domain is a Fastify plugin encapsulating its own routes and business logic:

### Auth Plugin (`plugins/auth/`)
- **authRoutes.ts**: Registration, login, refresh, logout endpoints
- **authService.ts**: Password hashing, user creation, credential validation
- **authMiddleware.ts**: JWT verification, request decoration with user context
- **sessionService.ts**: Refresh token lifecycle, session creation/validation/revocation

### Users Plugin (`plugins/users/`)
- **userRoutes.ts**: User listing endpoint
- **userService.ts**: User query logic

### Invites Plugin (`plugins/invites/`)
- **inviteRoutes.ts**: Invite CRUD (create, list, validate, revoke)
- **inviteService.ts**: Invite token generation, validation, usage tracking

### Channels Plugin (`plugins/channels/`)
- **channelRoutes.ts**: Channel listing endpoint
- **channelService.ts**: Channel query logic

### Database Plugin (`plugins/db.ts`)
- Registers the database connection as a Fastify decoration

## Database Architecture

### Connection
- SQLite via better-sqlite3 (synchronous, embedded)
- Database path configurable via `DATABASE_PATH` env var (default: `./data/discord_clone.db`)
- Drizzle ORM for type-safe queries

### Schema (5 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | id, username, password_hash, role, public_key, encrypted_group_key |
| `sessions` | Auth sessions | id, user_id (FK), refresh_token_hash, expires_at |
| `invites` | Registration invites | id, token, created_by (FK), revoked |
| `bans` | User bans | id, user_id (FK), banned_by (FK) |
| `channels` | Communication channels | id, name, type (text/voice) |

### Migrations
- Managed by Drizzle Kit (`drizzle-kit generate/migrate/push`)
- Migration files in `drizzle/` directory
- Current migrations: initial schema + encryption group key column

## API Design

### Base Pattern
- All endpoints prefixed with `/api/`
- Consistent response envelopes: `{ data }` for success, `{ error }` for failure
- Pino structured logging

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public | Register with invite token |
| POST | `/api/auth/login` | Public | Login with credentials |
| POST | `/api/auth/refresh` | Public | Refresh access token |
| POST | `/api/auth/logout` | Required | Invalidate session |
| GET | `/api/channels` | Required | List all channels |
| GET | `/api/users` | Required | List all users |
| POST | `/api/invites` | Owner only | Create invite token |
| GET | `/api/invites` | Owner only | List all invites |
| GET | `/api/invites/:token/validate` | Public | Validate invite token |
| DELETE | `/api/invites/:id` | Owner only | Revoke invite |
| GET | `/api/health` | Public | Health check (API + DB) |

## Authentication & Authorization

### Token Strategy
- **Access Token**: JWT, 15-minute expiry, sent in Authorization header
- **Refresh Token**: JWT, 7-day expiry, stored as bcrypt hash in sessions table
- **Token Refresh Flow**: Client sends refresh token → server validates hash → issues new access token

### Roles
- **owner**: Full admin access (create/revoke invites, manage bans)
- **user**: Standard member access

### Middleware
- `authMiddleware.ts`: Verifies JWT, decorates request with user info
- Applied per-route (not globally)

## Encryption

- Server-side encryption service using libsodium
- Generates sealed box encryption for group keys during registration
- Stores user public keys for key exchange

## Entry Points

| File | Purpose |
|------|---------|
| `src/index.ts` | Server bootstrap - loads env, creates app, starts listening |
| `src/app.ts` | Fastify app factory - registers CORS, plugins, health check |

## Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `NODE_ENV` | `development` | Environment |
| `JWT_ACCESS_SECRET` | - | Access token signing key |
| `JWT_REFRESH_SECRET` | - | Refresh token signing key |
| `DATABASE_PATH` | `./data/sqlite/discord-clone.db` | SQLite database path |
| `LOG_LEVEL` | `info` | Pino log level |

## Testing Strategy

- **Framework**: Vitest 4
- **Pattern**: Tests co-located with source files (`.test.ts`)
- **Test helpers**: `src/test/helpers.ts` for shared test utilities
- **Coverage areas**: Routes (auth, users, invites, channels), services (auth, session, encryption), database (schema, connection, seed)

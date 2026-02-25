# API Contracts - Server

**Generated:** 2026-02-24 | **Scan Level:** Quick | **Part:** server

## Overview

- **Base URL:** `http://localhost:3000` (configurable via PORT/HOST env vars)
- **API Prefix:** `/api/`
- **Response Format:** `{ data: T }` for success, `{ error: { code, message } }` for errors
- **Auth Method:** JWT Bearer token in Authorization header
- **Content Type:** application/json

## Response Types (from shared library)

```typescript
type ApiSuccess<T> = { data: T }
type ApiList<T> = { data: T[], count: number }
type ApiError = { error: { code: string, message: string } }
type AuthTokens = { accessToken: string, refreshToken: string }
```

## Endpoints

### Health Check

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | API and database status |

---

### Authentication (`/api/auth/`)

#### POST `/api/auth/register`
- **Auth:** None (public)
- **Description:** Register a new user with a valid invite token
- **Request Body:**
  - `username` (string, required)
  - `password` (string, required)
  - `inviteToken` (string, required) - Single-use invite token
  - `publicKey` (string, optional) - X25519 public key for E2E encryption
- **Response:** `{ data: { user, tokens: AuthTokens, encryptedGroupKey? } }`

#### POST `/api/auth/login`
- **Auth:** None (public)
- **Description:** Authenticate with username/password
- **Request Body:**
  - `username` (string, required)
  - `password` (string, required)
- **Response:** `{ data: { user, tokens: AuthTokens } }`

#### POST `/api/auth/refresh`
- **Auth:** None (public)
- **Description:** Refresh an expired access token
- **Request Body:**
  - `refreshToken` (string, required)
- **Response:** `{ data: { accessToken } }`

#### POST `/api/auth/logout`
- **Auth:** Required (Bearer token)
- **Description:** Invalidate current session
- **Request Body:**
  - `refreshToken` (string, required)
- **Response:** `{ data: { success: true } }`

---

### Channels (`/api/channels/`)

#### GET `/api/channels`
- **Auth:** Required (Bearer token)
- **Description:** List all channels
- **Response:** `{ data: Channel[] }`

---

### Users (`/api/users/`)

#### GET `/api/users`
- **Auth:** Required (Bearer token)
- **Description:** List all users (public info only)
- **Response:** `{ data: UserPublic[] }`

---

### Invites (`/api/invites/`)

#### POST `/api/invites`
- **Auth:** Required (Owner role only)
- **Description:** Create a new single-use invite token
- **Response:** `{ data: Invite }`

#### GET `/api/invites`
- **Auth:** Required (Owner role only)
- **Description:** List all invites
- **Response:** `{ data: Invite[] }`

#### GET `/api/invites/:token/validate`
- **Auth:** None (public)
- **Description:** Check if an invite token is valid
- **Response:** `{ data: { valid: boolean } }`

#### DELETE `/api/invites/:id`
- **Auth:** Required (Owner role only)
- **Description:** Revoke an invite token
- **Response:** `{ data: { success: true } }`

---

## Authentication Flow

```
1. Owner creates invite → POST /api/invites
2. New user registers with invite → POST /api/auth/register
   ← Returns: { user, tokens: { accessToken, refreshToken }, encryptedGroupKey }
3. Client stores refreshToken securely (Electron safeStorage)
4. Client uses accessToken in Authorization header for all requests
5. On 401 → Client calls POST /api/auth/refresh with refreshToken
   ← Returns new accessToken
6. On logout → POST /api/auth/logout invalidates session
```

## Authorization Roles

| Role | Permissions |
|------|-------------|
| `owner` | All endpoints, invite management, ban management |
| `user` | Read channels, read users, messaging |

## Rate Limits (from shared constants)

| Scope | Limit |
|-------|-------|
| API requests | 60/minute |
| Messages | 30/minute |

## Planned Endpoints (Not Yet Implemented)

Based on the shared library's WebSocket message types and PRD, these endpoints/features are planned:
- WebSocket connections for real-time messaging
- Voice channel join/leave/state management
- Presence updates (online/idle/dnd/offline)
- Message CRUD operations
- Channel management (create, update, delete)
- User profile updates
- Ban management

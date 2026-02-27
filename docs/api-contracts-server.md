# API Contracts — Server

**Generated:** 2026-02-26 | **Scan Level:** Exhaustive | **Source:** All server route files read

## Overview

- **Framework:** Fastify 5.7.0
- **Base URL:** `http://localhost:3000` (configurable via `HOST` + `PORT`)
- **Auth:** JWT Bearer tokens (15-minute access, 7-day refresh)
- **Response Envelope:** `{ data: T }` for success, `{ error: { code: string, message: string } }` for errors
- **Total Endpoints:** 17 HTTP + 1 WebSocket

## Authentication Flow

1. **First-time setup:** `POST /api/auth/register` without invite token (creates `owner` role)
2. **Subsequent users:** `POST /api/auth/register` with valid `inviteToken`
3. **Login:** `POST /api/auth/login` → receives access + refresh tokens + encrypted group key
4. **Token refresh:** `POST /api/auth/refresh` with refresh token → new token pair (rotation)
5. **Logout:** `POST /api/auth/logout` with refresh token → session destroyed
6. **All authenticated requests:** `Authorization: Bearer <accessToken>`

## Endpoints

### Server Status (Public)

#### `GET /api/server/status`
- **Auth:** None
- **Response:** `{ data: { needsSetup: boolean } }`
- **Purpose:** Check if server needs initial owner setup

### Health (Public)

#### `GET /api/health`
- **Auth:** None
- **Response (200):** `{ data: { status: 'ok', database: 'connected' } }`
- **Response (503):** `{ error: { code: 'DATABASE_UNAVAILABLE', message: '...' } }`

### Authentication (Public)

#### `POST /api/auth/register`
- **Auth:** None
- **Request Body:**
  ```json
  {
    "username": "string (3-32 chars, alphanumeric + underscore)",
    "password": "string (8+ chars)",
    "inviteToken": "string (optional, required for non-first user)",
    "publicKey": "string (optional, base64-encoded X25519 public key)"
  }
  ```
- **Response (201):**
  ```json
  {
    "data": {
      "accessToken": "string",
      "refreshToken": "string",
      "user": { "id": "uuid", "username": "string", "role": "owner|user" },
      "encryptedGroupKey": "string (base64 sealed box)"
    }
  }
  ```
- **Errors:** `USERNAME_TAKEN`, `INVALID_INVITE`, `SETUP_ALREADY_COMPLETED`, `REGISTRATION_BLOCKED`, `INVALID_USERNAME`, `INVALID_PUBLIC_KEY`

#### `POST /api/auth/login`
- **Auth:** None
- **Request Body:** `{ "username": "string", "password": "string" }`
- **Response (200):** Same shape as register response
- **Errors:** `INVALID_CREDENTIALS`, `ACCOUNT_BANNED`

#### `POST /api/auth/refresh`
- **Auth:** None
- **Request Body:** `{ "refreshToken": "string" }`
- **Response (200):** `{ "data": { "accessToken": "string", "refreshToken": "string" } }`
- **Errors:** `INVALID_REFRESH_TOKEN`
- **Notes:** Token rotation — old session deleted, new session created

#### `POST /api/auth/logout`
- **Auth:** Yes
- **Request Body:** `{ "refreshToken": "string" }`
- **Response:** `204 No Content`

### Invites

#### `POST /api/invites`
- **Auth:** Yes (owner only)
- **Response (201):**
  ```json
  {
    "data": { "id": "uuid", "token": "string", "createdBy": "uuid", "revoked": false, "createdAt": "timestamp" }
  }
  ```

#### `GET /api/invites`
- **Auth:** Yes (owner only)
- **Response (200):** `{ "data": [{ "id", "token", "revoked", "createdBy", "createdAt" }], "count": number }`

#### `GET /api/invites/:token/validate`
- **Auth:** None
- **Response (200):** `{ "data": { "valid": true, "serverName": "string" } }`
- **Errors:** `INVALID_INVITE`

#### `DELETE /api/invites/:id`
- **Auth:** Yes (owner only)
- **Response:** `204 No Content`
- **Errors:** `INVITE_NOT_FOUND`

### Channels

#### `GET /api/channels`
- **Auth:** Yes
- **Response (200):** `{ "data": [{ "id", "name", "type": "text|voice", "createdAt" }], "count": number }`

#### `POST /api/channels`
- **Auth:** Yes (owner only)
- **Request Body:** `{ "name": "string (1-32 chars)", "type": "text|voice" }`
- **Response (201):** `{ "data": { "id", "name", "type", "createdAt" } }`
- **Errors:** `VALIDATION_ERROR` (duplicate name, max 50 channels)
- **Side Effect:** Broadcasts `channel:created` via WebSocket

#### `DELETE /api/channels/:channelId`
- **Auth:** Yes (owner only)
- **Response:** `204 No Content`
- **Errors:** `NOT_FOUND`
- **Side Effect:** Broadcasts `channel:deleted` via WebSocket

### Users

#### `GET /api/users`
- **Auth:** Yes
- **Response (200):** `{ "data": [{ "id", "username", "role", "createdAt" }], "count": number }`

### Messages

#### `GET /api/channels/:channelId/messages`
- **Auth:** Yes
- **Query Params:** `limit` (1-100, default 50), `before` (cursor for pagination)
- **Response (200):**
  ```json
  {
    "data": [{ "messageId", "channelId", "authorId", "content": "(encrypted)", "nonce", "createdAt" }],
    "count": number
  }
  ```
- **Notes:** Messages are E2E encrypted; `content` is ciphertext, `nonce` is the encryption nonce

### Admin (Owner Only)

#### `POST /api/admin/kick/:userId`
- **Auth:** Yes (owner only)
- **Response:** `204 No Content`
- **Side Effects:** Deletes all sessions, sends `user:kicked` WS to target, broadcasts `member:removed`
- **Errors:** `NOT_FOUND`, `INVALID_ACTION` (can't kick self or other owners)

#### `POST /api/admin/ban/:userId`
- **Auth:** Yes (owner only)
- **Response:** `204 No Content`
- **Side Effects:** Creates ban record, deletes all sessions, sends `user:banned` WS, broadcasts `member:removed`
- **Errors:** `NOT_FOUND`, `INVALID_ACTION`, `ALREADY_BANNED`

#### `POST /api/admin/unban/:userId`
- **Auth:** Yes (owner only)
- **Response:** `204 No Content`
- **Errors:** `NOT_FOUND`

#### `POST /api/admin/reset-password/:userId`
- **Auth:** Yes (owner only)
- **Response (200):** `{ "data": { "temporaryPassword": "string (16 hex chars)" } }`
- **Side Effects:** Deletes all user sessions (forces re-login)
- **Errors:** `NOT_FOUND`, `INVALID_ACTION`

#### `GET /api/admin/bans`
- **Auth:** Yes (owner only)
- **Response (200):** `{ "data": [{ "id", "userId", "username", "bannedBy", "createdAt" }], "count": number }`

## WebSocket Endpoint

### `GET /ws?token=<JWT>`
- **Auth:** JWT access token in query parameter
- **Protocol:** Native WebSocket (via `@fastify/websocket`)
- **Connection:** One connection per user (new connection closes existing)
- **Message Format:** `{ "type": "string", "payload": any, "id": "string (optional, for request-response)" }`
- **Close Codes:** `4001` (auth failure), `4002` (malformed message), `4003` (server error)

### WebSocket Message Types

#### Text Messaging
| Type | Direction | Payload |
|------|-----------|---------|
| `text:send` | Client → Server | `{ channelId, content (encrypted), nonce }` |
| `text:receive` | Server → Clients | `{ messageId, channelId, authorId, content, nonce, createdAt }` |

#### Presence
| Type | Direction | Payload |
|------|-----------|---------|
| `presence:sync` | Server → Client | `{ users: [{ userId, status }] }` (on connect) |
| `presence:update` | Server → Clients | `{ userId, status: 'online'|'offline' }` |

#### Channel Events
| Type | Direction | Payload |
|------|-----------|---------|
| `channel:created` | Server → Clients | `{ channel: { id, name, type, createdAt } }` |
| `channel:deleted` | Server → Clients | `{ channelId }` |

#### Member Events
| Type | Direction | Payload |
|------|-----------|---------|
| `member:added` | Server → Clients | `{ id, username, role, createdAt }` |
| `member:removed` | Server → Clients | `{ userId }` |

#### Admin Events
| Type | Direction | Payload |
|------|-----------|---------|
| `user:kicked` | Server → Target | `{ userId }` |
| `user:banned` | Server → Target | `{ userId }` |

#### Voice (mediasoup SFU)
| Type | Direction | Payload |
|------|-----------|---------|
| `voice:join` | Client → Server | `{ channelId, rtpCapabilities? }` |
| Response | Server → Client | `{ routerRtpCapabilities, existingPeers[] }` |
| `voice:leave` | Client → Server | `{ channelId }` |
| `voice:create-transport` | Client → Server | `{ direction: 'send'\|'recv' }` |
| Response | Server → Client | `{ transportParams: { id, iceParameters, iceCandidates, dtlsParameters }, iceServers[] }` |
| `voice:connect-transport` | Client → Server | `{ transportId, dtlsParameters }` |
| `voice:produce` | Client → Server | `{ transportId, kind: 'audio'\|'video', rtpParameters }` |
| Response | Server → Client | `{ producerId }` |
| `voice:consume` | Client → Server | `{ producerId }` |
| Response | Server → Client | `{ consumerId, producerId, kind, rtpParameters }` |
| `voice:consumer-resume` | Client → Server | `{ consumerId }` |
| `voice:state` | Bidirectional | `{ userId, channelId, muted, deafened, speaking }` |
| `voice:new-producer` | Server → Clients | `{ producerId, peerId, kind }` |
| `voice:producer-closed` | Server → Clients | `{ producerId, peerId, kind }` |
| `voice:peer-joined` | Server → Clients | `{ userId, channelId }` |
| `voice:peer-left` | Server → Clients | `{ userId, channelId }` |
| `voice:presence-sync` | Server → Client | `{ participants: [{ userId, channelId }] }` |

## Error Codes Reference

| Code | HTTP Status | Description |
|------|------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Insufficient permissions (not owner) |
| `INVALID_CREDENTIALS` | 401 | Wrong username or password |
| `ACCOUNT_BANNED` | 403 | User is banned |
| `INVALID_INVITE` | 400 | Invite token invalid or revoked |
| `USERNAME_TAKEN` | 409 | Username already exists |
| `SETUP_ALREADY_COMPLETED` | 400 | Owner already registered |
| `REGISTRATION_BLOCKED` | 400 | No valid invite provided |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token invalid or expired |
| `INVALID_USERNAME` | 400 | Username format invalid |
| `INVALID_PUBLIC_KEY` | 400 | Public key wrong length |
| `INVALID_ACTION` | 400 | Can't perform action on self/owner |
| `ALREADY_BANNED` | 409 | User already banned |
| `NOT_FOUND` | 404 | Resource not found |
| `CHANNEL_NOT_FOUND` | 404 | Channel doesn't exist |
| `INVITE_NOT_FOUND` | 404 | Invite doesn't exist |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `DATABASE_UNAVAILABLE` | 503 | SQLite connection failed |

## Auth Middleware Flow

```
Request → Check public routes list → If public, skip
        → Extract Bearer token from Authorization header
        → Verify JWT with JWT_ACCESS_SECRET
        → Set request.user = { userId, role }
        → If owner-only route, check role === 'owner'
        → Continue to handler
```

**Public routes (no auth required):**
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `GET /api/health`
- `GET /api/server/status`
- `GET /ws`
- `GET /api/invites/:token/validate`

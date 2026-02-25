# Integration Architecture

**Generated:** 2026-02-24 | **Scan Level:** Quick

## Overview

Discord Clone is a monorepo with three npm workspaces that communicate through well-defined boundaries. The `shared` package acts as the contract boundary - client and server never import from each other directly.

## Parts

| Part | Package Name | Type | Root Path |
|------|-------------|------|-----------|
| client | discord-clone-client | Desktop (Electron) | `client/` |
| server | discord-clone-server | Backend (Fastify) | `server/` |
| shared | discord-clone-shared | Library | `shared/` |

## Integration Points

### 1. Client → Server (HTTP REST API)

| Aspect | Detail |
|--------|--------|
| **Type** | HTTP REST API |
| **Protocol** | HTTP/HTTPS |
| **Base URL** | `http://localhost:3000` (configurable) |
| **Client Implementation** | `client/src/renderer/src/services/apiClient.ts` |
| **Server Implementation** | `server/src/plugins/*/routes.ts` |
| **Auth** | JWT Bearer token in Authorization header |
| **Format** | JSON request/response |
| **Error Handling** | 401 triggers automatic token refresh on client |

**Request Flow:**
```
Renderer Process → apiClient.ts → HTTP → Fastify → Plugin Routes → Service → DB
                                     ← JSON Response ←
```

### 2. Client ↔ Shared (TypeScript Import)

| Aspect | Detail |
|--------|--------|
| **Type** | Direct npm package import |
| **Package** | `discord-clone-shared` |
| **Resolution** | npm workspaces (`"discord-clone-shared": "*"`) |
| **Usage** | Types (User, Channel, Message), constants (limits, rates), WS message types |

### 3. Server ↔ Shared (TypeScript Import)

| Aspect | Detail |
|--------|--------|
| **Type** | Direct npm package import |
| **Package** | `discord-clone-shared` |
| **Resolution** | npm workspaces (`"discord-clone-shared": "*"`) |
| **Usage** | Types for API responses, constants for validation, WS message definitions |

### 4. Client Main ↔ Client Renderer (Electron IPC)

| Aspect | Detail |
|--------|--------|
| **Type** | Electron IPC (via contextBridge) |
| **Bridge** | `client/src/preload/index.ts` |
| **API** | `window.api.secureStorage.{set, get, delete}` |
| **Purpose** | Secure credential storage (refresh tokens, encryption keys) |
| **Security** | Context isolation enabled, sandbox enabled |

### 5. Client ↔ Server (WebSocket) - Planned

| Aspect | Detail |
|--------|--------|
| **Type** | Native WebSocket |
| **Protocol** | WS/WSS |
| **Message Format** | `{ type: string, payload: T, id?: string }` |
| **Message Types** | Defined in `shared/src/ws-messages.ts` |
| **Use Cases** | Real-time messaging, presence updates, typing indicators, voice signaling |

**Planned WS Message Types:**
- `text:send` / `text:receive` / `text:typing` - Text messaging
- `voice:join` / `voice:leave` / `voice:state` / `voice:signal` - Voice channels
- `presence:update` - Online/idle/dnd/offline status
- `channel:update` / `user:update` - Entity change notifications

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    ELECTRON APP                          │
│                                                          │
│  ┌──────────────┐    IPC     ┌────────────────┐        │
│  │ Main Process │◄─────────►│ Preload Bridge │        │
│  │ (safeStorage)│            └───────┬────────┘        │
│  └──────────────┘                    │                  │
│                                      │ contextBridge    │
│                              ┌───────┴────────┐        │
│                              │ Renderer       │        │
│                              │                │        │
│                              │ Zustand Stores │        │
│                              │      ↕         │        │
│                              │ apiClient.ts ──┼─── HTTP ──→ Fastify Server
│                              │      ↕         │             │
│                              │ encryptionSvc  │             │ Plugins
│                              │                │             │ (auth, users,
│                              └────────────────┘             │  invites, channels)
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │       discord-clone-shared           │                   │
│  │  Types, Constants, WS Messages       │←──── imports ─────┘
│  └──────────────────────────────────────┘
└─────────────────────────────────────────────────────────┘

                              ┌──────────┐
                              │  SQLite  │
                              │   DB     │
                              └──────────┘
```

## Shared Contract Boundary

The `shared` package defines the contract between client and server:

### Types (`shared/src/types.ts`)
- Domain models: User, UserPublic, Channel, Message, Session, Invite, Ban
- API contracts: ApiSuccess<T>, ApiList<T>, ApiError
- Auth types: AuthTokens, EncryptedGroupKeyBlob

### Constants (`shared/src/constants.ts`)
- JWT expiration times (15min access, 7d refresh)
- Rate limits (60 API req/min, 30 msg/min)
- Server limits (50 channels, 100 members)
- Message limits (2000 chars)
- Encryption parameters (NaCl key/nonce sizes)
- WebSocket reconnect/heartbeat intervals

### WebSocket Protocol (`shared/src/ws-messages.ts`)
- Message envelope: `WsMessage<T>` with type, payload, optional id
- Payload types for text, voice, and presence
- Type constants using namespace:action pattern (e.g., `text:send`)

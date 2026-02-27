# Integration Architecture

**Generated:** 2026-02-26 | **Scan Level:** Exhaustive

## Overview

The Discord Clone is a monorepo with three parts that communicate through well-defined boundaries:

- **shared** → Pure contract layer (types, constants, WS protocol) — imported at build time by both client and server
- **client** → Electron desktop app that communicates with server via HTTP REST and WebSocket
- **server** → Fastify backend that serves REST API, WebSocket, and mediasoup WebRTC

```
┌─────────────────────────────────────────────────────────────────┐
│                        discord_clone/                            │
│                                                                  │
│  ┌──────────┐    build-time import    ┌──────────┐              │
│  │  shared   │◄───────────────────────│  client   │              │
│  │  (types,  │                        │ (Electron │              │
│  │ constants,│    build-time import   │  + React) │              │
│  │ WS proto) │◄───────────┐          └─────┬─────┘              │
│  └──────────┘             │                │                     │
│                      ┌────┴─────┐          │ HTTP REST           │
│                      │  server   │◄─────────┤ WebSocket          │
│                      │ (Fastify  │◄─────────┤ WebRTC (mediasoup) │
│                      │ + SQLite) │          │                     │
│                      └──────────┘          │                     │
│                                             │                     │
└─────────────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Shared Package Import (Build-Time)

| Aspect | Details |
|--------|---------|
| **Type** | npm workspace dependency |
| **From** | client, server |
| **To** | shared |
| **Mechanism** | `import { ... } from 'discord-clone-shared'` |
| **Build Order** | shared must be built first (`npm run build -w shared`) |

**What flows through shared:**
- 7 domain type interfaces (`User`, `UserPublic`, `Channel`, `Message`, `Session`, `Invite`, `Ban`)
- 4 API envelope types (`ApiSuccess<T>`, `ApiList<T>`, `ApiError`, `AuthTokens`)
- 1 encryption type (`EncryptedGroupKeyBlob`)
- `WsMessage<T>` generic envelope
- 27 `WS_TYPES` constants (event type strings)
- 25 WebSocket payload interfaces
- 19 runtime constants (limits, timeouts, crypto params)

**Server imports shared in 10 files.** **Client imports shared in 8 files.**

### 2. HTTP REST API (Runtime)

| Aspect | Details |
|--------|---------|
| **Type** | HTTP/HTTPS REST |
| **From** | client (`apiClient.ts`) |
| **To** | server (Fastify routes) |
| **Auth** | `Authorization: Bearer <JWT>` |
| **Format** | JSON — `{ data: T }` success, `{ error: { code, message } }` error |
| **CORS** | Restricted to `CLIENT_ORIGIN` env var |

**Data flow:**

```
Client apiClient.ts                    Server Fastify Routes
─────────────────                      ────────────────────
POST /api/auth/login        ──────►    authRoutes.ts
  { username, password }               │ Verify credentials
                            ◄──────    │ Return tokens + encrypted group key
                                       │
GET /api/channels           ──────►    channelRoutes.ts
                            ◄──────    │ Return channel list
                                       │
GET /api/channels/:id/messages ────►   messageRoutes.ts
  ?before=cursor&limit=50              │ Return encrypted messages
                            ◄──────    │ (ciphertext + nonce only)
                                       │
POST /api/invites           ──────►    inviteRoutes.ts (owner only)
                            ◄──────    │ Return invite token
                                       │
POST /api/admin/kick/:id    ──────►    adminRoutes.ts (owner only)
                            ◄──────    │ 204 + WS side effects
```

**Token refresh flow:**
```
apiClient: Request fails with 401
  → POST /api/auth/refresh { refreshToken }
  → Receive new token pair (rotation)
  → Retry original request with new access token
  → If refresh also fails → session expired → logout
```

**17 HTTP endpoints total.** See [API Contracts](./api-contracts-server.md) for complete list.

### 3. WebSocket (Runtime — Real-Time)

| Aspect | Details |
|--------|---------|
| **Type** | Native WebSocket (RFC 6455) |
| **From** | client (`wsClient.ts`) |
| **To** | server (`wsServer.ts` + `wsRouter.ts`) |
| **Endpoint** | `GET /ws?token=<JWT>` |
| **Auth** | JWT in query parameter |
| **Format** | JSON — `{ type: string, payload: T, id?: string }` |
| **Reconnect** | Exponential backoff: 1s → 30s max (`WS_RECONNECT_DELAY`, `WS_MAX_RECONNECT_DELAY`) |
| **Concurrency** | One connection per user (new connection closes existing) |

**Message flow patterns:**

#### Fire-and-Forget (Client → Server → Broadcast)
```
Client A                    Server                      Client B
────────                    ──────                      ────────
text:send ─────────────►    messageWsHandler
  { channelId,              │ Validate message
    content (encrypted),    │ Store in SQLite
    nonce }                 │ text:receive ──────────►   wsClient.on('text:receive')
                            │   { messageId,             │ Decrypt with group key
                            │     channelId,             │ Add to useMessageStore
                            │     authorId,              │ Render in MessageGroup
                            │     content, nonce,
                            │     createdAt }
```

#### Request-Response (Client ↔ Server)
```
Client                      Server
──────                      ──────
voice:join ────────────►    voiceWsHandler
  { channelId }             │ Validate channel
  id: "uuid-123"            │ Create peer state
                ◄────────── │ response { id: "uuid-123",
                            │   routerRtpCapabilities,
                            │   existingPeers[] }
```

#### Server-Initiated Events
```
                            Server                      All Clients
                            ──────                      ───────────
                            presenceService
User connects ──►           │ Add to online set
                            │ presence:update ────────►  usePresenceStore
                            │   { userId, status:        │ Update online users
                            │     'online' }             │ Re-render MemberList
                            │
                            │ presence:sync ──────────►  (connecting client only)
                            │   { users: [all online] }  │ Bulk sync
```

**27 WebSocket message types** across 6 domains:
- Text: 2 types (send, receive)
- Presence: 2 types (update, sync)
- Channel: 2 types (created, deleted)
- Member: 2 types (added, removed)
- Admin: 2 types (kicked, banned)
- Voice: 17 types (join, leave, transport, produce, consume, state, notifications)

### 4. WebRTC / mediasoup (Runtime — Voice/Video)

| Aspect | Details |
|--------|---------|
| **Type** | WebRTC via mediasoup SFU |
| **From** | client (`mediaService.ts`, `voiceService.ts`) |
| **To** | server (`mediasoupManager.ts`, `voiceService.ts`) |
| **Signaling** | WebSocket (voice:* message types) |
| **Media** | UDP (RTP/RTCP via mediasoup transports) |
| **TURN/STUN** | coturn for NAT traversal |
| **Codecs** | audio/opus (48kHz stereo), video/VP8 (90kHz) |
| **Port Range** | UDP 40000-49999 (mediasoup), 49152-49252 (TURN relay) |
| **Limits** | 25 participants per voice channel |

**Voice join flow:**

```
Client                          Server                         coturn
──────                          ──────                         ──────
1. voice:join ─────────────►    Create peer state
   { channelId }                Generate TURN credentials
                  ◄──────────── Return routerRtpCapabilities
                                + existingPeers + iceServers

2. Initialize mediasoup Device
   with router capabilities

3. voice:create-transport ──►   Create WebRtcTransport (send)
   { direction: 'send' }       Generate ICE/DTLS params
                  ◄──────────── transportParams + iceServers
                                (includes TURN credentials)

4. voice:create-transport ──►   Create WebRtcTransport (recv)
   { direction: 'recv' }
                  ◄──────────── transportParams + iceServers

5. voice:connect-transport ──►  Connect send transport
   { transportId,               Complete DTLS handshake
     dtlsParameters }           ICE candidates ◄──────────► STUN/TURN

6. Produce audio track
   voice:produce ────────────►  Create Producer
   { transportId,               Link to Router
     kind: 'audio',
     rtpParameters }
                  ◄──────────── { producerId }

7.                              Notify existing peers:
                                voice:new-producer ──────► Other clients
                                { producerId, peerId,      │ voice:consume
                                  kind: 'audio' }          │ Create Consumer
                                                           │ Resume consumer
                                                           │ Play audio

8. Media flows:
   Audio RTP ═══════════════►   Router ═══════════════════► Consumer tracks
   (via send transport)         (SFU forwarding)           (via recv transports)
```

**TURN credential generation:**
```
Server mediasoupManager.ts:
  username = timestamp + ":" + peerId
  credential = HMAC-SHA1(TURN_SECRET, username)
  TTL = 24 hours
  → Sent to client with transport params
  → Client uses credentials to connect through coturn
```

### 5. Electron IPC (Runtime — Internal)

| Aspect | Details |
|--------|---------|
| **Type** | Electron IPC (invoke/handle + send/on) |
| **From** | Renderer process |
| **To** | Main process (via preload bridge) |
| **Isolation** | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` |

**IPC channels:**

```
Renderer (React)              Preload (Bridge)           Main (Electron)
────────────────              ────────────────           ───────────────
window.api.                   contextBridge              ipcMain.handle
  secureStorage               .exposeInMainWorld
    .set(key, val) ────────►  invoke ─────────────────►  safeStorage.ts
    .get(key)      ────────►  invoke ─────────────────►  │ Encrypt/decrypt
    .delete(key)   ────────►  invoke ─────────────────►  │ Store at userData/
                                                          │ secure-tokens.json
  updater
    .checkForUpdates() ────►  invoke ─────────────────►  updater.ts
    .downloadUpdate()  ────►  invoke ─────────────────►  │ autoUpdater.*
    .quitAndInstall()  ────►  invoke ─────────────────►  │

  onDeepLink(cb)   ◄────────  on ◄───────────────────── index.ts
                                                          │ open-url event
                                                          │ second-instance
  updater
    .onUpdateAvailable(cb) ◄─ on ◄───────────────────── updater.ts
    .onDownloadProgress(cb)◄─ on ◄───────────────────── │ autoUpdater events
    .onUpdateDownloaded(cb)◄─ on ◄───────────────────── │
```

### 6. External Services (Runtime — Production)

| Service | Integration | Purpose |
|---------|-------------|---------|
| **GitHub Releases** | electron-updater + release.yml | Auto-update distribution, installer downloads |
| **Let's Encrypt** | certbot sidecar container | TLS certificate provisioning and renewal |
| **AWS EC2** | SSH deploy in release.yml | Production server hosting |

**No other external services.** The application is fully self-hosted:
- No analytics/telemetry (enforced by privacy tests)
- No external APIs called by server (enforced by `noOutboundRequests.test.ts`)
- No CDN (assets bundled in Electron app)
- No external auth providers (self-managed JWT + bcrypt)

## Data Flow Summary

### Message Lifecycle (E2E Encrypted)

```
1. User types message in MessageInput
2. encryptionService.encryptMessage(plaintext, groupKey)
   → ciphertext + nonce
3. messageService.sendMessage() → wsClient.send('text:send', { channelId, content: ciphertext, nonce })
4. Server messageWsHandler receives → validates → stores in SQLite (ciphertext only)
5. Server broadcasts text:receive to all connected clients
6. wsClient dispatches to useMessageStore
7. useMessageStore calls encryptionService.decryptMessage(ciphertext, nonce, groupKey)
8. MessageGroup renders decrypted plaintext
```

### Auth Lifecycle

```
1. First user: POST /api/auth/register (no invite) → creates owner
2. Owner generates invite → POST /api/invites → token
3. Invite URL: https://domain/invite/{token} → landing page
4. User installs app → opens discord-clone://invite/{token} → RegisterPage
5. POST /api/auth/register { username, password, inviteToken, publicKey }
6. Server: hash password, create user, seal group key with public key
7. Return: accessToken + refreshToken + encryptedGroupKey
8. Client: decrypt group key with private key, store all in safeStorage
9. Connect WebSocket with access token → receive presence:sync
```

### Voice Join Lifecycle

```
1. User clicks voice channel in ChannelSidebar
2. voiceService.joinVoiceChannel(channelId)
3. WS: voice:join → receive routerRtpCapabilities + existingPeers
4. Initialize mediasoup Device
5. Create send + recv transports (with TURN credentials)
6. Produce audio track → start local VAD
7. For each existing peer: consume their producer → start remote VAD
8. New peers joining: receive voice:new-producer → consume
9. Voice state changes (mute/deafen) → broadcast via voice:state
10. Leave: close all transports/producers/consumers → voice:leave
```

## Shared Contract Enforcement

The `shared` package enforces type safety across the integration boundary:

| Mechanism | What It Enforces |
|-----------|-----------------|
| `WS_TYPES` (`as const`) | Both sides use identical event type strings |
| Payload interfaces | Request/response shapes match at compile time |
| `MAX_MESSAGE_LENGTH` | Same 2000-char limit on client validation and server validation |
| `MAX_CHANNELS_PER_SERVER` | Same 50-channel limit |
| `MAX_PARTICIPANTS` | Same 25-user voice limit |
| `JWT_ACCESS_EXPIRY` / `_MS` | Same 15-min expiry in both string and numeric form |
| `WS_RECONNECT_DELAY` / `_MAX` | Client reconnect timing constants |
| NaCl constants | Encryption parameter sizes match libsodium expectations |

**Key rule:** Client and server never import from each other. All shared contracts flow through `discord-clone-shared`.

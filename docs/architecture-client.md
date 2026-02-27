# Architecture — Client (Electron Desktop App)

**Generated:** 2026-02-26 | **Scan Level:** Exhaustive | **Part:** client | **Type:** Desktop

## Executive Summary

The client is an Electron 40 desktop application with a React 19 renderer. It follows Electron's multi-process architecture with strict security isolation (context isolation, sandboxing, no Node integration in renderer). The UI is built with functional React components organized by feature, Zustand for state management (10 stores), and Tailwind CSS 4 for styling. Real-time communication uses WebSocket for text/presence and mediasoup-client for voice/video via WebRTC. All messages are E2E encrypted using libsodium (XSalsa20-Poly1305) with X25519 key exchange.

## Process Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Application                      │
│                                                               │
│  ┌──────────────────┐    IPC (invoke/handle)                 │
│  │   Main Process    │◄──────────────────────┐               │
│  │  (Node.js)        │                        │               │
│  │                   │    IPC (send/on)       │               │
│  │  • Window mgmt    │───────────────────────►│               │
│  │  • safeStorage    │                   ┌────┴────┐         │
│  │  • Auto-updater   │                   │ Preload  │         │
│  │  • Protocol handler│                  │ (Bridge) │         │
│  │  • CSP enforcement │                  │          │         │
│  │  • Single-instance │                  │ context  │         │
│  └──────────────────┘                   │ Bridge   │         │
│                                          └────┬────┘         │
│                                               │               │
│  ┌────────────────────────────────────────────┴─────────┐    │
│  │              Renderer Process (Chromium)                │   │
│  │                                                         │   │
│  │   React 19 SPA (HashRouter)                            │   │
│  │   ┌─────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │   │ Features │  │  Stores  │  │ Services │            │   │
│  │   │ (40 UI   │◄►│(10 Zustand│◄►│(7 modules│            │   │
│  │   │ comps)   │  │  stores) │  │ API/WS/  │            │   │
│  │   └─────────┘  └──────────┘  │ crypto/  │            │   │
│  │                               │ media)   │            │   │
│  │                               └────┬─────┘            │   │
│  └────────────────────────────────────┼──────────────────┘   │
│                                        │                      │
└────────────────────────────────────────┼──────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │ HTTP REST          │ WebSocket    WebRTC │
                    │ (apiClient)        │ (wsClient)  (media) │
                    ▼                    ▼              ▼      │
              Server :3000         Server /ws     mediasoup SFU
```

## Main Process (`src/main/`)

### `index.ts` — Application Entry Point

**Responsibilities:**
- Creates `BrowserWindow` (1280x720 default, 960x540 minimum)
- Enforces Content Security Policy with dynamic connect-src (dev vs production URLs)
- Registers `discord-clone://` custom protocol handler for invite deep links
- Implements single-instance lock (prevents duplicate app instances)
- Handles cross-platform deep linking: `open-url` (macOS), `second-instance` (Windows/Linux)
- Initializes auto-updater in production mode

**Security settings:**
```
nodeIntegration: false
contextIsolation: true
sandbox: true
webSecurity: true
```

### `safeStorage.ts` — Secure Token Storage

Uses Electron's `safeStorage` API for OS-level encryption:
- macOS: Keychain
- Windows: DPAPI
- Linux: libsecret

Stores encrypted JSON at `userData/secure-tokens.json`. Provides `set`, `get`, `delete` operations via IPC.

**Stored keys:** `accessToken`, `refreshToken`, `privateKey`, `publicKey`, `encryptedGroupKey`

### `updater.ts` — Auto-Update Lifecycle

Uses `electron-updater` with GitHub Releases as the update source:
1. Checks for updates 5 seconds after startup (production only)
2. Forwards all update events to renderer via IPC
3. Exposes `check`, `download`, `quitAndInstall` IPC handlers

## Preload (`src/preload/`)

Context bridge between main and renderer. Exposes three API surfaces via `contextBridge.exposeInMainWorld`:

| API | Methods |
|-----|---------|
| `window.electron` | Standard Electron API (`@electron-toolkit/preload`) |
| `window.api.secureStorage` | `set(key, value)`, `get(key)`, `delete(key)` |
| `window.api.onDeepLink(cb)` | Listener for `discord-clone://` protocol URLs |
| `window.api.updater` | `checkForUpdates()`, `downloadUpdate()`, `quitAndInstall()` + 5 event listeners |

## Renderer Architecture (`src/renderer/`)

### Component Hierarchy

```
<React.StrictMode>
  <HashRouter>
    <App>
      ├── /login → <LoginPage />
      ├── /setup → <SetupPage />
      ├── /register/:token → <RegisterPage />
      └── /app → <AuthGuard>
            └── <AppLayout>
                  ├── <ChannelSidebar>
                  │     ├── <ServerHeader> (dropdown: invite, create channel, settings)
                  │     ├── Text Channels
                  │     │     └── <ChannelItem> (with <ChannelContextMenu>)
                  │     ├── Voice Channels
                  │     │     ├── <ChannelItem>
                  │     │     └── <VoiceParticipant> (per connected user)
                  │     ├── <VoiceStatusBar> (when in voice)
                  │     └── <UserPanel> (username, avatar, mute/deafen, settings)
                  │
                  ├── <ContentArea>
                  │     ├── Channel header (name, member list toggle)
                  │     ├── <VideoGrid> (when video active)
                  │     │     └── <VideoTile> (per participant)
                  │     ├── Message feed (<ScrollArea>)
                  │     │     └── <MessageGroup> (grouped by author + 5-min window)
                  │     └── <MessageInput> (auto-grow, Enter to send, E2E encrypt)
                  │
                  ├── <MemberList> (toggleable right panel)
                  │     ├── Online section
                  │     │     └── <MemberItem> (with <MemberContextMenu> for admin)
                  │     └── Offline section
                  │           └── <MemberItem>
                  │
                  ├── <ConnectionBanner> (reconnecting/disconnected)
                  ├── <UpdateNotification> (auto-update UI)
                  ├── <KickedNotification> / <BannedNotification>
                  ├── <CreateChannelModal>
                  ├── <InviteModal>
                  ├── <KickConfirmDialog> / <BanConfirmDialog>
                  ├── <ResetPasswordDialog>
                  ├── <BannedUsersPanel>
                  └── <SettingsPage> → <AudioSettings>
```

### Service Layer

Services contain all business logic and external communication. Components never call APIs directly.

```
Components ──► Stores ──► Services ──► External
    │              │           │
    │ useStore()   │ getState()│
    │ selectors    │           │
    ▼              ▼           ▼
UI renders    State updates   apiClient (REST)
                              wsClient (WebSocket)
                              encryptionService (libsodium)
                              mediaService (mediasoup)
                              voiceService (orchestration)
                              messageService (encrypt + send/fetch)
                              vadService (voice activity)
```

**Key pattern:** Stores are accessed both as React hooks (selectors) and imperatively via `getState()` from services. This allows services to read/write state without being React components.

### State Management (Zustand)

10 independent stores, no cross-store dependencies at the store level (services coordinate between stores):

| Store | Persistence | External Triggers |
|-------|------------|-------------------|
| `useAuthStore` | safeStorage (Electron) | Login/register API responses |
| `useChannelStore` | None | REST API + WS `channel:created/deleted` |
| `useMessageStore` | None | REST API + WS `text:receive` |
| `useMemberStore` | None | REST API + WS `member:added/removed` |
| `usePresenceStore` | None | WS `presence:sync/update` |
| `useVoiceStore` | localStorage (device prefs) | WS `voice:*` events |
| `useUIStore` | None | User interaction only |
| `useInviteStore` | None | REST API |
| `useUpdateStore` | None | Electron IPC updater events |
| `useAdminNotificationStore` | None | WS `user:kicked/banned` |

### Routing

React Router v7 with `HashRouter` (hash-based URLs for Electron `file://` compatibility):

| Route | Component | Auth Required |
|-------|-----------|--------------|
| `/login` | LoginPage | No |
| `/setup` | SetupPage | No |
| `/register/:token` | RegisterPage | No |
| `/app` | AuthGuard → AppLayout | Yes |
| `/app/channels` | ChannelRedirect | Yes |
| `/app/channels/:channelId` | ContentArea | Yes |

### E2E Encryption Architecture

```
Registration:
  Client generates X25519 keypair (encryptionService)
  → Sends publicKey to server
  → Server seals groupKey with publicKey (crypto_box_seal)
  → Returns encryptedGroupKey
  → Client decrypts with privateKey (crypto_box_seal_open)
  → Stores: privateKey + publicKey in safeStorage, groupKey in memory

Message Send:
  plaintext → crypto_secretbox_easy(plaintext, randomNonce, groupKey) → ciphertext + nonce
  → Send via WebSocket { content: ciphertext, nonce }

Message Receive:
  { content: ciphertext, nonce } → crypto_secretbox_open_easy(ciphertext, nonce, groupKey)
  → plaintext (or "[Decryption failed]")
```

### Voice/Video Architecture

```
voiceService (orchestration)
  ├── mediaService (mediasoup-client)
  │     ├── Device (loaded with router capabilities)
  │     ├── Send Transport → Audio Producer + Video Producer
  │     ├── Recv Transport → Audio Consumers + Video Consumers
  │     └── Device switching (replaceTrack for audio, setSinkId for output)
  │
  ├── vadService (voice activity detection)
  │     ├── Local VAD (microphone → AudioContext → AnalyserNode → FFT)
  │     └── Remote VAD (per-peer consumer track → same pipeline)
  │     └── Config: RMS threshold 15, hold 250ms, poll 50ms
  │
  └── soundPlayer (connect/disconnect/mute/unmute tones)
```

## Security Model

| Layer | Protection |
|-------|-----------|
| Electron | `contextIsolation`, `sandbox`, no `nodeIntegration`, CSP |
| Storage | OS-level encryption via `safeStorage` (Keychain/DPAPI/libsecret) |
| Transport | HTTPS + WSS in production (nginx TLS termination) |
| Messages | E2E encrypted (XSalsa20-Poly1305, server never sees plaintext) |
| Voice/Video | DTLS + SRTP via mediasoup WebRTC transports |
| Auth | JWT with 15-min expiry, refresh token rotation, SHA-256 hashed storage |
| Privacy | Zero telemetry, no external API calls, no analytics |

## Build & Packaging

| Target | Format | Tool |
|--------|--------|------|
| macOS | DMG | electron-builder |
| Windows | NSIS installer | electron-builder |
| Linux | AppImage | electron-builder |

Custom protocol `discord-clone://` registered for invite deep links. Auto-update via GitHub Releases (`electron-updater`).

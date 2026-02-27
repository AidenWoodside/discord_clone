# Source Tree Analysis

**Generated:** 2026-02-26 | **Scan Level:** Exhaustive

## Repository Structure

**Type:** Monorepo (npm workspaces)
**Workspaces:** `client`, `server`, `shared`
**Build Order:** shared → server → client

```
discord_clone/
├── .github/workflows/              # CI/CD pipelines
│   ├── ci.yml                      # PR validation: lint + test + build (all 3 workspaces)
│   └── release.yml                 # Tag-triggered: 3-platform Electron build, GitHub Releases, EC2 deploy
│
├── client/                         # ★ Electron Desktop Client (Part: client)
│   ├── electron-builder.yml        # Packaging config: DMG/NSIS/AppImage, discord-clone:// protocol
│   ├── electron.vite.config.ts     # Vite build: main + preload + renderer targets
│   ├── dev-app-update.yml          # electron-updater dev config
│   ├── vitest.config.ts            # Test config: jsdom, React plugin, setup file
│   ├── vitest.setup.ts             # Test setup: jest-dom matchers, ResizeObserver polyfill
│   ├── tsconfig.json               # Project references root → node + web configs
│   ├── tsconfig.node.json          # Main/preload TypeScript config (Node.js env)
│   ├── tsconfig.web.json           # Renderer TypeScript config (DOM env, react-jsx)
│   └── src/
│       ├── main/                   # ★ ENTRY: Electron main process
│       │   ├── index.ts            # ★ Window creation, CSP, protocol handler, single-instance
│       │   ├── safeStorage.ts      # Encrypted token storage (OS keychain via Electron safeStorage)
│       │   └── updater.ts          # Auto-update lifecycle (electron-updater, IPC events)
│       │
│       ├── preload/                # Context bridge (main ↔ renderer)
│       │   ├── index.ts            # Exposes: secureStorage, deepLink, updater APIs
│       │   └── index.d.ts          # Type declarations for window.api
│       │
│       └── renderer/               # React SPA (renderer process)
│           ├── index.html          # HTML shell with <div id="root">
│           └── src/
│               ├── main.tsx        # ★ ENTRY: React root render
│               ├── App.tsx         # Root component: HashRouter, routes, session restore, update listeners
│               ├── globals.css     # Tailwind CSS 4 + custom theme (dark warm brown/amber palette)
│               │
│               ├── components/     # 8 reusable UI primitives (Radix UI wrappers)
│               │   ├── Button.tsx              # Primary/secondary/danger/ghost variants
│               │   ├── Input.tsx               # Labeled input with error display
│               │   ├── Modal.tsx               # Dialog wrapper (overlay, title, close)
│               │   ├── ContextMenu.tsx         # Right-click menu
│               │   ├── DropdownMenu.tsx        # Click-to-open menu
│               │   ├── Tooltip.tsx             # Hover tooltip
│               │   ├── ScrollArea.tsx          # Custom scrollbar
│               │   ├── UpdateNotification.tsx  # Auto-update banner UI
│               │   └── index.ts               # Barrel export
│               │
│               ├── features/       # Feature-based organization (32 components)
│               │   ├── auth/       # 4 components: LoginPage, RegisterPage, SetupPage, AuthGuard
│               │   ├── layout/     # 5 components: AppLayout, ContentArea, ChannelRedirect, ConnectionBanner, UserPanel
│               │   ├── channels/   # 6 components: ChannelSidebar, ChannelItem, ServerHeader, ChannelContextMenu, CreateChannelModal, InviteModal
│               │   ├── messages/   # 2 components: MessageGroup, MessageInput
│               │   ├── members/    # 2 components: MemberList, MemberItem
│               │   ├── voice/      # 4 components: VoiceStatusBar, VoiceParticipant, VideoGrid, VideoTile
│               │   ├── settings/   # 2 components: SettingsPage, AudioSettings
│               │   └── admin/      # 7 components: MemberContextMenu, Kick/Ban/Reset dialogs, BannedUsersPanel, Kicked/BannedNotification
│               │
│               ├── services/       # 7 service modules (business logic layer)
│               │   ├── apiClient.ts          # REST client with auto token refresh
│               │   ├── wsClient.ts           # WebSocket: connect, reconnect, request/response, event dispatch
│               │   ├── encryptionService.ts  # E2E: X25519 keypair, sealed box, secretbox encrypt/decrypt
│               │   ├── mediaService.ts       # mediasoup: Device, transports, producers, consumers
│               │   ├── voiceService.ts       # Voice orchestration: join/leave, VAD, video toggle
│               │   ├── messageService.ts     # Send (encrypt+WS) and fetch (HTTP+decrypt) messages
│               │   └── vadService.ts         # Voice Activity Detection (Web Audio API FFT)
│               │
│               ├── stores/         # 10 Zustand stores
│               │   ├── useAuthStore.ts               # Auth state, login/register/logout, session restore
│               │   ├── useChannelStore.ts             # Channel list, active channel, CRUD
│               │   ├── useMessageStore.ts             # Per-channel message maps, pagination
│               │   ├── useMemberStore.ts              # Server member list
│               │   ├── usePresenceStore.ts            # Online/offline tracking, WS connection state
│               │   ├── useVoiceStore.ts               # Voice state, participants, device preferences
│               │   ├── useUIStore.ts                  # UI toggles (member list, settings)
│               │   ├── useInviteStore.ts              # Invite management
│               │   ├── useUpdateStore.ts              # Auto-update state machine
│               │   └── useAdminNotificationStore.ts   # Kick/ban notification modals
│               │
│               ├── hooks/          # 3 custom React hooks
│               │   ├── useUsername.ts       # Resolve userId → username + avatar color
│               │   ├── useMediaDevices.ts   # Enumerate audio devices, listen for changes
│               │   └── useDeepLink.ts       # Handle discord-clone:// protocol URLs
│               │
│               └── utils/          # 4 utility modules
│                   ├── avatarColor.ts       # Deterministic hash-based avatar colors
│                   ├── formatTimestamp.ts    # Relative date formatting
│                   ├── groupMessages.ts     # 5-minute message grouping algorithm
│                   └── soundPlayer.ts       # Procedural audio tones (Web Audio API)
│
├── server/                         # ★ Fastify Backend API (Part: server)
│   ├── Dockerfile                  # Multi-stage build: Node 20 Alpine, non-root user
│   ├── drizzle.config.ts           # Drizzle-kit: SQLite dialect, schema path, migrations output
│   ├── vitest.config.ts            # Test config: globals, in-memory SQLite
│   ├── tsconfig.json               # Node.js TypeScript config
│   ├── drizzle/                    # SQL migrations (4 files + metadata)
│   │   ├── 0000_steep_galactus.sql         # Initial: users, sessions, invites, bans, channels
│   │   ├── 0001_add_encrypted_group_key.sql # Add encrypted_group_key to users
│   │   ├── 0002_next_blue_marvel.sql       # Add messages table
│   │   ├── 0003_wandering_norman_osborn.sql # Add unique index on channels.name
│   │   └── meta/                           # Drizzle migration metadata (snapshots + journal)
│   └── src/
│       ├── index.ts                # ★ ENTRY: Bootstrap (dotenv, key gen, build app, migrate, seed, listen)
│       ├── app.ts                  # buildApp(): Fastify instance, plugin registration order
│       ├── app.test.ts             # Integration test for app bootstrap
│       │
│       ├── config/                 # Server configuration
│       │   ├── corsConfig.ts       # CORS: CLIENT_ORIGIN restriction, credentials enabled
│       │   └── logRedaction.ts     # Pino: 13 sensitive field paths redacted
│       │
│       ├── db/                     # Database layer
│       │   ├── schema.ts           # Drizzle schema: 6 tables (users, sessions, invites, bans, channels, messages)
│       │   ├── connection.ts       # SQLite connection: WAL mode, foreign keys, :memory: support
│       │   ├── migrate.ts          # Auto-migration runner
│       │   ├── seed.ts             # Default channels (general text, Gaming voice)
│       │   └── *.test.ts           # Schema and connection tests
│       │
│       ├── services/               # Shared services
│       │   └── encryptionService.ts # Group key management: sealed box encrypt for each user
│       │
│       ├── plugins/                # Fastify plugins organized by domain
│       │   ├── db.ts               # Database plugin: decorates fastify.db
│       │   ├── auth/               # Auth domain (4 files)
│       │   │   ├── authRoutes.ts       # POST login/register/refresh/logout + GET server/status
│       │   │   ├── authService.ts      # JWT sign/verify, bcrypt hash, first-user setup
│       │   │   ├── authMiddleware.ts   # Global onRequest JWT verification hook
│       │   │   └── sessionService.ts   # Session CRUD, token rotation, expiry cleanup
│       │   ├── invites/            # Invite domain (2 files)
│       │   │   ├── inviteRoutes.ts     # POST create, GET list, GET validate, DELETE revoke
│       │   │   └── inviteService.ts    # Invite generation, validation
│       │   ├── channels/           # Channel domain (2 files)
│       │   │   ├── channelRoutes.ts    # GET list, POST create, DELETE (+ WS broadcast)
│       │   │   └── channelService.ts   # Channel CRUD, 50-channel limit
│       │   ├── users/              # User domain (2 files)
│       │   │   ├── userRoutes.ts       # GET /api/users (member list)
│       │   │   └── userService.ts      # User queries
│       │   ├── messages/           # Message domain (3 files)
│       │   │   ├── messageRoutes.ts    # GET messages (cursor pagination)
│       │   │   ├── messageService.ts   # Message storage, E2E ciphertext only
│       │   │   └── messageWsHandler.ts # text:send → store + broadcast text:receive
│       │   ├── admin/              # Admin domain (2 files)
│       │   │   ├── adminRoutes.ts      # POST kick/ban/unban/reset-password, GET bans
│       │   │   └── adminService.ts     # Admin actions + session cleanup
│       │   ├── presence/           # Presence domain (1 file)
│       │   │   └── presenceService.ts  # In-memory online tracking, presence:sync/update broadcasts
│       │   └── voice/              # Voice domain (3 files)
│       │       ├── mediasoupManager.ts # mediasoup Worker/Router singleton, TURN credential gen
│       │       ├── voiceService.ts     # Peer state management, transport/producer/consumer lifecycle
│       │       └── voiceWsHandler.ts   # Voice WS message handlers (join/leave/transport/produce/consume)
│       │
│       ├── ws/                     # WebSocket infrastructure
│       │   ├── wsServer.ts         # WS endpoint (/ws?token=), connection tracking, presence integration
│       │   └── wsRouter.ts         # Message format validation, type-based dispatch
│       │
│       ├── privacy/                # Privacy/security audit tests (4 files)
│       │   ├── corsRestriction.test.ts     # Verifies unknown origins rejected
│       │   ├── dependencyAudit.test.ts     # Zero telemetry/analytics packages
│       │   ├── noOutboundRequests.test.ts  # No fetch/axios/http.request in source
│       │   └── pinoRedaction.test.ts       # Sensitive fields censored in logs
│       │
│       └── test/                   # Test infrastructure
│           └── helpers.ts          # setupApp(), seedOwner(), seedRegularUser(), seedInvite()
│
├── shared/                         # ★ Shared TypeScript Library (Part: shared)
│   ├── vitest.config.ts            # Test config: globals, node env
│   ├── tsconfig.json               # Library config: declarations, source maps
│   └── src/
│       ├── index.ts                # ★ ENTRY: Barrel re-export of all types, constants, WS messages
│       ├── types.ts                # 7 domain types (User, Channel, Message, Session, Invite, Ban) + API envelopes
│       ├── constants.ts            # 19 runtime constants (limits, timeouts, JWT expiry, NaCl params)
│       ├── ws-messages.ts          # 27 WS event types + 25 payload interfaces + WsMessage<T> envelope
│       └── constants.test.ts       # Constant value verification tests
│
├── docker/                         # Docker/infrastructure configs
│   ├── coturn/
│   │   ├── turnserver.conf         # Dev TURN config (no TLS, hardcoded secret)
│   │   └── turnserver.prod.conf    # Prod TURN config (realm=discweeds.com, EC2 NAT IPs)
│   └── nginx/
│       ├── nginx.conf              # TLS termination, reverse proxy, rate limiting, WS upgrade
│       └── landing/
│           └── index.html          # Invite landing page (deep link → app install fallback)
│
├── scripts/
│   └── setup.sh                    # Interactive production setup (secrets, certs, nginx, TURN)
│
├── docs/                           # Generated project documentation (this workflow's output)
│
├── docker-compose.yml              # Production: app + coturn + nginx + certbot (host networking)
├── docker-compose.dev.yml          # Development: coturn only
├── package.json                    # Root: workspaces config, dev/build/test/lint scripts
├── tsconfig.base.json              # Shared TypeScript base: strict, ES2022, bundler resolution
├── eslint.config.mjs               # ESLint 9 flat config: no-any (error), no-console (server)
├── .prettierrc.json                # Prettier: semicolons, single quotes, 100-char lines
├── .env.example                    # All env vars with defaults and descriptions
├── .dockerignore                   # Excludes client/, .git/, node_modules/, secrets
├── .gitignore                      # Excludes dist/, data/, .env, IDE configs
└── README.md                       # Project overview, tech stack, getting started
```

## Critical Folders

| Path | Purpose | Criticality |
|------|---------|-------------|
| `client/src/main/` | Electron main process — window, IPC, security, auto-update | **High** — security boundary |
| `client/src/renderer/src/services/` | All client business logic — API, WS, encryption, voice | **High** — core functionality |
| `client/src/renderer/src/stores/` | All application state (10 stores) | **High** — state management |
| `server/src/plugins/auth/` | Authentication — JWT, sessions, middleware, first-user setup | **High** — security |
| `server/src/plugins/voice/` | mediasoup SFU — WebRTC transports, producers, consumers | **High** — voice/video |
| `server/src/db/` | Database schema, connection, migrations, seeding | **High** — data layer |
| `server/src/ws/` | WebSocket server and message routing | **High** — real-time |
| `shared/src/` | Contract boundary — all types, constants, WS protocol | **High** — type safety |
| `docker/` | Production infrastructure — TURN, nginx, landing page | **Medium** — deployment |
| `.github/workflows/` | CI/CD — PR validation, release pipeline, EC2 deploy | **Medium** — automation |

## Entry Points

| Entry Point | File | Process |
|-------------|------|---------|
| Electron Main | `client/src/main/index.ts` | Main process — window creation, protocol handler, CSP |
| Electron Preload | `client/src/preload/index.ts` | Context bridge — exposes APIs to renderer |
| React App | `client/src/renderer/src/main.tsx` | Renderer — React root render |
| Server | `server/src/index.ts` | Node.js — dotenv, build app, migrate, seed, listen |
| Shared | `shared/src/index.ts` | Library — barrel re-export |

## File Count Summary

| Category | Count |
|----------|-------|
| Client source (non-test) | 61 |
| Client tests | 44 |
| Server source (non-test) | 25 |
| Server tests | 22 |
| Server privacy tests | 4 |
| Shared source | 4 |
| Shared tests | 1 |
| Config files | 18 |
| Infrastructure | 8 |
| Documentation | 10 (in docs/) |
| **Total project files** | **~197** |

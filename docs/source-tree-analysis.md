# Source Tree Analysis

**Generated:** 2026-02-24 | **Scan Level:** Quick

## Repository Structure

```
discord_clone/                          # Monorepo root
├── package.json                        # Workspace root (npm workspaces)
├── tsconfig.base.json                  # Shared TypeScript config
├── eslint.config.mjs                   # ESLint flat config (TS + React hooks)
├── .env                                # Environment variables
├── .env.example                        # Env template
├── README.md                           # Project documentation
│
├── client/                             # ★ ELECTRON DESKTOP APP (Part: client)
│   ├── package.json                    # Electron + React dependencies
│   ├── electron-builder.yml            # Packaging config (dmg/nsis/AppImage)
│   ├── electron.vite.config.ts         # Vite config for main/preload/renderer
│   ├── tsconfig.json                   # Extends base TS config
│   ├── tsconfig.node.json              # Node config for main process
│   ├── tsconfig.web.json               # Web config for renderer
│   ├── vitest.config.ts                # Test configuration
│   ├── vitest.setup.ts                 # Test setup (jsdom)
│   ├── out/                            # Build output
│   └── src/
│       ├── main/                       # ★ ELECTRON MAIN PROCESS
│       │   ├── index.ts                # ← ENTRY POINT: App init, window management
│       │   └── safeStorage.ts          # IPC handlers for secure credential storage
│       ├── preload/                    # ★ IPC BRIDGE (Context Isolation)
│       │   ├── index.ts                # Exposes secureStorage API to renderer
│       │   └── index.d.ts             # TypeScript declarations for window globals
│       └── renderer/                   # ★ REACT APPLICATION
│           └── src/
│               ├── App.tsx             # ← ENTRY: Router setup, session restore
│               ├── main.tsx            # ReactDOM render entry
│               ├── components/         # Shared UI component library
│               │   ├── index.ts        # Barrel export
│               │   ├── Button.tsx      # Reusable button
│               │   ├── Input.tsx       # Form input
│               │   ├── Modal.tsx       # Dialog/modal
│               │   ├── ContextMenu.tsx # Right-click menu (Radix)
│               │   ├── DropdownMenu.tsx# Dropdown selector (Radix)
│               │   ├── Tooltip.tsx     # Hover tooltip (Radix)
│               │   └── ScrollArea.tsx  # Scrollable container
│               ├── features/           # Feature-based modules
│               │   ├── auth/           # Authentication
│               │   │   ├── LoginPage.tsx
│               │   │   ├── RegisterPage.tsx
│               │   │   └── AuthGuard.tsx
│               │   ├── layout/         # App shell & navigation
│               │   │   ├── AppLayout.tsx
│               │   │   ├── ContentArea.tsx
│               │   │   ├── UserPanel.tsx
│               │   │   └── ChannelRedirect.tsx
│               │   ├── channels/       # Channel management
│               │   │   ├── ChannelSidebar.tsx
│               │   │   └── ChannelItem.tsx
│               │   └── members/        # Member list
│               │       ├── MemberList.tsx
│               │       └── MemberItem.tsx
│               ├── stores/             # Zustand state stores
│               │   ├── useAuthStore.ts
│               │   ├── useChannelStore.ts
│               │   ├── useMemberStore.ts
│               │   └── useUIStore.ts
│               ├── services/           # API & encryption clients
│               │   ├── apiClient.ts    # HTTP client with token refresh
│               │   └── encryptionService.ts  # libsodium E2E encryption
│               └── utils/
│                   └── avatarColor.ts  # Deterministic avatar colors
│
├── server/                             # ★ FASTIFY BACKEND API (Part: server)
│   ├── package.json                    # Fastify + Drizzle dependencies
│   ├── drizzle.config.ts              # Drizzle ORM / migration config
│   ├── tsconfig.json                   # Extends base TS config
│   ├── vitest.config.ts               # Test configuration
│   ├── data/                           # SQLite database files
│   ├── dist/                           # Compiled output
│   ├── drizzle/                        # Database migrations
│   │   ├── 0000_steep_galactus.sql    # Initial schema
│   │   ├── 0001_add_encrypted_group_key.sql  # Encryption migration
│   │   └── meta/                      # Migration metadata
│   └── src/
│       ├── index.ts                    # ← ENTRY POINT: Server bootstrap
│       ├── app.ts                      # Fastify app factory + health endpoint
│       ├── db/                         # Database layer
│       │   ├── schema.ts              # Drizzle schema definitions
│       │   ├── connection.ts          # SQLite connection setup
│       │   ├── migrate.ts             # Migration runner
│       │   └── seed.ts               # Database seeding
│       ├── plugins/                    # ★ DOMAIN PLUGINS (Fastify)
│       │   ├── db.ts                  # Database plugin
│       │   ├── auth/                  # Authentication domain
│       │   │   ├── authRoutes.ts      # Auth API endpoints
│       │   │   ├── authService.ts     # Auth business logic
│       │   │   ├── authMiddleware.ts  # JWT verification middleware
│       │   │   └── sessionService.ts  # Session/token management
│       │   ├── users/                 # User domain
│       │   │   ├── userRoutes.ts      # User API endpoints
│       │   │   └── userService.ts     # User business logic
│       │   ├── invites/               # Invite domain
│       │   │   ├── inviteRoutes.ts    # Invite API endpoints
│       │   │   └── inviteService.ts   # Invite business logic
│       │   └── channels/              # Channel domain
│       │       ├── channelRoutes.ts   # Channel API endpoints
│       │       └── channelService.ts  # Channel business logic
│       └── services/                   # Shared server services
│           └── encryptionService.ts   # Server-side encryption
│
├── shared/                             # ★ SHARED LIBRARY (Part: shared)
│   ├── package.json                    # Minimal deps (libsodium)
│   ├── tsconfig.json                   # Extends base TS config
│   ├── vitest.config.ts               # Test configuration
│   └── src/
│       ├── index.ts                    # ← ENTRY: Barrel re-export
│       ├── types.ts                   # Domain types (User, Channel, Message, etc.)
│       ├── constants.ts               # System limits, rate limits, encryption params
│       └── ws-messages.ts             # WebSocket message types & protocol
│
├── _bmad/                              # BMAD workflow engine (tooling)
├── _bmad-output/                       # BMAD planning/implementation artifacts
│   ├── planning-artifacts/            # PRD, architecture, epics, UX design
│   │   └── epics/                     # Epic breakdowns (6 epics)
│   ├── implementation-artifacts/      # Story implementations
│   └── project-context.md            # AI-ready project context
│
└── docs/                               # ★ THIS DOCUMENTATION (generated)
```

## Critical Folders

| Folder | Purpose | Part |
|--------|---------|------|
| `client/src/main/` | Electron main process - app lifecycle, window management, secure storage | client |
| `client/src/preload/` | IPC bridge - context-isolated API exposure | client |
| `client/src/renderer/src/` | React application root | client |
| `client/src/renderer/src/features/` | Feature modules (auth, layout, channels, members) | client |
| `client/src/renderer/src/stores/` | Zustand state management | client |
| `client/src/renderer/src/services/` | API client and encryption service | client |
| `server/src/plugins/` | Fastify domain plugins (routes + services) | server |
| `server/src/db/` | Database schema, connection, migrations, seeding | server |
| `server/drizzle/` | SQL migration files | server |
| `shared/src/` | Shared types, constants, WS message protocol | shared |

## Entry Points

| Part | Entry Point | Description |
|------|------------|-------------|
| client (main) | `client/src/main/index.ts` | Electron app initialization |
| client (renderer) | `client/src/renderer/src/main.tsx` | React DOM render |
| server | `server/src/index.ts` | Fastify server bootstrap |
| shared | `shared/src/index.ts` | Library barrel export |

## Integration Points

| From | To | Type | Path |
|------|----|------|------|
| client renderer | server | HTTP REST API | `services/apiClient.ts` → `/api/*` |
| client renderer | shared | TypeScript import | `discord-clone-shared` package |
| server | shared | TypeScript import | `discord-clone-shared` package |
| client main | client renderer | Electron IPC | `preload/index.ts` bridge |

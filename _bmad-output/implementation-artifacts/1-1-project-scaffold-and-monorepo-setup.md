# Story 1.1: Project Scaffold & Monorepo Setup

Status: ready-for-dev

## Story

As a developer,
I want the project scaffolded with the electron-vite React+TS client, Fastify server, and shared types package in a monorepo workspace,
so that I have a working development environment with all foundational tooling configured.

## Acceptance Criteria

1. **Given** a fresh repository **When** the scaffold commands are executed **Then** the monorepo is structured with `client/`, `server/`, and `shared/` workspaces **And** root `package.json` configures npm workspaces
2. **Given** the client workspace **When** I run `npm run dev` in client **Then** the Electron app launches with Vite HMR active in the renderer
3. **Given** the server workspace **When** I run `npm run dev` in server **Then** the Fastify server starts in tsx watch mode
4. **Given** the root workspace **When** I run `npm run dev` **Then** both client and server start concurrently
5. **Given** the project configuration **When** I inspect the tooling **Then** TypeScript strict mode is enabled across all packages **And** Tailwind CSS is configured in the client with the warm earthy color tokens from the UX spec **And** Radix UI primitives are installed as dependencies **And** Vitest is configured for testing **And** ESLint and Prettier are configured for consistent code style

## Tasks / Subtasks

- [ ] Task 1: Initialize monorepo root (AC: 1)
  - [ ] 1.1 Create root `package.json` with `"workspaces": ["client", "server", "shared"]` and `"private": true`
  - [ ] 1.2 Create root `tsconfig.base.json` with shared TypeScript config (strict: true, target: ES2022, moduleResolution: bundler)
  - [ ] 1.3 Create `.gitignore` (node_modules, dist, build, .env, data/sqlite, *.log, .DS_Store)
  - [ ] 1.4 Create `.env.example` with server environment variable template
  - [ ] 1.5 Create root `.prettierrc.json` (semi: true, singleQuote: true, printWidth: 100, tabWidth: 2, trailingComma: es5)
  - [ ] 1.6 Create root ESLint config with TypeScript and React plugins
  - [ ] 1.7 Add root dev dependencies: `concurrently`, `prettier`, `typescript@5.9.x`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`
  - [ ] 1.8 Add root scripts: `dev` (concurrently client+server), `dev:client`, `dev:server`, `build`, `test`, `lint`, `format`

- [ ] Task 2: Scaffold Electron client with electron-vite (AC: 2, 5)
  - [ ] 2.1 Run `npm create @quick-start/electron@latest client -- --template react-ts` to scaffold the client workspace
  - [ ] 2.2 Verify `electron.vite.config.ts` has main/preload/renderer sections
  - [ ] 2.3 Configure Electron BrowserWindow security: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `enableRemoteModule: false`
  - [ ] 2.4 Set minimum window size to 960x540 in main process
  - [ ] 2.5 Create preload script with contextBridge skeleton exposing `window.api` namespace
  - [ ] 2.6 Verify `npm run dev` in client launches Electron with Vite HMR

- [ ] Task 3: Configure Tailwind CSS v4 with warm earthy design tokens (AC: 5)
  - [ ] 3.1 Install `tailwindcss@^4.2.0` and `@tailwindcss/vite` in client
  - [ ] 3.2 Add `@tailwindcss/vite` plugin to `electron.vite.config.ts` renderer section
  - [ ] 3.3 Create `client/src/renderer/src/globals.css` with `@import "tailwindcss"` and `@theme` block defining all color tokens
  - [ ] 3.4 Define warm earthy color palette in `@theme` (see Dev Notes for exact hex values)
  - [ ] 3.5 Define typography tokens: system font stack, type scale (xs through xl)
  - [ ] 3.6 Define spacing tokens on 4px grid system
  - [ ] 3.7 Define border-radius tokens (8px default, 12px large, 9999px full)
  - [ ] 3.8 Verify Tailwind utility classes render correctly in the Electron renderer

- [ ] Task 4: Install and configure Radix UI (AC: 5)
  - [ ] 4.1 Install unified `radix-ui` package in client
  - [ ] 4.2 Create placeholder component wrappers in `client/src/renderer/src/components/` for: Button, Input, Modal (Dialog), ContextMenu, DropdownMenu, Tooltip, ScrollArea
  - [ ] 4.3 Verify Radix primitives import and render correctly

- [ ] Task 5: Scaffold Fastify server (AC: 3)
  - [ ] 5.1 Create `server/` workspace with `package.json` (dependencies: `fastify@^5.7.0`)
  - [ ] 5.2 Create `server/tsconfig.json` extending root `tsconfig.base.json`
  - [ ] 5.3 Create `server/src/index.ts` entry point that starts Fastify on configurable port
  - [ ] 5.4 Create `server/src/app.ts` with Fastify instance creation and plugin registration skeleton
  - [ ] 5.5 Add GET `/api/health` endpoint returning `{ data: { status: "ok" } }`
  - [ ] 5.6 Configure Pino logger (structured JSON, no message content logging)
  - [ ] 5.7 Add server dev dependencies: `tsx@^4.21.0`, `vitest@^4.0.0`, `@types/node`
  - [ ] 5.8 Add server scripts: `dev` (tsx watch), `build` (tsc), `start`, `test`, `lint`
  - [ ] 5.9 Verify `npm run dev` in server starts Fastify with tsx watch mode

- [ ] Task 6: Create shared types package (AC: 1)
  - [ ] 6.1 Create `shared/` workspace with `package.json` (`"name": "discord-clone-shared"`, `"private": true`)
  - [ ] 6.2 Create `shared/tsconfig.json` extending root `tsconfig.base.json`
  - [ ] 6.3 Create `shared/src/types.ts` with core interfaces: User, Channel, Message, Session, Invite, Ban, ApiSuccess, ApiList, ApiError, AuthTokens
  - [ ] 6.4 Create `shared/src/ws-messages.ts` with WebSocket message type definitions (WsMessage envelope, namespace:action types)
  - [ ] 6.5 Create `shared/src/constants.ts` with shared constants (MAX_PARTICIPANTS, WS_RECONNECT_DELAY, JWT expiry times, MAX_MESSAGE_LENGTH, etc.)
  - [ ] 6.6 Create `shared/src/index.ts` barrel export
  - [ ] 6.7 Configure client and server to import from shared workspace package

- [ ] Task 7: Configure Vitest testing (AC: 5)
  - [ ] 7.1 Install `vitest@^4.0.0` as dev dependency in client and server
  - [ ] 7.2 Create `client/vitest.config.ts` (environment: jsdom, globals: true, react plugin)
  - [ ] 7.3 Create `server/vitest.config.ts` (environment: node, globals: true)
  - [ ] 7.4 Install `@vitejs/plugin-react` and `jsdom` as client dev dependencies
  - [ ] 7.5 Write one smoke test per workspace to verify test runner works

- [ ] Task 8: Configure concurrent dev workflow (AC: 4)
  - [ ] 8.1 Install `concurrently@^9.2.0` at root
  - [ ] 8.2 Configure root `npm run dev` script: `concurrently -n client,server -c blue,green "npm run dev -w client" "npm run dev -w server"`
  - [ ] 8.3 Verify `npm run dev` at root starts both client and server with labeled output
  - [ ] 8.4 Run `npm install` at root and verify all workspace dependencies resolve

- [ ] Task 9: Final verification (AC: 1-5)
  - [ ] 9.1 Verify monorepo structure: client/, server/, shared/ all present with package.json
  - [ ] 9.2 Verify `npm run dev` starts Electron + Fastify concurrently
  - [ ] 9.3 Verify TypeScript strict mode in all tsconfig files
  - [ ] 9.4 Verify Tailwind warm earthy tokens render in Electron
  - [ ] 9.5 Verify Vitest runs in both client and server
  - [ ] 9.6 Verify ESLint and Prettier run without errors
  - [ ] 9.7 Verify Radix UI primitives are importable

## Dev Notes

### Critical Technology Versions (February 2026)

| Package | Version | Notes |
|---------|---------|-------|
| electron-vite | 5.0.0 | ESM package; scaffold with `npm create @quick-start/electron@latest` |
| Electron | 40.x | Latest stable 40.6.0; rebuild native modules with `@electron/rebuild` |
| Fastify | 5.7.x | Requires Node.js 20+; async plugin registration |
| TypeScript | 5.9.3 | Use stable; 6.0 beta not recommended yet |
| Tailwind CSS | 4.2.0 | NO `tailwind.config.js`; uses CSS `@theme` directives; requires `@tailwindcss/vite` plugin |
| Radix UI | 1.4.3 | Unified `radix-ui` package (NOT individual `@radix-ui/react-*`) |
| Vitest | 4.0.x | Breaking changes from v3: `poolOptions` removed; coverage remapping changed |
| Zustand | 5.0.x | Install for future stories; requires React 18+ |
| React Router | 7.13.x | Import from `react-router` (NOT `react-router-dom`); use `HashRouter` for Electron |
| tsx | 4.21.0 | For server watch mode dev |
| concurrently | 9.2.x | Root-level dev orchestration |
| better-sqlite3 | 12.6.x | NOT needed for this story, but DO NOT install at root (native module) |
| libsodium-wrappers | 0.8.2 | NOT needed for this story |
| Drizzle ORM | 0.45.x | NOT needed for this story |

### Tailwind CSS v4 Migration - CRITICAL

The architecture doc references `tailwind.config.js`. **Tailwind v4 eliminates this file.** Instead:

1. Install `tailwindcss` and `@tailwindcss/vite`
2. In `globals.css`, use `@import "tailwindcss"` (NOT `@tailwind base/components/utilities`)
3. Define theme customizations with `@theme` block in CSS:

```css
@import "tailwindcss";

@theme {
  /* Background Colors */
  --color-bg-primary: #221e1a;
  --color-bg-secondary: #2a2520;
  --color-bg-tertiary: #1c1915;
  --color-bg-floating: #161310;
  --color-bg-hover: #362f28;
  --color-bg-active: #3d342b;
  --color-bg-voice: #2a2d2e;

  /* Text Colors */
  --color-text-primary: #f0e6d9;
  --color-text-secondary: #a89882;
  --color-text-muted: #6d5f4e;
  --color-text-link: #00a8fc;

  /* Accent Colors */
  --color-accent-primary: #c97b35;
  --color-accent-hover: #b56a28;

  /* Status Colors */
  --color-status-online: #23a55a;
  --color-status-idle: #f0b232;
  --color-status-dnd: #f23f43;
  --color-status-offline: #80848e;

  /* Semantic Colors */
  --color-success: #23a55a;
  --color-warning: #f0b232;
  --color-error: #f23f43;
  --color-voice-speaking: #23a55a;

  /* Typography */
  --font-family-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;

  /* Border Radius */
  --radius-default: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
}
```

4. Add `@tailwindcss/vite` to the renderer Vite plugins in `electron.vite.config.ts`
5. Content detection is automatic in v4 - no `content` array needed
6. Use `@source` directive if Tailwind needs to scan shared workspace packages

[Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design-Direction-B]

### Radix UI Unified Package

The architecture doc references individual `@radix-ui/react-*` packages. **As of v1.4.3, use the unified `radix-ui` package:**

```bash
npm install radix-ui
```

```tsx
import { Dialog, DropdownMenu, Tooltip, ContextMenu, ScrollArea } from 'radix-ui';
```

### Electron Security Configuration (Mandatory)

Every BrowserWindow MUST enforce:
```typescript
webPreferences: {
  nodeIntegration: false,
  enableRemoteModule: false,
  contextIsolation: true,
  sandbox: true,
  preload: path.join(__dirname, '../preload/index.js'),
}
```

The preload script exposes a controlled `window.api` surface via `contextBridge.exposeInMainWorld`. Never expose raw IPC or Node.js APIs to the renderer.

[Source: _bmad-output/planning-artifacts/architecture.md#Electron-Security]

### React Router for Electron

Use `HashRouter` (not `BrowserRouter`) since Electron loads from `file://` protocol:

```tsx
import { HashRouter } from 'react-router';
```

[Source: Web research - React Router v7 Electron compatibility]

### Naming Conventions (Enforce from Day 1)

| Context | Convention | Examples |
|---------|-----------|----------|
| React components | PascalCase files & exports | `ChannelSidebar.tsx`, `VoiceStatusBar.tsx` |
| Non-component files | camelCase | `useAuthStore.ts`, `apiClient.ts` |
| Functions/variables | camelCase | `getChannelList()`, `currentUser` |
| Types/interfaces | PascalCase | `interface Channel`, `type MessagePayload` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_PARTICIPANTS`, `WS_RECONNECT_DELAY` |
| Zustand stores | `use{Domain}Store` | `useAuthStore`, `useVoiceStore` |
| Fastify plugins | camelCase | `authPlugin`, `channelRoutes` |
| DB tables | snake_case plural | `users`, `channels`, `messages` |
| DB columns | snake_case | `user_id`, `created_at` |
| API routes | kebab-case | `/api/channels`, `/api/invite-links` |
| WS messages | namespace:action | `text:send`, `voice:join` |
| Test files | co-located | `Component.test.tsx` next to `Component.tsx` |

[Source: _bmad-output/planning-artifacts/architecture.md#Naming-Conventions]

### Monorepo npm Workspaces Gotchas

1. **DO NOT hoist native modules** (better-sqlite3, electron) to root. They must be direct dependencies of their consuming package.
2. **Use `workspace:*` protocol** for inter-package dependencies: `"discord-clone-shared": "workspace:*"` in client and server package.json.
3. **Vite deduplication**: If duplicate React instances appear, add `resolve.dedupe: ['react', 'react-dom']` to Vite config.
4. **electron-vite resolves from its own root** - configure `resolve.alias` if needed to find shared package source.
5. **Build order matters**: shared must build before client and server can consume its types.

### Error Response Format (Establish in Health Endpoint)

All API responses follow this envelope:
```typescript
// Success
{ "data": { ...object } }

// List
{ "data": [...objects], "count": number }

// Error
{ "error": { "code": "ERROR_CODE", "message": "Human readable" } }
```

Use `crypto.randomUUID()` for all ID generation. Dates as ISO 8601 in JSON responses.

[Source: _bmad-output/planning-artifacts/architecture.md#API-Response-Format]

### Target Directory Structure

```
discord-clone/
├── package.json                  # root workspaces config
├── tsconfig.base.json            # shared TS strict config
├── .eslintrc.json                # root ESLint config
├── .prettierrc.json              # Prettier config
├── .gitignore
├── .env.example
│
├── client/                       # Electron + React
│   ├── package.json
│   ├── electron.vite.config.ts
│   ├── electron-builder.yml
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── tsconfig.web.json
│   ├── vitest.config.ts
│   └── src/
│       ├── main/
│       │   └── index.ts          # Electron main process
│       ├── preload/
│       │   ├── index.ts          # contextBridge API
│       │   └── index.d.ts        # Type declarations
│       └── renderer/
│           ├── index.html
│           └── src/
│               ├── main.tsx      # React entry
│               ├── App.tsx       # Root + HashRouter
│               ├── globals.css   # Tailwind v4 @import + @theme
│               ├── components/   # Radix UI wrappers
│               ├── features/     # Feature-based organization
│               ├── stores/       # Zustand stores
│               ├── services/     # API, WS, encryption clients
│               ├── hooks/        # Custom React hooks
│               ├── types/        # Client-specific types
│               └── assets/       # Static assets
│
├── server/                       # Fastify backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── index.ts              # Server entry point
│       ├── app.ts                # Fastify setup + plugins
│       ├── plugins/              # Domain plugins (auth, channels, etc.)
│       ├── ws/                   # WebSocket server + router
│       ├── db/                   # Database connection + schema
│       ├── services/             # Business logic
│       └── utils/                # Logger, errors, helpers
│
└── shared/                       # Shared TypeScript types
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts              # Barrel export
        ├── types.ts              # Data model interfaces
        ├── ws-messages.ts        # WebSocket message types
        └── constants.ts          # Shared constants
```

For this story, create only the skeleton structure with entry points. Feature directories (`features/`, `plugins/`, etc.) should be created as empty directories or with placeholder index files - they will be populated in subsequent stories.

[Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure]

### Project Structure Notes

- Directory layout follows architecture doc exactly - no deviations
- `client/` naming matches architecture spec (not `desktop/` or `packages/client/`)
- Workspaces are at root level (not under `packages/`)
- Test files co-located with source, NOT in separate `__tests__` directories
- Feature-based frontend organization under `features/` with domain grouping

### References

- [Source: _bmad-output/planning-artifacts/architecture.md] - Full technical stack, folder structure, naming conventions, security patterns
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] - Color palette, typography, spacing, component specs
- [Source: _bmad-output/planning-artifacts/epics/epic-1-project-foundation-user-authentication.md] - Story requirements and acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md] - Product requirements, Electron security, platform support
- [Source: Web Research Feb 2026] - Latest versions: Tailwind v4 @theme migration, unified radix-ui, React Router v7 HashRouter

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

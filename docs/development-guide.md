# Development Guide

**Generated:** 2026-02-24 | **Scan Level:** Quick

## Prerequisites

- **Node.js** 18+ (recommended: latest LTS)
- **npm** 9+
- Git

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/discord_clone.git
cd discord_clone

# Install all dependencies (root + workspaces)
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your JWT secrets and other config
```

## Environment Setup

Create a `.env` file in the project root with:

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3000` | No | Server port |
| `HOST` | `0.0.0.0` | No | Server bind address |
| `NODE_ENV` | `development` | No | Environment mode |
| `JWT_ACCESS_SECRET` | - | **Yes** | Access token signing key |
| `JWT_REFRESH_SECRET` | - | **Yes** | Refresh token signing key |
| `DATABASE_PATH` | `./data/sqlite/discord-clone.db` | No | SQLite file path |
| `LOG_LEVEL` | `info` | No | Pino log level |

## Running in Development

```bash
# Start both client and server concurrently
npm run dev

# Or start them individually
npm run dev:client    # Electron + React with HMR
npm run dev:server    # Fastify with tsx watch (auto-restart)
```

The `dev` script uses `concurrently` to run both client and server with colored output (blue for client, green for server).

## Building

```bash
# Build all packages (shared → server → client)
npm run build

# Build individual packages
cd shared && npm run build
cd server && npm run build
cd client && npm run build
```

**Build order matters:** shared must be built first (dependency for both client and server).

## Packaging the Desktop App

```bash
cd client
npm run build    # electron-vite build + electron-builder
```

**Targets:**
- macOS: DMG (x64 + arm64)
- Windows: NSIS installer (x64)
- Linux: AppImage (x64)

## Testing

```bash
# Run all tests across workspaces
npm run test

# Run tests for a specific workspace
npm run test -w client
npm run test -w server
npm run test -w shared

# Watch mode
cd client && npm run test:watch
cd server && npm run test:watch
```

**Framework:** Vitest 4
**Client tests:** jsdom environment with React Testing Library
**Server tests:** Node environment
**Pattern:** Co-located test files (`.test.ts` / `.test.tsx`)

## Linting & Formatting

```bash
# Lint all TypeScript files
npm run lint

# Format all files
npm run format
```

**ESLint:** Flat config with TypeScript + React Hooks rules
**Prettier:** Configured for TS, TSX, JSON, CSS, MD files

## Database Management

```bash
# Run from server directory
cd server

# Generate migration from schema changes
npm run db:generate

# Run pending migrations
npm run db:migrate

# Push schema directly (dev convenience, skips migrations)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

## Project Structure (Workspaces)

| Workspace | Path | Purpose |
|-----------|------|---------|
| `discord-clone-client` | `client/` | Electron + React desktop app |
| `discord-clone-server` | `server/` | Fastify REST API backend |
| `discord-clone-shared` | `shared/` | Shared types, constants, WS protocol |

All three workspaces are managed from the root `package.json` via npm workspaces. Shared is consumed as `discord-clone-shared` package by both client and server.

## Common Development Tasks

### Adding a New API Endpoint
1. Create or update route file in `server/src/plugins/{domain}/`
2. Add business logic in corresponding service file
3. Add types to `shared/src/types.ts` if needed
4. Write tests alongside the route/service files
5. Update client API calls in `client/src/renderer/src/services/apiClient.ts`

### Adding a New UI Component
1. Create component in `client/src/renderer/src/components/`
2. Export from `components/index.ts` barrel file
3. Use Radix UI primitives with Tailwind CSS classes

### Adding a New Feature Module
1. Create folder in `client/src/renderer/src/features/{feature}/`
2. Add components specific to the feature
3. Create Zustand store in `stores/` if state management needed
4. Add routes in `App.tsx`

### Adding a New Database Table
1. Define schema in `server/src/db/schema.ts` using Drizzle syntax
2. Run `npm run db:generate` to create migration
3. Run `npm run db:migrate` to apply
4. Add types to `shared/src/types.ts`

## Code Conventions

- **TypeScript strict mode** across all workspaces
- **No explicit `any`** (ESLint error)
- **Unused vars** with `_` prefix are allowed (ESLint warning)
- **React hooks rules** enforced by ESLint
- **Module system:** ES2022 modules throughout
- **Target:** ES2022

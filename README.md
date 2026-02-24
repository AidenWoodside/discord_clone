# Discord Clone

A full-featured Discord clone built as a cross-platform desktop application with end-to-end encryption, real-time messaging, and voice/video chat.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 40 |
| Frontend | React 19, TypeScript, Tailwind CSS 4, Radix UI |
| State Management | Zustand |
| Routing | React Router 7 |
| Backend | Fastify 5, Node.js |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| Real-Time | Native WebSockets, mediasoup (WebRTC SFU) |
| Encryption | libsodium (XSalsa20-Poly1305 for messages, DTLS/SRTP for voice) |
| Auth | JWT (access + refresh tokens), bcrypt |
| Testing | Vitest, React Testing Library |
| Build | electron-vite, electron-builder |

## Project Structure

```
discord_clone/
├── client/           # Electron + React desktop app
│   └── src/
│       ├── main/         # Electron main process
│       ├── preload/      # IPC bridge (context isolation)
│       └── renderer/     # React application
│           ├── components/   # Shared UI components
│           ├── features/     # Feature modules (auth, channels, etc.)
│           ├── services/     # API/WS/encryption clients
│           ├── stores/       # Zustand state stores
│           └── hooks/        # Custom React hooks
├── server/           # Fastify backend API
│   └── src/
│       ├── db/           # Drizzle schema & migrations
│       ├── plugins/      # Fastify domain plugins
│       ├── services/     # Business logic
│       └── ws/           # WebSocket handlers
├── shared/           # Types & constants shared across packages
│   └── src/
│       ├── types.ts      # Domain types (User, Channel, Message, etc.)
│       ├── constants.ts  # Limits, rates, config values
│       └── ws-messages.ts # WebSocket message envelopes
└── .env.example      # Environment variable template
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/discord_clone.git
cd discord_clone

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `NODE_ENV` | `development` | Environment |
| `JWT_ACCESS_SECRET` | — | Access token signing key |
| `JWT_REFRESH_SECRET` | — | Refresh token signing key |
| `DATABASE_PATH` | `./data/sqlite/discord-clone.db` | SQLite database path |
| `LOG_LEVEL` | `info` | Pino log level |

### Running

```bash
# Start both client and server in dev mode
npm run dev

# Or start them individually
npm run dev:client    # Electron + React with HMR
npm run dev:server    # Fastify with auto-restart
```

### Building

```bash
# Build all packages
npm run build

# Package desktop app
cd client && npm run build
```

### Testing

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch
```

### Linting & Formatting

```bash
npm run lint
npm run format
```

## Architecture

**Monorepo** with three npm workspaces (`client`, `server`, `shared`). The `shared` package is the contract boundary — client and server never import from each other directly.

- **Frontend:** Feature-based organization. Zustand stores for state, service layer for all server communication. Electron runs with context isolation and sandboxing enabled; tokens stored in OS keychain via `safeStorage`.
- **Backend:** Plugin-based Fastify. Each domain (auth, channels, messages, voice) is a plugin. All endpoints under `/api/` with consistent `{ data }` / `{ error }` response envelopes. Pino for structured logging.
- **Real-Time:** WebSocket for text/presence, mediasoup SFU for voice/video via WebRTC.
- **Security:** Messages encrypted client-side before transmission. 15-min access tokens + 7-day refresh tokens. Rate limiting on all endpoints.

## License

This project is for educational purposes.

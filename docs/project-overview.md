# Discord Clone — Project Overview

**Generated:** 2026-02-26 | **Scan Level:** Exhaustive | **Workflow Version:** 1.2.0

## Executive Summary

A full-featured Discord clone built as a cross-platform Electron desktop application with a Fastify backend. The application provides real-time text messaging with end-to-end encryption, voice and video chat via WebRTC (mediasoup SFU), user authentication with invite-based registration, channel management, and server administration. Designed for privacy-first self-hosting with zero telemetry.

## Project Identity

| Attribute | Value |
|-----------|-------|
| **Name** | discord-clone |
| **Version** | 0.3.12 |
| **Repository** | `github.com/AidenWoodside/discord_clone` |
| **License** | Educational |
| **Architecture** | Monorepo (npm workspaces) — 3 parts |
| **Primary Language** | TypeScript 5.9.3 (strict mode) |

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop Shell | Electron | 40.6.0 |
| Frontend Framework | React | 19.1.0 |
| State Management | Zustand | 5.0.11 |
| Styling | Tailwind CSS | 4.2.0 |
| UI Primitives | Radix UI | 1.4.3 |
| Routing | React Router | 7.13.0 |
| Backend Framework | Fastify | 5.7.0 |
| Database | SQLite (better-sqlite3) | 12.6.2 |
| ORM | Drizzle ORM | 0.45.1 |
| Real-Time | @fastify/websocket | 11.2.0 |
| Voice/Video | mediasoup (SFU) + mediasoup-client | 3.19.17 / 3.18.7 |
| NAT Traversal | coturn (TURN/STUN) | latest |
| Encryption | libsodium-wrappers | 0.8.2 |
| Auth | JWT (jsonwebtoken) + bcrypt | 9.0.3 / 6.0.0 |
| Auto-Update | electron-updater | 6.8.3 |
| Build | electron-vite + electron-builder | 3.1.0 / 26.0.0 |
| Testing | Vitest + React Testing Library | 4.0.0 |
| Reverse Proxy | nginx | alpine |
| TLS | Let's Encrypt (certbot) | — |
| CI/CD | GitHub Actions | — |
| Containerization | Docker + Docker Compose | — |

## Repository Structure

| Part | Path | Type | Purpose |
|------|------|------|---------|
| **client** | `client/` | Electron Desktop | Desktop app with React 19 UI, mediasoup-client, E2E encryption |
| **server** | `server/` | Fastify Backend | REST API + WebSocket + mediasoup SFU + SQLite |
| **shared** | `shared/` | TypeScript Library | Contract boundary — types, constants, WS protocol definitions |

**Supporting directories:**
| Path | Purpose |
|------|---------|
| `docker/` | coturn config, nginx config, landing page |
| `scripts/` | Production setup automation |
| `.github/workflows/` | CI (PR validation) + CD (release pipeline) |
| `docs/` | Generated project documentation |

## Implementation Status

### Completed Features (Epics 1-6)

| Epic | Feature | Status |
|------|---------|--------|
| **1** | Project scaffold & monorepo | Done |
| **1** | Database schema & server config | Done |
| **1** | User registration & invite system | Done |
| **1** | Login/logout & session management | Done |
| **1** | E2E encryption foundation | Done |
| **1** | Discord-familiar app shell & navigation | Done |
| **2** | WebSocket connection & real-time transport | Done |
| **2** | Encrypted text messaging | Done |
| **2** | Message feed & channel navigation UI | Done |
| **2** | Persistent message history & scrollback | Done |
| **3** | Voice server infrastructure (mediasoup) | Done |
| **3** | Voice channel join/leave & presence | Done |
| **3** | Real-time voice audio & speaking indicators | Done |
| **3** | Audio device management & voice controls | Done |
| **4** | Video camera toggle & streaming | Done |
| **4** | Video grid display | Done |
| **5** | Channel management (create/delete) | Done |
| **5** | User management & administration (kick/ban/reset) | Done |
| **6** | Connection resilience & error handling | Done |
| **6** | Auto-update system | Done |
| **6** | Privacy enforcement & zero telemetry | Done |
| **6** | Production deployment infrastructure | Done |
| **6** | CI/CD pipeline & cross-platform distribution | Done |

### Codebase Metrics

| Metric | Count |
|--------|-------|
| Total source files (non-test) | 90 |
| Total test files | 67 |
| React components | 40 |
| Zustand stores | 10 |
| Services | 7 (client) + 1 (server encryption) |
| REST API endpoints | 17 |
| WebSocket message types | 27 |
| Database tables | 6 |
| Custom React hooks | 3 |
| Client utilities | 4 |
| Docker services | 4 (production) |

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Desktop framework | Electron | Cross-platform, mature ecosystem, protocol handler support |
| Database | SQLite (single file) | Simple deployment, no separate DB service, sufficient for single-server |
| State management | Zustand (not Redux) | Lightweight, no boilerplate, imperative access from services |
| WebRTC approach | mediasoup SFU | Scales better than mesh P2P, server controls routing |
| E2E encryption | libsodium (NaCl) | Battle-tested crypto, X25519 key exchange + XSalsa20-Poly1305 |
| Styling | Tailwind CSS 4 | Utility-first, no CSS modules, consistent design tokens |
| Module system | ESM throughout | Modern, tree-shakeable, Vite-native |
| Hosting | Single EC2 + Docker | Self-hosted, privacy-first, no cloud dependencies |
| Auth | JWT pairs (not sessions) | Stateless access tokens, rotatable refresh tokens |
| CI/CD | GitHub Actions | Free for open source, integrated with Releases |

## Quick Start

```bash
npm install
cp .env.example .env    # Set JWT secrets
npm run dev             # Starts client + server concurrently
```

## Documentation Index

See [index.md](./index.md) for the complete documentation navigation.

### Core Documents
- [Source Tree Analysis](./source-tree-analysis.md) — Annotated directory tree
- [Architecture — Client](./architecture-client.md) — Electron process model, React patterns
- [Architecture — Server](./architecture-server.md) — Plugin architecture, database, auth
- [Integration Architecture](./integration-architecture.md) — Part communication, data flows

### Reference
- [API Contracts](./api-contracts-server.md) — 17 REST endpoints + WebSocket protocol
- [Data Models](./data-models-server.md) — 6-table SQLite schema
- [Component Inventory](./component-inventory-client.md) — 40 components, 10 stores, 7 services

### Development
- [Development Guide](./development-guide.md) — Setup, commands, testing, deployment

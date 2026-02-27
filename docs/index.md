# Discord Clone — Project Documentation Index

**Generated:** 2026-02-26 | **Scan Level:** Exhaustive | **Workflow Version:** 1.2.0

## Project Overview

- **Type:** Monorepo (npm workspaces) with 3 parts
- **Primary Language:** TypeScript 5.9.3 (strict mode)
- **Architecture:** Electron desktop app + Fastify API backend + shared contract library
- **Purpose:** Full-featured Discord clone with E2E encryption, voice/video, and self-hosted deployment
- **Version:** 0.3.12

## Quick Reference

### Client (desktop)
- **Type:** Desktop (Electron 40)
- **Tech Stack:** Electron + React 19 + Zustand 5 + Tailwind CSS 4 + Radix UI + mediasoup-client + libsodium
- **Root:** `client/`
- **Entry Point:** `client/src/main/index.ts` (main process), `client/src/renderer/src/main.tsx` (React)
- **Architecture Pattern:** Electron multi-process + React feature-based (40 components, 10 stores, 7 services)

### Server (backend)
- **Type:** Backend API (Fastify 5)
- **Tech Stack:** Fastify + Drizzle ORM + SQLite + JWT + bcrypt + mediasoup + @fastify/websocket + libsodium
- **Root:** `server/`
- **Entry Point:** `server/src/index.ts`
- **Architecture Pattern:** Plugin-based domain architecture (auth, channels, messages, voice, admin, presence)

### Shared (library)
- **Type:** TypeScript library
- **Tech Stack:** TypeScript + libsodium-wrappers
- **Root:** `shared/`
- **Entry Point:** `shared/src/index.ts`
- **Purpose:** Contract boundary — 7 domain types, 27 WS message types, 19 runtime constants

## Generated Documentation

### Core Documents
- [Project Overview](./project-overview.md) — Executive summary, tech stack, implementation status, architectural decisions
- [Source Tree Analysis](./source-tree-analysis.md) — Annotated directory tree (~197 files), critical folders, entry points

### Architecture (per part)
- [Architecture — Client](./architecture-client.md) — Electron process model, React component hierarchy, service layer, state management, E2E encryption, voice/video architecture, security model
- [Architecture — Server](./architecture-server.md) — Plugin registration order, domain architecture, database design, auth flow, WebSocket routing, mediasoup SFU, privacy enforcement, deployment

### Integration
- [Integration Architecture](./integration-architecture.md) — 6 integration points (shared imports, HTTP REST, WebSocket, WebRTC/mediasoup, Electron IPC, external services), data flow diagrams, lifecycle walkthroughs

### Detailed Reference
- [Component Inventory — Client](./component-inventory-client.md) — 40 React components, 7 services, 10 Zustand stores, 3 hooks, 4 utilities, design system
- [API Contracts — Server](./api-contracts-server.md) — 17 REST endpoints + 27 WebSocket message types, request/response schemas, error codes, auth middleware flow
- [Data Models — Server](./data-models-server.md) — 6-table SQLite schema (33 columns, 6 FKs, 7 indexes), ER diagram, migration history, in-memory state

### Development
- [Development Guide](./development-guide.md) — Prerequisites, environment setup, NPM scripts, database management, testing, code style, common tasks, deployment, CI/CD

## Existing Documentation

### Root
- [README.md](../README.md) — Project overview, tech stack table, getting started

### BMAD Planning Artifacts
- [Product Brief](../_bmad-output/planning-artifacts/product-brief-discord_clone-2026-02-24.md)
- [PRD (Product Requirements)](../_bmad-output/planning-artifacts/prd.md)
- [UX Design Specification](../_bmad-output/planning-artifacts/ux-design-specification.md)
- [Architecture (BMAD)](../_bmad-output/planning-artifacts/architecture.md)
- [Implementation Readiness Report](../_bmad-output/planning-artifacts/implementation-readiness-report-2026-02-24.md)
- [Dependency Map & Parallel Plan](../_bmad-output/planning-artifacts/dependency-map-and-parallel-plan.md)
- [Epics Index](../_bmad-output/planning-artifacts/epics/index.md) (6 epics, all completed)
- [Project Context](../_bmad-output/project-context.md)

### BMAD Implementation Artifacts

**Epic 1 — Project Foundation & Authentication:**
- [Story 1-1: Project Scaffold & Monorepo Setup](../_bmad-output/implementation-artifacts/1-1-project-scaffold-and-monorepo-setup.md)
- [Story 1-2: Database Schema & Core Server Config](../_bmad-output/implementation-artifacts/1-2-database-schema-and-core-server-configuration.md)
- [Story 1-3: User Registration & Invite System](../_bmad-output/implementation-artifacts/1-3-user-registration-and-invite-system.md)
- [Story 1-4: User Login/Logout & Session Management](../_bmad-output/implementation-artifacts/1-4-user-login-logout-and-session-management.md)
- [Story 1-5: E2E Encryption Foundation](../_bmad-output/implementation-artifacts/1-5-e2e-encryption-foundation.md)
- [Story 1-6: Discord-Familiar App Shell & Navigation](../_bmad-output/implementation-artifacts/1-6-discord-familiar-app-shell-and-navigation.md)
- [Epic 1 Retrospective](../_bmad-output/implementation-artifacts/epic-1-retro-2026-02-24.md)

**Epic 2 — Real-Time Text Communication:**
- [Story 2-1: WebSocket Connection & Real-Time Transport](../_bmad-output/implementation-artifacts/2-1-websocket-connection-and-real-time-transport.md)
- [Story 2-2: Encrypted Text Messaging](../_bmad-output/implementation-artifacts/2-2-encrypted-text-messaging.md)
- [Story 2-3: Message Feed & Channel Navigation UI](../_bmad-output/implementation-artifacts/2-3-message-feed-and-channel-navigation-ui.md)
- [Story 2-4: Persistent Message History & Scrollback](../_bmad-output/implementation-artifacts/2-4-persistent-message-history-and-scrollback.md)

**Epic 3 — Voice Communication:**
- [Story 3-1: Voice Server Infrastructure](../_bmad-output/implementation-artifacts/3-1-voice-server-infrastructure.md)
- [Story 3-2: Voice Channel Join/Leave & Presence](../_bmad-output/implementation-artifacts/3-2-voice-channel-join-leave-and-presence.md)
- [Story 3-3: Real-Time Voice Audio & Speaking Indicators](../_bmad-output/implementation-artifacts/3-3-real-time-voice-audio-and-speaking-indicators.md)
- [Story 3-4: Audio Device Management & Voice Controls](../_bmad-output/implementation-artifacts/3-4-audio-device-management-and-voice-controls.md)

**Epic 4 — Video Communication:**
- [Story 4-1: Video Camera Toggle & Streaming](../_bmad-output/implementation-artifacts/4-1-video-camera-toggle-and-streaming.md)
- [Story 4-2: Video Grid Display](../_bmad-output/implementation-artifacts/4-2-video-grid-display.md)

**Epic 5 — Server Administration & User Management:**
- [Story 5-1: Channel Management](../_bmad-output/implementation-artifacts/5-1-channel-management.md)
- [Story 5-2: User Management & Administration](../_bmad-output/implementation-artifacts/5-2-user-management-and-administration.md)

**Epic 6 — Desktop App Polish & Production Deployment:**
- [Story 6-1: Connection Resilience & Error Handling](../_bmad-output/implementation-artifacts/6-1-connection-resilience-and-error-handling.md)
- [Story 6-2: Auto-Update System](../_bmad-output/implementation-artifacts/6-2-auto-update-system.md)
- [Story 6-3: Privacy Enforcement & Zero Telemetry](../_bmad-output/implementation-artifacts/6-3-privacy-enforcement-and-zero-telemetry.md)
- [Story 6-4: Production Deployment Infrastructure](../_bmad-output/implementation-artifacts/6-4-production-deployment-infrastructure.md)
- [Story 6-5: CI/CD Pipeline & Cross-Platform Distribution](../_bmad-output/implementation-artifacts/6-5-ci-cd-pipeline-and-cross-platform-distribution.md)

**Supporting:**
- [Tech Spec: Wire Up Invite People Button](../_bmad-output/implementation-artifacts/tech-spec-wire-up-invite-people-button.md)
- [Tech Spec: Automated EC2 Deployment](../_bmad-output/implementation-artifacts/tech-spec-automated-ec2-deployment.md)

### CI/CD Configuration
- [CI Workflow](../.github/workflows/ci.yml) — PR validation: lint + test + build
- [Release Workflow](../.github/workflows/release.yml) — Tag-triggered: 3-platform Electron build, GitHub Releases, EC2 deploy with rollback

## Getting Started

### Quick Start
```bash
npm install          # Install all workspace dependencies
cp .env.example .env # Configure environment (set JWT secrets)
npm run dev          # Start client + server concurrently
```

### For New Features
1. Review the [Architecture docs](#architecture-per-part) for the relevant part
2. Check [API Contracts](./api-contracts-server.md) for existing endpoints
3. Check [Data Models](./data-models-server.md) for schema
4. Reference [Component Inventory](./component-inventory-client.md) for reusable components
5. Follow patterns in the [Development Guide](./development-guide.md)

### For AI-Assisted Development
When creating a brownfield PRD or implementing features, point to this index as the entry point. Key documents for AI context:
- This index for navigation
- Architecture docs for patterns and conventions
- API contracts and data models for existing capabilities
- Integration architecture for cross-part communication

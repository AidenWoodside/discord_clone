# Discord Clone - Project Documentation Index

**Generated:** 2026-02-24 | **Scan Level:** Quick | **Workflow Version:** 1.2.0

## Project Overview

- **Type:** Monorepo (npm workspaces) with 3 parts
- **Primary Language:** TypeScript ~5.9.3
- **Architecture:** Multi-part desktop application with API backend
- **Purpose:** Full-featured Discord clone with E2E encryption

## Quick Reference

### Client (desktop)
- **Type:** Desktop (Electron 40)
- **Tech Stack:** Electron + React 19 + Zustand + Tailwind CSS 4 + Radix UI
- **Root:** `client/`
- **Entry Point:** `client/src/main/index.ts`
- **Architecture Pattern:** Electron multi-process + React feature-based

### Server (backend)
- **Type:** Backend API (Fastify 5)
- **Tech Stack:** Fastify + Drizzle ORM + SQLite + JWT + bcrypt
- **Root:** `server/`
- **Entry Point:** `server/src/index.ts`
- **Architecture Pattern:** Plugin-based domain architecture

### Shared (library)
- **Type:** TypeScript library
- **Tech Stack:** TypeScript + libsodium-wrappers
- **Root:** `shared/`
- **Entry Point:** `shared/src/index.ts`
- **Purpose:** Contract boundary (types, constants, WS protocol)

## Generated Documentation

### Core Documents
- [Project Overview](./project-overview.md) - Executive summary, tech stack, implementation status
- [Source Tree Analysis](./source-tree-analysis.md) - Annotated directory tree, critical folders, entry points

### Architecture (per part)
- [Architecture - Client](./architecture-client.md) - Electron process model, React patterns, security
- [Architecture - Server](./architecture-server.md) - Plugin architecture, database design, auth flow

### Integration
- [Integration Architecture](./integration-architecture.md) - Part communication, data flow, shared contracts

### Detailed Reference
- [Component Inventory - Client](./component-inventory-client.md) - UI components, stores, services, features
- [API Contracts - Server](./api-contracts-server.md) - REST endpoints, auth flow, response formats
- [Data Models - Server](./data-models-server.md) - Database schema, relationships, migrations

### Development
- [Development Guide](./development-guide.md) - Setup, commands, testing, common tasks

## Existing Documentation

### Root
- [README.md](../README.md) - Project overview, tech stack table, getting started

### BMAD Planning Artifacts
- [Product Brief](../_bmad-output/planning-artifacts/product-brief-discord_clone-2026-02-24.md)
- [PRD (Product Requirements)](../_bmad-output/planning-artifacts/prd.md)
- [UX Design Specification](../_bmad-output/planning-artifacts/ux-design-specification.md)
- [Architecture (BMAD)](../_bmad-output/planning-artifacts/architecture.md)
- [Implementation Readiness Report](../_bmad-output/planning-artifacts/implementation-readiness-report-2026-02-24.md)
- [Dependency Map & Parallel Plan](../_bmad-output/planning-artifacts/dependency-map-and-parallel-plan.md)
- [Epics Index](../_bmad-output/planning-artifacts/epics/index.md)
- [Project Context](../_bmad-output/project-context.md)

### BMAD Implementation Artifacts
- [Story 1-1: Project Scaffold & Monorepo Setup](../_bmad-output/implementation-artifacts/1-1-project-scaffold-and-monorepo-setup.md)
- [Story 1-2: Database Schema & Core Server Config](../_bmad-output/implementation-artifacts/1-2-database-schema-and-core-server-configuration.md)
- [Story 1-3: User Registration & Invite System](../_bmad-output/implementation-artifacts/1-3-user-registration-and-invite-system.md)
- [Story 1-4: User Login/Logout & Session Management](../_bmad-output/implementation-artifacts/1-4-user-login-logout-and-session-management.md)
- [Story 1-5: E2E Encryption Foundation](../_bmad-output/implementation-artifacts/1-5-e2e-encryption-foundation.md)
- [Story 1-6: Discord-Familiar App Shell & Navigation](../_bmad-output/implementation-artifacts/1-6-discord-familiar-app-shell-and-navigation.md)
- [Epic 1 Retrospective](../_bmad-output/implementation-artifacts/epic-1-retro-2026-02-24.md)

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

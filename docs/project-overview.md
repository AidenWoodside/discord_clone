# Discord Clone - Project Overview

**Generated:** 2026-02-24 | **Scan Level:** Quick | **Workflow Version:** 1.2.0

## Executive Summary

Discord Clone is a full-featured Discord-like communication platform built as a cross-platform Electron desktop application with a Fastify backend. The project emphasizes end-to-end encryption for messages, real-time communication via WebSockets, and a familiar Discord-style UI.

The project is structured as an **npm workspaces monorepo** with three packages: a desktop client (Electron + React), an API server (Fastify + SQLite), and a shared types/constants library.

## Project Type

- **Repository Type:** Monorepo (npm workspaces)
- **Parts:** 3 (client, server, shared)
- **Primary Language:** TypeScript (~5.9.3)
- **Architecture:** Multi-part desktop application with API backend

## Parts Summary

| Part | Type | Primary Tech | Purpose |
|------|------|-------------|---------|
| **client** | Desktop (Electron) | Electron 40 + React 19 + Zustand + Tailwind CSS 4 | Cross-platform desktop UI |
| **server** | Backend | Fastify 5 + Drizzle ORM + SQLite | REST API + WebSocket server |
| **shared** | Library | TypeScript | Shared types, constants, WS message definitions |

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 40 |
| Frontend | React 19, TypeScript, Tailwind CSS 4, Radix UI |
| State Management | Zustand 5 |
| Routing | React Router 7 (hash-based) |
| Backend | Fastify 5, Node.js |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| Real-Time | Native WebSockets (planned: mediasoup WebRTC SFU) |
| Encryption | libsodium (XSalsa20-Poly1305 for messages) |
| Auth | JWT (15-min access + 7-day refresh tokens), bcrypt |
| Testing | Vitest 4, React Testing Library |
| Build | electron-vite 3, electron-builder 26 |
| Linting | ESLint 9 + Prettier |

## Architecture Summary

- **Client:** Electron main/preload/renderer process model with React feature-based organization. Zustand stores for state, service layer for API communication and encryption. Context isolation and sandboxing enabled. Tokens stored via Electron safeStorage API.
- **Server:** Plugin-based Fastify architecture. Each domain (auth, users, invites, channels) is an isolated plugin with its own routes and service layer. All endpoints under `/api/` with consistent response envelopes.
- **Shared:** Contract boundary library - client and server never import from each other directly. Contains domain types, API response types, WebSocket message protocol, and system constants.
- **Security:** Messages encrypted client-side before transmission using libsodium. JWT-based auth with access/refresh token pattern. Rate limiting on all endpoints.

## Current Implementation Status

Based on BMAD implementation artifacts, **Epic 1 (Project Foundation & User Authentication)** is complete with 6 stories implemented:
1. Project scaffold and monorepo setup
2. Database schema and core server configuration
3. User registration and invite system
4. User login/logout and session management
5. E2E encryption foundation
6. Discord-familiar app shell and navigation

## Links to Detailed Documentation

- [Architecture - Client](./architecture-client.md)
- [Architecture - Server](./architecture-server.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Component Inventory - Client](./component-inventory-client.md)
- [API Contracts - Server](./api-contracts-server.md)
- [Data Models - Server](./data-models-server.md)
- [Development Guide](./development-guide.md)
- [Integration Architecture](./integration-architecture.md)

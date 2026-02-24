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

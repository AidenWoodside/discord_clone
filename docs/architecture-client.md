# Architecture - Client (Electron Desktop App)

**Generated:** 2026-02-24 | **Scan Level:** Quick | **Part:** client | **Type:** Desktop

## Executive Summary

The client is a cross-platform Electron desktop application using React 19 as the renderer framework. It follows Electron's security best practices with context isolation, sandboxing, and the preload bridge pattern. The UI is built with a feature-based module architecture, Zustand for state management, and Radix UI primitives styled with Tailwind CSS 4.

## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Runtime | Electron | 40.6.0 |
| UI Framework | React | 19.1.0 |
| Language | TypeScript | ~5.9.3 |
| Styling | Tailwind CSS | 4.2.0 |
| UI Primitives | Radix UI | 1.4.3 |
| Icons | Lucide React | 0.575.0 |
| State Management | Zustand | 5.0.11 |
| Routing | React Router | 7.13.0 |
| Encryption | libsodium-wrappers | 0.8.2 |
| Build Tool | electron-vite | 3.1.0 |
| Testing | Vitest 4 + React Testing Library 16 |
| Packaging | electron-builder | 26.0.0 |

## Architecture Pattern

**Electron Multi-Process + React Feature-Based Architecture**

```
┌─────────────────────────────────────────┐
│              Electron Main              │
│  (index.ts + safeStorage.ts)            │
│  - App lifecycle management             │
│  - Window creation (1280x720)           │
│  - Secure credential storage (IPC)      │
└─────────────┬───────────────────────────┘
              │ IPC (context isolated)
┌─────────────┴───────────────────────────┐
│            Preload Bridge               │
│  (index.ts + index.d.ts)                │
│  - Exposes secureStorage API            │
│  - window.api.secureStorage.{set,get,   │
│    delete}                              │
└─────────────┬───────────────────────────┘
              │ contextBridge
┌─────────────┴───────────────────────────┐
│          React Renderer                 │
│                                         │
│  ┌─────────┐  ┌──────────────────────┐  │
│  │ Stores  │  │ Services             │  │
│  │ (Zustand)│  │ - apiClient.ts      │  │
│  │ - auth  │  │ - encryptionService  │  │
│  │ - channel│  └──────────┬──────────┘  │
│  │ - member │             │             │
│  │ - ui    │             │ HTTP/REST   │
│  └────┬────┘             │             │
│       │                  ▼             │
│  ┌────┴────────────────────────────┐   │
│  │        Features                  │   │
│  │  auth/ layout/ channels/ members/│   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │      Components (Radix UI)      │   │
│  │  Button Input Modal Tooltip ... │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Process Model

### Main Process (`src/main/`)
- **index.ts**: App initialization, BrowserWindow creation (1280x720, min 960x540), context isolation enabled, sandbox enabled
- **safeStorage.ts**: IPC handlers for encrypted credential storage using Electron's safeStorage API. Credentials stored as encrypted JSON at `userData/secure-tokens.json`

### Preload Bridge (`src/preload/`)
- **index.ts**: Exposes `window.api.secureStorage` API (set, get, delete) via contextBridge
- **index.d.ts**: TypeScript type declarations for `Window.electron` and `Window.api`

### Renderer Process (`src/renderer/`)
Feature-based organization with clear separation of concerns:

## State Management (Zustand Stores)

| Store | State | Key Methods |
|-------|-------|-------------|
| `useAuthStore` | user, tokens, groupKey, loading, error | login, register, logout, refreshTokens, restoreSession |
| `useChannelStore` | channels[], activeChannelId | fetchChannels, setActiveChannel |
| `useMemberStore` | members[] | fetchMembers |
| `useUIStore` | isMemberListVisible | toggleMemberList, setMemberListVisible |

## Routing

Hash-based routing via React Router 7:

| Route | Component | Auth Required |
|-------|-----------|---------------|
| `/login` | LoginPage | No |
| `/register/:token` | RegisterPage | No |
| `/app/channels/:channelId` | AppLayout | Yes (AuthGuard) |

## Services Layer

### apiClient.ts
- Centralized HTTP client for server communication
- Base URL: `import.meta.env.VITE_API_URL` (default: `http://localhost:3000`)
- Automatic token refresh on 401 responses
- Configurable token callbacks (set by auth store)
- Generic typed `apiRequest<T>()` function

### encryptionService.ts
- End-to-end encryption using libsodium (NaCl)
- Key pair generation (X25519)
- Group key decryption (sealed box)
- Message encryption/decryption (XSalsa20-Poly1305)
- Base64 key serialization/deserialization

## Component Library

7 shared Radix UI-based components with Tailwind CSS styling:
Button, Input, Modal, ContextMenu, DropdownMenu, Tooltip, ScrollArea

## Security Model

- **Context Isolation**: Enabled (renderer cannot access Node.js APIs)
- **Sandbox**: Enabled
- **Credential Storage**: Electron safeStorage API (OS keychain encryption)
- **E2E Encryption**: Messages encrypted before leaving the renderer process
- **Token Management**: Access tokens in memory, refresh tokens in secure storage

## Build & Packaging

- **Build Tool**: electron-vite (separate configs for main, preload, renderer)
- **Packaging**: electron-builder with targets:
  - macOS: DMG (x64 + arm64)
  - Windows: NSIS (x64)
  - Linux: AppImage (x64)
- **App ID**: `com.discord-clone.app`

## Testing Strategy

- **Framework**: Vitest 4 with jsdom environment
- **UI Testing**: React Testing Library + @testing-library/user-event
- **Coverage**: Tests co-located with source files (`.test.ts` / `.test.tsx`)
- **Test areas**: Stores, services (encryption), features (layout, channels, members), App routing

# Component Inventory - Client

**Generated:** 2026-02-24 | **Scan Level:** Quick | **Part:** client

## Summary

- **Total Components:** 29 source files (excluding tests)
- **Test Files:** 8
- **UI Library:** Radix UI primitives + Tailwind CSS 4
- **State Management:** Zustand 5

## Shared UI Components (`components/`)

Reusable, Radix UI-based component library:

| Component | File | Description |
|-----------|------|-------------|
| Button | `Button.tsx` | Reusable button with variants |
| Input | `Input.tsx` | Form input field |
| Modal | `Modal.tsx` | Dialog/modal container |
| ContextMenu | `ContextMenu.tsx` | Right-click context menu (Radix) |
| DropdownMenu | `DropdownMenu.tsx` | Dropdown menu selector (Radix) |
| Tooltip | `Tooltip.tsx` | Hover tooltip (Radix) |
| ScrollArea | `ScrollArea.tsx` | Scrollable container |

**Barrel Export:** `components/index.ts` re-exports all components.

## Feature Modules (`features/`)

### Authentication (`features/auth/`)

| Component | Purpose | Auth Required |
|-----------|---------|---------------|
| LoginPage | Login form with username/password | No |
| RegisterPage | Registration form with invite token support | No |
| AuthGuard | Route protection wrapper, redirects unauthenticated users | N/A (wrapper) |

### Layout (`features/layout/`)

| Component | Purpose | Notes |
|-----------|---------|-------|
| AppLayout | Main app container, manages responsive member list | 1000px breakpoint for member list visibility |
| ContentArea | Main content area for selected channel | Center panel |
| UserPanel | User profile display with logout | Bottom-left panel |
| ChannelRedirect | Auto-redirects to first available channel | Route helper |

### Channels (`features/channels/`)

| Component | Purpose | Notes |
|-----------|---------|-------|
| ChannelSidebar | Server header + channel list | Groups by text/voice type |
| ChannelItem | Individual channel list item | Active state, navigation |

### Members (`features/members/`)

| Component | Purpose | Notes |
|-----------|---------|-------|
| MemberList | Scrollable member list container | Right sidebar |
| MemberItem | Individual member row | Avatar, username, role display |

## State Stores (`stores/`)

| Store | State Shape | Methods |
|-------|------------|---------|
| `useAuthStore` | user, accessToken, refreshToken, groupKey, isLoading, error | login, register, logout, refreshTokens, restoreSession, clearError |
| `useChannelStore` | channels[], activeChannelId, isLoading, error | fetchChannels, setActiveChannel, clearError |
| `useMemberStore` | members[], isLoading, error | fetchMembers, clearError |
| `useUIStore` | isMemberListVisible | toggleMemberList, setMemberListVisible |

## Services (`services/`)

| Service | Purpose | Key Exports |
|---------|---------|-------------|
| `apiClient.ts` | HTTP client with auto token refresh | `configureApiClient()`, `apiRequest<T>()` |
| `encryptionService.ts` | E2E encryption (libsodium) | `initializeSodium()`, `generateKeyPair()`, `encryptMessage()`, `decryptMessage()`, `decryptGroupKey()` |

## Utilities (`utils/`)

| Utility | Purpose |
|---------|---------|
| `avatarColor.ts` | Deterministic avatar color generation from username (10 color palette) |

## Electron Main Process (`main/`)

| File | Purpose |
|------|---------|
| `index.ts` | App init, window management (1280x720), context isolation, sandbox |
| `safeStorage.ts` | IPC handlers for encrypted credential storage via Electron safeStorage API |

## Preload Bridge (`preload/`)

| File | Purpose |
|------|---------|
| `index.ts` | Exposes `window.api.secureStorage` (set, get, delete) via contextBridge |
| `index.d.ts` | TypeScript declarations for Window.electron and Window.api |

## Design Patterns

- **Feature-based organization**: Each domain (auth, channels, members, layout) has its own folder
- **Barrel exports**: Components use `index.ts` barrel file
- **Co-located tests**: Test files sit next to source files
- **Service layer**: All server communication goes through `apiClient.ts`
- **Store separation**: Each domain has its own Zustand store
- **Responsive design**: 1000px breakpoint for member list visibility

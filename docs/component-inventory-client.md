# Component Inventory — Client

**Generated:** 2026-02-26 | **Scan Level:** Exhaustive | **Source:** All 105 client source files read

## Overview

- **Framework:** React 19.1.0 (functional components only, no class components)
- **State Management:** Zustand 5.0.11 (10 stores)
- **UI Primitives:** Radix UI 1.4.3
- **Styling:** Tailwind CSS 4.2.0 (utility classes, dark warm theme)
- **Icons:** lucide-react 0.575.0
- **Total Components:** 40 React components
- **Total Services:** 7
- **Total Stores:** 10
- **Total Hooks:** 3 custom hooks
- **Total Utilities:** 4

## Reusable UI Components (`components/`)

Base primitives wrapping Radix UI with consistent Tailwind styling:

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `Button` | `components/Button.tsx` | `variant`, `size`, `loading`, `disabled` | Primary/secondary/danger/ghost variants, spinner on loading |
| `Input` | `components/Input.tsx` | `label`, `error`, `type` | Labeled text input with error display, auto-generated IDs |
| `Modal` | `components/Modal.tsx` | `open`, `onOpenChange`, `title`, children | Radix Dialog wrapper with overlay, title, close button |
| `ContextMenu` | `components/ContextMenu.tsx` | `trigger`, `items[]` | Radix ContextMenu wrapper, right-click menus |
| `DropdownMenu` | `components/DropdownMenu.tsx` | `trigger`, `items[]` | Radix DropdownMenu wrapper, click-to-open menus |
| `Tooltip` | `components/Tooltip.tsx` | `content`, `children`, `side` | Radix Tooltip wrapper with consistent styling |
| `ScrollArea` | `components/ScrollArea.tsx` | `children`, `className` | Radix ScrollArea with custom scrollbar styling |
| `UpdateNotification` | `components/UpdateNotification.tsx` | — | Auto-update banner (Download/Later/Restart Now) |

## Feature Components

### Auth (`features/auth/`) — 4 components

| Component | Purpose |
|-----------|---------|
| `LoginPage` | Username/password form, server status check, redirect to setup if needed |
| `RegisterPage` | Invite-based registration with token from URL param, validates invite first |
| `SetupPage` | First-run owner registration (no invite required) |
| `AuthGuard` | Route guard — skeleton during session restore, redirect to `/login` if unauthenticated |

### Layout (`features/layout/`) — 5 components

| Component | Purpose |
|-----------|---------|
| `AppLayout` | Main shell — sidebar + content area + member list, WebSocket connection management |
| `ContentArea` | Message view — channel header, message feed with scroll-to-bottom, message input |
| `ChannelRedirect` | Auto-redirects to first text channel on `/app/channels` |
| `ConnectionBanner` | Shows reconnecting/disconnected status banner |
| `UserPanel` | Bottom-left panel — username, avatar, settings gear, mute/deafen buttons |

### Channels (`features/channels/`) — 6 components

| Component | Purpose |
|-----------|---------|
| `ChannelSidebar` | Left sidebar — server header + text channels + voice channels + voice status bar |
| `ChannelItem` | Individual channel row (hash/speaker icon), active highlight, voice participant list |
| `ServerHeader` | Server name with dropdown (Invite People, Create Channel, Settings) |
| `ChannelContextMenu` | Right-click on channels (Delete Channel — owner only) |
| `CreateChannelModal` | Modal form — channel name + type (text/voice) |
| `InviteModal` | Generate invite link, copy to clipboard, list/revoke existing invites |

### Messages (`features/messages/`) — 2 components

| Component | Purpose |
|-----------|---------|
| `MessageGroup` | Grouped messages — avatar, username, timestamp header, consecutive messages within 5-min window |
| `MessageInput` | Auto-growing textarea, Enter to send (Shift+Enter newline), 2000 char limit, E2E encryption |

### Members (`features/members/`) — 2 components

| Component | Purpose |
|-----------|---------|
| `MemberList` | Right panel — online/offline sections with member counts |
| `MemberItem` | Avatar (deterministic color), username, online status dot, owner crown |

### Voice & Video (`features/voice/`) — 4 components

| Component | Purpose |
|-----------|---------|
| `VoiceStatusBar` | Bottom bar when in voice — channel name, mute/deafen/video/disconnect buttons |
| `VoiceParticipant` | User in voice channel list — avatar with speaking ring animation, muted/deafened icons |
| `VideoGrid` | Adaptive CSS Grid for video tiles (1-4 cols based on participant count) |
| `VideoTile` | Individual video feed with username overlay and speaking border |

### Settings (`features/settings/`) — 2 components

| Component | Purpose |
|-----------|---------|
| `SettingsPage` | Settings container with tabbed navigation |
| `AudioSettings` | Audio input/output device selection dropdowns |

### Admin (`features/admin/`) — 7 components

| Component | Purpose |
|-----------|---------|
| `MemberContextMenu` | Right-click on member — Kick, Ban, Reset Password (owner only) |
| `KickConfirmDialog` | Confirmation modal before kicking |
| `BanConfirmDialog` | Confirmation modal before banning |
| `ResetPasswordDialog` | Shows temporary password after reset, copy-to-clipboard |
| `BannedUsersPanel` | Panel listing banned users with unban buttons |
| `KickedNotification` | Modal shown to kicked user — forces logout |
| `BannedNotification` | Modal shown to banned user — forces logout |

## Services (`services/`)

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| `apiClient` | REST API communication | `get`, `post`, `delete` with auto token refresh on 401 |
| `wsClient` | WebSocket connection | `connect`, `disconnect`, `send`, `request` (req/res), `on` (events) |
| `encryptionService` | E2E encryption | `generateKeyPair`, `decryptGroupKey`, `encryptMessage`, `decryptMessage` |
| `mediaService` | mediasoup management | `produceAudio/Video`, `consumeAudio/Video`, `switchAudioInput/Output` |
| `voiceService` | Voice orchestration | `joinVoiceChannel`, `leaveVoiceChannel`, `startVideo`, `stopVideo` |
| `messageService` | Message operations | `sendMessage` (encrypt + WS send), `fetchMessages` (HTTP + decrypt) |
| `vadService` | Voice Activity Detection | `startLocalVAD`, `startRemoteVAD`, `stopVAD` (Web Audio API FFT) |

## Zustand Stores (`stores/`)

| Store | Key State | Key Actions |
|-------|-----------|-------------|
| `useAuthStore` | `user`, `accessToken`, `groupKey`, `isAuthenticated` | `login`, `register`, `setup`, `logout`, `restoreSession` |
| `useChannelStore` | `channels[]`, `activeChannelId` | `fetchChannels`, `setActiveChannel`, `createChannel`, `deleteChannel` |
| `useMessageStore` | `messagesByChannel` (Map), `hasMore`, `isLoading` | `fetchMessages`, `addMessage`, `addOptimisticMessage` |
| `useMemberStore` | `members[]` | `fetchMembers`, `addMember`, `removeMember` |
| `usePresenceStore` | `onlineUsers` (Set), `wsConnected` | `setUserOnline/Offline`, `syncPresence`, `setWsConnected` |
| `useVoiceStore` | `currentChannelId`, `participants`, `isMuted`, `isDeafened`, `isVideoEnabled` | `joinChannel`, `leaveChannel`, `toggleMute/Deafen/Video`, `setSpeaking` |
| `useUIStore` | `showMemberList`, `showSettings` | `toggleMemberList`, `toggleSettings` |
| `useInviteStore` | `invites[]`, `generatedLink` | `generateInvite`, `fetchInvites`, `revokeInvite` |
| `useUpdateStore` | `status`, `version`, `progress`, `error` | `checkForUpdates`, `downloadUpdate`, `installUpdate` |
| `useAdminNotificationStore` | `kickedModalOpen`, `bannedModalOpen` | `showKickedModal`, `showBannedModal`, `dismiss` |

**Store Patterns:**
- All use `create<T>((set, get) => ...)` pattern
- Accessed as hooks (selectors) and imperatively via `getState()` from services
- `useVoiceStore` persists audio device preferences to `localStorage`
- `useAuthStore` persists tokens/keys to Electron's `safeStorage`

## Custom Hooks (`hooks/`)

| Hook | Purpose |
|------|---------|
| `useUsername` | Resolves `userId` → `{ username, avatarColor }` from member store |
| `useMediaDevices` | Enumerates audio input/output devices, listens for `devicechange` events |
| `useDeepLink` | Listens for `discord-clone://invite/` protocol URLs, navigates to registration |

## Utilities (`utils/`)

| Utility | Purpose |
|---------|---------|
| `avatarColor` | Deterministic hash-based avatar background color from username |
| `formatTimestamp` | Relative date formatting (Today/Yesterday/date + time) |
| `groupMessages` | Groups consecutive messages from same author within 5-minute windows |
| `soundPlayer` | Procedural audio tones via Web Audio API (connect/disconnect/mute/unmute) |

## Routing Structure

```
/                         → Redirect to /app
/login                    → LoginPage
/setup                    → SetupPage (first-run owner registration)
/register/:token          → RegisterPage (invite-based)
/app                      → AuthGuard wrapper
  /app/channels            → ChannelRedirect (auto-select first text channel)
  /app/channels/:channelId → ContentArea (message view)
```

**Router:** React Router v7 with `HashRouter` (hash-based for Electron compatibility)

## IPC Channels (Electron)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `secure-storage:set/get/delete` | Renderer → Main | Encrypted token/key storage via OS keychain |
| `deep-link` | Main → Renderer | Forward `discord-clone://` protocol URL |
| `updater:check/download/install` | Renderer → Main | Auto-update control |
| `updater:checking/available/not-available/download-progress/downloaded/error` | Main → Renderer | Auto-update events |

## Design System

**Color Palette (Dark Warm Theme):**
- Background: `#221e1a` / `#2a2520` / `#342e28`
- Accent: `#c97b35` (amber/brown)
- Text: `#e8e0d8` / `#a89888`
- Status: Online green, Idle yellow, DnD red, Offline gray

**Custom Animations:** `slideUp`, `speakingPulse`, `fadeIn` (respects `prefers-reduced-motion`)

## Test Coverage

- **44 test files** covering all services, stores, hooks, utilities, and major components
- **Vitest 4.0.0** with `jsdom` + `@testing-library/react` + `@testing-library/jest-dom`

# Story 1.5: E2E Encryption Foundation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want end-to-end encryption established during my account setup,
so that all my future communications are encrypted and the server cannot read my messages.

## Acceptance Criteria

1. **Given** the server initializes for the first time **When** the owner account is created **Then** a group symmetric key is generated using libsodium
2. **Given** I am registering a new account **When** my account is created **Then** an X25519 key pair is generated on my client **And** my public key is sent to the server **And** the server encrypts the group key with my public key and stores the encrypted blob
3. **Given** I log in successfully **When** I receive my authentication response **Then** I also receive my encrypted group key blob **And** my client decrypts it using my private key **And** the group key is available in memory for message encryption/decryption
4. **Given** the encryption service is initialized **When** I encrypt a message **Then** XSalsa20-Poly1305 symmetric encryption is used with the group key **And** a unique nonce is generated per message
5. **Given** the encryption service is initialized **When** I decrypt an encrypted message with its nonce **Then** the original plaintext is recovered correctly

## Tasks / Subtasks

- [x] Task 1: Install libsodium-wrappers and add encryption constants (AC: 1-5)
  - [x] 1.1 Install `libsodium-wrappers` v0.8.2 in server, client, and shared workspaces: `npm install libsodium-wrappers -w server -w client -w shared`
  - [x] 1.2 Install `@types/libsodium-wrappers` as devDependency in all three workspaces
  - [x] 1.3 Add encryption constants to `shared/src/constants.ts`: `NACL_SECRETBOX_KEY_BYTES = 32`, `NACL_SECRETBOX_NONCE_BYTES = 24`, `NACL_SECRETBOX_MAC_BYTES = 16`, `X25519_PUBLIC_KEY_BYTES = 32`, `X25519_SECRET_KEY_BYTES = 32`, `NACL_SEALEDBOX_OVERHEAD = 48`
  - [x] 1.4 Add encryption-related types to `shared/src/types.ts`: `EncryptedGroupKeyBlob` type (base64 string), update `User` interface to document `publicKey` field usage
  - [x] 1.5 Verify libsodium loads correctly in both Node.js (server) and Chromium (client renderer) environments

- [x] Task 2: Add `encrypted_group_key` column to users table (AC: 2, 3)
  - [x] 2.1 Add `encrypted_group_key` column (text, nullable) to the `users` table in `server/src/db/schema.ts`
  - [x] 2.2 Generate and apply Drizzle migration for the new column
  - [x] 2.3 Update `server/src/db/schema.test.ts` to expect 7 columns in users table (was 6)

- [x] Task 3: Create server-side encryption service for group key management (AC: 1, 2)
  - [x] 3.1 Create `server/src/services/encryptionService.ts`
  - [x] 3.2 Implement `initializeSodium(): Promise<void>` — call `sodium.ready`, cache the module reference
  - [x] 3.3 Implement `generateGroupKey(): Uint8Array` — `sodium.crypto_secretbox_keygen()`, returns 32-byte key
  - [x] 3.4 Implement `encryptGroupKeyForUser(groupKey: Uint8Array, userPublicKey: Uint8Array): string` — uses `sodium.crypto_box_seal(groupKey, userPublicKey)`, returns base64-encoded sealed box
  - [x] 3.5 Implement `encryptMessage(plaintext: string, groupKey: Uint8Array): { ciphertext: string, nonce: string }` — uses `sodium.crypto_secretbox_easy(message, nonce, groupKey)`, generates random nonce via `sodium.randombytes_buf(24)`, returns base64-encoded ciphertext + nonce
  - [x] 3.6 Implement `decryptMessage(ciphertext: string, nonce: string, groupKey: Uint8Array): string` — uses `sodium.crypto_secretbox_open_easy(cipher, nonce, groupKey)`, returns plaintext string
  - [x] 3.7 Implement `getOrCreateGroupKey(db): Promise<Uint8Array>` — check for existing group key in DB (`server_config` or env), generate if not found, persist securely
  - [x] 3.8 Store group key as `GROUP_ENCRYPTION_KEY` environment variable (base64 encoded) — add to `.env.example`

- [x] Task 4: Update database seed to generate group key on first startup (AC: 1)
  - [x] 4.1 Update `server/src/db/seed.ts` — on first startup (owner account creation), generate group key via `generateGroupKey()`
  - [x] 4.2 Store group key as base64 in `GROUP_ENCRYPTION_KEY` env var documentation (the key is provided via env, generated once by a setup script)
  - [x] 4.3 Create a one-time key generation helper: if `GROUP_ENCRYPTION_KEY` env var is not set AND no owner exists, generate key, log it to console (one-time setup), and use it
  - [x] 4.4 Add `GROUP_ENCRYPTION_KEY` to `.env.example` with documentation: "Base64-encoded 32-byte group encryption key. Generated on first server start."
  - [x] 4.5 Add module-level fail-fast validation for `GROUP_ENCRYPTION_KEY` env var in `encryptionService.ts` (same pattern as `JWT_ACCESS_SECRET`)
  - [x] 4.6 Encrypt the group key for the owner account using the owner's public key (owner public key generated during seed or provided via env)

- [x] Task 5: Update registration to accept public key and issue encrypted group key (AC: 2)
  - [x] 5.1 Update POST `/api/auth/register` request schema to accept optional `publicKey: string` (base64-encoded X25519 public key)
  - [x] 5.2 When `publicKey` is provided: validate it is exactly 32 bytes when decoded, store in `public_key` column, encrypt group key for user via `encryptGroupKeyForUser()`, store result in `encrypted_group_key` column
  - [x] 5.3 When `publicKey` is NOT provided: leave both columns null (backward compatibility for existing accounts — they'll need to upload a key later)
  - [x] 5.4 Update registration response to include `encryptedGroupKey: string | null` in the `data.user` object
  - [x] 5.5 Wrap the public key storage + encrypted group key generation in the existing registration transaction
  - [x] 5.6 Add request schema validation for `publicKey` field (optional string, base64 format)

- [x] Task 6: Update login to return encrypted group key blob (AC: 3)
  - [x] 6.1 Update POST `/api/auth/login` response to include `encryptedGroupKey: string | null` in `data` alongside existing `accessToken`, `refreshToken`, `user`
  - [x] 6.2 Query the user's `encrypted_group_key` from DB during login and include it in response
  - [x] 6.3 Update POST `/api/auth/refresh` — do NOT include encrypted group key (only needed on initial login, client caches it in memory)
  - [x] 6.4 Update login tests to verify `encryptedGroupKey` is present in response
  - [x] 6.5 Update `restoreSession` flow: on token refresh, the client should already have the group key in memory; if lost (app restart), client needs to re-login to get it (OR store encrypted group key in safeStorage)

- [x] Task 7: Create client-side encryption service (AC: 2, 3, 4, 5)
  - [x] 7.1 Create `client/src/renderer/src/services/encryptionService.ts`
  - [x] 7.2 Implement `initializeSodium(): Promise<void>` — call `sodium.ready`
  - [x] 7.3 Implement `generateKeyPair(): { publicKey: Uint8Array, secretKey: Uint8Array }` — `sodium.crypto_box_keypair()`, returns X25519 key pair
  - [x] 7.4 Implement `decryptGroupKey(encryptedBlob: string, publicKey: Uint8Array, secretKey: Uint8Array): Uint8Array` — base64 decode blob, `sodium.crypto_box_seal_open(cipher, publicKey, secretKey)`, returns group key
  - [x] 7.5 Implement `encryptMessage(plaintext: string, groupKey: Uint8Array): { ciphertext: string, nonce: string }` — same as server-side: `crypto_secretbox_easy` with random nonce, returns base64
  - [x] 7.6 Implement `decryptMessage(ciphertext: string, nonce: string, groupKey: Uint8Array): string` — `crypto_secretbox_open_easy`, returns plaintext
  - [x] 7.7 Implement `serializeKey(key: Uint8Array): string` — base64 encode for storage/transport
  - [x] 7.8 Implement `deserializeKey(base64: string): Uint8Array` — base64 decode

- [x] Task 8: Store private key securely via Electron safeStorage (AC: 2, 3)
  - [x] 8.1 On registration: after generating key pair, store private key in safeStorage with key `"private-key"` (base64 encoded)
  - [x] 8.2 On login: retrieve private key from safeStorage, use it to decrypt the encrypted group key blob
  - [x] 8.3 On logout: do NOT delete private key from safeStorage — it's tied to the account, not the session (user needs it to decrypt group key on next login)
  - [x] 8.4 Store encrypted group key blob in safeStorage with key `"encrypted-group-key"` — enables session restoration without full re-login
  - [x] 8.5 On `restoreSession`: read private key + encrypted group key blob from safeStorage, decrypt group key, make available in memory

- [x] Task 9: Update RegisterPage to integrate encryption (AC: 2)
  - [x] 9.1 Create `client/src/renderer/src/features/auth/RegisterPage.tsx` (currently does not exist — only a placeholder route)
  - [x] 9.2 Registration form: username + password fields only (per UX spec — encryption is invisible to user)
  - [x] 9.3 On submit: initialize sodium → generate keypair → call register API with `{ username, password, inviteToken, publicKey }` → store private key in safeStorage → store encrypted group key in safeStorage → decrypt group key → redirect to `/app`
  - [x] 9.4 Invite token extracted from URL route param (`/register/:token`)
  - [x] 9.5 Error states per UX spec: invalid invite ("This invite is no longer valid"), username taken ("That username is taken. Try another."), server unreachable
  - [x] 9.6 Style consistent with LoginPage: warm earthy theme, centered card layout, `bg-bg-primary`, `text-text-primary`
  - [x] 9.7 Submit button disabled until both fields have content; Enter key submits; Tab navigates between fields

- [x] Task 10: Update useAuthStore for encryption integration (AC: 2, 3)
  - [x] 10.1 Add `groupKey: Uint8Array | null` to auth store state (in-memory only — never serialized)
  - [x] 10.2 Update `login()` action: after successful login, read private key from safeStorage, decrypt encrypted group key blob, set `groupKey` in store
  - [x] 10.3 Add `register(username, password, inviteToken)` action: generate keypair, call register API with publicKey, store private key + encrypted group key in safeStorage, decrypt and set groupKey
  - [x] 10.4 Update `restoreSession()` action: read private key + encrypted group key from safeStorage, decrypt, set groupKey
  - [x] 10.5 Update `logout()` action: clear `groupKey` from state (keep private key + encrypted group key in safeStorage)
  - [x] 10.6 Ensure groupKey is Uint8Array (not serializable) — Zustand will NOT persist this to storage

- [x] Task 11: Write server-side tests (AC: 1-5)
  - [x] 11.1 Create `server/src/services/encryptionService.test.ts`
  - [x] 11.2 Test `generateGroupKey()` returns 32-byte Uint8Array
  - [x] 11.3 Test `encryptGroupKeyForUser()` + decrypt roundtrip: generate keypair, encrypt group key, decrypt with keypair → matches original
  - [x] 11.4 Test `encryptMessage()` + `decryptMessage()` roundtrip: encrypt plaintext, decrypt → matches original
  - [x] 11.5 Test `encryptMessage()` generates unique nonce per call
  - [x] 11.6 Test `decryptMessage()` with wrong key fails gracefully (throws, doesn't crash)
  - [x] 11.7 Test `decryptMessage()` with wrong nonce fails gracefully
  - [x] 11.8 Update `server/src/plugins/auth/authRoutes.test.ts` — test registration with publicKey field, verify encrypted_group_key stored
  - [x] 11.9 Update `server/src/plugins/auth/authRoutes.test.ts` — test login response includes encryptedGroupKey
  - [x] 11.10 Test registration without publicKey still works (backward compatibility)
  - [x] 11.11 Test registration with invalid publicKey (wrong length) returns 400 validation error
  - [x] 11.12 Add `GROUP_ENCRYPTION_KEY` env var to `vi.hoisted()` in all test files that need it

- [x] Task 12: Write client-side encryption service tests (AC: 4, 5)
  - [x] 12.1 Create `client/src/renderer/src/services/encryptionService.test.ts`
  - [x] 12.2 Test `generateKeyPair()` returns valid X25519 keypair (32-byte public + 32-byte secret)
  - [x] 12.3 Test `decryptGroupKey()` roundtrip: encrypt with crypto_box_seal on "server side", decrypt with keypair on "client side"
  - [x] 12.4 Test `encryptMessage()` + `decryptMessage()` roundtrip
  - [x] 12.5 Test encrypt produces different ciphertext for same plaintext (unique nonces)
  - [x] 12.6 Test decrypt with wrong key throws
  - [x] 12.7 Test `serializeKey()` / `deserializeKey()` roundtrip

- [x] Task 13: Final verification (AC: 1-5)
  - [x] 13.1 Run `npm test -w server` — all existing + new tests pass
  - [x] 13.2 Run `npm test -w client` — all existing + new tests pass
  - [x] 13.3 Run `npm run lint` — no lint errors across all workspaces
  - [x] 13.4 Verify full encryption roundtrip: generate keypair → register with publicKey → login → receive encrypted group key → decrypt group key → encrypt message → decrypt message → original text matches
  - [x] 13.5 Verify `restoreSession` works: restart app → private key + encrypted group key loaded from safeStorage → group key decrypted → available in memory
  - [x] 13.6 Verify no plaintext group key, private key, or decrypted content appears in server logs

## Dev Notes

### Critical Technology Versions (February 2026)

| Package | Version | Install Location | Notes |
|---------|---------|-----------------|-------|
| libsodium-wrappers | 0.8.2 | server + client + shared | Isomorphic — same API in Node.js and Chromium renderer. DO NOT use `libsodium-wrappers-sumo` unless you need advanced features (we don't). |
| @types/libsodium-wrappers | latest | devDependency in all workspaces | Type definitions for TypeScript |

**No other new dependencies needed.** The server already has `jsonwebtoken`, `bcrypt`, and `crypto` (Node.js built-in).

### E2E Encryption Architecture

**Group Key Model (Shared Symmetric Key):**

This is a pragmatic design for a small trusted group (~20 users). All members share one symmetric key for message encryption. The server generates and distributes the key, which means the server owner technically has access to it. This is acceptable because:
- The server owner (Aiden) is a trusted member of the group
- The server is self-hosted — no corporate third party
- True zero-knowledge would require online key exchange between users (Signal Protocol), which is overkill for a 20-person friend group
- The architecture document explicitly chose this trade-off [Source: architecture.md#Authentication-Security]

**Key Hierarchy:**
```
GROUP_ENCRYPTION_KEY (32 bytes, symmetric, stored server-side as env var)
├── Encrypted for User A: crypto_box_seal(groupKey, userA_publicKey) → stored in users.encrypted_group_key
├── Encrypted for User B: crypto_box_seal(groupKey, userB_publicKey) → stored in users.encrypted_group_key
└── ... per user
```

**Encryption Algorithms:**
| Operation | Algorithm | Library Function |
|-----------|-----------|-----------------|
| Group key generation | Random 32 bytes | `sodium.crypto_secretbox_keygen()` |
| Per-user key encryption | X25519 sealed box | `sodium.crypto_box_seal(groupKey, publicKey)` |
| Per-user key decryption | X25519 sealed box | `sodium.crypto_box_seal_open(sealed, publicKey, secretKey)` |
| Message encryption | XSalsa20-Poly1305 | `sodium.crypto_secretbox_easy(msg, nonce, key)` |
| Message decryption | XSalsa20-Poly1305 | `sodium.crypto_secretbox_open_easy(cipher, nonce, key)` |
| Nonce generation | Random 24 bytes | `sodium.randombytes_buf(24)` |
| Keypair generation | X25519 | `sodium.crypto_box_keypair()` |

### Registration Flow (Updated for Encryption)

```typescript
// Client-side registration flow:
// 1. User submits username + password (UX: encryption is invisible)
// 2. Client: await sodium.ready
// 3. Client: const { publicKey, privateKey } = sodium.crypto_box_keypair()
// 4. Client: POST /api/auth/register { username, password, inviteToken, publicKey: base64(publicKey) }
// 5. Server: validate invite, create user, store publicKey in users.public_key
// 6. Server: encryptedGroupKey = crypto_box_seal(groupKey, publicKey)
// 7. Server: store encryptedGroupKey in users.encrypted_group_key
// 8. Server: return { data: { user: {...}, encryptedGroupKey: base64(encryptedGroupKey) } }
// 9. Client: store privateKey in safeStorage("private-key")
// 10. Client: store encryptedGroupKey in safeStorage("encrypted-group-key")
// 11. Client: groupKey = crypto_box_seal_open(encryptedGroupKey, publicKey, privateKey)
// 12. Client: store groupKey in useAuthStore (in-memory only)
```

### Login Flow (Updated for Encryption)

```typescript
// Client-side login flow:
// 1. User submits username + password
// 2. Client: POST /api/auth/login { username, password }
// 3. Server: validate credentials, return tokens + encryptedGroupKey
// 4. Client: read privateKey from safeStorage("private-key")
// 5. Client: read publicKey — derive from privateKey OR store separately
//    NOTE: crypto_box_seal_open needs BOTH publicKey and secretKey
//    Store publicKey in safeStorage("public-key") during registration
// 6. Client: groupKey = crypto_box_seal_open(encryptedGroupKey, publicKey, privateKey)
// 7. Client: store groupKey in useAuthStore (in-memory only)
```

### Session Restore Flow

```typescript
// App restart → restoreSession():
// 1. Read accessToken + refreshToken from safeStorage (existing flow)
// 2. Read privateKey from safeStorage("private-key")
// 3. Read publicKey from safeStorage("public-key")
// 4. Read encryptedGroupKey from safeStorage("encrypted-group-key")
// 5. If all present: decrypt group key, set in store
// 6. If privateKey missing: user must re-register (key was lost)
// 7. If encryptedGroupKey missing: call login endpoint to get it again
```

### Message Encrypt/Decrypt Pattern

```typescript
// Encrypt (before sending):
const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES); // 24 bytes
const ciphertext = sodium.crypto_secretbox_easy(
  sodium.from_string(plaintext),
  nonce,
  groupKey
);
// Send: { ciphertext: base64(ciphertext), nonce: base64(nonce) }

// Decrypt (after receiving):
const plaintext = sodium.to_string(
  sodium.crypto_secretbox_open_easy(
    base64Decode(ciphertext),
    base64Decode(nonce),
    groupKey
  )
);
```

### Server-Side Encryption Service Pattern

```typescript
// server/src/services/encryptionService.ts
import sodium from 'libsodium-wrappers';

let _sodium: typeof sodium;

export async function initializeSodium(): Promise<void> {
  await sodium.ready;
  _sodium = sodium;
}

// Group key: loaded from GROUP_ENCRYPTION_KEY env var (base64)
// On first startup: generated and logged to console for admin to save
// After first startup: always provided via env var

const GROUP_ENCRYPTION_KEY = process.env.GROUP_ENCRYPTION_KEY;
if (!GROUP_ENCRYPTION_KEY) {
  throw new Error('GROUP_ENCRYPTION_KEY environment variable is required');
}

export function getGroupKey(): Uint8Array {
  return sodium.from_base64(GROUP_ENCRYPTION_KEY);
}

export function encryptGroupKeyForUser(userPublicKey: Uint8Array): string {
  const groupKey = getGroupKey();
  const sealed = _sodium.crypto_box_seal(groupKey, userPublicKey);
  return _sodium.to_base64(sealed);
}
```

### RegisterPage Component Structure

```typescript
// client/src/renderer/src/features/auth/RegisterPage.tsx
// - Centered card on bg-bg-primary background (matches LoginPage)
// - Server name display at top (fetched via GET /api/invites/:token/validate)
// - Username input (Input component)
// - Password input (Input component, type="password")
// - "Create Account" button (Button component, variant="primary")
// - Error message below form (inline, red)
//
// UX requirements (per UX spec):
// - Enter key submits form
// - Tab navigates between fields
// - Button disabled until both fields have content
// - No confirm password field — single password field
// - No email, no phone, no CAPTCHA
// - Encryption is COMPLETELY INVISIBLE to the user
// - On success: immediate redirect to /app
```

### Project Structure Notes

New files to create:
```
server/src/services/
  encryptionService.ts              # Group key management, per-user encryption, message encrypt/decrypt
  encryptionService.test.ts         # Encryption service tests

client/src/renderer/src/
  services/
    encryptionService.ts            # Keypair generation, group key decryption, message encrypt/decrypt
    encryptionService.test.ts       # Client encryption tests
  features/auth/
    RegisterPage.tsx                # Registration form (new — only placeholder route exists)
```

Modified files:
```
shared/src/constants.ts             # Add encryption constants (key sizes, nonce sizes)
shared/src/types.ts                 # Add/update encryption types
server/src/db/schema.ts             # Add encrypted_group_key column to users table
server/src/db/seed.ts               # Generate/load group key during owner creation
server/src/plugins/auth/authRoutes.ts    # Accept publicKey on register, return encryptedGroupKey on login
server/src/plugins/auth/authRoutes.test.ts # New tests for encryption in auth flows
server/src/db/schema.test.ts        # Update column count assertion
client/src/renderer/src/stores/useAuthStore.ts  # Add groupKey state, register action, update login/restore
client/src/renderer/src/App.tsx     # Wire RegisterPage to /register/:token route
.env.example                        # Add GROUP_ENCRYPTION_KEY
```

### Deferred / Known Gaps

- **Actual message sending/receiving:** This story only establishes the encryption foundation. Message storage (messages table) and WebSocket message transport are built in Epic 2 (stories 2-1, 2-2).
- **Voice/video encryption:** Architecture specifies transport encryption (DTLS/SRTP) for MVP, not true E2E for voice/video. This is a known post-MVP enhancement.
- **Key rotation:** No group key rotation mechanism in MVP. If a user is banned, they retain the group key they already decrypted. Rotation would require re-encrypting for all remaining users and re-distributing. Deferred to post-MVP.
- **Multi-device support:** Private key is stored on one device via safeStorage. If a user installs on a second device, they'd need to re-register or transfer their key. Deferred to post-MVP.
- **Owner key generation during seed:** The owner account created during DB seed needs a public key. Options: (a) generate keypair during seed and log private key for admin to save, (b) owner registers normally after seed creates just the base account. Option (b) is cleaner — seed creates owner with null publicKey, owner can "upgrade" their account with encryption via a future admin flow OR by re-registering.

### Alignment with Architecture Doc

- libsodium-wrappers v0.8.2 for all encryption operations [Source: architecture.md#Authentication-Security]
- Shared group symmetric key model [Source: architecture.md#Authentication-Security]
- X25519 keypairs per user, server distributes encrypted group key [Source: architecture.md#E2E-Encryption-Flow]
- XSalsa20-Poly1305 for message encryption [Source: architecture.md#Authentication-Security]
- Client-side encryptionService.ts at `services/encryptionService.ts` [Source: architecture.md#Client-File-Structure]
- Server-side encryptionService.ts at `services/encryptionService.ts` [Source: architecture.md#Server-File-Structure]
- Encrypted message content opaque to server [Source: architecture.md#Data-Boundaries]
- Zero content logging enforced [Source: project-context.md#Critical-Rules]
- Co-located tests [Source: project-context.md#Testing-Rules]
- Feature-based client organization [Source: architecture.md#Client-File-Structure]
- API response envelope on all endpoints [Source: project-context.md#Code-Quality]
- ESM imports with .js extensions [Source: previous story 1-4 learnings]
- Fastify JSON schema validation on all request bodies [Source: previous story 1-3 learnings]
- Module-level env var validation (fail-fast) [Source: previous story 1-3 learnings]

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-project-foundation-user-authentication.md#Story-1.5] — Acceptance criteria, user story
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Security] — E2E encryption architecture, libsodium, group key model
- [Source: _bmad-output/planning-artifacts/architecture.md#E2E-Encryption-Flow] — Step-by-step encryption flow
- [Source: _bmad-output/planning-artifacts/architecture.md#Database-Schema] — Users table with public_key column
- [Source: _bmad-output/planning-artifacts/architecture.md#Client-File-Structure] — encryptionService.ts location
- [Source: _bmad-output/planning-artifacts/architecture.md#Server-File-Structure] — server encryptionService.ts location
- [Source: _bmad-output/planning-artifacts/architecture.md#Voice-Video-Encryption-MVP-Trade-Off] — Transport encryption for voice/video MVP
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Account-Creation] — Registration form (username + password only, encryption invisible)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Form-Rules] — Enter submits, tab navigation, button disabled states
- [Source: _bmad-output/planning-artifacts/prd.md#FR33-FR37] — E2E encryption requirements
- [Source: _bmad-output/planning-artifacts/prd.md#Security-NFRs] — Encryption, no plaintext keys, TLS
- [Source: _bmad-output/project-context.md] — API envelope, error handling, naming conventions, testing rules, libsodium version
- [Source: _bmad-output/implementation-artifacts/1-4-user-login-logout-and-session-management.md] — Auth patterns, safeStorage bridge, useAuthStore, apiClient, code review learnings
- [Source: shared/src/types.ts] — User.publicKey, Message.encrypted, Message.nonce type definitions
- [Source: shared/src/constants.ts] — Where to add encryption constants
- [Source: server/src/db/schema.ts] — Users table already has public_key column

### Previous Story (1-4) Intelligence

**Key learnings from story 1-4 that MUST be applied:**

- **Module-level env validation:** `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are validated at module load. Do the same for `GROUP_ENCRYPTION_KEY` — fail fast, not at request time.
- **Fastify schema validation:** All request bodies must have JSON schema validation. Registration must validate the new `publicKey` field.
- **Response envelope consistency:** Every response uses `{ data }` or `{ error: { code, message } }`.
- **Type-safe request handling:** Use `getAuthenticatedUser()` type guard. Fastify generics (`<{ Body: T }>`) on all route handlers.
- **Shared test helpers:** Use `setupApp()`, `seedOwner()`, `seedRegularUser()`, `seedUserWithSession()` from `server/src/test/helpers.ts`.
- **ESM imports:** All local imports need `.js` extensions.
- **Co-located tests:** Test files next to source files.
- **Pino logger only:** No `console.log` on the server — use `request.log` or `fastify.log`.
- **Username normalization:** Registration and login both normalize with `trim().toLowerCase()`.
- **Transactional DB writes:** Registration is wrapped in `db.transaction()`. Encryption operations (store publicKey + encryptedGroupKey) must be included in that transaction.
- **DRY service calls:** Use shared service functions. Don't duplicate encryption logic — import from encryptionService.
- **vi.hoisted() env vars:** When adding `GROUP_ENCRYPTION_KEY` env var, update ALL test files that call `setupApp()` with the new env var in `vi.hoisted()`.
- **safeStorage pattern:** Store/retrieve values using `window.api.secureStorage.set(key, value)` / `.get(key)` / `.delete(key)`. All values are strings (base64 encode Uint8Arrays).
- **Zustand store pattern:** `{ user, accessToken, refreshToken, isLoading, error }` — extend with `groupKey: Uint8Array | null`.

**Code review pattern from stories 1-2 through 1-4:**
Every story gets 5-10 issues in code review. Most common issues:
- Missing input validation (wrong length publicKey, non-base64 strings)
- Race conditions on concurrent writes (missing transaction wrapping)
- Missing type safety (Fastify generics)
- Inconsistent response patterns
- Insufficient boundary tests
**Action:** Write clean code from the start following all patterns above. Add boundary tests for invalid publicKey lengths, invalid base64, missing fields.

### Git Intelligence

Recent commits:
```
cc790a3 Fix 10 code review issues for story 1-4
db98ec0 Implement story 1-4: User Login, Logout & Session Management
72fd181 Fix 9 code review #2 issues for story 1-3
37f4aee Fix 10 code review issues for story 1-3
d1eec53 Implement story 1-3: User Registration & Invite System
```

**Pattern:** Implementation → code review → fixes. Each story follows this cycle. Aim for zero HIGH-severity issues in code review by following all established patterns.

**Key files from recent work:**
- `server/src/plugins/auth/authRoutes.ts` — registration + login endpoints (must be modified)
- `server/src/plugins/auth/authService.ts` — token generation/verification (reference patterns)
- `server/src/plugins/auth/sessionService.ts` — session CRUD (reference patterns)
- `client/src/renderer/src/stores/useAuthStore.ts` — auth state management (must be extended)
- `client/src/main/safeStorage.ts` — secure storage IPC handlers (already working, reuse)
- `client/src/renderer/src/services/apiClient.ts` — API client (reuse for registration calls)
- `server/src/test/helpers.ts` — test utilities (may need new helper for encryption setup)

### libsodium API Quick Reference

```typescript
import sodium from 'libsodium-wrappers';

// MUST await ready before any operations
await sodium.ready;

// Key generation
const groupKey = sodium.crypto_secretbox_keygen(); // 32 bytes
const { publicKey, privateKey } = sodium.crypto_box_keypair(); // X25519

// Sealed box (anonymous public-key encryption)
const sealed = sodium.crypto_box_seal(message, recipientPublicKey); // encrypt
const opened = sodium.crypto_box_seal_open(sealed, publicKey, privateKey); // decrypt

// Secret box (symmetric encryption)
const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES); // 24 bytes
const cipher = sodium.crypto_secretbox_easy(message, nonce, key); // encrypt
const plain = sodium.crypto_secretbox_open_easy(cipher, nonce, key); // decrypt

// String conversion
const bytes = sodium.from_string("hello"); // string → Uint8Array
const str = sodium.to_string(bytes); // Uint8Array → string

// Base64 conversion
const b64 = sodium.to_base64(bytes); // Uint8Array → base64 string
const arr = sodium.from_base64(b64); // base64 string → Uint8Array
```

**Critical:** `sodium.ready` is a Promise. ALL encryption functions require sodium to be initialized first. The server should call `initializeSodium()` during app startup (in `app.ts`). The client should call it before any encryption operation.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed libsodium `from_string()` compatibility issue in jsdom test environment — client encryptionService passes strings directly to `crypto_secretbox_easy` instead of converting to Uint8Array first (jsdom uses a different Uint8Array constructor than libsodium expects)
- Fixed test GROUP_ENCRYPTION_KEY base64 encoding — libsodium's `from_base64` uses a different base64 variant than standard Node.js Buffer; generated a proper key using `sodium.crypto_secretbox_keygen()` + `sodium.to_base64()`

### Completion Notes List

- Installed libsodium-wrappers v0.8.2 and @types/libsodium-wrappers in all three workspaces (server, client, shared)
- Added 6 encryption constants to shared/src/constants.ts and EncryptedGroupKeyBlob type to shared/src/types.ts
- Added encrypted_group_key column to users table with Drizzle migration (0001_add_encrypted_group_key.sql)
- Created server-side encryptionService.ts with initializeSodium, generateGroupKey, getGroupKey, encryptGroupKeyForUser, encryptMessage, decryptMessage functions
- Updated seed.ts to generate GROUP_ENCRYPTION_KEY on first startup if not set in env
- Updated authRoutes.ts registration to accept optional publicKey, validate 32-byte length, encrypt group key for user, store in transaction, return encryptedGroupKey in response
- Updated authRoutes.ts login to return encryptedGroupKey from user's DB record
- Created client-side encryptionService.ts with matching encrypt/decrypt functions plus generateKeyPair, serializeKey, deserializeKey
- Created RegisterPage.tsx matching LoginPage styling (warm earthy theme, centered card) with invisible encryption flow
- Updated useAuthStore with groupKey state, register() action (keypair generation + API call + safeStorage), updated login() and restoreSession() to decrypt group key from safeStorage, logout() clears groupKey but keeps private key
- Wired RegisterPage into App.tsx routing (replaced placeholder)
- Added GROUP_ENCRYPTION_KEY to .env.example with documentation
- Added GROUP_ENCRYPTION_KEY env var to vi.hoisted() in app.test.ts, inviteRoutes.test.ts, authRoutes.test.ts, and encryptionService.test.ts
- 10 server encryption service tests (key generation, sealed box roundtrip, secretbox roundtrip, nonce uniqueness, wrong key/nonce failures)
- 7 auth route encryption tests (register with publicKey, register without publicKey, invalid publicKey length, invalid base64, login with/without encryptedGroupKey)
- 7 client encryption service tests (keypair generation, sealed box roundtrip, secretbox roundtrip, nonce uniqueness, wrong key failure, serialize/deserialize)
- All 102 server tests pass, all 8 client tests pass, zero lint errors

### Change Log

- 2026-02-24: Implemented story 1-5 E2E Encryption Foundation — added libsodium-wrappers encryption infrastructure, server/client encryption services, updated registration/login for encryption key exchange, created RegisterPage, added 24 new tests

### File List

New files:
- server/src/services/encryptionService.ts
- server/src/services/encryptionService.test.ts
- server/drizzle/0001_add_encrypted_group_key.sql
- server/drizzle/meta/0001_snapshot.json
- client/src/renderer/src/services/encryptionService.ts
- client/src/renderer/src/services/encryptionService.test.ts
- client/src/renderer/src/features/auth/RegisterPage.tsx

Modified files:
- shared/src/constants.ts
- shared/src/types.ts
- shared/src/index.ts
- server/src/db/schema.ts
- server/src/db/schema.test.ts
- server/src/db/seed.ts
- server/src/plugins/auth/authRoutes.ts
- server/src/plugins/auth/authRoutes.test.ts
- server/src/app.test.ts
- server/src/plugins/invites/inviteRoutes.test.ts
- client/src/renderer/src/stores/useAuthStore.ts
- client/src/renderer/src/App.tsx
- .env.example
- package-lock.json
- server/package.json
- client/package.json
- shared/package.json

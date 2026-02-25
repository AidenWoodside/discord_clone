# Dependency Map & Parallel Execution Plan

**Generated:** 2026-02-24 | **Revised:** 2026-02-24 (v4)
**Project:** discord_clone
**Scope:** 17 remaining stories across Epics 2-6 (Epic 1 complete)

---

## Current State

Epic 1 (Project Foundation & User Authentication) is **fully complete** — all 6 stories done, 167 tests passing. The foundation provides: monorepo scaffold, SQLite + Drizzle ORM, JWT auth, E2E encryption (libsodium), and the Discord-familiar three-column app shell.

---

## Full Dependency Graph

```
                    ┌──────────────────────────────────────────────────┐
                    │              EPIC 1 (COMPLETE)                   │
                    │  1-1 → 1-2 → 1-3 → 1-4 → 1-5 → 1-6           │
                    └──────────────┬───────────────────────────────────┘
                                   │
                            [2-1] WebSocket ★
                                   │
         ┌────────────┬────────────┼────────────┬──────────┐
         │            │            │            │          │
    [2-2] Text   [3-1] Voice  [5-1] Channel [5-2] User
    Messaging     Server ★    Management    Management
         │            │
    [2-3] Feed   [3-2] Join/
    & UI         Leave ★
         │            │
    [2-4] History ┌───┼──────────┐
    & Scrollback  │   │          │
             [3-3] Audio [4-1] Video [6-1] Connection
             Indicators ★ Toggle     Resilience
                  │          │
             [3-4] Device [4-2] Video
             Controls ★   Grid ←─── also needs [3-3]
                  │          │
                  └────┬─────┘
                       │
             ┌─────────┴─────────┐
             │                   │
     [6-3] Privacy         [6-4] Production
     Audit                 Deployment
                                 │
                            [6-5] CI/CD ★
                            Pipeline
                                 │
                            [6-2] Auto-Update

★ = Critical path story
```

---

## Story-by-Story Dependency Matrix

| Story | Title | Hard Dependencies | Rationale |
|-------|-------|-------------------|-----------|
| **2-1** | WebSocket Connection & Real-Time Transport | Epic 1 (done) | JWT auth gates WebSocket access; no other remaining blockers |
| **2-2** | Encrypted Text Messaging | **2-1** | Sends/receives messages over WebSocket; uses encryption from 1-5 (done). Writes encrypted messages to the messages table created by 2-1. |
| **2-3** | Message Feed & Channel Navigation UI | **2-2** | Needs message data to render; extends app shell from 1-6 (done) |
| **2-4** | Persistent Message History & Scrollback | **2-3** | Needs message feed UI to integrate scrollback and history loading |
| **3-1** | Voice Server Infrastructure | **2-1** | Voice signaling (`voice:join`, `rtc:offer`, etc.) travels over WebSocket |
| **3-2** | Voice Channel Join, Leave & Presence | **3-1** | Requires mediasoup transports and coturn from 3-1 |
| **3-3** | Real-Time Voice Audio & Speaking Indicators | **3-2** | Requires active voice connections to produce/consume audio |
| **3-4** | Audio Device Management & Voice Controls | **3-3** | Needs working audio tracks for device switching; mute icon depends on voice UI |
| **4-1** | Video Camera Toggle & Streaming | **3-2** | Adds video tracks to existing voice transport; voice status bar toggle button from 3-2 |
| **4-2** | Video Grid Display | **4-1, 3-3** | Renders video streams from 4-1; speaking indicator (green border) on video tiles requires speaking detection from 3-3 |
| **5-1** | Channel Management | **2-1** | WebSocket broadcasts (`channel:created/deleted`); AC requires "all associated messages are permanently removed" on channel delete — messages table is created by 2-1 and cascade delete can be unit-tested with seed data |
| **5-2** | User Management & Administration | **2-1** | WebSocket notifications (`user:kicked/banned`); session invalidation cascades to WebSocket disconnect (and transitively to voice if active). Soft dep on 3-2 for voice-kick testing. |
| **6-1** | Connection Resilience & Error Handling | **2-1, 3-2** | Handles WebSocket reconnection + voice manual rejoin; AC explicitly states "voice must be manually rejoined" |
| **6-2** | Auto-Update System | **6-5** | electron-updater checks GitHub Releases published by 6-5. Implementation is standalone, but end-to-end testing requires a real release artifact. Nothing meaningful to update to until the app is feature-complete and CI/CD is publishing. |
| **6-3** | Privacy Enforcement & Zero Telemetry | **All feature stories** | Audit story. AC says "when I use any feature" and "no outbound network requests to third-party services" — requires all dependency trees (mediasoup, coturn, electron-updater) to exist for a valid audit. "Pino configured to exclude message payloads" needs the message schema from 2-2. Doing this early means re-auditing after every subsequent story. |
| **6-4** | Production Deployment Infrastructure | **All feature stories** | Docker Compose includes coturn (3-1) + full app server; must come after all features for production readiness |
| **6-5** | CI/CD Pipeline & Cross-Platform Distribution | **6-4** | Server Dockerfile defined in 6-4; publishes to GitHub Releases (consumed by 6-2's auto-updater) |

### Revision History

#### v2 Changes

| Story | v1 Deps | v2 Deps | What Was Missed |
|-------|---------|---------|-----------------|
| **5-1** | 2-1 only | **2-1, 2-2** | AC: "all associated messages are permanently removed" on channel delete. Can't implement cascade delete without the messages table that 2-2 creates. **Moved Wave 2 → Wave 3.** *(Reverted in v4 — see below.)* |
| **5-2** | 2-1 only | **2-1** (soft: 3-2) | Kick invalidates sessions → WebSocket drops → voice disconnects via cascade. Hard dep is still just 2-1, but testing kick-from-voice requires 3-2. **Stays Wave 2; soft dep noted.** |
| **4-2** | 4-1 only | **4-1, 3-3** | AC: "speaking indicator activates... green border/glow" on video tiles. Can't render speaking state without speaking detection from 3-3. **Wave unchanged (both deps in prior wave), but dependency now explicit.** |

#### v3 Changes

| Story | v2 Deps | v3 Deps | What Was Missed |
|-------|---------|---------|-----------------|
| **6-3** | Epic 1 (done) | **All feature stories** | AC: "when I use any feature... no outbound network requests to third-party services." This is an audit story — mediasoup, coturn, and electron-updater all bring dependency trees that need auditing. "Pino configured to exclude message payloads" needs 2-2's message schema. A partial audit would need to be re-done after every subsequent story. **Moved Wave 1 → Wave 6.** |
| **6-2** | Epic 1 (done) | **All feature stories** | electron-updater code is standalone, but testing requires a GitHub Release (manual or via 6-5). More importantly, auto-update has zero practical value for a half-built app — you'd only ship it when the app is feature-complete. Integration pair with 6-5. **Moved Wave 1 → Wave 7.** |

#### v4 Changes

| Story | v3 Deps | v4 Deps | What Was Wrong |
|-------|---------|---------|----------------|
| **5-1** | 2-1, 2-2 | **2-1** | The v2 rationale claimed 2-2 creates the messages table. In fact, story 2-1's spec explicitly declares the messages table under Database Modifications. 2-2 *writes to* the table — it doesn't create it. Cascade delete can be implemented and unit-tested with seed data. **Moved Wave 3 → Wave 2.** |
| **6-2** | All feature stories | **6-5** | Hard dependency was listed as "all feature stories" but the actual blocker is GitHub Releases: electron-updater needs a published release artifact to test against, and 6-5 is what publishes them. Making this explicit rather than hiding behind a soft "integration pair" note. **Stays Wave 7; hard dep now explicit.** |

---

## Critical Path

The longest dependency chain determines the minimum possible project duration:

```
2-1 → 3-1 → 3-2 → 3-3 → 3-4 → 6-4 → 6-5
 ★      ★      ★      ★      ★         ★
```

**7 stories in sequence.** Every day saved on a critical path story saves a day on the total project. Non-critical-path stories can be deferred or interleaved without affecting the end date.

The critical path runs entirely through the **voice pipeline** into **deployment**. This is the longest chain because mediasoup/coturn/WebRTC are the most technically complex features in the project.

---

## Parallel Execution Waves

Each wave contains stories whose **hard dependencies** are fully satisfied by all prior waves. Stories within a wave are independent of each other and can be worked simultaneously.

### Wave 1 — Immediate Start (1 story, 0 blockers)

| Story | Title | Effort Est. | Notes |
|-------|-------|-------------|-------|
| **2-1** ★ | WebSocket Connection & Real-Time Transport | Large | **CRITICAL PATH.** The single bottleneck. Unblocks 6 stories directly. Creates messages table. |

> **Parallel capacity:** 1 developer
> **Note:** This is the only story with zero remaining blockers. Everything flows from here.

---

### Wave 2 — After 2-1 Completes (4 stories)

| Story | Title | Effort Est. | Notes |
|-------|-------|-------------|-------|
| **3-1** ★ | Voice Server Infrastructure | Large | **CRITICAL PATH.** mediasoup + coturn + signaling. Technically complex. |
| 2-2 | Encrypted Text Messaging | Medium | Uses WebSocket from 2-1 + encryption from 1-5. Writes encrypted messages to the table created by 2-1. Unblocks the text UI pipeline (2-3). |
| 5-1 | Channel Management | Medium | Create/delete channels, WebSocket broadcasts, message cascade delete. Messages table exists from 2-1. |
| 5-2 | User Management & Administration | Medium | Kick/ban/unban + WebSocket notifications. Soft dep on 3-2 for voice-kick testing — core functionality works without it. |

> **Parallel capacity:** 4 concurrent developers
> **Recommendation:** If solo, prioritize **3-1** (critical path), then **2-2** (unblocks the text UI pipeline).

---

### Wave 3 — After Wave 2 Deps (2 stories)

| Story | Title | Blocked By | Effort Est. | Notes |
|-------|-------|------------|-------------|-------|
| **3-2** ★ | Voice Channel Join, Leave & Presence | 3-1 | Large | **CRITICAL PATH.** Unblocks 3-3, 4-1, and 6-1. |
| 2-3 | Message Feed & Channel Navigation UI | 2-2 | Medium | Message display, grouping, input bar, channel switching. |

> **Parallel capacity:** 2 concurrent developers
> **Recommendation:** If solo, prioritize **3-2** (critical path).

---

### Wave 4 — After Wave 3 Deps (4 stories)

| Story | Title | Blocked By | Effort Est. | Notes |
|-------|-------|------------|-------------|-------|
| **3-3** ★ | Real-Time Voice Audio & Speaking Indicators | 3-2 | Large | **CRITICAL PATH.** Audio producers/consumers + speaking detection. Also unblocks 4-2. |
| 4-1 | Video Camera Toggle & Streaming | 3-2 | Medium | Adds video track to existing voice transport. Soft dep on 3-3 (audio should ideally work before adding video). |
| 2-4 | Persistent Message History & Scrollback | 2-3 | Medium | REST message fetch, pagination, auto-scroll, "new messages" indicator. |
| 6-1 | Connection Resilience & Error Handling | 2-1, 3-2 | Medium | Reconnection banner, exponential backoff, voice manual rejoin. |

> **Parallel capacity:** 4 concurrent developers (peak parallelism)
> **Recommendation:** If solo, prioritize **3-3** (critical path). 4-1 is a natural follow-up since it builds on the same transport layer.

---

### Wave 5 — After Wave 4 Deps (2 stories)

| Story | Title | Blocked By | Effort Est. | Notes |
|-------|-------|------------|-------------|-------|
| **3-4** ★ | Audio Device Management & Voice Controls | 3-3 | Medium | **CRITICAL PATH.** Device selection, mute/deafen, keyboard shortcuts. Last feature story on the critical path. |
| 4-2 | Video Grid Display | **4-1 + 3-3** | Medium | Responsive grid, username overlay, speaking indicator (green border) on tiles. Dual dependency: needs video streams (4-1) AND speaking detection (3-3). |

> **Parallel capacity:** 2 concurrent developers
> **Recommendation:** Both can run in parallel. 3-4 is on critical path.

---

### Wave 6 — After All Feature Stories (2 stories)

| Story | Title | Blocked By | Effort Est. | Notes |
|-------|-------|------------|-------------|-------|
| 6-4 | Production Deployment Infrastructure | All feature stories | Large | Docker Compose (app + coturn + nginx), TLS via Let's Encrypt, invite landing page, custom protocol handler. |
| 6-3 | Privacy Enforcement & Zero Telemetry | All feature stories | Medium | Comprehensive audit: verify zero analytics libs in full dependency tree, no outbound third-party requests (mediasoup, coturn, electron-updater), Pino excludes message payloads. Must audit the complete app. |

> **Parallel capacity:** 2 concurrent developers
> **Note:** 6-3 is an audit/hardening pass across the entire codebase. 6-4 is infrastructure. Both need the full app to exist but are independent of each other.

---

### Wave 7 — Final (2 stories, sequential)

| Story | Title | Blocked By | Effort Est. | Notes |
|-------|-------|------------|-------------|-------|
| 6-5 | CI/CD Pipeline & Cross-Platform Distribution | 6-4 | Medium | GitHub Actions, cross-platform Electron builds, server Docker image. Publishes to GitHub Releases. |
| 6-2 | Auto-Update System | **6-5** | Medium | electron-updater checks GitHub Releases. Requires a published release artifact from 6-5 for end-to-end testing. |

> **Parallel capacity:** 1 developer (sequential — 6-2 depends on 6-5)
> **Note:** 6-5 must publish at least one release before 6-2 can be validated end-to-end.

---

## Optimal Solo Developer Execution Order

For a solo developer, total project time = sum of all story durations (no true parallelism). The optimization is: **always prioritize the critical path**, and **group related stories to minimize context switching**.

| # | Story | Wave | Critical Path? | Why This Order |
|---|-------|------|----------------|----------------|
| 1 | **2-1** WebSocket | W1 | YES | The sole unblocked story. Everything flows from here. |
| 2 | **3-1** Voice Server Infra | W2 | YES | Critical path. Start the technically hardest chain early. |
| 3 | **2-2** Encrypted Text Messaging | W2 | No | Unblocks the text UI pipeline (2-3). Good context switch from mediasoup. |
| 4 | **5-1** Channel Management | W2 | No | Admin CRUD while text context is warm. Only needs 2-1 (messages table exists). |
| 5 | **3-2** Voice Join/Leave & Presence | W3 | YES | Critical path. Unblocks 3-3, 4-1, and 6-1. |
| 6 | **2-3** Message Feed & Channel UI | W3 | No | Text pipeline continues. Context switch from voice work. |
| 7 | **3-3** Voice Audio & Speaking Indicators | W4 | YES | Critical path. Core voice experience. |
| 8 | **4-1** Video Camera Toggle | W4 | No | Builds on voice transport from 3-2. Natural follow-on from 3-3. |
| 9 | **3-4** Audio Device Mgmt & Controls | W5 | YES | Critical path. Completes voice feature set. |
| 10 | **4-2** Video Grid Display | W5 | No | Completes video. Both deps (4-1, 3-3) now satisfied. |
| 11 | **2-4** Message History & Scrollback | W4 | No | Completes text feature set. |
| 12 | **5-2** User Management & Admin | W2 | No | Admin feature. All core features exist now — voice-kick cascade fully testable. |
| 13 | **6-1** Connection Resilience | W4 | No | Polish. All connection types (WS + voice) are stable. |
| 14 | **6-4** Production Deployment | W6 | No | Docker Compose + TLS + invite landing page. All features complete. |
| 15 | **6-3** Privacy Audit | W6 | No | Full audit of dependency trees, outbound requests, Pino config. All code exists to audit. |
| 16 | **6-5** CI/CD Pipeline | W7 | No | Automate builds and publishing to GitHub Releases. |
| 17 | **6-2** Auto-Update System | W7 | No | electron-updater. Requires published release from 6-5. |

### Solo Strategy Notes

- **Story 1** (2-1): The sole unblocked story. No choice here — WebSocket is the gateway to everything.
- **Stories 2-4** (3-1, 2-2, 5-1): Get voice infra started (critical path), then stand up text messaging and channel management. All three are unblocked by 2-1.
- **Stories 5-6** (3-2, 2-3): Both in Wave 3. Knock out the critical path story first (3-2), then complete the text UI.
- **Stories 7-8** (3-3, 4-1): Core audio + video in the same stretch while WebRTC/mediasoup knowledge is fresh.
- **Stories 9-13** (3-4, 4-2, 2-4, 5-2, 6-1): Sweep up remaining features. All deps satisfied. Order is flexible.
- **Stories 14-17** (6-4, 6-3, 6-5, 6-2): Deployment, audit, CI/CD, auto-update. These are the finishing touches — do them last as a cohesive "ship it" phase.

---

## Multi-Developer Capacity Analysis

| Wave | Stories | Max Parallel Devs | Cumulative Stories Done |
|------|---------|-------------------|------------------------|
| W1 | 2-1 | 1 | 1 |
| W2 | 3-1, 2-2, 5-1, 5-2 | 4 | 5 |
| W3 | 3-2, 2-3 | 2 | 7 |
| W4 | 3-3, 4-1, 2-4, 6-1 | 4 | 11 |
| W5 | 3-4, 4-2 | 2 | 13 |
| W6 | 6-4, 6-3 | 2 | 15 |
| W7 | 6-5, 6-2 | 1 (sequential) | 17 |

**Peak parallelism:** 4 developers (Waves 2 and 4)
**Wave 1 bottleneck:** Only 1 story can be worked — 2-1 gates everything
**Minimum waves to complete:** 7 (regardless of team size)
**Total stories remaining:** 17

### Team Size Recommendations

- **1 dev:** Follow the solo execution order above. ~17 story-units in sequence. Wave 1 is unavoidable — 2-1 must come first.
- **2 devs:** Dev A takes the critical path (voice/video chain). Dev B takes text + admin. Both stay productive Waves 2-5. One dev handles 6-4 while the other handles 6-3 in Wave 6, then split 6-5/6-2 in Wave 7. Wave 1 bottleneck: one dev is idle until 2-1 completes.
- **3 devs:** Each dev "owns" a stream: (A) voice chain, (B) text chain, (C) admin + polish. Peak efficiency Waves 2-3, then C assists with Wave 4. Two devs idle during Wave 1 bottleneck.
- **4 devs:** Maximum utilization only in Wave 4. Three devs idle during Wave 1. Best to have idle devs prepare development environment, research mediasoup/coturn docs, or spike on technical unknowns while waiting for 2-1.

---

## Risk Notes

1. **2-1 is the single biggest bottleneck.** It blocks 6 downstream stories directly (2-2, 3-1, 5-1, 5-2, and transitively everything else), sits on the critical path, and is the ONLY story in Wave 1. Multi-dev teams will have idle capacity until it completes.
2. **Voice stories (3-1 through 3-4) are technically complex.** mediasoup, coturn, and WebRTC have steep learning curves. Budget extra time. These are the critical path.
3. **2-2 feeds the text pipeline.** It writes encrypted messages to the table created by 2-1 and unblocks the message feed UI (2-3). 5-1 no longer depends on 2-2 — the messages table exists after 2-1.
4. **4-2 has a dual dependency** (4-1 + 3-3) that isn't obvious. The speaking indicator on video tiles requires 3-3's speaking detection. Both must complete before 4-2 can start.
5. **5-2 works without voice but is incomplete.** Kick/ban core logic only needs WebSocket (2-1), but testing the full kick-from-voice cascade requires 3-2. Implement core first, verify voice cascade integration after 3-2 lands.
6. **6-3 is an audit, not a config task.** It verifies that ALL dependency trees (mediasoup, coturn, electron-updater, etc.) are free of analytics/telemetry. Doing it before all features means re-auditing after every new dependency.
7. **6-2 and 6-5 are an integration pair.** Auto-update (6-2) checks GitHub Releases; CI/CD (6-5) publishes to GitHub Releases. Implementing them in the same wave enables end-to-end validation.
8. **6-4 (Docker Compose) requires coturn from 3-1.** Don't start deployment infra until voice server infrastructure is proven and all features are complete.

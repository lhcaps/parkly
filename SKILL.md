# PARKLY DOMAIN SKILLS & ENTERPRISE ARCHITECTURE MANIFESTO

This document defines the core business logic, strict distributed-system patterns, and B2B IoT architecture of the Parkly RC1 system. **You MUST strictly adhere to these principles before writing or designing any new flow, API, or module.**

## 1. Concurrency, Race Conditions & Distributed Locks
- **The Problem:** IoT devices are unpredictable. ALPR cameras and RFID readers can and will trigger simultaneously at the exact same millisecond. Network retries can cause duplicate requests.
- **The Solution (Two-Level Protection):**
  1. **Mutation Idempotency:** ALL state-changing APIs (payments, barrier commands) MUST pass through the Two-Level Idempotency middleware (Fast-fail Redis `SETNX` + DB Persistence `api_idempotency_keys`).
  2. **Lane Lock (`Redlock`):** ALL entry/exit gate reads MUST acquire a Redis Distributed Lock using `laneId` before opening `gate_passage_sessions`. If locked, the subsequent request must append its data to the currently opening session, NOT create a duplicate database record.

## 2. Topology Management & Atomic Mutations
- **The Problem:** Modifying physical infrastructure mapping (Sites -> Gates -> Lanes -> Devices) directly impacts thousands of historical sessions.
- **The Solution:**
  1. **NO Hard Deletes:** Never execute `DELETE` on topology records. Use soft deletes (`status = 'INACTIVE'` or `is_active = false`).
  2. **Atomic Device Mapping:** Modifying device-to-lane assignments (`PUT /api/admin/topology/lanes/:laneId/devices`) MUST be wrapped in a `prisma.$transaction` (wipe old mapping, create new, update primary device).
  3. **Hot-Reloading (SSE):** Topology mutations MUST trigger an SSE event (`lane.status.upsert`) to actively reload connected Edge Nodes and Guard Consoles without page refreshes.

## 3. The Edge Fallback & Local Survivability
- **The Problem:** Cloud-Centralized architectures fail catastrophically during local ISP outages. Vehicles cannot be held hostage at the barrier.
- **The Solution:** Features like `OPEN_BARRIER` for Subscriptions MUST support local edge execution. 
- **Flow:** The Parkly Edge Node synchronizes active subscriptions to a local SQLite DB every 5 minutes. During an outage, the Edge Node acts as the Decision Engine, opens the barrier locally, and utilizes a Store-and-Forward Outbox pattern to bulk-sync (`POST /api/edge/sessions/bulk-sync`) back to the cloud when internet is restored.

## 4. Tariff Projection (Pre-calculation Over Runtime)
- **The Concept:** Parkly supports highly complex B2B pricing models (Holiday Multipliers, Daily Caps, Grace Periods, Compound Rules).
- **The Rule:** NEVER execute complex JSON tariff rule parsing at the exact millisecond a vehicle triggers the exit loop sensor. Barrier latency MUST remain under 200ms.
- **The Solution:** Pricing must be projected asynchronously while the vehicle is parked (`spot_occupancy_projection`). The exit flow merely retrieves the pre-calculated fee or relies on Webhook/VietQR payment confirmations.

## 5. Non-Blocking Event Delivery & The Outbox Pattern
- **The Concept:** The main HTTP thread must never wait for third-party network responses (e.g., Bank Webhooks, MongoDB syncs).
- **The Solution:** Use the `gate_event_outbox` table.
- **Flow:** 1. API mutation saves the domain state AND inserts an outbox record within the SAME Prisma `$transaction`.
  2. Return HTTP 2xx to the client instantly.
  3. BullMQ workers (`parkly:development:outbox`) process the outbox payload asynchronously.
  4. For B2B Webhooks: Generate an HMAC-SHA256 signature (`X-Parkly-Signature`), dispatch via Axios, and log the exact request/response to `webhook_deliveries`. Failures trigger exponential backoff; terminal failures move to `gate_event_outbox_dlq`.

## 6. Heavy Lifting & Bulk Operations (B2B Standard)
- **The Concept:** Enterprise administrators will upload thousands of records (Subscriptions, VIP lists) simultaneously.
- **The Rule:** NEVER process bulk inserts synchronously via a single HTTP request.
- **The Solution:** Accept file -> Save to MinIO -> Enqueue BullMQ Job (`parkly:admin:bulk-import`) -> Return `HTTP 202 Accepted` with a `jobId`. The frontend client MUST poll `/api/admin/jobs/:jobId` to render a progress bar.

## 7. Anti-Passback & Automated Reconciliation
- **The Concept:** Tailgating (vehicles following each other closely) causes missing exit reads, leaving a "Ghost Presence" (`status = ACTIVE`) in `gate_active_presence`. This triggers false Anti-Passback blocks the next morning.
- **The Solution:** Do not rely on manual guard intervention. The `ghost-presence-purge` BullMQ repeatable cron job MUST run nightly (e.g., 02:00 AM) to automatically flag >24h stale presence records as `CLEARED`, accompanied by an `audit_logs` entry.

## 8. B2B Security & Session Hygiene
- **The Concept:** Parkly is an Enterprise IoT system, not a consumer B2C app.
- **The Rule:** Rely strictly on the internal Custom JWT + Redis auth architecture. Do not suggest B2C identity providers (like Firebase).
- **The Implementation:** Authentication requires strict RBAC (`user_site_scopes`). Device authentication uses HMAC `X-Device-Signature`. Human session management must enforce concurrent session limits and support forced global eviction (`/api/auth/revoke-all`).
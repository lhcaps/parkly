# Architecture — Parkly Codebase

**Analyzed:** 2026-05-05
**Focus:** System design, patterns, data flow, bounded contexts

## High-Level Architecture

```
[Guard Console / Mobile] --HTTPS--> [Express API] --Prisma--> [MySQL]
                                   |                                   
                                   +--ioredis--> [Redis] (lock/cache/session)
                                   |                                   
                                   +--BullMQ--> [Worker] --axios--> [Webhooks]
                                   |                                   
                                   +--S3 SDK--> [MinIO] (media storage)
                                   |                                   
                                   +--SSE--> [Web Console] (realtime deltas)
                                   |                                   
                                   +--Prometheus--> [Grafana]
```

## Bounded Contexts (API Modules)

| Context | Key Services | Domain |
|---------|-------------|--------|
| `gate` | `open-session`, `resolve-session`, `decision-engine`, `review` | Entry/exit workflow, barrier control |
| `auth` | `auth-service`, `auth-security` | User sessions, RBAC, device signatures |
| `dashboard` | `dashboard-summary`, `dashboard-site-scope-policy` | Aggregated KPIs for operators |
| `topology` | `topology-admin.service` | Sites, gates, lanes, devices CRUD |
| `subscriptions` | `admin-subscriptions` | Subscription lifecycle, bulk import |
| `reconciliation` | `run-reconciliation`, spot occupancy | Occupancy tracking, ghost presence |
| `incidents` | `incident-service`, `incident-noise-policy` | Incident lifecycle, noise suppression |
| `presence` | `ingest-zone-presence-event` | Real-time zone occupancy |
| `parking-live` | `list-parking-live-board`, `get-parking-live-summary` | Live spot board |
| `webhooks` | `webhook.service` | B2B outbound delivery |
| `media` | `media-storage.service` | Image upload, thumbnail generation |
| `bulk-import` | `bulk-import.service` | File-based bulk operations |
| `edge` | `replay-edge-read` | Edge node bulk sync |
| `users` | `user-management.service` | User lifecycle |
| `customers` | `customer-management.service` | Customer/tenant management |
| `system` | `sql-surface.service` | Operational SQL queries |

## Key Architectural Patterns

### 1. Contract-First Monorepo (ADR-001)
- `packages/contracts` — single source of truth for Zod schemas + types
- Both `apps/api` and `apps/web` import from contracts
- Prevents backend/frontend drift
- API route modules in `apps/api/src/modules/*/interfaces/http/` conform to contracts

### 2. Outbox Pattern (ADR-003)
- Business write + outbox insert in same Prisma `$transaction`
- Return HTTP 2xx immediately
- BullMQ worker processes outbox asynchronously
- Failures: exponential backoff -> DLQ
- Webhook delivery: HMAC-SHA256 signed, logged to `webhook_deliveries`

### 3. Redis-First Coordination (ADR-004)
- Lane lock: `SETNX` + Redlock before opening sessions
- Fast-fail idempotency keys
- Cache: ALPR preview cache, mobile pairing state
- Session: user sessions + rate limiting
- Graceful degradation where fallback logic exists

### 4. Snapshot + Delta (API.md rule)
- REST endpoints = canonical state source
- SSE = delta transport only (never replace snapshot)
- Frontend: hydrate from REST first, then merge SSE deltas

### 5. Decision Engine (`gate/decision-engine.ts`)
- ALPR confidence scoring
- Subscription lookup
- Anti-passback enforcement
- Tariff pre-projection (not runtime calculation)
- Barrier latency target: <200ms

### 6. Three Auth Planes (ADR-005)
- User auth (JWT + Redis session) — web console
- Device-signed auth (HMAC) — capture/heartbeat
- Internal service auth (rotating secrets) — system-to-system

## Data Flow

### Entry Flow
```
ALPR camera detects vehicle
-> POST /api/lane-flow/submit (device-signed)
-> Decision engine (confidence check)
  -> High confidence: auto-open barrier
  -> Low confidence: create review item, put in queue
-> Session created in MySQL + outbox event
-> SSE delta to web consoles
```

### Exit Flow
```
ALPR camera detects vehicle
-> POST /api/lane-flow/submit
-> Decision engine: tariff lookup (pre-projected)
-> Barrier opens
-> Session resolved
-> Outbox: webhook to B2B if needed
```

### Review Flow
```
Supervisor opens Review Queue
-> POST /api/gate-review-queue/:reviewId/claim (prevents race)
-> View plate images, candidates
-> Approve / Reject / Manual-open
-> Audit log written
-> Session state updated
```

## Migration Strategy
- Flyway CLI for schema migrations
- `db/migrations/` directory
- `prisma db pull` + `prisma generate` for schema sync
- Seed scripts: `seed-min`, `seed-big`, `seed-enterprise`, `seed-reset`

## Worker Architecture
- BullMQ workers in `apps/api/src/worker/`
- Processors: outbox, DLQ, ghost-presence-purge (nightly cron)
- Dev mode: `pnpm worker:dev`
- Separate from API process

## Summary

Parkly follows a clean domain-driven modular architecture with clear bounded contexts. The outbox pattern, Redis coordination, and three auth planes are well-implemented. The snapshot+delta SSE rule and contract-first approach are good practices. The main architectural risk is the Node version conflict between rules and CI.

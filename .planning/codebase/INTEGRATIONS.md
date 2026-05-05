# Integrations — Parkly Codebase

**Analyzed:** 2026-05-05
**Focus:** External services, APIs, and integration patterns

## Database

- **MySQL 8.4** — primary relational store for all operational data
  - Managed via Flyway migrations in `apps/api/db/migrations`
  - Prisma ORM with Mariadb adapter
  - BIGINT internal keys (per ADR-006)
- **MongoDB 7** — included as driver, appears to be for legacy/ext purposes (not primary store)

## Cache & Coordination

- **Redis 7** (ioredis client)
  - Session storage
  - Distributed locking (Redlock pattern)
  - Rate limiting
  - Idempotency keys (SETNX fast-fail)
  - ALPR preview cache (`alpr-preview-cache.ts`)
  - Mobile pairing state
  - Presence tracking

## Object Storage

- **MinIO** (S3-compatible)
  - Media capture storage (plate images, thumbnails)
  - Bucket auto-healing via `pr13-minio-bucket-autoheal.test.ts`
  - Configured in `docker-compose.local.yml` under `storage` profile

## External Integrations

### B2B Webhooks
- Outbound webhook delivery via BullMQ
- HMAC-SHA256 signature on `X-Parkly-Signature`
- Delivery tracking in `webhook_deliveries` table
- Exponential backoff, DLQ for terminal failures
- Configurable via `/api/integrations/webhooks`

### Edge Node
- Store-and-Forward pattern for ISP outage survivability
- Bulk sync endpoint: `POST /api/edge/sessions/bulk-sync`
- Active subscriptions synced to local SQLite every 5 minutes
- Local barrier decision during cloud outage

### ALPR (Automatic License Plate Recognition)
- Preview cache (Redis)
- Recognition endpoints: `/api/alpr/preview`, `/api/alpr/recognize`
- Decision engine uses ALPR confidence for auto-approve/reject

## Auth Planes (3 separate trust domains)

### 1. User Auth (web console)
- Custom JWT + Redis session
- Routes: login, refresh, logout, revoke-all, admin user management
- Session limits, forced global eviction
- Password policy enforcement

### 2. Device-Signed Auth (capture/heartbeat)
- HMAC signed requests with timestamp + signature version
- Device code in request
- Replay detection, rotation audit

### 3. Internal Service Auth
- Rotating secrets
- Active/next rotation support
- Included in secret-safety reporting

## Payment

- VietQR webhook confirmation support (mentioned in SKILL.md tariff projection)
- Tariff projection pre-calculation (not runtime parsing)
- Barrier latency target: <200ms

## Observability

- **Prometheus** metrics (`/metrics`)
- `GET /api/ops/metrics/summary` — latency budgets, traffic/error buckets, incident counters, secret safety rollup
- **Grafana** dashboards in `apps/api/docs/grafana-dashboards/`
- Pino structured logging
- SSE streams for realtime delta

## No External Dependencies For

- Auth (no Firebase, no Passport)
- Database (no PlanetScale, no Supabase)
- Queue (no SQS, no Kafka — uses BullMQ + Redis)

## Summary

Parkly integrations are self-contained: MySQL + Redis + MinIO cover persistence, coordination, and storage. Auth is home-grown. No vendor lock-in for critical paths. B2B webhooks are the primary external delivery mechanism. Edge nodes provide local survivability during cloud outages.

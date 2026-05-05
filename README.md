# Parkly — Parking Operations Command Center

Parkly là hệ thống điều hành bãi giữ xe cho nhân viên cổng, giám sát và admin. Nó tập trung vào xe vào/ra, duyệt biển số (ALPR), trạng thái làn/camera, xe đang trong bãi, audit trail, và đồng bộ sự kiện bền vững qua outbox.

Parkly is a parking operations command center for gate operators, supervisors, and admins. It manages entry/exit sessions, ALPR-assisted review, live lane health, active occupancy, audit trails, and resilient outbox delivery.

## What It Does

```
Guard scans plate → System creates session → High confidence: auto-open barrier
                                         → Low confidence: review queue → Supervisor approves → Barrier opens
Vehicle exits → Session resolved → Audit + outbox events delivered
```

## Core Workflows

| Workflow | Description |
|----------|-------------|
| **Run Lane** | Primary workspace: select site/gate/lane, submit entry or exit capture |
| **Review Queue** | Supervisor reviews low-confidence captures, approves/rejects in seconds |
| **Session History** | Full audit trail with timeline, media, and decision context |
| **Device Health** | Live camera/lane status with heartbeat monitoring |
| **Outbox Monitor** | B2B webhook delivery status, DLQ failures, retry backlog |

## Architecture

```
[Guard Console / Mobile] ──HTTPS──> [Express API]
                                   │
                     ┌─────────────┼─────────────┐
                     │             │             │
                   MySQL         Redis        BullMQ
                  (Prisma)    (Redlock)    (Outbox)
                     │             │             │
                     └─────────────┼─────────────┘
                                   │
                             [SSE Streams]
                                   │
                          [React SPA Console]
```

Key patterns: outbox pattern for resilient external delivery, snapshot REST + SSE delta for real-time state, Redis Redlock for lane coordination, three auth planes (user JWT, device HMAC, service secrets).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 22 LTS, Express 4, TypeScript (Strict) |
| Database | Prisma 7 ORM, MySQL 8.x |
| Cache/Queue | Redis 7, BullMQ |
| Frontend | React 18, Vite, TanStack Query, Zustand, React Router v6 |
| Shared | `@parkly/contracts` (Zod schemas), `@parkly/gate-core` |
| E2E | Playwright |

## Structure

- `apps/api` — Express API, worker, Flyway migrations, Prisma schema
- `apps/web` — React/Vite operations console
- `packages/contracts` — shared Zod transport contracts (single source of truth)
- `packages/gate-core` — shared gate decision / domain helpers
- `docs` — API contract, ADRs, runbook, evidence requirements

## Quickstart

```bash
# 1. Copy env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 2. Install
pnpm install

# 3. Start infrastructure
docker compose -f infra/docker/docker-compose.local.yml up -d mysql redis

# 4. Setup database
pnpm --dir apps/api db:migrate
pnpm --dir apps/api db:grant:app
pnpm --dir apps/api db:seed:min

# 5. Run
pnpm dev:api        # Terminal 1: API on :3000
pnpm --dir apps/api worker:dev  # Terminal 2: BullMQ worker
pnpm dev:web       # Terminal 3: Web console on :5173
```

## Entry Points

| URL | Purpose |
|-----|---------|
| `http://127.0.0.1:5173/` | Web console |
| `http://127.0.0.1:3000/docs` | Swagger API docs |
| `http://127.0.0.1:3000/openapi.json` | OpenAPI spec |
| `http://127.0.0.1:3000/metrics` | Prometheus metrics |

## Demo Accounts

| Role | Username | Password | Default Route |
|------|----------|----------|---------------|
| SUPER_ADMIN | `admin` | `Parkly@123` | /overview |
| MANAGER | `manager` | `Parkly@123` | /review-queue |
| OPERATOR | `ops` | `Parkly@123` | /run-lane |
| GUARD | `guard` | `Parkly@123` | /run-lane |

## Quality Gates

```bash
pnpm test:full       # Canonical release gate: typecheck + unit + e2e + i18n
pnpm typecheck:api   # API TypeScript strict
pnpm typecheck:web   # Web TypeScript strict
pnpm --dir apps/web build:web  # Production bundle (must pass before release)
```

CI runs: quality gate, Flyway migration validation, npm audit, dependency review, CodeQL.

## Evidence & Docs

- `docs/PARKLY_GOLDEN_PATH.md` — 3-min + 10-min demo walkthrough
- `docs/API.md` — API contract, envelopes, auth planes, SSE hydration rules
- `docs/ADR.md` — Architecture decision records
- `docs/EVIDENCE.md` — Release evidence requirements
- `.planning/` — GSD project planning (roadmap, requirements, audit)

## Roadmap

7 phases: Truth Alignment → Golden Path → IA/Role Workflow → Industrial Ops UI → Contract Hardening → Playwright Evidence → Portfolio Packaging.

See `.planning/ROADMAP.md` for full phase details.

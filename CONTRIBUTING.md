# Contributing to Parkly

Welcome! This guide gets you from zero to running in **under 15 minutes**.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | ≥ 20.x | `node -v` |
| pnpm | ≥ 9.x | `pnpm -v` |
| Docker + Compose | ≥ 24.x | `docker compose version` |
| MySQL | 8.0+ (via Docker) | auto |
| Redis | 7.x (via Docker) | auto |
| Git | ≥ 2.40 | `git -v` |

## Quick Start (< 15 min)

```bash
# 1. Clone & install
git clone <repo-url> parkly && cd parkly
pnpm install

# 2. Start infrastructure (MySQL + Redis + MinIO)
docker compose -f infra/docker/docker-compose.platform.yml up -d

# 3. Configure environment
cp apps/api/.env.example apps/api/.env
# Edit .env: set DATABASE_URL, REDIS_URL, JWT secrets

# 4. Run migrations + seed
cd apps/api
pnpm db:migrate
pnpm db:seed:min

# 5. Generate Prisma client
pnpm prisma:generate

# 6. Start dev servers (2 terminals)
pnpm dev              # API → http://localhost:3000
cd ../web && pnpm dev # Web → http://localhost:5173

# 7. Verify
curl http://localhost:3000/health
```

### Default Credentials (Demo only)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `Admin@123` | SUPER_ADMIN |

## Verify Setup Script

```bash
# Run all checks at once
pnpm --dir apps/api typecheck     # TypeScript compilation
pnpm --dir apps/api test:vitest   # Unit tests (55 tests)
pnpm --dir apps/web build         # Frontend build
```

## Project Structure

```
parkly/
├── apps/
│   ├── api/              # Express API (Node.js + TypeScript)
│   │   ├── src/
│   │   │   ├── modules/  # Domain modules (auth, gate, parking, etc.)
│   │   │   ├── server/   # Express setup, middleware, metrics
│   │   │   ├── lib/      # Shared utilities (Redis, Prisma, events)
│   │   │   └── tests/    # Test suites (node:test + Vitest)
│   │   └── db/migrations/# SQL migrations (V1–V32)
│   └── web/              # React SPA (Vite + TypeScript)
│       └── src/
│           ├── features/  # Feature modules (overview, topology, review-queue)
│           ├── components/# Shared UI components
│           └── pages/     # Route pages
├── packages/
│   ├── gate-core/        # Decision engine, plate parser (shared logic)
│   └── contracts/        # Shared TypeScript types
├── services/
│   └── alpr/             # Python ALPR microservice
└── infra/
    └── docker/           # Docker Compose files
```

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  React SPA (web)                │
│   ReactFlow │ Radix UI │ Sonner │ Recharts      │
└─────────────┬───────────────────────────────────┘
              │ REST + SSE
┌─────────────▼───────────────────────────────────┐
│               Express API (api)                 │
│  ┌──────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Auth │ │  Gate   │ │ Parking  │ │ Topology │ │
│  └──┬───┘ └───┬────┘ └────┬─────┘ └────┬─────┘ │
│     │    Domain Events Bus │            │       │
│  ┌──▼─────────▼────────────▼────────────▼─────┐ │
│  │        Infrastructure Layer                │ │
│  │  Prisma │ Redis │ BullMQ │ MinIO           │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
              │         │         │
          ┌───▼──┐  ┌───▼──┐  ┌──▼───┐
          │MySQL │  │Redis │  │MinIO │
          └──────┘  └──────┘  └──────┘
```

## Development Workflow

### Branch Naming

```
feat/gate-anti-passback
fix/plate-ocr-dash-handling
docs/adr-003-derived-gates
refactor/review-queue-decompose
```

### Commit Messages (Conventional)

```
feat(gate): add anti-passback detection for ENTRY
fix(plate): handle Vietnamese Đ in NFKC normalization
test(decision): add 19-path coverage for evaluateGateDecision
docs(adr): document outbox pattern rationale
```

### Testing

```bash
# Existing node:test suite (42 files)
pnpm --dir apps/api test:pr01     # Redis foundation
pnpm --dir apps/api test:pr02     # Plate core (50+ tests)

# New Vitest suite
pnpm --dir apps/api test:vitest   # Decision engine + errors + events

# Frontend
pnpm --dir apps/web build         # Type-check + build
```

### Key Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API dev server |
| `pnpm typecheck` | TypeScript type-checking |
| `pnpm test:vitest` | Run Vitest tests |
| `pnpm test:vitest:watch` | Watch mode |
| `pnpm db:migrate` | Run DB migrations |
| `pnpm prisma:generate` | Regenerate Prisma client |

## Code Standards

1. **TypeScript Strict** — `noEmit` must pass, no `as any` in business logic
2. **Component size** — max 200 lines per component, extract hooks for state
3. **Error handling** — use `NotFoundError`, `BusinessRuleError`, etc. from `server/errors.ts`
4. **Multi-tenancy** — all queries must include site scope (`assertSiteAccess()`)
5. **Metrics** — instrument new endpoints via `observeOperation()` in `metrics.ts`
6. **Events** — emit domain events for state changes via `domainEvents.emit()`

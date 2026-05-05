# Stack — Parkly Codebase

**Analyzed:** 2026-05-05
**Focus:** Technology stack and external integrations

## Language & Runtime

- **TypeScript 5.9** (strict mode) — all packages, strict compiler settings
- **Node.js** — conflict detected: `.cursorrules` mandates `20 LTS`, CI (`ci.yml`) sets `NODE_VERSION: '22'`. Pick one and enforce.
- **pnpm 10** — package manager, workspace monorepo via `pnpm-workspace.yaml`

## Backend (`apps/api`)

| Layer | Technology |
|-------|-----------|
| HTTP framework | Express 4 |
| ORM | Prisma 7 (with `@prisma/adapter-mariadb` adapter) |
| Database | MySQL 8.4 |
| Redis client | ioredis 5 |
| Job queue | BullMQ 5 |
| Auth | Custom JWT + Redis session (no Firebase, no Passport) |
| Validation | Zod 4 + `zod-to-json-schema` |
| HTTP client (webhooks) | axios |
| File/media storage | MinIO (S3-compatible) via `@aws-sdk/client-s3` |
| Image processing | sharp |
| Logging | pino + pino-http |
| Metrics | prom-client |
| Rate limiting | express-rate-limit |
| Security headers | helmet |
| API docs | swagger-ui-express + OpenAPI |
| Migrations | Flyway CLI 12 |
| Database driver | mariadb (for Prisma adapter) |
| Additional stores | MongoDB 7 (used in `mongodb` driver for legacy/ext purposes) |
| File upload | multer |

### Dev tooling (api)
- **tsx** — TypeScript execution
- **vitest** — unit tests
- **cross-env** — env var normalization

## Frontend (`apps/web`)

| Layer | Technology |
|-------|-----------|
| UI framework | React 18 |
| Build tool | Vite 5 |
| State (server) | TanStack Query 5 |
| State (client) | Zustand 5 |
| Routing | React Router v6 |
| HTTP client | (inferred from contracts package usage) |
| i18n | i18next + react-i18next |
| UI primitives | Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-scroll-area`, etc.) |
| Styling | Tailwind CSS 3 + `tailwind-merge` + `clsx` + `cva` |
| Icons | Lucide React |
| Graphs/flows | `@xyflow/react` (React Flow) + `dagre` |
| Toast notifications | Sonner |
| E2E testing | Playwright |
| Unit testing | Vitest + Testing Library |

## Shared Packages

### `packages/contracts`
- Zod schemas for transport contracts
- Auth types (`AuthRole`, etc.)
- Shared response envelope types
- Consumed by both `apps/api` and `apps/web`
- `zod ^4.3.6` — note: api uses `^4.3.6`, web likely inherits

### `packages/gate-core`
- Gate decision / domain helpers
- Shared plate parsing, decision logic
- Also Zod-based

## Infrastructure (`infra/docker`)

- `docker-compose.local.yml` — local dev profile
  - MySQL 8.4
  - Redis 7.4-alpine
  - MinIO (storage profile)
  - Prometheus (observability profile)
  - Alertmanager (observability profile)
  - Grafana (observability profile)

## CI/CD

- GitHub Actions (`ci.yml`, `codeql.yml`)
- Runs: quality gate, migration validation, security audit, dependency review
- `pnpm test:full` is the canonical release gate

## Key Dependency Conflicts

1. **Node version**: `.cursorrules` says `20 LTS`, CI uses `22`. Must resolve.
2. **Zod**: API uses `^4.3.6`, contracts package uses `^4.3.6` — aligned. Frontend may need checking.
3. **path-to-regexp**: overridden in root `package.json` for `0.1.12 -> 0.1.13` and `8.3.0 -> 8.4.0` — version mismatch handling present.

## Summary

Parkly has a well-defined, modern TypeScript monorepo stack. Backend is Express + Prisma + BullMQ. Frontend is React + Vite + TanStack Query + Zustand. Shared contracts via packages. Infrastructure is Docker-based with MySQL, Redis, MinIO, Prometheus stack.

**Critical action:** Resolve Node version conflict between `.cursorrules` (20) and CI (22).

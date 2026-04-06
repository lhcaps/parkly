# Parkly — Gate Operations Monorepo

Monorepo này đã được cutover từ legacy gate-events flow sang operations console đầy đủ hơn: session orchestration, decision engine, entry/exit workflow, review queue, SSE health feeds, outbox monitor và evidence pack.

## Structure

- `apps/api` — Express API, worker, Flyway, Prisma, operational scripts
- `apps/web` — React/Vite operations console
- `packages/contracts` — shared Zod contracts/types
- `packages/gate-core` — shared gate decision / domain helpers
- `docs` — runbook, API surface, evidence pack, archive patch notes

## Quickstart

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm install
cd apps/api
pnpm db:migrate
pnpm prisma:pull
pnpm db:grant:app
pnpm db:seed:min
pnpm dev
```

Terminal khác:

```bash
cd apps/api
pnpm worker:dev
```

Terminal khác nữa:

```bash
cd apps/web
pnpm dev
```

## Main entry points

- API docs: `http://127.0.0.1:3000/docs`
- OpenAPI JSON: `http://127.0.0.1:3000/openapi.json`
- Metrics: `http://127.0.0.1:3000/metrics`
- Web console: `http://127.0.0.1:5173/`

## Operator docs

- `docs/RUNBOOK.md`
- `docs/API.md`
- `docs/EVIDENCE.md`
- `docs/README.md`

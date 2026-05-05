# Parkly Setup

This file is the short local bootstrap path. Keep it aligned with real scripts, not hand-written ceremony.

## Prerequisites

- Node.js 22.x
- pnpm 10.x
- Docker Desktop

## First run

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm install
pnpm --dir apps/api compose:up:local
pnpm --dir apps/api db:migrate
pnpm --dir apps/api db:grant:app
pnpm --dir apps/api db:seed:min
```

## Start the stack

Terminal 1:

```bash
pnpm dev:api
```

Terminal 2:

```bash
pnpm --dir apps/api worker:dev
```

Terminal 3:

```bash
pnpm dev:web
```

## Verify

- Web: `http://127.0.0.1:5173`
- API docs: `http://127.0.0.1:3000/docs`
- Health: `http://127.0.0.1:3000/api/health`
- Metrics: `http://127.0.0.1:3000/metrics`

Demo login for local smoke usually uses `ops / Parkly@123`.

## Common commands

```bash
pnpm --dir apps/api smoke:bundle
pnpm --dir apps/web test:unit
pnpm --dir apps/web test:e2e
pnpm test:full
```

## Canonical docs

- `README.md`: repository overview
- `docs/RUNBOOK.md`: operator runbook
- `apps/api/docs/RUNBOOK.md`: backend-specific runbook
- `docs/API.md`: contract summary
- `services/alpr/README.md`: optional ALPR service

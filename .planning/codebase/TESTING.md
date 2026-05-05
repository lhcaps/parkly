# Testing — Parkly Codebase

**Analyzed:** 2026-05-05
**Focus:** Test framework, structure, mocking, coverage expectations

## Backend Tests (`apps/api`)

### Framework: Vitest
- `vitest run` for CI
- `vitest` (watch mode) for dev
- Coverage via `@vitest/coverage-v8`
- Coverage artifact: `apps/api/coverage/vitest`

### Node-level Tests
- `node --import tsx --test` pattern
- For tests requiring full runtime (Redis, DB)
- Run via `scripts/run-node-tests.mjs`

### PR Regression Tests
Pattern: `test:pr{NN}` — numbered PR regression tests (pr01 through pr39)

| Test | Focus |
|------|-------|
| `pr01-redis-foundation` | Redis connectivity |
| `pr02-shared-plate-core` | Plate parsing core |
| `pr04-capture-auth-idempotency` | Capture auth + idempotency |
| `pr06-decision-engine` | Decision logic |
| `pr10-mobile-pairing-redis` | Mobile pairing state |
| `pr11-alpr-preview-redis-cache` | ALPR preview cache |
| `pr12-outbox-bullmq` | Outbox + BullMQ |
| `pr13-minio-bucket-autoheal` | MinIO bucket healing |
| `pr17-internal-presence-intake` | Presence ingestion |
| `pr18-reconciliation-engine` | Reconciliation logic |
| `pr19-incident-workflow` | Incident lifecycle |
| `pr20-auth-rbac` | Auth + RBAC |
| `pr21-contract-freeze` | API contract adherence |
| `pr22-dashboard-summary` | Dashboard read model |
| `pr23-audit-hardening` | Audit trail completeness |
| `pr24-incident-noise-control` | Incident noise suppression |
| `pr25-release-hardening` | Release gate smoke |
| `pr26-security-layer2` | Security layer 2 |
| `pr27-observability` | Metrics + logging |
| `pr28-retention-cleanup` | Retention policy |
| `pr29-deployment-profile` | Deployment profiles |
| `pr30-backup-restore` | Backup + restore |
| `pr31-final-rc-gate` | Final RC gate |
| `pr32-secret-hygiene` | Secret hygiene rules |
| `pr33-secret-rotation` | Secret rotation |
| `pr34-secret-safety-observability` | Secret safety metrics |
| `pr35-pilot-gate` | Pilot readiness |
| `pr36-quality-gate-regression` | Quality gate regression |
| `pr37-minio-bucket-autoheal` | MinIO bucket autoheal |
| `pr38-subscription-customer-reference` | Subscription refs |
| `pr39-core-stabilization` | Core stabilization |

### Smoke Tests (Release Gate)
- `smoke/pr25-release-hardening.test.ts`
- `smoke/rc1-release-consolidation.test.ts`

### Vitest Unit Tests
- `tests/domain-events-tenancy.vitest.ts`
- `tests/decision-engine.vitest.ts`
- `tests/error-hierarchy.vitest.ts`
- `tests/sse-envelope-contract.test.ts` (pr14)

### Scripts
- `scripts/run-node-tests.mjs` — runs all node-level tests
- `scripts/smoke-backend.ts` — backend smoke test
- `scripts/e2e-api.ts` — API E2E smoke

### Release Gate (`rc:gate`)
```bash
typecheck && test:pr20 && test:pr21 && test:pr22 && test:pr23 && test:pr24 && test:pr25 && release:reset && smoke:bundle
```

## Frontend Tests (`apps/web`)

### Framework: Vitest + Testing Library
- `vitest run` — unit tests
- `vitest run --coverage` — with coverage
- Coverage artifact: `apps/web/coverage/unit`

### E2E: Playwright
- `scripts/run-playwright-e2e.mjs` — E2E runner
- `playwright.config.ts` — config
- `playwright/tests/` — test specs
- `playwright install chromium` — runtime install
- Report: `apps/web/playwright-report/`
- Results: `apps/web/test-results/`
- Built artifact tests: `apps/web/dist/` (ADR-007: must test built SPA, not dev server)

### Frontend Unit Tests
- `pages/__tests__/` — page-level tests
- `features/*/__tests__/` — feature tests
- `app/__tests__/` — route auth tests

### Smoke Tests
- `smoke:web` — smoke against built dist
- `smoke:web:dev` — smoke against dev server
- `smoke:web:dist` — smoke against built dist (no server start)

### Role Policy Tests
```bash
pnpm --dir apps/web test:smoke:auth-routes
# Runs: vitest run src/app/__tests__/role-policy.test.ts src/features/auth/__tests__/auth-redirect.test.ts
```

## Root Level Tests

```bash
pnpm test:full    # Canonical release gate — runs quality gate
pnpm test:ci      # CI mode — runs quality gate with CI settings
```

Quality gate (`scripts/run-quality-gate.mjs`):
1. Typecheck API
2. Typecheck Web
3. API unit tests + coverage
4. Web unit tests + coverage
5. Web E2E (Playwright against built artifact)
6. Web smoke test
7. i18n validation

## Evidence Collection

```bash
pnpm --dir apps/web evidence:web   # Collects screenshots, reports
```

Output: `apps/web/docs/frontend/evidence/`

## CI Integration

GitHub Actions `ci.yml` runs:
1. i18n validation (Python scripts)
2. `pnpm install --frozen-lockfile`
3. `pnpm test:full` (quality gate)
4. Playwright runtime install
5. Migration validation (Flyway)
6. Security audit (npm audit)
7. Dependency review

## Summary

Testing is comprehensive at the PR level (40+ regression tests) with clear smoke and release gates. ADR-007 (test built artifact, not dev server) is enforced. Playwright E2E exists but evidence coverage should be verified against the golden path. Coverage artifacts are produced. Main gap: Playwright tests should cover the actual golden path (Run Lane -> Entry -> Review -> Exit).

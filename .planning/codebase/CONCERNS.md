# Concerns — Parkly Codebase

**Analyzed:** 2026-05-05
**Focus:** Technical debt, known issues, security, performance, fragile areas

## CRITICAL: Node Version Conflict

- **`.cursorrules`** mandates: `Node.js 20 LTS`
- **`.github/workflows/ci.yml`** sets: `NODE_VERSION: '22'`
- **Impact**: GitHub Actions runs on Node 22, not the declared 20. Local dev environments may also run 22. This is a rule/doc CI mismatch that signals the project has governance drift.
- **Risk**: Medium — CI passes on 22, but rules say 20. Devs may be confused.
- **Action**: Pick one. Recommended: align CI to 20 (or bump .cursorrules to 22 if 22 is intentional).

## HIGH: Legacy Page Files Still Present

The following pages exist as files but are likely dead code (legacy redirect targets that route elsewhere):
- `GatePage.tsx`
- `DevicesPage.tsx`
- `DashboardPage.tsx`
- `GateEventsMonitorPage.tsx`

These are referenced in `LEGACY_ROUTE_REDIRECTS` in `routes.tsx`. They should either be:
1. Deleted if truly dead
2. Formally documented as "archive pages kept for backward compat"

**Risk**: Dead code in codebase confuses navigation audit and UI review phases.

## MEDIUM: SKILL.md is a Manifesto, Not a Skill

`SKILL.md` (2,800+ words) reads like an architecture manifesto, not a reusable skill document. It mixes:
- Technical patterns (outbox, idempotency, Redlock)
- Domain rules (anti-passback, tariff projection)
- Product context (ALPR, edge fallback)

This is excellent as a design document. But as an AI skill, it's too heavy. The `.cursorrules` file already covers the same ground more concisely.

**Risk**: Low immediate impact, but contributes to "enterprise bloat" in documentation.

## MEDIUM: Role Policy is Dense

`role-policy.ts` has 16 action policies + 16 route policies + 7 nav groups + 7 role home preferences. This is well-structured but complex. When Phase 2 (IA + Role Workflow) touches navigation, the policy file will need careful surgical changes.

**Risk**: High coupling between routing and policy. Changes must be coordinated.

## MEDIUM: Frontend Route Preload May Cause Performance Issues

`ROUTE_PRELOADS` in `routes.tsx` preloads 4-5 pages for every route. On slow connections or mobile, this could cause bundle bloat or unnecessary fetches. This should be reviewed in Phase 3.

## MEDIUM: i18n Schema Validation

i18n uses a Python script (`scripts/i18n-safe-edit.py`) for safe JSON editing. The schema is `i18n.locale.schema.json`. This is unconventional — most React projects use a JavaScript/TypeScript-based i18n setup. It works, but adds a toolchain dependency.

**Risk**: Non-standard. Any new i18n contributor needs to learn the Python script.

## MEDIUM: Multiple Docker Compose Files

`infra/docker/` has `docker-compose.local.yml` with profiles. But there may be other compose files (the `docker-compose.platform.yml` referenced in api scripts). Need to verify only one compose file is the source of truth.

## LOW: Prisma 7 with Mariadb Adapter

Prisma 7 with `@prisma/adapter-mariadb` is a relatively new combination. Prisma's MariaDB adapter maturity should be monitored. Check `prisma/adapter-mariadb` release notes and test coverage for edge cases.

## LOW: MongoDB Driver Present But Unclear Role

`mongodb ^7.1.0` is in dependencies but its usage is not immediately obvious from the codebase map. If it's for legacy data only, it should be flagged as deprecated or removed.

## LOW: Bulk Import Returns HTTP 202

Bulk import follows the correct pattern (file -> MinIO -> job enqueue -> 202 Accepted -> poll job status). But job progress polling needs frontend implementation. Verify the frontend actually polls `/api/admin/jobs/:jobId` with progress rendering.

## LOW: Ghost Presence Purge is Nightly Cron

The `ghost-presence-purge` BullMQ cron job runs at 02:00 AM. For demo/pilot environments with fast iteration, this means ghost presence could accumulate during the day. Not a bug, but worth noting for Phase 1 demo stability.

## LOW: SSE Hydration Order Not Enforced in Code

The API docs say "hydrate from REST, then merge SSE delta" but there's no runtime enforcement. A careless future developer could treat SSE as the source of truth. Consider adding a test that verifies this invariant.

## INFO: No .env File in Repo

`.env.example` files exist (`apps/api/.env.example`, `apps/web/.env.example`) but no actual `.env` files. This is correct — secrets should not be committed. But the seed demo accounts need to be discoverable.

## INFO: Evidence Pack Structure

Evidence collection scripts exist (`evidence:web`, `collect-evidence.mjs`) but the structure and actual coverage of Playwright tests against the golden path needs verification. Phase 5 of the roadmap addresses this.

## Summary of Priority Actions

1. **Resolve Node version** — CRITICAL (5 min fix, prevents governance drift)
2. **Audit legacy pages** — HIGH (determine dead vs alive)
3. **Verify Playwright golden path coverage** — MEDIUM (Phase 5 addresses)
4. **Review SSE hydration discipline** — MEDIUM (add test or document)
5. **Clarify MongoDB role** — LOW (could be removed if legacy only)

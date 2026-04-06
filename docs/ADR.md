# Parkly Architecture Decision Records

Last reviewed: 2026-03-30
Status legend: accepted unless otherwise noted

## ADR-001: Contract-first monorepo

Date: 2026-03-30

Decision:

- Shared transport contracts live in `packages/contracts`.
- Backend and web both consume the same Zod-defined canonical schemas.
- Route behavior, RBAC, and frontend page access must align with those shared contracts.

Why:

- Prevent backend and frontend drift.
- Keep API, UI route policy, and test fixtures synchronized.
- Make CI failures surface real contract mismatches instead of integration guesswork.

## ADR-002: Profile-based deployment bootstrap

Date: 2026-03-30

Decision:

- Deployment preparation is profile-driven through `local-dev`, `demo`, and `release-candidate`.
- Bootstrap and verification are executable through repository scripts, not tribal runbooks.
- The quality gate may reuse already-running dependencies when verification proves they are healthy.

Why:

- Reduces environment drift.
- Makes CI and local release rehearsal converge on the same flow.
- Allows deterministic setup for Playwright and integration checks.

## ADR-003: Outbox over inline external delivery

Date: 2026-03-30

Decision:

- Business writes commit first.
- External delivery is staged through `gate_event_outbox` and related delivery tracking.

Why:

- Preserves transactional correctness.
- Prevents slow downstream targets from blocking lane operations.
- Creates measurable backlog, retry, and failure signals.

## ADR-004: Redis-first coordination with graceful fallback

Date: 2026-03-30

Decision:

- Lane coordination, selected caches, and queue orchestration use Redis first.
- Critical gate behavior degrades gracefully when Redis is unavailable where fallback logic exists.

Why:

- Lower contention than database-only locking.
- Better fit for distributed coordination and short-lived operational state.
- Metrics can expose lock wait time, cache misses, and Redis health directly.

## ADR-005: Canonical user auth separated from device and internal auth

Date: 2026-03-30

Decision:

- User sessions use dedicated auth routes and role-aware session policy.
- Device capture and device upload use signed request verification.
- Internal service integration uses its own rotating secret model.
- Legacy role tokens remain compatibility-only, not the primary enterprise path.

Why:

- Different callers have different trust boundaries.
- Rotation, replay defense, and auditability are easier when auth planes are separated.
- Prevents mobile or device failures from being treated as normal user-session failures.

## ADR-006: BIGINT internal keys with external string identifiers

Date: 2026-03-30

Decision:

- Internal relational joins use `BIGINT` primary keys.
- External APIs expose stable string identifiers where appropriate.

Why:

- Better InnoDB locality and smaller indexes.
- Faster joins and simpler migration evolution for high-churn relational tables.

## ADR-007: Deterministic release gate must test the built web artifact

Date: 2026-03-30

Decision:

- Unit tests alone are insufficient for release sign-off.
- Web E2E must run against the built SPA artifact, not only against a dev server.
- The root gate is `pnpm test:full`.

Why:

- Production bundle regressions are different from hot-reload development failures.
- The repository already had production-only issues that only surfaced during built-asset E2E.
- This approach gives one canonical release command for CI and local validation.

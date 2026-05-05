# Parkly — Project Context

## What This Is

Parkly is a parking operations command center for gate operators, supervisors, and admins. It manages entry/exit sessions, ALPR-assisted review, live lane health, active occupancy, audit trails, and resilient outbox delivery.

Tiếng Việt: Parkly là hệ thống điều hành bãi giữ xe cho nhân viên cổng, giám sát và admin, tập trung vào xe vào/ra, duyệt biển số, trạng thái làn/camera, xe đang trong bãi, audit và đồng bộ sự kiện bền vững.

## Core Value

A guard can process a vehicle entry and exit through the Run Lane screen in under 30 seconds, with confidence-based routing to human review. The system is the source of truth for gate state.

## Requirements

### Validated

Parkly has been built over multiple iterations (PR01–PR39) with the following capabilities verified in code:

- Gate session lifecycle: open, resolve, cancel, manual actions
- Decision engine: ALPR confidence scoring, subscription lookup, anti-passback
- Review queue: claim, approve, reject, manual-open with audit
- Outbox pattern: Prisma transaction + BullMQ + DLQ
- Three auth planes: user JWT, device HMAC, service secrets
- Redis coordination: idempotency, Redlock, cache
- Dashboard summary read model with site-scope policy
- Incident lifecycle with noise suppression
- Parking live board with occupancy tracking
- Topology admin: sites, gates, lanes, devices CRUD
- Subscription management with bulk import
- Audit trail for all manual gate actions
- B2B webhook delivery with HMAC signature
- Secret hygiene and rotation infrastructure
- MinIO media storage with bucket auto-heal
- Observability: Prometheus metrics, Grafana dashboards
- Edge node bulk sync for ISP outage survival
- Role-based access control: 7 roles, 16 routes, 16 action policies
- REST snapshot + SSE delta data hydration pattern
- RC1 HTTP envelopes: `{ requestId, data }` success, `{ requestId, code, message, details }` error
- Cursor-based pagination everywhere

### Active

- Phase 0 (Truth Alignment): Align docs, rules, CI, README to one source of truth
- Phase 1 (Golden Path): Prove the 3-minute demo works end-to-end
- Phase 2 (IA + Role Workflow): Organize navigation by ops workflow, role-aware defaults
- Phase 3 (Industrial Ops UI Taste): Make Run Lane the hero, ops-grade visual hierarchy
- Phase 4 (Contract + RBAC Hardening): Audit packages/contracts usage, API docs alignment
- Phase 5 (Playwright Evidence Pack): Golden path E2E with screenshots
- Phase 6 (One-command Demo): `pnpm parkly:setup`, `pnpm parkly:dev`, `pnpm parkly:demo`
- Phase 7 (Portfolio Packaging): README, screenshots, architecture diagram, CV packaging

### Out of Scope

- Mobile app (web-first, React SPA covers gate operations)
- Payment processing integration (tariff pre-projection exists; actual payment gateway out of scope)
- Multi-tenant SaaS isolation (single-tenant pilot focus)
- Native notification push (email/webhook-only for now)
- OAuth identity providers (custom JWT sufficient)

## Context

Parkly is a brownfield monorepo that evolved from a legacy gate-events system into a full operations console. It was built with enterprise discipline (ADR, contracts, RBAC, observability) but lacks a product narrative and demo proof. The codebase is technically mature but product-shy.

Key state from audit:
- No git repository (not yet initialized)
- No `.planning/` directory (created during this session)
- Node version conflict: `.cursorrules` says 20 LTS, CI uses 22
- Legacy page files exist but are dead code
- No golden path Playwright suite
- No demo script

## Constraints

- **Tech stack**: Node.js, Express 4, TypeScript, Prisma 7, MySQL 8, Redis 7, BullMQ, React 18, Vite — lock these. No substitution without explicit revision.
- **No `any`**: All inputs validated with Zod schemas.
- **Cursor pagination only**: No offset pagination anywhere.
- **Snapshot + SSE**: REST is canonical state. SSE is delta only.
- **Contract-first**: `packages/contracts` is the single source of truth for shared types.
- **Outbox for external delivery**: Never call third-party APIs synchronously in request handlers.
- **Built artifact test gate**: Playwright E2E must run against built `dist/`, not dev server.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Monorepo with shared contracts | Prevent backend/frontend drift | ADR-001 — Validated |
| Outbox over inline delivery | Transactional correctness, non-blocking | ADR-003 — Validated |
| Redis-first coordination | Low contention, distributed lock fit | ADR-004 — Validated |
| Three auth planes separated | Different trust boundaries | ADR-005 — Validated |
| BIGINT internal keys | InnoDB performance | ADR-006 — Validated |
| Test built artifact, not dev server | Catch production-only regressions | ADR-007 — Validated |
| Node version: 20 LTS vs 22 | Conflict between .cursorrules and CI | ⚠️ UNRESOLVED — must decide |
| SKILL.md as manifesto | Domain architecture guidance | ⚠️ TOO HEAVY — simplify or split |
| Golden path E2E | No end-to-end proof of the core flow | ⚠️ MISSING — Phase 5 addresses |

---

*Last updated: 2026-05-05 after initial GSD project initialization*

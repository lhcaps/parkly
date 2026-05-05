# State: Parkly

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-05)

**Core value:** A guard can process a vehicle entry and exit through Run Lane in under 30 seconds, with confidence-based routing to human review.

**Current focus:** Phase 0 — Truth Alignment & Planning Reset

---

## Milestone: v0.1.0 — Portfolio-Ready Baseline

Target: Repo is CV-ready with proven golden path, evidence pack, and one-command demo.

### Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 — Truth Alignment | `in_progress` | Creating .planning/ structure, resolving Node version, rewriting README |
| Phase 1 — Golden Path Product Slice | `pending` | Wait for Phase 0 |
| Phase 2 — IA & Role Workflow | `pending` | Wait for Phase 1 |
| Phase 3 — Industrial Ops UI | `pending` | Wait for Phase 1 |
| Phase 4 — Contract & RBAC Hardening | `pending` | Wait for Phase 2 |
| Phase 5 — Playwright Evidence | `pending` | Wait for Phase 3 |
| Phase 6 — One-command Demo | `pending` | Wait for Phase 1 |
| Phase 7 — Portfolio Packaging | `pending` | Wait for Phase 5 |

### Phase 0 Details

**Started:** 2026-05-05

**Checkpoints:**
- [x] Read codebase context (README, SKILL.md, .cursorrules, CI, docs, routes, role-policy)
- [x] Write .planning/codebase/ map (7 documents)
- [x] Write BRUTAL_AUDIT.md
- [x] Write PROJECT.md
- [x] Write REQUIREMENTS.md
- [x] Write ROADMAP.md
- [ ] Write STATE.md (this file)
- [ ] Initialize git repository
- [ ] Resolve Node version conflict (.cursorrules says 20, CI uses 22)
- [ ] Rewrite README with product positioning
- [ ] Audit docs/README.md — mark archive vs current
- [ ] Run `pnpm install --frozen-lockfile`
- [ ] Run `pnpm typecheck:api`
- [ ] Run `pnpm typecheck:web`
- [ ] Commit all Phase 0 artifacts

### Phase 1 Details

**Status:** `pending`

**Dependencies:** Phase 0 complete

**Pre-work notes:**
- Verify `apps/api/src/modules/gate/` flow: open-session -> decision-engine -> review queue
- Verify `apps/web/src/features/run-lane/` data flow
- Write `docs/PARKLY_GOLDEN_PATH.md`
- Extend or create `apps/web/playwright/tests/golden-path.spec.ts`
- Demo credentials: `ops / Parkly@123` (verify this is the actual seed account)

---

## Blocked Items

- None currently.

---

## Recent Decisions

| Date | Decision | Rationale | Outcome |
|------|----------|-----------|---------|
| 2026-05-05 | Parkly product truth defined | README failed in 30 seconds | Parkly is a parking ops command center |
| 2026-05-05 | Node version conflict identified | .cursorrules says 20, CI uses 22 | Phase 0 must resolve this |
| 2026-05-05 | SKILL.md is too heavy | Architecture manifesto duplicates .cursorrules | Phase 0: archive or split |
| 2026-05-05 | Legacy pages identified | GatePage, DevicesPage, DashboardPage, GateEventsMonitorPage are dead code | Phase 2: audit and decide to delete or archive |

---

## Next Action

Execute Phase 0 remaining checkpoints:
1. Initialize git repository
2. Resolve Node version conflict
3. Rewrite README
4. Run verification commands
5. Commit

Then proceed to Phase 1.

---

*State updated: 2026-05-05*
*Next update: After Phase 0 commit*

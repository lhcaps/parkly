# Parkly Roadmap

## Roadmap Principles

- Product-first, not module-first.
- Golden path before feature expansion.
- Surgical changes over rewrite.
- Contract-first API.
- Snapshot REST first, SSE delta second.
- Evidence-driven release.
- Industrial operations console UI, no AI dashboard slop.
- Phase 0 does NOT add code. It aligns truth.
- No new module in any phase unless the phase explicitly requires it.

---

## Phase 0 — Truth Alignment & Planning Reset

**Goal:** Make the repo speak with one voice. No new code.

**Why now:** Node version conflicts, scattered docs, product truth missing from README, and no `.planning/` directory means no shared context. Fix the foundation before touching anything else.

**Scope:**
- Create `.planning/` structure with PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md
- Resolve Node version: pick 20 or 22, update `.cursorrules` and CI
- Rewrite README root with product positioning (30-second pitch)
- Audit and classify `docs/` — which are current, which go to archive
- Update `docs/README.md` index to reflect reality
- Initialize git repository
- Archive `SKILL.md` or split into a focused skill vs. architecture reference

**Non-goals:**
- No code changes
- No refactoring
- No new features
- No UI changes

**Files likely touched:**
- `.cursorrules` (Node version fix)
- `.github/workflows/ci.yml` (Node version fix)
- `README.md` (product positioning)
- `docs/README.md` (index audit)
- `SKILL.md` (archive or split)
- `docs/archive/` (move superseded docs)

**Acceptance criteria:**
1. `.planning/` contains: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md
2. Git repo initialized with `.planning/` committed
3. Node version is consistent across .cursorrules and CI (either 20 or 22, not both)
4. README communicates product truth in 3 sentences
5. docs/README.md distinguishes current from archived docs
6. `pnpm install --frozen-lockfile` passes

**Verification commands:**
```bash
git status
pnpm install --frozen-lockfile
pnpm typecheck:api
pnpm typecheck:web
```

**Demo evidence:** None — this is a documentation and governance phase.

**Risk:** Breaking CI if Node version is changed. **Rollback:** Revert the single line in CI `.yml` and `.cursorrules`.

---

## Phase 1 — Golden Path Product Slice

**Goal:** Prove the core 3-minute workflow works end-to-end with real data and observable outputs.

**Why now:** Phase 0 aligned truth. Phase 1 proves the product actually works. No point polishing UI if the Run Lane -> Entry -> Review -> Exit flow is broken.

**Scope:**
- Verify login with demo account (`ops / Parkly@123`)
- Verify Run Lane: site/gate/lane selection + entry capture submission
- Verify session creation in database
- Verify decision engine routing (high confidence auto-approves, low confidence goes to queue)
- Verify review queue receives items and allows approve/reject
- Verify exit capture resolves session
- Verify audit logs are written
- Verify outbox records are visible
- Write `docs/PARKLY_GOLDEN_PATH.md` with step-by-step demo script
- Create minimal Playwright smoke that exercises the golden path (basic — no screenshots yet)

**Non-goals:**
- No UI redesign
- No new routes
- No Playwright screenshot evidence (that is Phase 5)
- No contract hardening

**Files likely touched:**
- `apps/api/src/modules/gate/` (verify flow correctness if issues found)
- `apps/web/src/features/run-lane/` (verify data flow correctness)
- `apps/web/src/features/review-queue/` (verify review action correctness)
- `docs/PARKLY_GOLDEN_PATH.md` (new file)
- `apps/web/playwright/tests/golden-path.spec.ts` (new, minimal smoke)

**Acceptance criteria:**
1. Login works with demo credentials
2. Run Lane creates a gate session on entry capture
3. Low-confidence captures appear in review queue
4. Review actions (approve/reject) update session state and write audit logs
5. Exit capture resolves the session
6. `docs/PARKLY_GOLDEN_PATH.md` documents the 3-minute demo with exact steps
7. Basic Playwright test exercises the golden path (login -> run lane -> capture)

**Verification commands:**
```bash
pnpm typecheck:api
pnpm typecheck:web
pnpm --dir apps/api typecheck
pnpm --dir apps/api test:pr04
pnpm --dir apps/api test:pr20
pnpm --dir apps/api test:pr23
pnpm --dir apps/web build:web
```

**Demo evidence:** `docs/PARKLY_GOLDEN_PATH.md` with walkthrough steps.

**Risk:** The golden path may reveal bugs that require fixing. If so, fix surgically and document. **Rollback:** Revert surgical changes, mark criteria as blocked until fixed.

---

## Phase 2 — Frontend IA & Role Workflow Reorganization

**Goal:** Make navigation reflect the ops workflow, not the module dump that exists today.

**Why now:** Current 16 routes with equal visual weight creates cognitive load. Guards need to land on Run Lane immediately. Supervisors need to find the Review Queue fast.

**Scope:**
- Reorganize sidebar nav groups to match ops workflow:
  - **Command Center** (primary) — Overview, Parking Live
  - **Gate Operations** — Run Lane, Review Queue, Session History, Mobile Capture
  - **Infrastructure** — Device Health, Lane Monitor, Outbox Monitor, Subscriptions
  - **Business** — Reports, Audit Viewer
  - **System** — Accounts, Settings, Topology
- Update `role-policy.ts` to reflect new groups
- Set default routes by role:
  - GUARD/OPERATOR → /run-lane
  - MANAGER → /review-queue
  - SITE_ADMIN/SUPER_ADMIN → /overview
- Mark debug routes (capture-debug, mobile-camera-pair) with `hidden` or visual de-emphasis
- No broad UI rewrite — navigation only

**Non-goals:**
- No component redesign
- No color changes
- No new pages
- No route logic changes (keep lazy loading, keep preload strategy)
- No changes to page components themselves

**Files likely touched:**
- `apps/web/src/lib/auth/role-policy.ts` (nav groups, role home preferences)
- `apps/web/src/app/routes.tsx` (group reorganization if it affects import order)
- `apps/web/src/i18n/locales/en.json` (nav group labels if changed)
- `apps/web/src/i18n/locales/vi.json`

**Acceptance criteria:**
1. Sidebar shows the 5 new nav groups in the specified order
2. GUARD role lands on `/run-lane` after login
3. MANAGER role lands on `/review-queue` after login
4. SUPER_ADMIN and SITE_ADMIN roles land on `/overview` after login
5. Debug routes (capture-debug) are visually de-emphasized or moved to a secondary section
6. `pnpm --dir apps/web test:smoke:auth-routes` passes

**Verification commands:**
```bash
pnpm --dir apps/web build:web
pnpm --dir apps/web test:smoke:auth-routes
pnpm typecheck:web
```

**Demo evidence:** None — navigation reorganization is invisible to end users in demo walkthrough.

**Risk:** Changing nav groups may break role routing in edge cases. **Rollback:** Revert role-policy.ts changes.

---

## Phase 3 — Industrial Ops Console UI Taste Pass

**Goal:** Make Run Lane look and feel like an operations console — not a SaaS dashboard.

**Why now:** Phase 1 proved the flow works. Phase 2 organized navigation. Phase 3 makes the actual work surface feel professional. This is an aesthetic pass, not a functional redesign.

**Scope (priority order):**
1. **Run Lane** — the hero surface. Must look authoritative. Clear site/gate/lane context. Large, readable plate display. Prominent submit action.
2. **Review Queue** — high-speed decision workspace. Clear image previews. Large approve/reject buttons. Claimed-by indicator.
3. **Overview** — command center. KPIs in cards. Site attention table. Quick actions.
4. **Parking Live** — occupancy board with spot states readable at a glance.
5. **Device Health** — status indicators must read in 1 second (green/yellow/red).
6. **Outbox Monitor** — delivery backlog and failure rate must be scannable.

**Design rules (from impeccable + taste skills):**
- No purple gradient heroes
- No decorative card nesting (max 2 levels)
- No gradient text headings
- No glow effects
- No glassmorphism
- Status indicators must have minimum 4.5:1 contrast ratio
- Plate/session IDs use monospace font
- Danger actions (reject, cancel, manual-open) must be visually distinct with confirmation
- Empty states use ops-appropriate language ("No pending reviews" not "Nothing here!")
- Loading states show meaningful progress (not spinners in isolation)
- Error states surface the RC1 `error.code` and `error.message`

**Non-goals:**
- No changes to route logic or data fetching
- No changes to TanStack Query / Zustand setup
- No new components unless strictly needed for the aesthetic pass
- No changes outside the 6 priority screens listed above

**Files likely touched:**
- `apps/web/src/features/run-lane/` (RunLanePage + components)
- `apps/web/src/features/review-queue/` (ReviewQueuePage + components)
- `apps/web/src/features/overview/` (OverviewPage + components)
- `apps/web/src/features/parking-live/` (ParkingLivePage + components)
- `apps/web/src/features/device-health/` (DeviceHealthPage + components)
- `apps/web/src/features/outbox-monitor/` (OutboxMonitorPage + components)
- Shared CSS variables in Tailwind config if present

**Acceptance criteria:**
1. Run Lane page has clear visual hierarchy: context bar (site/gate/lane) at top, plate display prominent, action button large
2. Review Queue has large image preview, prominent approve/reject buttons with confirmation dialogs
3. Overview dashboard reads top-to-bottom: KPIs → attention items → quick actions
4. Device health status (green/yellow/red) is readable without squinting
5. No purple gradients, decorative glow, or glassmorphism on any priority screen
6. Empty state messages use ops-appropriate language
7. `pnpm --dir apps/web build:web` succeeds with no new lint errors

**Verification commands:**
```bash
pnpm --dir apps/web build:web
pnpm --dir apps/web test:unit
```

**Demo evidence:** Screenshots collected in Phase 5.

**Risk:** Aesthetic opinions vary. If user disagrees with taste direction, Phase 3 is blocked. **Rollback:** Revert CSS/class changes in affected feature directories.

---

## Phase 4 — Contract & RBAC Hardening

**Goal:** Verify that the `packages/contracts` shared schemas are actually used everywhere, and API docs match implementation.

**Why now:** The ADR says contract-first, but drift can happen over 39 PRs. This phase audits and fixes any drift before Phase 5 adds E2E evidence.

**Scope:**
- Audit `packages/contracts/src/index.ts` — list all schemas and verify each is used by both API and web
- Audit `docs/API.md` against actual route implementations — verify HTTP envelope, error codes, pagination
- Verify cursor-based pagination is used everywhere (no offset creeping in)
- Verify role-based route access on the backend matches `role-policy.ts`
- Verify SSE envelope format matches `packages/contracts` definitions
- Fix any drift found
- Verify all error codes use UPPERCASE_SNAKE_CASE

**Non-goals:**
- No new features
- No new routes
- No schema changes that break backward compatibility

**Files likely touched:**
- `packages/contracts/src/` (schema additions if drift found)
- `apps/api/src/modules/*/interfaces/http/` (route compliance)
- `apps/api/src/server/errors.ts` (error code consistency)
- `apps/web/src/lib/contracts/` (if imports are missing)
- `docs/API.md` (doc corrections)

**Acceptance criteria:**
1. All schemas in `packages/contracts` are imported by both API and web
2. API route responses match the envelope defined in `docs/API.md`
3. No offset-based pagination exists in any route
4. Backend RBAC matches frontend `role-policy.ts` for every route
5. All error codes are UPPERCASE_SNAKE_CASE
6. `pnpm --dir apps/api test:pr21` (contract freeze) passes
7. `pnpm --dir apps/api test:pr20` (auth RBAC) passes

**Verification commands:**
```bash
pnpm --dir apps/api test:pr20
pnpm --dir apps/api test:pr21
pnpm --dir apps/api typecheck
pnpm typecheck:web
```

**Demo evidence:** None — this is a compliance audit.

**Risk:** Drift corrections may be extensive if multiple inconsistencies are found. Scope to surgical fixes. **Rollback:** Revert contract changes. If schema changes are needed, add to migration notes.

---

## Phase 5 — Playwright Evidence Pack

**Goal:** Repo CV has proof, not just claims. The golden path must be automated and screenshot-documented.

**Why now:** Phase 1 proved the flow works manually. Phase 5 makes it machine-verifiable and documentable for CV evidence.

**Scope:**
- Write Playwright E2E tests for the golden path:
  1. `01-login-role-routing.spec.ts` — login with each role, verify correct landing page
  2. `02-run-lane-entry.spec.ts` — login as OPERATOR, submit entry capture, verify session created
  3. `03-review-queue-approve.spec.ts` — login as MANAGER, claim review, approve, verify session updated
  4. `04-session-history-detail.spec.ts` — verify session detail shows audit timeline
  5. `05-device-health-status.spec.ts` — verify device health page loads with status indicators
  6. `06-outbox-monitor.spec.ts` — verify outbox page shows delivery status
  7. `07-overview-command-center.spec.ts` — verify overview dashboard shows KPIs
- Run all E2E tests and collect screenshots
- Store evidence in `docs/evidence/` (screenshots, report, test results)
- Update `docs/EVIDENCE.md` to reference the new Playwright evidence

**Non-goals:**
- No new features
- No changes to page components
- No performance testing

**Files likely touched:**
- `apps/web/playwright/tests/` (7 new spec files)
- `apps/web/playwright/tests/golden-path.spec.ts` (from Phase 1 — extend or merge)
- `docs/evidence/` (new directory, screenshots)
- `docs/EVIDENCE.md` (update with Playwright evidence reference)

**Acceptance criteria:**
1. All 7 Playwright specs pass against the built artifact
2. Screenshots collected for each spec
3. `docs/evidence/` contains: Playwright HTML report, screenshots per spec, test results
4. `pnpm --dir apps/web test:e2e` passes
5. `pnpm --dir apps/web evidence:web` runs and produces artifacts

**Verification commands:**
```bash
pnpm --dir apps/web playwright:runtime:install
pnpm --dir apps/web test:e2e
pnpm --dir apps/web evidence:web
pnpm --dir apps/web build:web
```

**Demo evidence:** `docs/evidence/` directory with screenshots and Playwright report.

**Risk:** E2E tests are flaky by nature. Tests must be written for reliability, not just coverage. **Rollback:** Revert Playwright test files. Keep screenshots as-is.

---

## Phase 6 — One-command Local Demo

**Goal:** Clone repo -> run one command -> demo is ready. No tribal knowledge required.

**Why now:** Current setup requires 3 terminals and 5 manual steps. This blocks CV portability — anyone evaluating the repo can't get a demo in under 5 minutes.

**Scope:**
- Add root-level `pnpm parkly:setup` alias: runs `cp .env.example .env`, `pnpm install`, `docker compose up -d mysql redis`
- Add root-level `pnpm parkly:dev` alias: runs API + worker + web dev servers
- Add root-level `pnpm parkly:demo` alias: runs `parkly:setup` + seeds demo data + opens browser
- Add root-level `pnpm parkly:verify` alias: runs `typecheck:api`, `typecheck:web`, `build:web`, `test:e2e`
- Document demo accounts and expected behavior in `docs/PARKLY_GOLDEN_PATH.md`
- Do NOT duplicate existing scripts — alias to them

**Non-goals:**
- No new infrastructure scripts
- No changes to existing app scripts
- No Docker changes (reuse existing `docker-compose.local.yml`)

**Files likely touched:**
- `package.json` (root — add 4 new scripts)
- `docs/PARKLY_GOLDEN_PATH.md` (update with one-command flow)

**Acceptance criteria:**
1. `pnpm parkly:setup` completes without error (docker compose up, pnpm install, env copy)
2. `pnpm parkly:dev` starts API + worker + web in background or separate terminals
3. `pnpm parkly:demo` seeds demo data and reports the demo URL
4. `pnpm parkly:verify` runs the full verification suite and reports pass/fail
5. Demo login credentials are documented in `docs/PARKLY_GOLDEN_PATH.md`

**Verification commands:**
```bash
pnpm parkly:setup
pnpm parkly:verify
```

**Demo evidence:** Demo setup is self-documenting via the `parkly:setup` and `parkly:demo` scripts.

**Risk:** Docker Compose profile conflicts. Test on a clean machine if possible. **Rollback:** Remove the 4 new scripts from `package.json` root.

---

## Phase 7 — Portfolio Packaging

**Goal:** Repo is CV-ready. A reviewer understands the product in 30 seconds and has everything needed to evaluate technical quality.

**Why now:** Phases 0–6 have built the foundation, proven the flow, polished the UI, hardened contracts, documented evidence, and simplified setup. Phase 7 packages it for presentation.

**Scope:**
- Rewrite `README.md` with:
  1. What is Parkly? (3 sentences max)
  2. Why it exists (the ops problem it solves)
  3. Core workflows (Run Lane, Review Queue, Overview — no module dump)
  4. Architecture diagram (ASCII or Mermaid in markdown)
  5. Tech stack (the actual stack, not the full dependency list)
  6. Screenshots (5 key screens from Phase 5 evidence)
  7. Run locally (from `pnpm parkly:setup` + `pnpm parkly:dev`)
  8. Demo accounts (ops/OPERATOR/MANAGER/SUPER_ADMIN with passwords)
  9. Quality gates (what `pnpm parkly:verify` proves)
  10. Evidence pack link (`docs/evidence/`)
  11. What I would improve next (honest, 3-5 bullet points)
- Create `docs/architecture/diagram.md` with architecture overview
- Tag release as `v0.1.0`
- Add release checklist to `docs/EVIDENCE.md`

**Non-goals:**
- No new code
- No changes to application behavior
- No promotional language ("best-in-class", "revolutionary", etc.)

**Files likely touched:**
- `README.md` (rewrite)
- `docs/architecture/diagram.md` (new file)
- `docs/EVIDENCE.md` (add release checklist)
- Git tag: `v0.1.0`

**Acceptance criteria:**
1. README communicates product truth in the first paragraph
2. README has 5 screenshots referenced from `docs/evidence/`
3. README has architecture diagram
4. README has demo account credentials
5. README has `pnpm parkly:setup` and `pnpm parkly:dev` instructions
6. Git tag `v0.1.0` created and pushed
7. `docs/evidence/` is browsable and contains all Phase 5 artifacts

**Verification commands:**
```bash
pnpm test:full
git tag -a v0.1.0 -m "Portfolio-ready: golden path proven, evidence packed"
git push origin main --tags
```

**Demo evidence:** The README itself is the primary evidence artifact.

**Risk:** README rewrite is opinionated. User must approve the direction. **Rollback:** Revert README changes from git.

---

## Phase Summary

| # | Phase | Goal | Non-Goals | Verification |
|---|-------|------|------------|--------------|
| 0 | Truth Alignment | Align docs, CI, rules, git | No code | `pnpm install --frozen-lockfile` |
| 1 | Golden Path | Prove 3-min workflow works | No UI, no screenshots | `pnpm --dir apps/web build:web` |
| 2 | IA + Role Workflow | Ops navigation org | No redesign | `test:smoke:auth-routes` |
| 3 | Industrial Ops UI | Run Lane hero, ops taste | No new features | `pnpm --dir apps/web build:web` |
| 4 | Contract + RBAC | Verify contracts used | No new routes | `test:pr20`, `test:pr21` |
| 5 | Playwright Evidence | E2E + screenshots | No new features | `test:e2e`, `evidence:web` |
| 6 | One-command Demo | Clone -> demo in 5 min | No new infra | `parkly:setup`, `parkly:verify` |
| 7 | Portfolio Packaging | CV-ready repo | No new code | `test:full`, git tag |

---

*Roadmap defined: 2026-05-05*
*All phases are independent of each other except: Phase 2 depends on Phase 1 (run-lane must work before reorganizing nav around it); Phase 3 depends on Phase 1; Phase 5 depends on Phase 1; Phase 7 depends on Phase 5.*

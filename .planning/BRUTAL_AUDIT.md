# Parkly Repo Audit — Brutal Assessment

**Audited:** 2026-05-05
**Context:** Brownfield codebase, no git, no `.planning/` directory yet. This audit is the foundation for the GSD roadmap.

---

## 1. Product Clarity

### Finding: WEAK — README fails in 30 seconds

`README.md` opens with:

> "Monorepo này đã được cutover từ legacy gate-events flow sang operations console đầy đủ hơn: session orchestration, decision engine..."

This is internally-focused engineering language. It tells a developer what modules exist, not what problem Parkly solves for users. The word "Parkly" doesn't even appear in the first paragraph.

**Product truth (from user-supplied positioning):**
> "Parkly is a parking operations command center for gate operators, supervisors, and admins. It manages entry/exit sessions, ALPR-assisted review, live lane health, active occupancy, audit trails, and resilient outbox delivery."

The README does not communicate this. A CV reviewer skimming for 30 seconds sees: "monorepo", "cutover", "gate-events flow" — and learns nothing about what the product does.

**Files inspected:** `README.md` (line 1-54), `docs/README.md` (line 1-44)

---

## 2. Architecture Clarity

### Finding: MODERATE — Internal docs are strong, but truth alignment is broken

**What's good:**
- `docs/API.md` (2026-03-30) is comprehensive: auth planes, envelopes, surface map, pagination rules, SSE hydration discipline
- `docs/ADR.md` has 7 solid ADRs: contract-first monorepo, outbox pattern, Redis-first, three auth planes, BIGINT keys, profile-based bootstrap, built-artifact test gate
- `docs/EVIDENCE.md` defines release evidence requirements clearly
- `docs/ARCHITECTURE.md` describes runtime topology
- `docs/RUNBOOK.md` covers day-2 operations

**What's broken:**

**CRITICAL: Node version conflict**
| Location | Value |
|----------|-------|
| `.cursorrules` | `Node.js 20 LTS` |
| `.github/workflows/ci.yml` | `NODE_VERSION: '22'` |

This is a governance failure. CI runs on Node 22. `.cursorrules` says 20. Repo docs don't mention Node version at all. **No single source of truth exists.**

**File inspected:** `.github/workflows/ci.yml` (line 18), `.cursorrules` (line 12)

**CI artifact paths:** `apps/api/coverage/vitest`, `apps/web/coverage/unit`, `apps/web/playwright-report`, `apps/web/test-results`, `apps/web/dist` — these match `docs/EVIDENCE.md` expectations.

**Files inspected:** `docs/API.md`, `docs/ADR.md`, `docs/EVIDENCE.md`, `docs/RUNBOOK.md`, `.github/workflows/ci.yml`, `SKILL.md`, `.cursorrules`

---

## 3. Backend Quality

### Finding: STRONG — technically mature, but over-invested in some areas

**What's good:**
- Contract-first via `packages/contracts` — Zod schemas shared between API and web
- Idempotency: Redis SETNX fast-fail + DB persistence
- Redis Redlock for lane coordination
- Outbox pattern: Prisma transaction + BullMQ worker + DLQ
- Custom error hierarchy with RC1 envelopes
- Cursor-based pagination everywhere (no offset)
- Auth planes separated (user JWT, device HMAC, service secrets)
- BIGINT internal keys with string external IDs
- Flyway migrations + Prisma schema sync
- Secret hygiene and rotation infrastructure

**What's concerning:**

1. **40+ PR regression tests** (`pr01` through `pr39`) — most are good, but some (pr37, pr38, pr39) may be testing fixes rather than contracts. The test count suggests over-iteration on small fixes without consolidating.

2. **SKILL.md is a manifesto, not a skill** — 2,800+ words of architectural philosophy that duplicates `.cursorrules`. This is design debt, not a bug.

3. **No obvious integration test for the actual golden path** — `pr04`, `pr06`, `pr12` test components, but there doesn't appear to be a test that: submits entry capture -> creates session -> triggers review -> approves -> exits -> resolves session -> verifies audit log.

4. **`mongodb ^7.1.0` in dependencies** — MongoDB driver present but its role is unclear. Could be legacy. Needs investigation.

**Files inspected:** `apps/api/package.json`, `apps/api/src/modules/`, `apps/api/src/server/`, `apps/api/src/tests/`, `packages/contracts/`, `packages/gate-core/`

---

## 4. Frontend Quality

### Finding: MODERATE — well-structured, but taste is unclear

**What's good:**
- TanStack Query + Zustand — correct stack
- Feature-based folder structure (`features/auth/`, `features/run-lane/`, etc.)
- Custom hooks for complex logic (`useRunLanePreview`, `useReviewQueue`, `useOverviewData`)
- Lazy route loading
- SSE + REST snapshot hydration pattern
- Role-based navigation via `role-policy.ts`
- 7 role home preferences
- 4 nav groups: Operations, Monitoring, Capture, System
- Legacy route redirects in place

**What's concerning:**

1. **16 routes + 4 nav groups — no visual priority** — the sidebar has equal visual weight for "Run Lane" (critical) and "Capture Debug" (diagnostic). The hero surface (Run Lane) doesn't look like a hero.

2. **Legacy page files still present** — `GatePage.tsx`, `DevicesPage.tsx`, `DashboardPage.tsx`, `GateEventsMonitorPage.tsx` are dead code (redirected to other routes). Confusing for navigation audit.

3. **UI taste unknown from code alone** — the code structure is correct. But visual execution (gradient usage, card nesting, color palette, typography) can't be assessed from code inspection. Impeccable skill and taste skill should audit screenshots, not source.

4. **Route preload strategy may be aggressive** — `ROUTE_PRELOADS` preloads 4-5 pages per route. Could cause performance issues.

**Files inspected:** `apps/web/src/app/routes.tsx`, `apps/web/src/lib/auth/role-policy.ts`, `apps/web/src/pages/`, `apps/web/src/features/`, `apps/web/package.json`

---

## 5. UX / Product Flow

### Finding: UNCERTAIN — golden path exists but is not proven end-to-end

**What's supposed to work:**
```
Login (ops / Parkly@123)
-> /run-lane (choose site/gate/lane)
-> Submit entry capture (ALPR or manual plate)
-> System creates session
-> If low confidence: review queue receives item
-> Supervisor approves/rejects
-> Exit capture resolves session
-> Audit/outbox records visible
```

**Evidence of this flow existing in code:**
- `apps/api/src/modules/gate/` — `open-session`, `decision-engine`, `review` submodules present
- `apps/web/src/features/run-lane/` — RunLanePage, capture components, result panels
- `apps/web/src/features/review-queue/` — ReviewQueuePage, claim/approve/reject actions
- `apps/api/src/tests/pr04-capture-auth-idempotency.test.ts` — partial coverage
- `apps/api/src/modules/audit/` — audit log infrastructure

**What's missing:**
- **No single Playwright test that runs the full golden path** — `apps/web/playwright/tests/` exists, but golden path tests (Run Lane -> Entry -> Review -> Exit) are not confirmed to exist
- **No demo script** — `docs/DEMO_SCRIPT.md` does not exist
- **No evidence of screenshot collection** for the golden path

**The product truth is sound. The execution needs a single script that proves it works in 3 minutes.**

---

## 6. Evidence

### Finding: PARTIAL — CI has gates, but golden path evidence is missing

**CI gates that exist:**
- `pnpm test:full` (root gate)
- Migration validation (Flyway)
- i18n validation (Python scripts)
- Security audit (npm audit)
- Dependency review
- CodeQL analysis

**Evidence artifacts expected by `docs/EVIDENCE.md`:**
- Quality gate logs
- CI job URLs
- Coverage reports
- Playwright HTML report
- Deployment verification
- Backup manifest

**Evidence artifacts that exist in the codebase:**
- `apps/api/src/scripts/evidence/09-health-sse.ps1` — PowerShell evidence script (Windows-specific)
- `apps/web/src/scripts/collect-evidence.mjs` — evidence collection
- `apps/api/src/scripts/rc1-repeat-smoke.ts` — repeat smoke
- `release-evidence/` directory has past evidence packs (frontend-wave-09, frontend-mobile-review)

**What's missing for Phase 0:**
- **No golden path Playwright test suite** covering Run Lane -> Review Queue -> Session History
- **No `docs/DEMO_SCRIPT.md`**
- **No `docs/PARKLY_GOLDEN_PATH.md`**
- **No consolidated evidence pack** for the current state

---

## 7. Discipline Scattered

### Finding: The rules exist but are in the wrong places

| What | Where | Status |
|------|-------|--------|
| HTTP envelope | `docs/API.md` | Good |
| Auth planes | `docs/API.md` + ADR-005 | Good |
| Cursor pagination | `docs/API.md` | Good |
| SSE hydration rule | `docs/API.md` | Good |
| Outbox pattern | `docs/ADR.md` | Good |
| Tech stack | `.cursorrules` | Incomplete (Node 20/22 conflict) |
| Coding standards | `.cursorrules` | Good |
| Domain rules | `SKILL.md` | Redundant + heavy |
| Release gate | `docs/EVIDENCE.md` | Good |
| Quality gate | `package.json` + `scripts/run-quality-gate.mjs` | Good |

**The reader has to check 5 places to understand what "Parkly" expects.** This is manageable for internal devs. It's a problem for onboarding and CV presentation.

---

## 8. Navigation Architecture

### Finding: Well-structured, but needs visual re-weighting

Current nav groups and roles:
| Group | Routes |
|-------|--------|
| Operations | Overview, Run Lane, Review Queue, Session History, Subscriptions |
| Monitoring | Lane Monitor, Device Health, Sync Outbox, Reports, Parking Live |
| Capture | Mobile Camera Pair, Capture Debug |
| System | Settings, Topology, Accounts |

Role home preferences (from `role-policy.ts`):
| Role | Primary Home |
|------|-------------|
| GUARD | /run-lane |
| OPERATOR | /run-lane |
| MANAGER | /overview |
| SITE_ADMIN | /overview |
| SUPER_ADMIN | /overview |

**What's right:** Role-based routing exists. GUARD/OPERATOR land on Run Lane. This is correct.

**What needs work:** All nav items have equal visual weight in the sidebar. "Run Lane" — the actual work surface — doesn't stand out from "Capture Debug" — a diagnostic tool. Phase 3 of the roadmap addresses this.

---

## 9. Skills & Quality Tools

### Finding: Comprehensive tooling, underutilized documentation

**Tools present:**
- Impeccable skill (for UI audit)
- Taste skill / gpt-taste / redesign-skill (for UI refresh)
- Emil Kowalski-inspired UI judgment
- Playwright skill
- GSD skills (map-codebase, new-project, plan-phase, execute-phase, etc.)
- Karpathy coding guidelines
- i18n-safe-edit skill
- docx skill

**What's not documented in the repo:**
- These skills exist in `.agents/skills/` and global Codex skills, but the repo doesn't reference them
- No `SKILL.md` in the repo root that points to available skills (there IS a `SKILL.md` but it's the architecture manifesto, not a skill index)
- The `.cursorrules` doesn't mention that UI work should use impeccable/redesign skills

---

## 10. Overarching Judgment

### Parkly is a technically mature enterprise system in search of a product story.

The codebase is NOT a mess. It is NOT under-engineered. It is over-engineered in the wrong places (40+ PR tests, deep domain rules, extensive observability) and under-documented in the right places (product positioning, golden path demo, portfolio packaging).

**The diagnosis:**
1. Someone built this as a serious production system
2. Someone iterated heavily on technical quality (tests, patterns, CI)
3. Nobody ever paused to ask: "Can we demo this in 3 minutes to a non-engineer?"
4. Nobody resolved the Node version conflict between rules and CI
5. Nobody created a golden path Playwright suite

**The fix is not more engineering. The fix is:**
1. Align truth (Node version, docs, rules, CI)
2. Prove the golden path works end-to-end
3. Make the UI feel like an operations console, not a SaaS dashboard
4. Package it so a CV reviewer understands the product in 30 seconds

---

## Audit Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| Product clarity | 4/10 | README fails in 30 seconds |
| Architecture clarity | 7/10 | Docs good, Node conflict critical |
| Backend quality | 8/10 | Mature, but over-invested in some areas |
| Frontend quality | 7/10 | Well-structured, taste unknown |
| UX/Product flow | 6/10 | Path exists, not proven end-to-end |
| Evidence | 5/10 | CI gates exist, golden path missing |
| Discipline scatter | 6/10 | Rules exist, in wrong places |
| Navigation IA | 7/10 | Well-structured, needs visual priority |
| Skills | 7/10 | Tools exist, underutilized |
| **Overall** | **6.3/10** | **Mature system, product story missing** |

**Files actually inspected:** 15 source files, 8 docs, 4 config files, 2 workflow files

# FE Remaining PR Scripts for Cursor

Use one branch per PR. Do not run multiple PRs in parallel.

## Shared execution pattern
1. Create a dedicated branch.
2. Inspect target files first.
3. State a brief execution plan.
4. Make changes within scope only.
5. Return:
   - summary
   - changed files
   - verification commands
   - risks / notes
   - acceptance checklist

---

## PR-04 — Investigation Workspace: Session ↔ Incident ↔ Audit ↔ Media

### Branch
```bash
git checkout -b fe/pr-04-investigation-workspace
```

### Cursor prompt
```text
Implement PR-04 — Investigation Workspace: Session ↔ Incident ↔ Audit ↔ Media.

Goal:
Create a coherent frontend investigation workspace so operators can inspect one case end-to-end without jumping across disconnected pages.

Frontend mission:
Build a unified investigation panel/page/drawer that can be opened from relevant entry points and shows:
- case summary
- media
- timeline
- audit
- incident context
- correlation identifiers

Scope:
- Reuse existing APIs and read models if already available.
- If data is fragmented, create frontend composition adapters rather than fake business logic.
- Add deep-link support for investigation view if the repo patterns support it.
- Add entry points from:
  - session history
  - review queue
  - parking live attention state if relevant
  - incident list if relevant

Inspect first:
- apps/web/src/pages/SessionHistoryPage*
- apps/web/src/features/session-history/*
- apps/web/src/features/review-queue/*
- apps/web/src/features/parking-live/*
- apps/web/src/features/incidents/* if exists
- apps/web/src/features/audit/*
- existing media preview components
- route/query-state conventions

Required deliverables:
1) investigation workspace shell
2) compact triage summary section
3) tabs or sections:
   - summary
   - media
   - timeline
   - audit
   - incident
4) copy actions for IDs if consistent with existing component patterns
5) graceful behavior when media or related data fails
6) stable loading/empty/error states
7) tests:
   - adapter/composition tests
   - deep-link restore test if applicable
   - entry point navigation test if applicable

Constraints:
- Do not implement collaboration/comments.
- Do not build analytics-heavy reporting here.
- Do not dump raw JSON if a human-readable timeline is feasible.

Acceptance criteria:
- operator can trace a case from one investigation surface
- related artifacts are visible in one flow
- failure of one panel does not crash the whole workspace
- state is refresh/deep-link resilient
```

### Verify
```bash
pnpm --dir apps/web test:unit
pnpm --dir apps/web build
pnpm --dir apps/web test:e2e
```

---

## PR-05 — Parking Live Triage v2

### Branch
```bash
git checkout -b fe/pr-05-parking-live-triage-v2
```

### Cursor prompt
```text
Implement PR-05 — Parking Live Triage v2.

Goal:
Upgrade Parking Live from a readable board into a triage-efficient operational board without sacrificing stability or performance.

Scope:
- Add structured attention reasons and triage affordances.
- Improve scanability for high-density boards.
- Preserve last-good-snapshot and stale behavior from the realtime hardening work.
- Add quick filters and drill actions where already supported by data.

Inspect first:
- apps/web/src/pages/ParkingLivePage*
- apps/web/src/features/parking-live/*
- existing board/tile components
- stale banner / realtime status banner
- any incident/session jump actions already present

Deliverables:
1) structured attention states:
   - stale
   - incident open
   - occupancy mismatch
   - degraded device impact
   - manual review / override pending if supported
2) quick filters:
   - attention only
   - incident only
   - stale only
   - degraded only if supported
3) top-level hotlist or compact priority view
4) quick actions:
   - open related session
   - open incident
   - open device health if supported
5) performance discipline:
   - avoid full-board rerender on small patch updates
   - preserve current virtualization/chunking strategy if already present
6) tests for:
   - attention mapping
   - stale-to-recover flow
   - last snapshot preservation

Constraints:
- do not turn Parking Live into a bloated dashboard
- do not introduce decorative metrics
- keep the page operational, not flashy

Acceptance criteria:
- user can identify what needs action first
- stale/live state remains trustworthy
- performance does not regress
- tests cover attention mapping and fallback behavior
```

### Verify
```bash
pnpm --dir apps/web test:unit
pnpm --dir apps/web exec vitest run src/features/parking-live
pnpm --dir apps/web build
```

---

## PR-06 — Subscriptions Ops Depth v2

### Branch
```bash
git checkout -b fe/pr-06-subscriptions-ops-depth-v2
```

### Cursor prompt
```text
Implement PR-06 — Subscriptions Ops Depth v2.

Goal:
Push the subscriptions workspace from decent CRUD toward real operational usability:
fewer clicks, clearer risk signals, stronger conflict handling, stable deep-link behavior.

Scope:
- Improve filters and presets.
- Improve detail panel stability.
- Improve conflict / retry UX.
- Strengthen read-only discipline by role.
- Add lightweight risk surfacing where data already supports it.

Inspect first:
- apps/web/src/pages/SubscriptionsPage*
- apps/web/src/features/subscriptions/*
- query-state / deep-link hooks
- list/detail panel synchronization
- current mutate flows and conflict handling

Deliverables:
1) preset filters / saved filter helpers if aligned with repo patterns
2) risk badges or flags:
   - expiring soon
   - suspended
   - missing vehicle
   - missing spot
   - conflict / stale record if applicable
3) detail panel stability on refresh
4) clearer mutation failure surface:
   - authoritative latest snapshot if available
   - conflict/precondition reason
   - safe retry path
5) stronger role-aware action visibility
6) tests:
   - deep-link restore
   - selected row preservation
   - conflict reducer / mutation failure handling

Constraints:
- do not build full billing
- do not add unsafe bulk actions unless clearly supported
- avoid speculative backend assumptions

Acceptance criteria:
- subscriptions workspace is resilient under reload and concurrent update scenarios
- risk states are clearer
- conflict handling is readable and actionable
- role discipline is tighter
```

### Verify
```bash
pnpm --dir apps/web test:unit
pnpm --dir apps/web exec vitest run src/features/subscriptions
pnpm --dir apps/web build
```

---

## PR-07 — Operational Reporting Pack

### Branch
```bash
git checkout -b fe/pr-07-operational-reporting-pack
```

### Cursor prompt
```text
Implement PR-07 — Operational Reporting Pack.

Goal:
Strengthen the frontend reporting surface so it answers real operational questions instead of being a thin summary page.

Scope:
- Improve report information architecture.
- Prefer operationally useful tables, trends, and aging buckets over decorative charts.
- Support drill-down from report summary to filtered details where feasible.
- Keep report layout printable/export-friendly.

Inspect first:
- apps/web/src/pages/ReportsPage*
- apps/web/src/features/reports/*
- any existing summary/report cards
- shared table/filter primitives
- export/download patterns already in repo

Deliverables:
1) reports page sections such as:
   - operations health
   - incident / exception workload
   - device/runtime health
   - subscription risk
2) drill-down links or route/query-state driven detail views if feasible
3) stable loading/empty/error states
4) export-friendly structure if CSV/export endpoints already exist
5) tests around:
   - filter state
   - report section rendering
   - drill-down parameter mapping

Constraints:
- no BI overengineering
- no chart spam
- do not invent analytics unsupported by existing API contracts

Acceptance criteria:
- reporting page helps answer where problems are accumulating
- sections are structured and readable
- filters/drill-down are stable
- no flashy noise
```

### Verify
```bash
pnpm --dir apps/web test:unit
pnpm --dir apps/web build
```

---

## PR-08 — CI, Evidence Automation & Release Discipline

### Branch
```bash
git checkout -b fe/pr-08-ci-evidence-release-discipline
```

### Cursor prompt
```text
Implement PR-08 — CI, Evidence Automation & Release Discipline.

Goal:
Institutionalize FE release discipline in the repository so it does not depend on memory or manual folklore.

Scope:
- Add or improve CI workflows for frontend validation.
- Upload useful artifacts on failure.
- Add PR/release discipline docs and templates.
- Ensure evidence collection and sign-off fit into CI structure.

Inspect first:
- .github/workflows/*
- .github/pull_request_template.md
- apps/web/package.json
- apps/web/scripts/*
- docs/frontend/runbooks/*
- release-evidence/frontend/*
- any existing CI files in repo root

Deliverables:
1) CI workflow(s) covering:
   - install
   - typecheck/build
   - unit
   - playwright runtime setup
   - targeted E2E or full E2E depending repo speed
   - smoke where practical
2) artifact upload:
   - logs
   - screenshots
   - traces/videos on Playwright failure if already enabled
3) PR template requiring:
   - scope
   - risk
   - evidence
   - rollback note
4) release runbook updates
5) explicit failure behavior and docs for reviewers

Constraints:
- do not build an overcomplicated multi-environment deployment pipeline
- keep CI readable and maintainable
- prefer deterministic artifact naming

Acceptance criteria:
- PR reviewers have a consistent evidence path
- CI can reproduce core FE validation
- release discipline is documented in-repo
- failure artifacts are useful
```

### Verify
```bash
pnpm --dir apps/web build
pnpm --dir apps/web test:unit
pnpm --dir apps/web test:e2e
```

---

## Review prompt after each PR

```text
Now perform a senior-level review of your own changes for this PR only.

Review checklist:
- Did you stay within PR scope?
- Any hidden drift to role policy, route policy, or shell behavior?
- Any brittle selectors or test smells introduced?
- Any Windows PowerShell issues in scripts?
- Any duplicated logic that should be consolidated?
- Any docs, runbooks, or evidence paths now inconsistent?
- Any type leaks or unsafe assumptions?
- Any files changed that should be reverted because they are unrelated?

Then return:
1) review findings
2) required fixes
3) final verification commands
4) final acceptance checklist
```

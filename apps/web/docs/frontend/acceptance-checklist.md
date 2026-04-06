# Frontend acceptance checklist

## 1. Bootstrap gate
- [ ] `pnpm install` runs clean on a clean machine
- [ ] `pnpm build` succeeds
- [ ] `docs/frontend/runbook.md` matches the scripts that actually exist in the repo
- [ ] `docs/frontend/routes.md` matches the live query-param contract

## 2. Canonical role + landing gate
- [ ] Policy registry is the single source of truth for guard, sidebar, topbar, and landing
- [ ] Landing matrix matches runtime:
  - `SUPER_ADMIN` -> `/overview`
  - `SITE_ADMIN` -> `/overview`
  - `MANAGER` -> `/overview`
  - `OPERATOR` -> `/run-lane`
  - `GUARD` -> `/run-lane`
  - `CASHIER` -> `/reports`
  - `VIEWER` -> `/overview`
- [ ] Direct URL into a forbidden route always goes through `/forbidden`
- [ ] Forbidden page shows current role, requested route, allowed roles, and fallback route

## 3. Canonical routes gate
- [ ] `/overview` opens
- [ ] `/run-lane` deep link reopens context
- [ ] `/review-queue` deep link reopens context
- [ ] `/session-history` deep link reopens context
- [ ] `/sync-outbox` deep link reopens context
- [ ] `/reports` deep link reopens context
- [ ] `/subscriptions` deep link reopens context
- [ ] `/parking-live` deep link reopens context
- [ ] `/mobile-camera-pair` opens
- [ ] `/mobile-capture` opens from pair context
- [ ] `/topology` opens for the allowed admin roles
- [ ] Refresh on nested routes does not blank the screen
- [ ] Back/forward keeps critical filter state

## 4. Auth + session gate
- [ ] Login succeeds with a valid local account
- [ ] Refreshing `/login` when already authenticated redirects to the canonical role home
- [ ] Logout clears runtime state cleanly
- [ ] Expired tokens return to `/login` with a clear notice
- [ ] UI never gives the impression that frontend can self-elevate role

## 5. Workspace gate
- [ ] Review Queue can claim or act on a live item and reflect refreshed state
- [ ] Session History distinguishes loading, degraded detail, and empty selection
- [ ] Sync Outbox triage keeps detail selection stable across filter refresh
- [ ] Subscriptions deep-link survives reload and tab restore
- [ ] Parking Live keeps the last snapshot visible during stale fallback
- [ ] Mobile Pair and Mobile Capture keep pair context consistent
- [ ] Settings persists theme and language choices
- [ ] Topology dialogs open, close, and remain keyboard-accessible

## 6. Shared state + semantics gate
- [ ] Loading, empty, degraded, forbidden, and error states are semantically distinct
- [ ] Empty business data is not described the same way as dependency failure
- [ ] Important error states surface a `requestId` or actionable hint
- [ ] Invalid `/subscriptions` and `/parking-live` query params normalize to safe defaults
- [ ] Icon-only controls have accessible names
- [ ] Form controls are associated with semantic labels
- [ ] Key images include intrinsic width and height where practical

## 7. Automated regression gate
- [ ] `pnpm test:unit` passes
- [ ] `pnpm test:e2e` passes
- [ ] `pnpm smoke:web:dev` passes
- [ ] `pnpm smoke:web:dist` passes
- [ ] Smoke updates `docs/frontend/evidence/latest-smoke-dev.json`
- [ ] Smoke updates `docs/frontend/evidence/latest-smoke-dist.json`

## 8. Manual QA + evidence gate
- [ ] Canonical role landings are signed off manually
- [ ] Forbidden fallback is signed off manually
- [ ] Review Queue action desk evidence is captured
- [ ] Session History degraded/error evidence is captured
- [ ] Sync Outbox triage evidence is captured
- [ ] Mobile Pair and Mobile Capture evidence is captured
- [ ] Settings persistence evidence is captured
- [ ] Topology dialog evidence is captured
- [ ] `docs/frontend/manual-qa-signoff.md` is filled in

## 9. Final release gate
Do not merge if any of the following remain true:
- [ ] Docs and runtime are out of sync
- [ ] Clean-machine bootstrap cannot be repeated
- [ ] Regression suite fails while build still looks green
- [ ] Evidence bundle is missing build, test, smoke, or screenshots
- [ ] The app only works reliably on the original author's machine

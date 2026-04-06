# Frontend runbook

## 1. Goal
This runbook locks down how to bootstrap, verify, and hand off the current frontend wave so another engineer can repeat the process without oral handoff.

Current wave scope:
- auth shell and canonical role-aware landing
- operational routes in the shell
- review queue, session history, sync outbox
- subscriptions and parking live
- mobile pair and mobile capture
- settings persistence and topology dialogs
- regression gate with build, unit, e2e, smoke, manual QA, and evidence bundle

## 2. Prerequisites
- Node.js 20.x or newer
- pnpm 10.x
- Parkly backend `local-dev`, `demo`, or `rc` profile available
- modern desktop browser
- Playwright browsers installed for E2E

## 3. Bootstrap

### Install dependencies

```bash
pnpm install
```

### Boot backend

```bash
pnpm --dir apps/api bootstrap:local
pnpm --dir apps/api dev
pnpm --dir apps/api worker:dev
```

### Start web

```bash
pnpm --dir apps/web dev --host 0.0.0.0
```

Wait until Vite prints the local URL before running smoke.

## 4. Canonical role homes
- `SUPER_ADMIN` -> `/overview`
- `SITE_ADMIN` -> `/overview`
- `MANAGER` -> `/overview`
- `OPERATOR` -> `/run-lane`
- `GUARD` -> `/run-lane`
- `CASHIER` -> `/reports`
- `VIEWER` -> `/overview`

## 5. Commands required before handoff

### Build

```bash
pnpm --dir apps/web build
```

### Unit tests

```bash
pnpm --dir apps/web test:unit
```

### E2E

```bash
pnpm --dir apps/web test:e2e
```

### Smoke against dev

```bash
pnpm --dir apps/web smoke:web:dev -- --apiUrl http://127.0.0.1:3000/api
```

### Smoke against dist

```bash
pnpm --dir apps/web smoke:web:dist -- --apiUrl http://127.0.0.1:3000/api
```

Expected smoke artifacts:
- `docs/frontend/evidence/latest-smoke-dev.json`
- `docs/frontend/evidence/latest-smoke-dist.json`

### Evidence bundle

```bash
node ./apps/web/scripts/collect-evidence.mjs \
  --buildLog ../../release-evidence/frontend/build.log \
  --unitLog ../../release-evidence/frontend/test-unit.log \
  --e2eLog ../../release-evidence/frontend/test-e2e.log \
  --smokeDevLog ../../release-evidence/frontend/smoke-dev.log \
  --smokeDistLog ../../release-evidence/frontend/smoke-dist.log \
  --screensDir ../../release-evidence/frontend/screenshots
```

## 6. Minimum signoff screenshot set
- `landing-super-admin.png`
- `landing-site-admin.png`
- `landing-manager.png`
- `landing-operator.png`
- `landing-guard.png`
- `landing-cashier.png`
- `landing-viewer.png`
- `forbidden-fallback.png`
- `review-queue-action-desk.png`
- `session-history-detail-error.png`
- `outbox-triage.png`
- `subscriptions-deeplink.png`
- `parking-live-stale-fallback.png`
- `mobile-pair-qr.png`
- `mobile-capture-receipt.png`
- `settings-theme-dark.png`
- `topology-dialogs.png`

## 7. Handoff rule
Do not hand off the wave if:
- docs drift from runtime
- clean-machine bootstrap has not been proven
- smoke JSON artifacts are missing or stale
- the screenshot bundle only covers landing pages
- manual QA sign-off is incomplete

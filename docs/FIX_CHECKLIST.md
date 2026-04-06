# Fix Checklist

Snapshot date: 2026-03-30

## Root docs

### `docs/API.md`
- [x] Re-aligned snapshot/state versus realtime contract wording with current backend tests.
- [x] Restored dashboard, audit, incident-noise, auth-security, observability, and secret-safety markers expected by regression tests.
- [x] Documented `backend-rc1` and `PR20→PR25` release scope.

### `docs/RUNBOOK.md`
- [x] Restored `rc:gate`, `release:reset`, `smoke:bundle`, and demo rollback guidance.
- [x] Re-aligned release gate sequencing with the current RC workflow.
- [x] Added demo rollback and reset-vs-restore guidance used by backup and smoke tests.

## Frontend QA artifacts

### `apps/web/docs/frontend/acceptance-checklist.md`
- [x] Replace legacy role landing matrix with canonical roles.
- [x] Pin smoke evidence naming to `latest-smoke-dev.json` and `latest-smoke-dist.json`.

### `apps/web/docs/frontend/manual-qa-signoff.md`
- [x] Replace legacy landing screenshots with canonical role screenshots.
- [x] Expand required screenshot coverage beyond landing-only evidence.

### `apps/web/docs/frontend/role-matrix.md`
- [x] Replace legacy roles with canonical runtime roles and route access.

### `apps/web/docs/frontend/routes.md`
- [x] Align role-home and forbidden fallback docs with runtime policy.
- [x] Point smoke evidence references at mode-specific JSON artifacts.

### `apps/web/docs/frontend/runbook.md`
- [x] Align smoke/evidence commands with current scripts and screenshot bundle.

### `apps/web/docs/frontend/evidence-template.md`
- [x] Expand screenshot checklist to the new signoff bundle.

### `apps/web/scripts/smoke-web.mjs`
- [x] Default smoke JSON output to mode-specific files and keep evidence scaffold in sync.

### `apps/web/scripts/release-signoff.mjs`
- [x] Replace legacy screenshot names with canonical role outputs.
- [x] Require expanded screenshot bundle for signoff.

### `apps/web/scripts/collect-evidence.mjs`
- [x] Validate canonical screenshot names and the larger signoff bundle.

## Accessibility + UI quality

### `apps/web/src/components/ui/button.tsx`
- [x] Replace shared `transition-all` with narrower transitions.

### `apps/web/src/globals.css`
- [x] Add reduced-motion fallback for global animations and transitions.

### `apps/web/src/features/review-queue/components/ReviewDetailPanel.tsx`
- [x] Add semantic labels for action inputs.
- [x] Add accessible name for icon close button.

### `apps/web/src/features/review-queue/components/ReviewImagePreview.tsx`
- [x] Add `aria-label` for icon actions.
- [x] Add intrinsic image sizing.

### `apps/web/src/features/subscriptions/components/SubscriptionDetailPane.tsx`
- [x] Add accessible name for icon close button.

### `apps/web/src/features/subscriptions/components/SubscriptionEditorDialogShell.tsx`
- [x] Add accessible name for icon close button.

### `apps/web/src/features/topology-admin/CreateGateDialog.tsx`
- [x] Add accessible name for icon close button.

### `apps/web/src/features/topology-admin/CreateLaneDialog.tsx`
- [x] Add accessible name for icon close button.

### `apps/web/src/features/topology-admin/EditLaneDialog.tsx`
- [x] Add accessible name for icon close button.

### `apps/web/src/features/topology-admin/DeviceConfigDrawer.tsx`
- [x] Add accessible name for icon close button.

### `apps/web/src/features/mobile-pair/components/MobileQrCard.tsx`
- [x] Add intrinsic QR image dimensions.

### `apps/web/src/features/session-history/components/SessionMediaStrip.tsx`
- [x] Add intrinsic media dimensions.

### `apps/web/src/features/capture-debug/components/PreviewDebugPanel.tsx`
- [x] Add intrinsic preview image dimensions.

### `apps/web/src/features/mobile-capture/components/MobileCaptureReceiptCard.tsx`
- [x] Add intrinsic evidence image dimensions.

## E2E coverage + evidence capture

### `apps/web/tests/e2e/release-signoff-role-landings.spec.ts`
- [x] Expand landing coverage to the canonical role set.

### `apps/web/tests/e2e/auth-role-landing.spec.ts`
- [x] Save forbidden fallback evidence screenshot.

### `apps/web/tests/e2e/subscriptions-deeplink.spec.ts`
- [x] Save subscription signoff evidence screenshot.

### `apps/web/tests/e2e/parking-live-fallback.spec.ts`
- [x] Save parking-live stale fallback screenshot.

### `apps/web/tests/e2e/*new*`
- [x] Add review queue action coverage.
- [x] Add session history degraded/error coverage.
- [x] Add outbox triage coverage.
- [x] Add mobile pair/capture coverage.
- [x] Add settings/theme persistence coverage.
- [x] Add topology dialog coverage.

## Visual hierarchy polish

### `apps/web/src/app/AppSidebar.tsx`
- [x] Reduce secondary copy weight and tighten navigation density.

### `apps/web/src/pages/OverviewPage.tsx`
- [x] Add stronger status hierarchy ahead of equal-weight cards.

### `apps/web/src/pages/RunLanePage.tsx`
- [x] Promote the primary submit action and reduce side-by-side panel competition.

### `apps/web/src/pages/ReportsPage.tsx`
- [x] Compress the filter toolbar and fill empty chrome with denser context.

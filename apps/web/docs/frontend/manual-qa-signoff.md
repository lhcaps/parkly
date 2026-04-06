# Manual QA sign-off - frontend release baseline freeze

- Owner:
- Reviewer:
- Date:
- Web commit / patch:
- Backend profile: local-dev / demo / rc
- Web base URL dev:
- Web base URL dist:
- API base URL:
- Device / browser:

## Preconditions
- [ ] `pnpm build` pass
- [ ] `pnpm test:unit` pass
- [ ] `pnpm playwright:runtime:check` pass
- [ ] `pnpm test:e2e` pass
- [ ] `pnpm smoke:web:dev` pass
- [ ] `pnpm smoke:web:dist` pass
- [ ] `docs/frontend/evidence/latest-smoke-dev.json` updated
- [ ] `docs/frontend/evidence/latest-smoke-dist.json` updated

## Section A - Login landing per canonical role
| Role | Expected route | Pass | Screenshot | Notes |
| --- | --- | --- | --- | --- |
| SUPER_ADMIN | `/overview` | [ ] | [ ] | |
| SITE_ADMIN | `/overview` | [ ] | [ ] | |
| MANAGER | `/overview` | [ ] | [ ] | |
| OPERATOR | `/run-lane` | [ ] | [ ] | |
| GUARD | `/run-lane` | [ ] | [ ] | |
| CASHIER | `/reports` | [ ] | [ ] | |
| VIEWER | `/overview` | [ ] | [ ] | |

## Section B - Forbidden direct URL
- [ ] Direct URL to `/subscriptions` with insufficient rights lands on `/forbidden`
- [ ] Fallback route shows the current role correctly
- [ ] Direct URL to `/parking-live` with insufficient rights does not partially render the page
- [ ] Screenshot `forbidden-fallback.png` saved
- Notes:

## Section C - Operational workspaces
- [ ] Review Queue action desk can claim or approve using fresh live context
- [ ] Screenshot `review-queue-action-desk.png` saved
- [ ] Session History shows degraded detail without collapsing the list pane
- [ ] Screenshot `session-history-detail-error.png` saved
- [ ] Sync Outbox triage keeps selected detail while filters and controls are used
- [ ] Screenshot `outbox-triage.png` saved
- [ ] Subscriptions deep-link restores the selected subscription and selected tab
- [ ] Screenshot `subscriptions-deeplink.png` saved
- [ ] Parking Live stale fallback keeps the last good snapshot visible
- [ ] Screenshot `parking-live-stale-fallback.png` saved

## Section D - Mobile + settings + topology
- [ ] Mobile Pair shows QR origin and active pair registry consistently
- [ ] Screenshot `mobile-pair-qr.png` saved
- [ ] Mobile Capture shows a successful receipt with the expected context
- [ ] Screenshot `mobile-capture-receipt.png` saved
- [ ] Settings persists theme choice after reload
- [ ] Screenshot `settings-theme-dark.png` saved
- [ ] Topology add/edit dialogs open and close correctly
- [ ] Screenshot `topology-dialogs.png` saved

## Section E - Evidence attachments
- [ ] `landing-super-admin.png` attached
- [ ] `landing-site-admin.png` attached
- [ ] `landing-manager.png` attached
- [ ] `landing-operator.png` attached
- [ ] `landing-guard.png` attached
- [ ] `landing-cashier.png` attached
- [ ] `landing-viewer.png` attached
- [ ] `forbidden-fallback.png` attached
- [ ] `review-queue-action-desk.png` attached
- [ ] `session-history-detail-error.png` attached
- [ ] `outbox-triage.png` attached
- [ ] `subscriptions-deeplink.png` attached
- [ ] `parking-live-stale-fallback.png` attached
- [ ] `mobile-pair-qr.png` attached
- [ ] `mobile-capture-receipt.png` attached
- [ ] `settings-theme-dark.png` attached
- [ ] `topology-dialogs.png` attached
- [ ] Build log attached
- [ ] Unit log attached
- [ ] E2E log attached
- [ ] Smoke dev log attached
- [ ] Smoke dist log attached
- [ ] `latest-smoke-dev.json` attached
- [ ] `latest-smoke-dist.json` attached
- [ ] `release-signoff.md` attached
- [ ] `signoff-manifest.json` attached

## Final sign-off
- Status: PASS / FAIL
- Blocking issues:
- Follow-up items:

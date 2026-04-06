# Frontend evidence template

Minimum evidence for this release wave must include:
- build log
- unit test log
- e2e log
- smoke dev log
- smoke dist log
- `latest-smoke-dev.json`
- `latest-smoke-dist.json`
- the full screenshot signoff set
- completed manual QA sign-off
- role matrix aligned with runtime
- `release-signoff.md`
- `signoff-manifest.json`

## Minimum screenshot checklist
1. Login page before sign-in
2. Canonical role landings:
   - `landing-super-admin.png`
   - `landing-site-admin.png`
   - `landing-manager.png`
   - `landing-operator.png`
   - `landing-guard.png`
   - `landing-cashier.png`
   - `landing-viewer.png`
3. `forbidden-fallback.png`
4. `review-queue-action-desk.png`
5. `session-history-detail-error.png`
6. `outbox-triage.png`
7. `subscriptions-deeplink.png`
8. `parking-live-stale-fallback.png`
9. `mobile-pair-qr.png`
10. `mobile-capture-receipt.png`
11. `settings-theme-dark.png`
12. `topology-dialogs.png`

## Required evidence fields
- build commit or patch id
- execution date and time
- web base URL dev
- web base URL dist
- api base URL
- backend profile
- role or flow under test
- requestId or hint for degraded or error states when applicable

## Required manual QA topics
- canonical login landing per role
- forbidden direct URL fallback
- review queue live action desk
- session history degraded detail triage
- sync outbox triage
- subscriptions selection recovery
- parking-live stale fallback
- mobile pair and mobile capture
- settings persistence
- topology dialogs

# Frontend evidence template

Bo evidence toi thieu khi ban giao wave nay phai co:
- build log
- unit test log
- e2e log
- smoke dev log
- smoke dist log
- `latest-smoke-dev.json`
- `latest-smoke-dist.json`
- screenshot set toi thieu
- manual QA sign-off da dien
- role matrix da doi chieu voi runtime
- release-signoff.md
- signoff-manifest.json

## Screenshot checklist toi thieu
1. Login page truoc khi sign-in
2. Role landing dung sau login (ADMIN, OPS, GUARD, CASHIER, WORKER)
3. Forbidden direct URL voi fallback ro rang
4. Subscriptions deep-link mo dung detail + dung tab
5. Subscriptions read-only hoac mutate bar tuy role
6. Parking Live board voi summary strip
7. Parking Live stale fallback banner con giu snapshot
8. Smoke dev output (5173)
9. Smoke dist output (4173)
10. Manual QA sign-off da dien

## Evidence fields bat buoc
- build commit hoac patch id
- ngay gio chay gate
- web base URL dev (5173)
- web base URL dist (4173)
- api base URL
- backend profile
- role da test
- requestId/hint neu co loi degraded hoac error

## Manual QA topics bat buoc
- login landing per role
- forbidden direct URL
- subscriptions selection recovery
- subscriptions detail error triage
- parking-live stale fallback
- parking-live reconcile freshness

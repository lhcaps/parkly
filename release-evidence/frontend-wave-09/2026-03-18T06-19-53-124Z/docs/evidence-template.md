# Frontend evidence template

Bộ evidence tối thiểu khi bàn giao wave này phải có:
- build log
- unit test log
- e2e log
- smoke log
- `latest-smoke.json`
- screenshot set tối thiểu
- manual QA sign-off đã điền
- role matrix đã đối chiếu với runtime

## Screenshot checklist tối thiểu
1. Login page trước khi sign-in
2. Role landing đúng sau login
3. Forbidden direct URL với fallback rõ ràng
4. Subscriptions deep-link mở đúng detail + đúng tab
5. Subscriptions read-only hoặc mutate bar tùy role
6. Parking Live board với summary strip
7. Parking Live stale fallback banner còn giữ snapshot
8. Reconcile hoặc force refresh sau stale fallback
9. Smoke output hoặc latest-smoke.json được lưu
10. Manual QA sign-off đã điền

## Naming convention đề xuất
- `01-login.png`
- `02-role-landing.png`
- `03-forbidden-fallback.png`
- `04-subscriptions-deeplink.png`
- `05-subscriptions-lifecycle.png`
- `06-parking-live-board.png`
- `07-parking-live-stale.png`
- `08-parking-live-reconcile.png`
- `09-smoke-output.png`
- `10-manual-signoff.png`

## Evidence fields bắt buộc
- build commit hoặc patch id
- ngày giờ chạy gate
- web base URL
- api base URL
- backend profile
- role đã test
- requestId/hint nếu có lỗi degraded hoặc error

## Manual QA topics bắt buộc
- login landing per role
- forbidden direct URL
- subscriptions selection recovery
- subscriptions detail error triage
- parking-live stale fallback
- parking-live reconcile freshness

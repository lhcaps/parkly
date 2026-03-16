# Frontend evidence bundle

Bundle này là checkpoint nhẹ cho shell smoke. Nó không thay thế manual operator flow.

## Bắt buộc có

- `latest-smoke.json`
- build log terminal
- screenshot pair origin
- screenshot mobile context summary
- screenshot heartbeat status
- screenshot capture status
- screenshot session/review detail sau mutation
- screenshot terminal lock banner nếu test case terminal
- `manual-qa-signoff.md`
- `release-evidence/frontend-mobile-review/bug-closure-notes.md`

## Cách dùng nhanh

1. Chạy `pnpm smoke:web` hoặc `pnpm smoke:web:dist`.
2. Lấy `latest-smoke.json` làm bằng chứng route shell.
3. Chạy manual flow theo `docs/RUNBOOK.md` mục frontend smoke.
4. Điền signoff và closure notes.

## Không được hiểu sai

- `latest-smoke.json` pass chỉ chứng minh shell route và health check cơ bản.
- Bug mobile capture hoặc review workflow chỉ được coi là đóng khi có thêm screenshot + requestId tương ứng.

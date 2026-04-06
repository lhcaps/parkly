# API Scripts

- `evidence/`: bộ script evidence vận hành và override theo từng PR.
- `seed-*.ts`: seed dữ liệu tối thiểu hoặc dữ liệu lớn.
- `drain-outbox.ts`, `requeue-outbox.ts`: thao tác outbox.
- `test-gate-event.ts`, `e2e-api.ts`: smoke test và legacy compatibility check.
- `release-bundle.ts`: mô tả fixture bootstrap/reset/smoke và RC gate dùng cho backend-rc1.
- `release-reset.ts`: reset demo data về baseline `seed_min` và tự áp lại MVP grants cho runtime user.
- `smoke-backend.ts`: smoke flow end-to-end login -> incident resolution -> audit, có preflight grant profile MVP.

## Canonical scripts sau BE-PR-19

- `pnpm rc:gate`: chạy typecheck + regression PR20→PR25 + `release:reset` + smoke bundle trên state hợp nhất.
- `pnpm rc:gate:reset`: alias rõ nghĩa cho `pnpm rc:gate` để người vận hành không phải nhớ thêm biến thể khác.
- `pnpm release:reset`: chỉ reset dữ liệu + grants về baseline RC1.
- `pnpm smoke:bundle`: chạy smoke tuyến `auth -> dashboard -> media(local) -> intake -> reconcile -> incident -> audit`.
- `pnpm shift:close:smoke`: smoke cho shift closure.
- `pnpm tariff:audit`: smoke cho tariff audit.

## Dọn alias cũ

- bỏ `demo:close-shift`
- bỏ `demo:tariff-audit`

Từ RC1 trở đi chỉ giữ tên canonical để tránh drift docs/runtime giữa patch notes và package scripts.

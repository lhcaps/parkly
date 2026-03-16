# API Runbook

Tài liệu vận hành API hiện nằm tại [`./docs/RUNBOOK.md`](./docs/RUNBOOK.md).

Trong `apps/api`, scripts evidence nằm tại [`src/scripts/evidence/`](./src/scripts/evidence/).
PR18 release hardening thêm:

- `pnpm release:reset`
- `pnpm smoke:bundle`
- `pnpm smoke:bundle:reset`

Lưu ý: release/smoke bundle tự áp grant profile MVP để login/auth/audit smoke không chết vì env DEVLOG.

Canonical RC1 scripts:

- `pnpm rc:gate`
- `pnpm rc:gate:reset`

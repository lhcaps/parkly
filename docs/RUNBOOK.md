# Parkly — Operations Runbook

Tài liệu này là bản dựng máy sạch và vận hành cho monorepo sau cutover Gate Operations Console.

## 1. Mục tiêu

Runbook này dùng cho 3 việc:

- dựng DB + API + Web trên máy sạch
- xác minh các flow ENTRY / EXIT / REVIEW / OUTBOX / SSE
- chuẩn bị evidence pack để chạy evidence hoặc nộp chấm

## 2. Prerequisites

- Node.js 20+
- pnpm 9+
- MySQL 8.0
- PowerShell 7+ trên Windows hoặc PowerShell Core trên macOS/Linux
- Flyway CLI khả dụng trong `PATH`

## 3. Bootstrap database

Từ root monorepo:

```bash
cd apps/api
pnpm db:info
pnpm db:migrate
pnpm db:validate
pnpm prisma:pull
pnpm db:grant:app
pnpm db:seed:min
```

Nếu DB đã chạy trước đó nhưng schema history bị lệch:

```bash
pnpm db:repair
pnpm db:migrate
pnpm prisma:pull
```

## 4. Chạy services

API:

```bash
cd apps/api
pnpm dev
```

Worker outbox:

```bash
cd apps/api
pnpm worker:dev
```

Web console:

```bash
cd apps/web
pnpm dev
```

## 5. Tokens mặc định

Dùng đúng token theo role để test quyền:

- `API_ADMIN_TOKEN`
- `API_OPS_TOKEN`
- `API_GUARD_TOKEN`
- `API_WORKER_TOKEN`

UI Operations Console dùng `OPS` hoặc `ADMIN` là hợp lý nhất.

## 6. Smoke checklist sau khi boot

### 6.1 API

```bash
GET /api/health
GET /api/me
GET /metrics
GET /openapi.json
```

### 6.2 Gate operations

```bash
GET /api/gate-sessions?limit=20
GET /api/gate-review-queue?limit=20
GET /api/devices
GET /api/outbox?limit=20
```

### 6.3 SSE

Mở 3 stream này bằng browser tab, curl `-N`, hoặc trực tiếp từ web console:

```text
/api/stream/lane-status
/api/stream/device-health
/api/stream/outbox
```

## 7. Evidence pack

Script evidence pack duy nhất nằm tại:

```text
apps/api/src/scripts/evidence/evidence-pack.ps1
```

Ví dụ chạy toàn bộ:

```powershell
pwsh -File .\apps\api\src\scripts\evidence\evidence-pack.ps1 -BaseUrl http://127.0.0.1:3000 -Token <OPS_OR_ADMIN_TOKEN> -Scenario all
```

Ví dụ chạy một scenario:

```powershell
pwsh -File .\apps\api\src\scripts\evidence\evidence-pack.ps1 -BaseUrl http://127.0.0.1:3000 -Token <OPS_OR_ADMIN_TOKEN> -Scenario anti-passback-blocked
```

## 8. Trình tự evidence đề xuất

1. Console Overview
2. Lane Monitor
3. Device Health
4. Review Queue
5. Session History
6. Outbox Monitor
7. chạy evidence pack cho ENTRY / REVIEW / OUTBOX / BARRIER TIMEOUT

## 9. Khi có lỗi

### Prisma pull fail vì relation thiếu

Fix model `parking_sites` phải có:

```prisma
gate_active_presence  gate_active_presence[]
```

### SSE không lên

Kiểm tra:

- token có hợp lệ không
- API có mount `/api/stream/*` không
- browser có bị proxy/Vite rewrite sai không

### Outbox đứng im

Kiểm tra:

- `pnpm worker:dev`
- `GET /api/outbox`
- `GET /api/stream/outbox`
- `POST /api/outbox/drain`

## 10. Layout tài liệu sau hardening

- `docs/RUNBOOK.md`: dựng máy sạch và vận hành
- `docs/API.md`: surface API thật đang sống
- `docs/EVIDENCE.md`: checklist và script evidence
- `docs/archive/*`: patch notes cũ và ghi chú lịch sử

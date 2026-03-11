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
- Docker Desktop hoặc Docker Engine + Compose plugin
- MySQL 8.0
- PowerShell 7+ trên Windows hoặc PowerShell Core trên macOS/Linux
- Flyway CLI khả dụng trong `PATH`

## 3. Bootstrap platform services

Spin-up Redis + MinIO local bằng một lệnh từ root monorepo:

```bash
docker compose -f infra/docker/docker-compose.platform.yml up -d
```

Kiểm tra nhanh:

```bash
docker compose -f infra/docker/docker-compose.platform.yml ps
```

Redis foundation PR-01 dùng các biến env sau:

```dotenv
REDIS_URL=redis://127.0.0.1:6379
REDIS_PREFIX=parkly:development
REDIS_DB=0
REDIS_REQUIRED=OFF
REDIS_TLS=OFF
```

Khi muốn API fail-fast nếu Redis chết, đặt `REDIS_REQUIRED=ON`.

S3 / MinIO foundation PR-05 dùng các biến env sau:

```dotenv
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET_MEDIA=parkly-media
S3_FORCE_PATH_STYLE=ON
S3_USE_SSL=OFF
```

Lưu ý bắt buộc với MinIO local: `S3_FORCE_PATH_STYLE=ON`. Sai flag này là lỗi phổ biến nhất khi presign hoặc HeadBucket.

## 4. Bootstrap database

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

## 5. Chạy services

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

## 6. Tokens mặc định

Dùng đúng token theo role để test quyền:

- `API_ADMIN_TOKEN`
- `API_OPS_TOKEN`
- `API_GUARD_TOKEN`
- `API_WORKER_TOKEN`

UI Operations Console dùng `OPS` hoặc `ADMIN` là hợp lý nhất.

## 7. Smoke checklist sau khi boot

### 7.1 API

```bash
GET /api/health
GET /api/ready
GET /api/me
GET /metrics
GET /openapi.json
pnpm storage:smoke
```

`/api/health` trả dependency surface để nhìn nhanh trạng thái Redis và object storage.
`/api/ready` tiếp tục dùng readiness semantics cho dependency bắt buộc; ở PR-05 object storage đang dark-launch nên chưa block readiness mặc định.
`pnpm storage:smoke` phải PASS đủ chuỗi `put-object -> head-object -> presign GET -> expiry -> delete`.

### 7.2 Gate operations

```bash
GET /api/gate-sessions?limit=20
GET /api/gate-review-queue?limit=20
GET /api/devices
GET /api/outbox?limit=20
```

### 7.3 SSE

Mở 3 stream này bằng browser tab, curl `-N`, hoặc trực tiếp từ web console:

```text
/api/stream/lane-status
/api/stream/device-health
/api/stream/outbox
```

## 8. Evidence pack

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

## 9. Trình tự evidence đề xuất

1. Console Overview
2. Lane Monitor
3. Device Health
4. Review Queue
5. Session History
6. Outbox Monitor
7. chạy evidence pack cho ENTRY / REVIEW / OUTBOX / BARRIER TIMEOUT

## 10. Khi có lỗi

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

## 11. Layout tài liệu sau hardening

- `docs/RUNBOOK.md`: dựng máy sạch và vận hành
- `docs/API.md`: surface API thật đang sống
- `docs/EVIDENCE.md`: checklist và script evidence
- `docs/archive/*`: patch notes cũ và ghi chú lịch sử

### Redis optional mode không lên

Kiểm tra:

- `docker compose -f infra/docker/docker-compose.platform.yml up -d redis`
- `GET /api/health` để xem `dependencies.redis`
- `GET /api/ready` để xác nhận service còn ready hay không theo policy `REDIS_REQUIRED`
- `REDIS_URL`, `REDIS_DB`, `REDIS_TLS`, `REDIS_PREFIX` trong `.env`

## 12. Object storage / MinIO smoke

Từ `apps/api`:

```bash
pnpm storage:smoke
```

Kết quả PASS tối thiểu phải chứng minh được:

- upload object vào bucket `parkly-media`
- head-object đọc lại được metadata
- presigned GET dùng được trước TTL
- URL hết hạn đúng TTL
- delete xong thì head-object không còn thấy object

Nếu lỗi presign hoặc HeadBucket, kiểm tra đầu tiên là `S3_FORCE_PATH_STYLE=ON` và bucket đã được bootstrap bởi `minio-init`.

# Parkly — CHCSDL (Quản lý Bãi Giữ Xe Multi-site)

Mục tiêu của repo này là **DB-centric**: thiết kế schema MySQL 8 theo hướng doanh nghiệp (ACID, concurrency, idempotency, audit, index/EXPLAIN, partitioning) và vận hành **Hybrid Event Model** (MySQL metadata + Mongo raw payload) với **Outbox**.

## 1) Yêu cầu môi trường

- MySQL 8.x
- MongoDB (optional nhưng nên có để kiểm tra outbox)
- Node.js + pnpm

## 2) Chạy migrations (Flyway)

Flyway config (`db/flyway.conf`) được **generate tự động** từ `.env` (admin creds).

- Admin (Flyway/seed reset): `DATABASE_URL_ADMIN` (hoặc `DATABASE_ADMIN_*`)
- App runtime (least-privilege): `DATABASE_URL` / `DATABASE_*`

> Lưu ý: `db/flyway.conf` là file generated **không commit/nộp**; dùng `db/flyway.conf.example` để tham khảo format.

```bash
copy .env.example .env
```

```bash
pnpm install
pnpm flyway:conf
pnpm db:validate
pnpm db:migrate
pnpm db:info
```

> Lưu ý: Migration V8 bổ sung tracking cho outbox (`sent_at`, `updated_at`) và retry exponential backoff.

## 3) Seed tối thiểu (DEV)

### Cách 1 (khuyến nghị): chạy bằng pnpm

```bash
pnpm db:seed:min
```

### Cách 2: chạy bằng DBeaver

Chạy `db/seed/seed_min.sql` trong MySQL client:

- Tạo 1 `parking_site`
- Tạo 1 `gate_device` (ENTRY)

## 4) Kiểm tra idempotency + outbox

### 4.1 Ghi gate event (MySQL + outbox)

```bash
pnpm test:gate-event
```

Kỳ vọng:

- Retry cùng `siteId + idempotencyKey + eventTime` **không tạo thêm row** trong `gate_events`.
- `gate_event_outbox` có row `PENDING` (hoặc `SENT` nếu Mongo chạy).

### 4.2 Drain outbox sang Mongo

```bash
pnpm outbox:drain
```

Kỳ vọng:

- Nếu Mongo đang chạy: outbox chuyển `SENT` + có `mongo_doc_id`.
- Nếu Mongo down: outbox tăng `attempts`, set `next_retry_at` theo **exponential backoff**, quá `OUTBOX_MAX_ATTEMPTS` -> `FAILED`.

Query nhanh để kiểm tra outbox (MySQL):

```sql
SELECT outbox_id, status, sent_at, attempts, mongo_doc_id, last_error, created_at, updated_at, next_retry_at
FROM parking_mgmt.gate_event_outbox
ORDER BY outbox_id DESC
LIMIT 10;
```

## 5) Partition rolling

Xem `db/scripts/rolling_partitions_gate_events.sql` để thêm partition tháng mới (pattern REORGANIZE `p_future`).

## 6) Audit triggers (tariffs)

Migrations `V7__audit_triggers_tariffs.sql` tạo trigger ghi vào `audit_logs` cho `tariffs` và `tariff_rules`.

Để audit có đúng `actor_user_id`, app nên set session var trước khi thao tác:

```sql
SET @actor_user_id = 123; -- user thực hiện
```

Nếu không set, trigger fallback `actor_user_id = 0` (SYSTEM).

Smoke test nhanh (cần profile MVP):

```bash
pnpm tariff:audit
```

## 7) Stored procedure chốt ca

`V6__shift_closures_and_procedure.sql` tạo procedure `sp_close_shift(...)`:

```sql
CALL sp_close_shift(
  1,
  'SHIFT_2026_02_24_MORNING',
  '2026-02-24 07:00:00',
  '2026-02-24 12:00:00',
  1
);
```

Policy hiện tại: nếu còn `tickets.OPEN` trong khoảng thời gian -> procedure **chặn**.

Smoke test nhanh (cần profile MVP):

```bash
pnpm shift:close:smoke
```

## 8) Quyền DB (least-privilege)

Script: `db/scripts/grants_parking_app.sql`

- Profile **LOG-ONLY**: đúng tinh thần event log/outbox.
- Profile **MVP**: đủ quyền để triển khai full nghiệp vụ (tickets/payments/subscriptions/RBAC...)

Từ bản bổ sung API, script `pnpm db:grant:app` hỗ trợ chọn profile bằng env:

- `PARKLY_APP_PROFILE=DEVLOG` → apply `db/scripts/grants_parking_app.devlog.sql` (mặc định)
- `PARKLY_APP_PROFILE=MVP`   → apply `db/scripts/grants_parking_app.mvp.sql`

## 9) EXPLAIN / Reporting pack

Seed dataset lớn (>=100k gate_events):

```bash
pnpm db:seed:big
```

Sau đó chạy script EXPLAIN ở `db/scripts/` và chụp ảnh EXPLAIN (có cả biến thể `IGNORE INDEX`).

> Muốn seed lại: `pnpm db:seed:reset`.

## 10) Tài liệu hướng dẫn

- `docs/RUNBOOK.md` (one-shot + checklist evidence)
- `docs/DBEAVER_MONGO_GUIDE.md` (DBeaver/Mongo Compass)
- `docs/EXPLAIN_PACK.md` (ảnh EXPLAIN cần chụp)

Tài liệu Word gốc:

- thư mục `docs/spec/` chứa bản spec Word và kế hoạch bàn giao lịch sử

## 10.1) Backend API (Fastify) — HTTP flow chạy end-to-end

Repo gốc là **DB-centric** (CLI scripts). Tuy nhiên để dễ chạy như một "app hoạt động được", repo đã bổ sung **API backend** tối thiểu:

- Gate events (ENTRY/EXIT) + idempotency
- Outbox drain/requeue + monitor
- Tariff CRUD tối thiểu + audit logs
- Shift closure (wrap stored procedure) + seed nghiệp vụ tối thiểu
- Swagger UI

### Chạy API

```bash
pnpm install
copy .env.example .env
pnpm api:dev
```

Swagger UI: `http://API_HOST:API_PORT/docs`

### Chạy UI (web, không build)

UI được serve trực tiếp bởi Fastify (static):

- `http://API_HOST:API_PORT/ui/`

UI gồm:

- Legacy capture surface: camera/file capture → upload → ALPR fallback → gửi gate event (idempotency)
- Dashboard: realtime SSE gate events + outbox
- Admin: tariffs/quote, shift close, reports, outbox list

### Local token auth

Mặc định `API_AUTH_MODE=ON`, các endpoint yêu cầu:

```
Authorization: Bearer <token>
```

Token nằm trong `.env`: `API_ADMIN_TOKEN / API_OPS_TOKEN / API_GUARD_TOKEN / API_WORKER_TOKEN`.

### E2E qua API

Chạy e2e ở mức **API-level** (không cần mở port):

```bash
pnpm test:api-e2e
```

Muốn chạy full (tariff + shift) thì cần bật **MVP grants** (xem mục 8) và set:

```bash
set PARKLY_E2E_FULL=1
pnpm test:api-e2e
```


## 11) Đóng gói nộp bài (teacher-proof)

```bash
pnpm pack:submit
```

Zip sẽ được tạo trong thư mục `dist/` và tự loại các file nhạy cảm (.env*, flyway.conf), node_modules, logs, *.rar.

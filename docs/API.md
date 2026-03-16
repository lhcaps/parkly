# Parkly API — RC1 Contract Baseline (backend-rc1)

Tài liệu này chốt contract backend để frontend có thể code và generate type ổn định, không phải đoán field fallback.

## 0. RC1 consolidation note

BE-PR-19 gom state release candidate quanh cụm regression `PR20→PR25` trong repo hiện tại:

- `PR20`: auth + RBAC
- `PR21`: contract freeze
- `PR22`: dashboard read models
- `PR23`: audit hardening
- `PR24`: incident noise control
- `PR25`: release hardening

Lý do nói thẳng điều này: nội dung scope “auth, contract, dashboard, audit, incident noise control, release hardening” không map vào PR13→PR18 của codebase hiện tại, mà map vào PR20→PR25. RC1 vì thế được freeze theo runtime thật, không theo tên patch lịch sử.

## 1. Envelope chuẩn

### Success envelope

Mọi HTTP response thành công dùng một envelope duy nhất:

```json
{
  "requestId": "8d9651f8-7a77-4f4b-8c78-0a9a9c4f3f2d",
  "data": {}
}
```

### Error envelope

Mọi HTTP response lỗi dùng một envelope duy nhất:

```json
{
  "requestId": "8d9651f8-7a77-4f4b-8c78-0a9a9c4f3f2d",
  "code": "BAD_REQUEST",
  "message": "Cursor không hợp lệ",
  "details": {}
}
```

### Error code enum đã chốt

- `BAD_REQUEST`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `UNPROCESSABLE_ENTITY`
- `UNSUPPORTED_MEDIA_TYPE`
- `PAYLOAD_TOO_LARGE`
- `SERVICE_UNAVAILABLE`
- `INTERNAL_ERROR`

## 2. Validation policy đã chốt

- Tất cả request query/body chính đi qua validation tập trung.
- Validation fail trả `400 BAD_REQUEST` với `details` từ schema validation.
- Cursor sai format luôn trả `BAD_REQUEST` thay vì silently ignore.
- Numeric id path param sai format luôn trả `BAD_REQUEST`.

## 3. Pagination / filter / sort policy đã chốt

### Cursor page envelope

Các list API dạng cursor phải trả:

```json
{
  "rows": [],
  "nextCursor": "opaque-or-id",
  "pageInfo": {
    "type": "CURSOR",
    "limit": 50,
    "nextCursor": "opaque-or-id",
    "hasMore": true,
    "sort": "sessionId:desc"
  }
}
```

### Quy ước chung

- `limit`: luôn là số nguyên dương, backend clamp theo endpoint.
- `cursor`: luôn là string opaque hoặc numeric string tùy endpoint; frontend không tự suy luận khác hợp đồng.
- `nextCursor`: luôn `string | null`.
- `sort`: luôn là string canonical, không để frontend tự đoán mặc định.
- Filter enum dùng uppercase ổn định.

## 4. Snapshot/state query vs realtime delta

### Snapshot / state query

Các route sau là nguồn dựng state hiện tại hoặc lịch sử có thể phân trang:

- `GET /api/health`
- `GET /api/ready`
- `GET /api/ops/metrics/summary`
- `GET /api/auth/me`
- `GET /api/sites`
- `GET /api/gates?siteCode=...`
- `GET /api/lanes?siteCode=...`
- `GET /api/devices?siteCode=...`
- `GET /api/topology?siteCode=...`
- `GET /api/gate-sessions?...`
- `GET /api/gate-sessions/:sessionId`
- `GET /api/gate-review-queue?...`
- `GET /api/ops/lane-status?...`
- `GET /api/ops/device-health?...`
- `GET /api/ops/dashboard/summary?...`
- `GET /api/ops/dashboard/sites/:siteCode/summary?...`
- `GET /api/ops/dashboard/incidents/summary?...`
- `GET /api/ops/dashboard/occupancy/summary?...`
- `GET /api/ops/dashboard/lanes/summary?...`
- `GET /api/ops/dashboard/subscriptions/summary?...`
- `GET /api/ops/incidents?...`
- `GET /api/ops/incidents/:incidentId`
- `GET /api/ops/audit?...`
- `GET /api/ops/audit/:auditId`
- `GET /api/ops/spot-occupancy?...`
- `GET /api/ops/spot-occupancy/:spotCode?...`
- `GET /api/outbox?...`
- `GET /api/gate-events?...`
- `GET /api/admin/subscriptions?...`
- `GET /api/admin/subscriptions/:subscriptionId`
- `GET /api/admin/subscription-spots?...`
- `GET /api/admin/subscription-vehicles?...`

### Realtime delta stream

Các stream sau chỉ là delta realtime, không phải nguồn dựng full state dài hạn:

- `GET /api/stream/gate-events`
- `GET /api/stream/lane-status`
- `GET /api/stream/device-health`
- `GET /api/stream/outbox`
- `GET /api/stream/incidents`

Frontend phải hydrate lần đầu từ snapshot query, sau đó mới ghép SSE delta.

## 5. Auth contract đã chốt

- `GET /api/auth/password-policy`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/revoke-all`
- `POST /api/auth/admin/users/:userId/revoke-all`
- `POST /api/auth/admin/users/:userId/disable`
- `POST /api/auth/admin/users/:userId/enable`
- `GET /api/auth/me`

User auth tách khỏi:

- device capture auth
- internal service auth

Frontend người dùng không còn phụ thuộc static env role token.

### 5.1 Security layer 2 / session hygiene

- login failure được track theo bucket `USERNAME` và `USERNAME_IP`
- repeated failure có progressive delay trước khi lên short lockout
- code HTTP vẫn giữ envelope chuẩn; chi tiết security đi trong `details.reasonCode`
- self-service revoke-all và admin revoke-all dùng chung audit trail `AUTH_SESSION_REVOKE_ALL`
- forced logout / session eviction dùng các action `AUTH_SESSION_FORCED_LOGOUT` và `AUTH_SESSION_LIMIT_EVICT`
- cleanup session stale chạy qua script `pnpm --dir apps/api auth:sessions:cleanup`
- seed credential `ops / Parkly@123` chỉ hợp lệ cho local/demo profile, không phải production default

## 6. Primary list contracts đã chốt

### Gate sessions

- Route: `GET /api/gate-sessions`
- Sort: `sessionId:desc`
- Filter: `siteCode`, `laneCode`, `status`, `direction`, `from`, `to`
- Cursor: numeric string

### Review queue

- Route: `GET /api/gate-review-queue`
- Sort: `reviewId:desc`
- Filter: `siteCode`, `status`
- Cursor: numeric string

### Lane status snapshot

- Route: `GET /api/ops/lane-status`
- Sort: `siteCode:asc,gateCode:asc,laneCode:asc`
- Cursor: opaque base64url tuple cursor


## 6. Observability + health breakdown

- `GET /metrics`: Prometheus scrape endpoint cho metric text format.
- `GET /api/ops/metrics/summary`: debug summary low-cardinality cho operator/QA sau smoke run, gồm cả `summary.secretSafety`.
- `GET /api/health`: health breakdown theo component, không chỉ trả một cờ xanh/đỏ; từ BE-PR-34 phải có thêm `components.secretSafety`.
- `GET /api/ready`: readiness giữ semantics chặt hơn cho component bắt buộc.

### Health breakdown

`GET /api/health` và `GET /api/ready` hiện phải trả breakdown tối thiểu theo:

- `components.db`
- `components.redis`
- `components.mediaStorage`
- `components.intakeSigning`
- `components.backgroundJobs.authSessionCleanup`

Status chuẩn hóa dùng các giá trị low-cardinality:

- `READY`
- `DEGRADED`
- `NOT_READY`
- `MISCONFIGURED`

`ready=true` chỉ được giữ khi DB sống, intake signing đủ cấu hình, media storage sẵn sàng, và Redis sống nếu `REDIS_REQUIRED=ON`.

### Metrics summary

Route `GET /api/ops/metrics/summary` trả JSON tóm tắt để nhìn nhanh sau smoke hoặc local QA. Payload tối thiểu phải có:

- `summary.totals.requests`
- `summary.totals.errors`
- `summary.operations[]` với `surface`, `action`, `requests`, `errors`, `lastDurationMs`, `avgDurationMs`, `budgetMs`, `withinBudget`
- `summary.incidents` với các counter như `AUTO_OPEN`, `AUTO_REOPEN`, `RESOLVE`, `SUPPRESS`
- `health` nhúng lại breakdown hiện tại để operator biết thành phần nào đang đỏ

Low-cardinality surface/action hiện chốt cho smoke tuyến chuẩn:

- `AUTH/LOGIN`
- `DASHBOARD/SUMMARY`
- `MEDIA/UPLOAD`
- `INTAKE/INGEST`
- `RECONCILE/REFRESH`
- `INCIDENT/RESOLVE`
- `AUDIT/LIST`

### Correlation tracing

- Mọi request tiếp tục đi qua header `x-correlation-id`.
- Script `smoke:bundle` phải tự gửi correlation root dạng `smoke:<timestamp>:<step>` để log và metrics summary có thể lần lại cùng một run.
- Khi debug production-like issue, ưu tiên giữ `requestId` và `correlationId` cùng nhau thay vì chỉ copy status code.

### Device health snapshot

- Route: `GET /api/ops/device-health`
- Sort: `siteCode:asc,gateCode:asc,laneCode:asc,deviceCode:asc`
- Cursor: opaque base64url tuple cursor

### Incidents

- Route: `GET /api/ops/incidents`
- Sort: `incidentId:desc`
- Filter: `siteCode`, `status`, `severity`, `incidentType`, `sourceKey`
- Cursor: numeric string

### Outbox

- Route: `GET /api/outbox`
- Sort: `outboxId:desc`
- Filter: `siteCode`, `status`
- Cursor: numeric string

### Legacy gate events

- Route: `GET /api/gate-events`
- Sort: `eventId:desc` mặc định, hoặc `eventId:asc` nếu query incremental bằng `sinceEventId`
- Filter: `siteCode`, `deviceCode`, `sinceEventId`, `sinceTime`
- Cursor tiếp trang: `nextCursor`

### Admin subscriptions

- `GET /api/admin/subscriptions` → `sort = subscriptionId:desc`
- `GET /api/admin/subscription-spots` → `sort = subscriptionSpotId:desc`
- `GET /api/admin/subscription-vehicles` → `sort = subscriptionVehicleId:desc`

## 7. Enum naming đã chốt

Các enum transport-level dùng uppercase snake/caps ổn định, ví dụ:

- session status
- incident status
- outbox status
- direction (`ENTRY`, `EXIT`)
- auth error code
- heartbeat / device health state

Không trả enum kiểu lẫn lộn giữa lowercase, title-case và uppercase cho cùng một semantic.

## 8. Request tracing đã chốt

Mọi HTTP response luôn có:

- header `x-request-id`
- header `x-correlation-id`

Success/error envelope luôn mang `requestId`.

## 9. Frontend guidance chốt thẳng

- Render error từ `code`, `message`, `details`, `requestId`.
- Không parse nested `error.code` nữa.
- Không tự đoán sort mặc định cho list API.
- Không coi SSE là nguồn lịch sử đầy đủ.
- Dùng `pageInfo.sort` và `pageInfo.nextCursor` làm contract chuẩn.


## 10. Dashboard read model contracts đã chốt

Mục tiêu của PR15 là để homepage / overview screen dựng được từ một hoặc hai call summary, không phải tự hot-join nhiều raw endpoint ở frontend.

### Endpoint chính

- `GET /api/ops/dashboard/summary`
- `GET /api/ops/dashboard/sites/:siteCode/summary`
- `GET /api/ops/dashboard/incidents/summary`
- `GET /api/ops/dashboard/occupancy/summary`
- `GET /api/ops/dashboard/lanes/summary`
- `GET /api/ops/dashboard/subscriptions/summary`

### Filter semantics đã chốt

- `siteCode`: scope về đúng một site nếu caller có quyền.
- Không truyền `siteCode`: backend tự expand theo site scopes của principal.
- `sinceHours`: dùng cho dashboard incidents / overview để diễn giải window gần đây, mặc định 24h.
- `expiringInDays`: dùng cho subscription expiry window, mặc định 7 ngày.

### Scope semantics đã chốt

- `ADMIN`, `OPS`: được xem toàn bộ active sites nếu account không bị giới hạn site scope.
- Các role còn lại: phải nằm trong `user_site_scopes`, backend không cho cross-site join lậu từ frontend.
- Nếu hỏi site không tồn tại → `NOT_FOUND`.
- Nếu hỏi site có tồn tại nhưng ngoài quyền → `FORBIDDEN`.

### Summary response shape đã chốt

`GET /api/ops/dashboard/summary` trả một document ổn định gồm:

- `generatedAt`
- `scope`
- `filters`
- `overview`
- `incidents`
- `occupancy`
- `lanes`
- `subscriptions`
- `sites`

Trong đó:

- `overview` là bộ card để render homepage nhanh.
- `sites` là breakdown theo site để frontend không phải tự group lại.
- Các route summary theo slice (`incidents`, `occupancy`, `lanes`, `subscriptions`) giữ cùng semantics `generatedAt + scope + filters + summary + sites`.

### Frontend guidance chốt thẳng cho homepage

- Multi-site homepage: gọi `GET /api/ops/dashboard/summary` là đủ.
- Site detail homepage: gọi `GET /api/ops/dashboard/sites/:siteCode/summary` là đủ.
- Chỉ gọi thêm slice endpoint nếu muốn refresh riêng một card/module mà không reload full overview.


## 10. Dashboard summary contract

Frontend homepage nên dựng từ một hoặc hai call summary, không hot-join nhiều raw endpoint:

- `GET /api/ops/dashboard/summary`
- `GET /api/ops/dashboard/sites/:siteCode/summary`

## 11. Audit action history contract

Audit là action history append-only cấp platform cho các mutate path quan trọng.

### Ops audit read APIs

- `GET /api/ops/audit`
- `GET /api/ops/audit/:auditId`

### Audit record shape

Mỗi audit record phải có tối thiểu:

- `auditId`
- `siteId`, `siteCode`
- `actorUserId`
- `actor` snapshot
- `action`
- `entityTable`, `entityId`
- `beforeSnapshot`
- `afterSnapshot`
- `requestId`
- `correlationId`
- `occurredAt`
- `createdAt`

### Filter semantics đã chốt

`GET /api/ops/audit` hỗ trợ filter ổn định theo:

- `siteCode`
- `actorUserId`
- `action`
- `entityTable`
- `entityId`
- `requestId`
- `correlationId`
- `from`
- `to`
- `cursor`
- `limit`

Sort canonical: `auditId:desc`

### Coverage đã chốt

Các mutate path sau phải ghi audit record theo một service chung:

- auth login / refresh / logout
- incident auto open / auto update / resolve
- review claim / manual approve / manual reject / manual open barrier
- subscription CRUD / spot assignment / vehicle assignment

Merge gate của frontend/ops: phải reconstruct được action quan trọng từ audit records mà không cần lần theo log rời rạc.

## 12. Incident noise-control policy đã chốt

PR17 chốt incident stream theo hướng operational signal thay vì raw reconcile noise.

### Dedupe / cooldown

- Incident từ reconciliation được gom theo `sourceKey` của spot.
- Signal lặp lại cùng fingerprint trong cooldown window chỉ refresh `lastSignalAt` và snapshot nội bộ.
- Không emit SSE mới cho mọi reconcile cycle giống hệt nhau.

### Grace thresholds

- `SENSOR_STALE`: có grace threshold trước khi mở incident chính thức.
- `MISSING_GATE_PRESENCE` / `PLATE_UNAVAILABLE`: có grace threshold để tránh flood ghost presence.
- `VIP_WRONG_SPOT` / `RESERVED_SPOT_OCCUPIED_BY_OTHER`: mở incident ngay nhưng các update lặp lại bị cooldown/dedupe.

### Reopen policy

- Incident đã `RESOLVED` hoặc `IGNORED` có thể `AUTO_REOPENED` nếu cùng source/fingerprint quay lại trong reopen window.
- Quá reopen window thì backend mở incident record mới thay vì tái sử dụng record cũ.

### Incident SSE semantics

`GET /api/stream/incidents` chỉ nên phát các state transition có ý nghĩa:

- `incident.opened`
- `incident.updated`
- `incident.reopened`
- `incident.resolved`

Frontend không được coi mỗi reconcile cycle là một incident event mới.

# API Patch Notes v4 / PR-04

## Đã chốt ở PR-04

- Capture API đã chuyển từ kiểu `requireAuth(...)` người dùng sang **device-signed ingest** thật cho 4 endpoint:
  - `POST /api/gate-reads/alpr`
  - `POST /api/gate-reads/rfid`
  - `POST /api/gate-reads/sensor`
  - `POST /api/devices/heartbeat`
- Contract trong `@parkly/contracts` đã bắt buộc các field thiết bị ký request:
  - `deviceCode`
  - `requestId`
  - `idempotencyKey`
  - `timestamp`
  - `signature`
  - `signatureVersion` = `capture-v1` (optional, reserved)
- Signature verification chạy ngay tại route bằng `verify-device-signature.ts`.
- Timestamp skew được reject rõ ràng:
  - quá cũ → `DEVICE_TIMESTAMP_EXPIRED`
  - lệch về tương lai → `DEVICE_TIMESTAMP_AHEAD`
  - format sai → `INVALID_CAPTURE_TIMESTAMP`
- Idempotency đã được siết đúng scope theo **read type + site + device**:
  - `capture:ALPR:<SITE>:<DEVICE>`
  - `capture:RFID:<SITE>:<DEVICE>`
  - `capture:SENSOR:<SITE>:<DEVICE>`
  - `capture:HEARTBEAT:<SITE>:<DEVICE>`
- Replay cùng `idempotencyKey` + cùng payload trả lại response deterministic từ `api_idempotency`.
- Cùng key nhưng payload khác trả `409 CONFLICT` với `reason = IDEMPOTENCY_CONFLICT`.
- Raw payload persist xuống DB đã được enrich thêm metadata xác thực:
  - `authority = DEVICE_SIGNATURE`
  - `verified`
  - `secretSource`
  - `requestTimestamp`
  - `maxSkewSeconds`
  - `serverRequestId`
  - `deviceRequestId`
- Log đã bổ sung các case bắt buộc:
  - `capture_auth_failed`
  - `capture_replay`
  - `capture_idempotency_conflict`
  - `capture_timestamp_rejected`
  - `capture_ingest_failed`

## File chính đã sửa

- `packages/contracts/src/index.ts`
- `apps/api/src/modules/gate/interfaces/http/register-gate-capture-routes.ts`
- `apps/api/src/modules/gate/application/verify-device-signature.ts`
- `apps/api/src/tests/pr04-capture-auth-idempotency.test.ts`
- `apps/api/.env.example`
- `apps/api/package.json`
- `package.json`

## Cách test nhanh

### 1) Chạy unit test PR-04

```bash
cd apps/api
node --import tsx --test src/tests/pr04-capture-auth-idempotency.test.ts
```

Hoặc từ root:

```bash
node --import ./apps/api/node_modules/tsx/dist/loader.mjs --test apps/api/src/tests/pr04-capture-auth-idempotency.test.ts
```

### 2) Env tối thiểu

```env
DEVICE_CAPTURE_AUTH_MODE=ON
DEVICE_CAPTURE_MAX_SKEW_SECONDS=300
DEVICE_CAPTURE_DEFAULT_SECRET=change_me_capture_secret
```

### 3) Signature canonical payload

Payload ký HMAC-SHA256 dùng format ổn định sau:

```json
{
  "v": "capture-v1",
  "surface": "POST /api/gate-reads/alpr",
  "readType": "ALPR",
  "siteCode": "SITE_HCM_01",
  "deviceCode": "GATE_01_ENTRY_CAMERA",
  "laneCode": "GATE_01_ENTRY",
  "direction": "ENTRY",
  "requestId": "req-alpr-001",
  "idempotencyKey": "idem-alpr-001",
  "timestamp": "2026-03-07T10:00:00.000Z",
  "eventTime": "2026-03-07T10:00:00.000Z",
  "reportedAt": null,
  "plateRaw": "51A12345",
  "rfidUid": null,
  "sensorState": null,
  "heartbeatStatus": null
}
```

### 4) Replay expectation

- gửi lại y hệt request + y hệt `idempotencyKey`
- backend không tạo row ingest mới
- response trả lại deterministic từ `api_idempotency`

### 5) Conflict expectation

- giữ nguyên `idempotencyKey`
- đổi `plateRaw` hoặc `rfidUid` hoặc `sensorState`
- backend trả `409 CONFLICT`

## Ghi chú

- `DeviceStatusSchema` tổng vẫn giữ `MAINTENANCE` cho các màn hình/device view.
- Riêng heartbeat ingest contract của PR-04 chỉ cho:
  - `ONLINE`
  - `DEGRADED`
  - `OFFLINE`

Lý do: migration/device heartbeat table hiện đang bám bộ giá trị này, không mở rộng thêm enum lặng lẽ ở PR-04.

# PR-04 — Capture APIs thật + Device Auth + Retry-safe Idempotency

## Những gì đã chốt trong patch này

### 1) Device auth chuẩn cho capture APIs
Tất cả các route sau đã yêu cầu thêm:
- `deviceCode`
- `requestId`
- `timestamp`
- `signature`

Routes áp dụng:
- `POST /api/gate-reads/alpr`
- `POST /api/gate-reads/rfid`
- `POST /api/gate-reads/sensor`
- `POST /api/devices/heartbeat`

Signature backend verify theo HMAC SHA-256 với payload chuẩn hoá `capture-v1`.

Nguồn secret hỗ trợ:
- `DEVICE_CAPTURE_SECRETS_JSON`
- `DEVICE_CAPTURE_SECRET_<DEVICE_CODE>`
- `DEVICE_CAPTURE_DEFAULT_SECRET`

### 2) Timestamp skew validation
Backend reject request nếu `timestamp` lệch quá ngưỡng:
- env: `DEVICE_CAPTURE_MAX_SKEW_SECONDS`
- mặc định: `300`

### 3) Retry-safe idempotency
- cùng `idempotencyKey` + cùng payload => replay deterministic
- cùng `idempotencyKey` + payload khác => `409 CONFLICT`
- key đang `IN_PROGRESS` hoặc `FAILED` => chặn replay bừa

### 4) Audit/log rõ hơn
Capture routes đã log rõ các case:
- auth fail (`DEVICE_SIGNATURE_*`, `DEVICE_SECRET_NOT_CONFIGURED`)
- replay deterministic
- idempotency conflict
- route fail chung

### 5) Metadata auth được giữ lại trong payload
`rawPayload` persist xuống read event / heartbeat bây giờ có thêm block:

```json
{
  "captureAuth": {
    "authority": "DEVICE_SIGNATURE",
    "verified": true,
    "secretSource": "DEVICE_CAPTURE_DEFAULT_SECRET",
    "requestTimestamp": "2026-03-07T12:34:56.000Z",
    "maxSkewSeconds": 300,
    "signatureVersion": "capture-v1"
  }
}
```

## Cách ký request mẫu

Payload canonical để ký là JSON ổn định theo version `capture-v1`, gồm các field:
- `surface`
- `readType`
- `siteCode`
- `deviceCode`
- `laneCode`
- `direction`
- `requestId`
- `idempotencyKey`
- `timestamp`
- `eventTime` / `reportedAt`
- `plateRaw` / `rfidUid` / `sensorState` / `heartbeatStatus`

Backend helper nằm ở:
- `apps/api/src/modules/gate/application/verify-device-signature.ts`

## File chính đã đụng
- `packages/contracts/src/index.ts`
- `apps/api/src/modules/gate/application/verify-device-signature.ts`
- `apps/api/src/modules/gate/interfaces/http/register-gate-capture-routes.ts`
- `apps/api/.env`
- `apps/api/.env.example`
- `apps/api/src/tests/pr04-capture-auth-idempotency.test.ts`

## Lưu ý
Patch này chưa thay người dùng thao tác tay trên web vì web hiện không phải client chính của capture APIs. Capture APIs ở đây được siết theo mô hình ingest thiết bị.

# Parkly API — Operations Surface

Tài liệu này chỉ liệt kê các endpoint vận hành đang sống và đã dùng trong web console.

## 1. Core health

- `GET /api/health`
- `GET /api/me`
- `GET /metrics`
- `GET /openapi.json`
- `GET /docs`

## 2. Master data / topology

- `GET /api/sites`
- `GET /api/gates?siteCode=...`
- `GET /api/lanes?siteCode=...`
- `GET /api/devices?siteCode=...`
- `GET /api/topology?siteCode=...`

## 3. Capture APIs thật

- `POST /api/gate-reads/alpr`
- `POST /api/gate-reads/rfid`
- `POST /api/gate-reads/sensor`
- `POST /api/devices/heartbeat`

Các route này yêu cầu ingest chuẩn thiết bị với `deviceCode`, `requestId`, `timestamp`, `signature`, `idempotencyKey`.

## 4. Session orchestration

- `POST /api/gate-sessions/open`
- `POST /api/gate-sessions/resolve`
- `GET /api/gate-sessions/:sessionId`
- `GET /api/gate-sessions?siteCode=...&status=...`
- `POST /api/gate-sessions/:sessionId/confirm-pass`
- `POST /api/gate-sessions/:sessionId/cancel`

### Manual override

- `POST /api/gate-sessions/:sessionId/manual-approve`
- `POST /api/gate-sessions/:sessionId/manual-reject`
- `POST /api/gate-sessions/:sessionId/manual-open-barrier`

## 5. Review queue

- `GET /api/gate-review-queue`
- `POST /api/gate-review-queue/:reviewId/claim`

## 6. Legacy compatibility

- `POST /api/gate-events`
- `GET /api/gate-events`

`POST /api/gate-events` vẫn sống để legacy clients không gãy. Backend map request này sang session model mới.

## 7. Outbox monitor / worker control

- `GET /api/outbox?limit=50&status=PENDING|SENT|FAILED`
- `POST /api/outbox/drain`
- `POST /api/outbox/requeue`

Role guard:

- list outbox: `ADMIN | OPS | WORKER`
- drain outbox: `ADMIN | WORKER`
- requeue outbox: `ADMIN | OPS`

## 8. SSE feeds

- `GET /api/stream/gate-events`
- `GET /api/stream/lane-status`
- `GET /api/stream/device-health`
- `GET /api/stream/outbox`

## 9. Observability

### Headers

- `x-request-id`: luôn trả về từ API
- `x-correlation-id`: giữ trace theo session / request chain

### Business metrics

- `gate_session_open_duration_ms`
- `gate_session_resolve_duration_ms`
- `gate_barrier_ack_timeout_total`
- `gate_review_queue_size`
- `gate_device_offline_count`
- `gate_outbox_backlog_size`

### Structured log fields

Các log quan trọng được gắn thêm:

- `requestId`
- `correlationId`
- `siteCode`
- `laneCode`
- `deviceCode`
- `sessionId`
- `decisionCode`

## 10. Role summary

- `GUARD`: queue, claim, open/resolve lane flow, không được outbox requeue
- `OPS`: review override, outbox requeue, lane operations
- `ADMIN`: toàn quyền
- `WORKER`: outbox drain / background path

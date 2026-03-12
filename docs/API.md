# Parkly API — Operations Surface

Tài liệu này chốt surface backend đang sống sau PR07 theo hướng tách rõ **query/snapshot API** và **SSE delta stream**.

## 1. Core health

- `GET /api/health`
- `GET /api/ready`
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
- `GET /api/gate-sessions?siteCode=...&status=...&cursor=...&limit=...`
- `POST /api/gate-sessions/:sessionId/confirm-pass`
- `POST /api/gate-sessions/:sessionId/cancel`

### Pagination contract

`GET /api/gate-sessions` trả thêm:

- `rows`
- `nextCursor`
- `pageInfo.limit`
- `pageInfo.nextCursor`
- `pageInfo.sort = "sessionId:desc"`

Session history luôn sort ổn định theo `session_id DESC`.

### Manual override

- `POST /api/gate-sessions/:sessionId/manual-approve`
- `POST /api/gate-sessions/:sessionId/manual-reject`
- `POST /api/gate-sessions/:sessionId/manual-open-barrier`

## 5. Review queue

- `GET /api/gate-review-queue?siteCode=...&status=...&cursor=...&limit=...`
- `POST /api/gate-review-queue/:reviewId/claim`

### Pagination contract

`GET /api/gate-review-queue` trả thêm:

- `rows`
- `nextCursor`
- `pageInfo.limit`
- `pageInfo.nextCursor`
- `pageInfo.sort = "reviewId:desc"`

Review queue query path được sort ổn định theo `review_id DESC`. SSE không còn là nguồn dựng lịch sử dài hạn.

## 6. Ops snapshot query routes

Các route này dành cho React Query / read model sau này. SSE chỉ đẩy delta; snapshot đầy đủ phải lấy ở query API.

- `GET /api/ops/lane-status?siteCode=...&cursor=...&limit=...`
- `GET /api/ops/device-health?siteCode=...&cursor=...&limit=...`

### Snapshot pagination contract

Hai route trên trả:

- `rows`
- `pageInfo.nextCursor`
- `pageInfo.hasMore`
- `pageInfo.limit`
- `pageInfo.sort`

Cursor là opaque cursor base64url, không nên tự parse ở frontend.

## 7. Legacy compatibility

- `POST /api/gate-events`
- `GET /api/gate-events`

`POST /api/gate-events` vẫn sống để legacy clients không gãy. Backend map request này sang session model mới.

## 8. Outbox monitor / worker control

- `GET /api/outbox?limit=50&status=PENDING|SENT|FAILED&cursor=...`
- `POST /api/outbox/drain`
- `POST /api/outbox/requeue`

Role guard:

- list outbox: `ADMIN | OPS | WORKER`
- drain outbox: `ADMIN | WORKER`
- requeue outbox: `ADMIN | OPS`

`GET /api/outbox` đã là query endpoint cho outbox monitor; SSE `/api/stream/outbox` chỉ dùng để nhận delta realtime.

## 9. SSE feeds

- `GET /api/stream/gate-events`
- `GET /api/stream/lane-status`
- `GET /api/stream/device-health`
- `GET /api/stream/outbox`

### Legacy event names vẫn còn sống

- `lane_status_snapshot`
- `device_health_snapshot`
- `outbox_snapshot`
- `hello`
- `stream_error`

Frontend cũ vẫn có thể subscribe như trước trong giai đoạn chuyển tiếp.

### Normalized SSE envelope mới

Ngoài legacy event, các stream trên còn phát `event: parkly_event` với envelope chuẩn:

```json
{
  "eventType": "lane.status.upsert",
  "sequence": 128,
  "occurredAt": "2026-03-12T09:30:00.000Z",
  "siteCode": "SITE_HCM_01",
  "laneCode": "GATE_01_ENTRY",
  "correlationId": null,
  "payload": {}
}
```

### Event naming đã chốt

- `lane.status.upsert`
- `lane.status.remove`
- `lane.barrier.lifecycle`
- `device.health.upsert`
- `device.health.remove`
- `outbox.item.upsert`
- `outbox.item.remove`
- `outbox.barrier.lifecycle`

### Replay / reconnect contract

- SSE response ghi `id: <channel>:<sequence>`
- Client có thể reconnect bằng `Last-Event-ID` header hoặc `?lastEventId=...`
- Server replay trong cửa sổ ngắn hạn theo `GATE_SSE_REPLAY_WINDOW` (mặc định 200 event mỗi channel)

## 10. Observability

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

## 11. Role summary

- `GUARD`: queue, claim, open/resolve lane flow, không được outbox requeue
- `OPS`: review override, outbox requeue, lane operations
- `ADMIN`: toàn quyền
- `WORKER`: outbox drain / background path

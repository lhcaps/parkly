# PR-09 — Barrier Commands + Device Health + SSE thật

## Những gì đã chốt

- Thêm 3 SSE feed thật:
  - `GET /api/stream/lane-status`
  - `GET /api/stream/device-health`
  - `GET /api/stream/outbox`
- Dashboard web không còn chỉ nghe raw gate events nữa; giờ nghe lane aggregate, device health và outbox snapshot từ backend.
- Device health được **derive từ heartbeat aging**, không tin mù vào raw status:
  - `ONLINE`
  - `DEGRADED`
  - `OFFLINE`
- Lane aggregate health được suy ra từ role thiết bị và barrier state:
  - `HEALTHY`
  - `DEGRADED_CAMERA`
  - `DEGRADED_RFID`
  - `DEGRADED_SENSOR`
  - `BARRIER_FAULT`
  - `OFFLINE`
- Barrier command lifecycle được đẩy thật bằng backend lifecycle pump:
  - `PENDING -> SENT -> TIMEOUT`
  - các trạng thái `ACKED / NACKED / CANCELLED` vẫn được tôn trọng nếu DB cập nhật bởi path khác.
- Outbox feed bây giờ nhìn thấy được `status / attempts / lastError / mongoDocId` thay vì chỉ xem gate event đã flatten.
- Vá luôn lỗi Prisma schema còn thiếu quan hệ ngược:
  - `parking_sites.gate_active_presence`

## File chính đã thêm/sửa

- `apps/api/src/server/services/gate-realtime.service.ts`
- `apps/api/src/modules/gate/interfaces/sse/register-lane-status-stream.ts`
- `apps/api/src/modules/gate/interfaces/sse/register-device-health-stream.ts`
- `apps/api/src/modules/gate/interfaces/sse/register-outbox-stream.ts`
- `apps/api/src/server/app.ts`
- `apps/api/prisma/schema.prisma`
- `packages/contracts/src/index.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/pages/DashboardPage.tsx`

## Threshold env dùng cho PR-09

- `GATE_REALTIME_DEVICE_DEGRADED_THRESHOLD_SECONDS`
- `GATE_REALTIME_DEVICE_OFFLINE_THRESHOLD_SECONDS`
- `GATE_BARRIER_ACK_TIMEOUT_SECONDS`
- `GATE_STREAM_POLL_MS`

Nếu không set thì backend fallback về threshold decision hoặc default an toàn.

## Cách evidence nhanh

1. Mở Dashboard web và vào tab Realtime.
2. Gửi heartbeat hợp lệ cho 1 thiết bị -> xem `device-health` chuyển `ONLINE`.
3. Ngừng heartbeat quá threshold -> xem `DEGRADED/OFFLINE`.
4. Chạy entry approved hoặc exit paid để phát sinh barrier `OPEN` -> chờ quá `GATE_BARRIER_ACK_TIMEOUT_SECONDS` nếu chưa ACK -> lane sẽ hiện `BARRIER_FAULT`, outbox/lane phản ánh timeout.
5. Chạy flow tạo event/outbox -> feed `/api/stream/outbox` sẽ có dòng thật.

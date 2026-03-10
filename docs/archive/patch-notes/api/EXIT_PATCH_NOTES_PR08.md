# PR-08 — Exit Workflow thật + Payment Gate

## Những gì đã chốt

- resolve open ticket ưu tiên **RFID trước**, rồi mới fallback sang **plateCompact**
- nếu RFID và plate trỏ 2 ticket khác nhau -> `PLATE_RFID_MISMATCH` -> `REVIEW`
- payment state business chuẩn:
  - `UNPAID`
  - `PENDING`
  - `PAID`
  - `WAIVED`
  - `SUBSCRIPTION_COVERED`
- bridge payment/tariff lấy từ:
  - `tickets`
  - `payments`
  - `tariffs`
  - `tariff_rules`
  - `credentials/subscriptions`
- EXIT approve path sẽ:
  - tạo barrier command `OPEN`
  - đóng ticket
  - clear active presence
  - update session sang `PASSED`
- EXIT unpaid sẽ giữ ở `WAITING_PAYMENT`
- EXIT ticket not found không silent fail nữa, sẽ trả `TICKET_NOT_FOUND` + `REVIEW`
- legacy `POST /api/gate-events` direction `EXIT` đã map sang flow session mới
- fix luôn Prisma schema relation bị thiếu ở `parking_sites.gate_active_presence`

## File chính

- `apps/api/src/modules/gate/application/process-exit.ts`
- `apps/api/src/server/services/payment-status-resolver.ts`
- `apps/api/src/server/services/ticket-service.ts`
- `apps/api/src/server/services/tariff.service.ts`
- `apps/api/src/modules/gate/application/decision-engine.ts`
- `apps/api/src/modules/gate/application/resolve-session.ts`
- `apps/api/src/services/event.service.ts`
- `apps/api/src/server/app.ts`
- `packages/gate-core/src/decision.ts`
- `apps/web/src/pages/GatePage.tsx`
- `apps/web/src/pages/SessionsPage.tsx`
- `apps/api/prisma/schema.prisma`

## Lưu ý

- schema DB không cần migration mới cho PR-08
- payment state `PENDING` ở đây là **business state suy diễn** khi ticket đã có thanh toán một phần nhưng vẫn còn thiếu tiền
- `WAIVED` được dùng khi tariff bridge tính ra `amountDue <= 0`

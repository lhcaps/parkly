# PR-05 — Session Orchestration Core

## Đã chốt

- Thêm migration `V14__gate_session_waiting_read.sql`
- Thêm `WAITING_READ` vào session state machine backend + Prisma schema
- Chốt active statuses gồm: `OPEN`, `WAITING_READ`, `WAITING_DECISION`, `APPROVED`, `WAITING_PAYMENT`
- Backend trả `allowedActions` theo state machine, frontend render theo backend, không đoán nữa
- `sensor PRESENT/TRIGGERED` đưa session sang `WAITING_READ`
- `ALPR/RFID` đưa session sang `WAITING_DECISION` nếu session còn ở `OPEN/WAITING_READ`
- `timeout` cũ bị đóng `TIMEOUT`, request mới sẽ mở session mới
- Capture session orchestration cũng được đồng bộ lại để reuse/timeout không lệch với session APIs
- GatePage cleanup flow chính theo tinh thần PR-05: `SENSOR -> WAITING_READ -> ALPR -> WAITING_DECISION`

## Files chính đã sửa

- `apps/api/db/migrations/V14__gate_session_waiting_read.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/gate/domain/session.ts`
- `apps/api/src/modules/gate/application/open-session.ts`
- `apps/api/src/modules/gate/application/resolve-session.ts`
- `apps/api/src/modules/gate/infrastructure/gate-read-events.repo.ts`
- `apps/api/src/modules/gate/application/ingest-alpr-read.ts`
- `apps/api/src/modules/gate/application/ingest-rfid-read.ts`
- `apps/api/src/modules/gate/application/ingest-sensor-read.ts`
- `packages/contracts/src/index.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/pages/GatePage.tsx`
- `apps/web/src/pages/SessionsPage.tsx`
- `apps/api/src/tests/pr05-session-orchestration.test.ts`

## Evidence nên chạy ở máy bạn

### 1) Sensor PRESENT rồi ALPR cùng lane -> cùng session

1. POST `/api/gate-sessions/open` với `readType=SENSOR`, `sensorState=PRESENT`
2. Ghi nhận `session.status = WAITING_READ`
3. POST `/api/gate-sessions/resolve` với `sessionId` ở trên, `readType=ALPR`, `plateRaw=...`
4. Kỳ vọng:
   - `sessionId` giữ nguyên
   - `status = WAITING_DECISION`
   - `timeline` có ít nhất `READ -> DECISION`

### 2) Timeout -> session mới

- set `GATE_SESSION_REUSE_WINDOW_MS` rất ngắn hoặc đợi quá window
- gọi lại open cùng lane
- kỳ vọng session cũ thành `TIMEOUT`, session mới có `sessionId` khác

### 3) allowedActions

- GET `/api/gate-sessions/:sessionId`
- Kỳ vọng:
  - `WAITING_READ -> ['CANCEL']`
  - `WAITING_DECISION -> ['APPROVE','REQUIRE_PAYMENT','DENY','CANCEL']`
  - `APPROVED -> ['CONFIRM_PASS','DENY','CANCEL']`
  - `PASSED -> []`

# PR-07 — Entry Workflow thật + Anti-passback

## Đã chốt

- ENTRY approved sẽ tự:
  - tạo/open ticket thật
  - upsert `gate_active_presence`
  - tạo `gate_barrier_commands` loại `OPEN`
- Decision engine đã thêm anti-passback theo site với key check:
  - `ticketId`
  - `plateCompact`
  - `rfidUid`
- RFID `LOST/BLOCKED` bị deny rõ bằng reason code riêng.
- Legacy `POST /api/gate-events` khi `direction=ENTRY` sẽ map sang flow session/decision mới nhưng vẫn giữ response cũ cho demo/feed.
- Review path sẽ mở manual review queue nếu chưa có.
- Deny path sẽ ghi incident với `reasonCode`/`reasonDetail` rõ.

## File chính

- `apps/api/db/migrations/V15__gate_entry_presence_and_barrier.sql`
- `apps/api/src/server/services/ticket-service.ts`
- `apps/api/src/server/services/presence-service.ts`
- `apps/api/src/modules/gate/application/process-entry.ts`
- `apps/api/src/modules/gate/application/decision-engine.ts`
- `apps/api/src/modules/gate/application/resolve-session.ts`
- `apps/api/src/services/event.service.ts`
- `apps/api/src/server/app.ts`
- `packages/gate-core/src/decision.ts`
- `apps/api/src/tests/pr07-entry-flow.test.ts`

## Evidence nên chạy

1. ENTRY happy path
2. Duplicate entry cùng site -> `ANTI_PASSBACK_BLOCKED`
3. RFID `LOST` hoặc `BLOCKED` -> deny rõ
4. `POST /api/gate-events` direction `ENTRY` -> response có `mappedSessionId`

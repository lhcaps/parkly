# PR-06 — Decision Engine v1

## Đã chốt
- Chuẩn hoá rule inputs: `plateValidity`, `ocrConfidence`, `rfidUid`, `laneDirection`, `presenceActive`, `openTicket`, `paymentStatus`, `deviceHealth`
- Tách rule outputs: `decisionCode`, `reasonCode`, `recommendedAction`, `reasonDetail`, `reviewRequired`
- `resolveGateSession(...)` trả decision explainable và persist vào `gate_decisions`
- Threshold được gom về config env:
  - `GATE_DECISION_OCR_APPROVE_THRESHOLD`
  - `GATE_DECISION_OCR_REVIEW_THRESHOLD`
  - `GATE_DECISION_DEVICE_DEGRADED_THRESHOLD_SECONDS`
  - `GATE_DECISION_DEVICE_OFFLINE_THRESHOLD_SECONDS`
- `gate_decisions.input_snapshot_json` và `threshold_snapshot_json` được dùng đúng nghĩa
- UI GatePage / SessionsPage hiển thị decision explanation đọc được cho operator

## File chính đã sửa
- `packages/gate-core/src/decision.ts`
- `packages/gate-core/src/index.ts`
- `apps/api/src/modules/gate/domain/decision.ts`
- `apps/api/src/modules/gate/application/decision-engine.ts`
- `apps/api/src/modules/gate/application/resolve-session.ts`
- `apps/api/src/modules/gate/domain/session.ts`
- `packages/contracts/src/index.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/pages/GatePage.tsx`
- `apps/web/src/pages/SessionsPage.tsx`
- `apps/api/src/tests/pr06-decision-engine.test.ts`

## Evidence tối thiểu nên test
1. Low confidence -> `REVIEW_REQUIRED`
2. EXIT không có open ticket -> `TICKET_NOT_FOUND`
3. Device heartbeat degraded/offline -> `DEVICE_DEGRADED`
4. EXIT có open ticket + payment OK -> `AUTO_APPROVED`

## Lệnh test unit
```bash
cd apps/api
node --import tsx --test src/tests/pr06-decision-engine.test.ts
```

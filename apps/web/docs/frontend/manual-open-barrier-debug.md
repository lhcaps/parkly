# Manual Open Barrier — FE patch + backend debug checklist

## Mục tiêu
Luồng này cho phép operator mở barrier thủ công **từ desktop** mà không phụ thuộc `mobile-camera-pair` hay `mobile-capture`. Tất cả thao tác vẫn phải neo vào `gate session` để giữ audit trail, barrier command log và snapshot reconciliation.

Endpoint backend:
- `POST /api/gate-sessions/:sessionId/manual-open-barrier`

Role được phép:
- `OPS`
- `ADMIN`

## Điều kiện tối thiểu trước khi bấm nút
1. `GET /api/auth/me` phải trả `200`.
2. `GET /api/gate-sessions/:sessionId` phải trả `200`. Nếu route này đang `500`, sửa session detail trước.
3. Session phải còn mutable ở backend. Nếu session đã bị `PASSED`, `CANCELLED`, `TIMEOUT` hoặc state machine không cho transition sang `APPROVED`, backend sẽ từ chối.
4. Lane phải resolve được topology barrier device hoặc primary device fallback.

## FE patch này làm gì
- thêm card **Manual barrier override** ở `Session History` detail panel
- action có confirm dialog chuẩn
- payload có `requestId`, `idempotencyKey`, `reasonCode`, `note`
- thành công xong sẽ force re-read session detail + refresh list
- lỗi sẽ hiển thị `requestId`, `HTTP status`, `error code`, `next action`

## Checklist debug backend khi gặp 500

### 1) Xác nhận auth và session detail trước
```bash
curl http://127.0.0.1:3000/api/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

curl http://127.0.0.1:3000/api/gate-sessions/<SESSION_ID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Nếu 2 lệnh trên chưa sạch thì chưa nên debug `manual-open-barrier`.

### 2) Gọi thẳng endpoint manual-open-barrier
```bash
curl -X POST http://127.0.0.1:3000/api/gate-sessions/<SESSION_ID>/manual-open-barrier \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "manual-open-debug-001",
    "idempotencyKey": "manual-open-debug-001-key",
    "occurredAt": "2026-03-15T10:00:00.000Z",
    "reasonCode": "MANUAL_OPEN_BARRIER",
    "note": "Operator mở barrier thủ công từ desktop"
  }'
```

### 3) Đọc đúng log route
Tìm theo các chuỗi sau:
- `manual-open-barrier`
- `gate-session-manual-open-barrier:<SESSION_ID>`
- `requestId`
- stack trace của `manualOpenBarrierForSession`

### 4) Các nguyên nhân 500 có xác suất cao
Dựa trên flow `manualOpenBarrierForSession`, thường sẽ vỡ ở 1 trong các điểm sau:

1. **Session không tồn tại**
   - `gate_passage_sessions.session_id` không có record tương ứng.

2. **Session không còn mutable / transition invalid**
   - hàm `ensureMutableSessionStatus(...)`
   - hàm `ensureSessionTransition(currentStatus, 'APPROVED')`

3. **Lane topology hỏng**
   - session có `lane_id` nhưng `gate_lanes` không tìm thấy row.

4. **Barrier device không resolve được như kỳ vọng**
   - `gate_lane_devices` không có device role `BARRIER`
   - fallback `primary_device_id` null hoặc lệch topology

5. **Audit actor / user mapping lỗi**
   - `resolveExistingActorUserIdTx(...)` không match user hiện tại

6. **Write path lỗi ở transaction**
   - `gate_decisions.create`
   - `gate_barrier_commands.create`
   - `gate_manual_reviews.update`
   - `gate_incidents.create`
   - idempotency mark succeed/failed

## SQL kiểm tra nhanh
```sql
SELECT session_id, site_id, lane_id, status, review_required, resolved_at, closed_at
FROM gate_passage_sessions
WHERE session_id = ?;
```

```sql
SELECT lane_id, site_id, gate_code, lane_code, primary_device_id
FROM gate_lanes
WHERE lane_id = ?;
```

```sql
SELECT lane_id, device_id, device_role, is_primary, sort_order
FROM gate_lane_devices
WHERE lane_id = ?
ORDER BY is_primary DESC, sort_order ASC, lane_device_id ASC;
```

```sql
SELECT command_id, session_id, device_id, command_type, status, reason_code, issued_at, ack_at
FROM gate_barrier_commands
WHERE session_id = ?
ORDER BY command_id DESC;
```

```sql
SELECT review_id, session_id, status, queue_reason_code, note, resolved_at
FROM gate_manual_reviews
WHERE session_id = ?
ORDER BY review_id DESC;
```

## Kỳ vọng sau khi thành công
- session được chuyển về `APPROVED`
- `review_required=false`
- có record mới trong `gate_decisions`
- có record `OPEN` trong `gate_barrier_commands`
- manual review được chuyển `RESOLVED`
- incident `MANUAL_OPEN_BARRIER` được ghi lại
- FE refresh lại session detail và timeline

## Nếu hardware barrier vẫn không mở
Khi endpoint trả `200` nhưng barrier vật lý không nhúc nhích, lỗi không còn nằm ở FE nữa. Khi đó phải kiểm tiếp:
- worker hoặc downstream reader của `gate_barrier_commands`
- mapping từ `device_id` sang hardware thật
- bridge/integration layer với barrier controller
- logic ack hiện tại có đang chỉ giả lập `ACKED` trong DB hay không

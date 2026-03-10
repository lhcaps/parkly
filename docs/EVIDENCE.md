# Parkly — Evidence Pack

Đây là bộ evidence cuối để chấm demo vận hành. Tất cả scenario đã gom về một script PowerShell duy nhất.

## 1. Script chính

```text
apps/api/src/scripts/evidence/evidence-pack.ps1
```

## 2. Scenarios có sẵn

- `entry-happy`
- `exit-paid`
- `exit-unpaid`
- `low-confidence-review`
- `anti-passback-blocked`
- `barrier-timeout`
- `all`

## 3. Cách chạy

Từ root monorepo:

```powershell
pwsh -File .\apps\api\src\scripts\evidence\evidence-pack.ps1 -BaseUrl http://127.0.0.1:3000 -Token <OPS_OR_ADMIN_TOKEN> -Scenario all
```

### Ví dụ riêng từng case

```powershell
pwsh -File .\apps\api\src\scripts\evidence\evidence-pack.ps1 -BaseUrl http://127.0.0.1:3000 -Token <OPS_OR_ADMIN_TOKEN> -Scenario entry-happy
pwsh -File .\apps\api\src\scripts\evidence\evidence-pack.ps1 -BaseUrl http://127.0.0.1:3000 -Token <OPS_OR_ADMIN_TOKEN> -Scenario low-confidence-review
pwsh -File .\apps\api\src\scripts\evidence\evidence-pack.ps1 -BaseUrl http://127.0.0.1:3000 -Token <OPS_OR_ADMIN_TOKEN> -Scenario barrier-timeout
```

## 4. Kỳ vọng từng scenario

### entry-happy

Kỳ vọng:

- session mở bằng sensor
- resolve bằng ALPR/RFID
- decision ra `APPROVE`
- ticket/presence/barrier được xử lý theo flow ENTRY

### exit-paid

Kỳ vọng:

- tìm thấy open ticket
- payment state hợp lệ (`PAID`, `WAIVED`, hoặc `SUBSCRIPTION_COVERED`)
- barrier `OPEN`
- ticket close
- active presence clear

### exit-unpaid

Kỳ vọng:

- payment state là `UNPAID` hoặc `PENDING`
- barrier không mở
- session dừng ở `WAITING_PAYMENT` hoặc vào review phù hợp
- explanation đọc được

### low-confidence-review

Kỳ vọng:

- decision không silent approve
- có `reasonCode` rõ
- queue nhận review item
- UI đọc được explanation

### anti-passback-blocked

Kỳ vọng:

- cùng site, cùng plate hoặc RFID đang active presence
- decision bị block hoặc review
- explanation nói rõ anti-passback

### barrier-timeout

Kỳ vọng:

- command đi `PENDING -> SENT -> TIMEOUT`
- lane aggregate health chuyển `BARRIER_FAULT`
- metric `gate_barrier_ack_timeout_total` tăng
- outbox monitor thấy row liên quan

## 5. Bằng chứng phải chụp

### A. Metrics

Chụp `/metrics` và highlight các metric business:

- `gate_session_open_duration_ms`
- `gate_session_resolve_duration_ms`
- `gate_barrier_ack_timeout_total`
- `gate_review_queue_size`
- `gate_device_offline_count`

### B. Logs

Chụp log API có đủ:

- `requestId`
- `correlationId`
- `siteCode`
- `laneCode`
- `deviceCode`
- `sessionId`

### C. Console

Chụp:

- Lane Monitor
- Review Queue
- Session Detail
- Device Health
- Outbox Monitor

### D. Legacy compatibility

Gọi `POST /api/gate-events` và chụp response có:

- `eventId`
- `outboxId`
- `mappedSessionId`
- `mappedSessionStatus`
- `mappedDecisionCode`

## 6. Lưu ý cho giảng viên/demo

- evidence pack chạy được trên Windows PowerShell
- web console không còn text demo/mock/simulate ở flow chính
- outbox monitor có cả SSE và API list/manual requeue thật
- legacy endpoint vẫn còn để demo cũ không gãy

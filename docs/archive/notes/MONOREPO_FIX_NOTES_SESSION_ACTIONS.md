# Session actions fix

Đã sửa flow Gate Sessions để bám đúng state machine hiện tại:

- Backend thêm `allowedActions` cho session summary/detail.
- Frontend `SessionsPage` đọc `allowedActions` và chỉ enable nút hợp lệ.
- `Confirm Pass` chỉ bật khi session đang `APPROVED`.
- `WAITING_DECISION + reviewRequired` hiện hint rõ: phải Approve hoặc Deny trước.
- Frontend có guard chặn click action không hợp lệ trước khi gọi API.

## Trạng thái / thao tác hiện tại

- `WAITING_DECISION`: `Approve`, `Payment Hold`, `Deny`, `Cancel`
- `APPROVED`: `Payment Hold`, `Deny`, `Confirm Pass`, `Cancel`
- `WAITING_PAYMENT`: `Approve`, `Deny`, `Cancel`
- `OPEN`: `Cancel`
- `ERROR`: `Cancel`
- `DENIED`, `PASSED`, `TIMEOUT`, `CANCELLED`: không còn action

## Ghi chú

API typecheck toàn repo gốc vẫn còn nhiều lỗi cũ không thuộc patch này. Tôi chỉ xác nhận được phần web typecheck sạch và patch session actions đã nối đúng file API/Web hiện tại.

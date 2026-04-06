# Realtime Feed fix

## Gốc lỗi
Dashboard SSE trước đó chỉ đọc buffer in-memory `globalThis.__parklyLastEvents`.
Buffer này chỉ có event mới trong lúc process đang sống và còn bị clear sau mỗi lần stream tick.
Hệ quả:
- reload Dashboard xong feed trống dù DB đã có gate events
- mở Dashboard sau khi đã chạy Gate trước đó thì không thấy history
- nhiều client SSE dễ giẫm nhau vì cùng đọc/clear một buffer chung

## Đã sửa
- `/api/stream/gate-events` bây giờ bootstrap 25 gate events gần nhất từ `gate_event_outbox`
- sau đó poll các outbox rows mới theo cursor `created_at + outbox_id`
- gửi keepalive ping định kỳ để connection ổn định hơn
- Dashboard dedupe item theo `outboxId / eventId`
- copy text UI cho đúng với hành vi mới

## Kết quả
- vào trang Dashboard là thấy ngay các event gần nhất
- chạy Gate sau đó sẽ thấy event mới đổ tiếp vào feed
- không còn lệ thuộc hoàn toàn vào buffer in-memory legacy

# EXPLAIN Pack (chụp minh chứng)

> Lưu ý version: repo hiện đang ở **Flyway V9** (tối ưu report theo `paid_date` / index report). Nếu tài liệu cũ nhắc V8 thì ignore.

## 1) Chuẩn bị dữ liệu

Seed dataset lớn:

```bash
pnpm db:seed:big
```

## 2) Chạy EXPLAIN

Mở DBeaver → chọn schema `parking_mgmt` → chạy file:

- `db/scripts/explain_demo.sql`

Trong file đã có 2 biến thể cho mỗi truy vấn:

- **Query thường**: cho thấy index/partition pruning được dùng
- **IGNORE INDEX**: giả lập tình huống thiếu index → thường sẽ ra `type=ALL`/rows rất lớn

## 3) Ảnh cần chụp

Gợi ý 3 ảnh "đủ chấm điểm":

1) gate_events theo site + time range (có partition pruning)
2) gate_events theo RFID (index composite)
3) payments report theo ngày (index (site_id, paid_at))

Gợi ý (V9): ưu tiên chụp query dùng `paid_date`/report index để thấy index scan rõ hơn.

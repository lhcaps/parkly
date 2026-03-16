-- Rolling partitions cho gate_events (MySQL 8)
-- Mục tiêu: thêm partition theo tháng mà không downtime, giữ 1 partition p_future = MAXVALUE.
--
-- Pattern chuẩn:
-- ALTER TABLE gate_events REORGANIZE PARTITION p_future INTO (
--   PARTITION pYYYY_MM VALUES LESS THAN ('YYYY-(MM+1)-01'),
--   PARTITION p_future VALUES LESS THAN (MAXVALUE)
-- );
--
-- Ví dụ: thêm partition cho tháng 04/2026 (cover đến trước 2026-05-01)

ALTER TABLE gate_events
REORGANIZE PARTITION p_future INTO (
  PARTITION p2026_04 VALUES LESS THAN ('2026-05-01'),
  PARTITION p_future VALUES LESS THAN (MAXVALUE)
);

-- Gợi ý archive:
-- 1) export dữ liệu partition cũ ra file
-- 2) DROP PARTITION để giảm dung lượng
-- ALTER TABLE gate_events DROP PARTITION p2026_01;

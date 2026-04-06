-- Rolling partitions cho gate_events (MySQL 8)
-- ⚠️  DEPRECATED: Sử dụng stored procedure `sp_create_next_gate_partition` thay vì script này.
--    V27 đã tạo SP tự động chạy qua MySQL Event (evt_create_next_gate_partition).
--    Script này chỉ dùng cho:
--    1) Initial setup khi MySQL Event Scheduler chưa bật
--    2) Manual intervention khẩn cấp
--
-- MySQL Event Scheduler cần được bật:
--   SET GLOBAL event_scheduler = ON;
--
-- Hoặc thêm vào my.cnf / my.ini:
--   event_scheduler = ON
--
-- Pattern chuẩn khi dùng script (thay vì SP):
--   ALTER TABLE gate_events REORGANIZE PARTITION p_future INTO (
--     PARTITION pYYYY_MM VALUES LESS THAN ('YYYY-(MM+1)-01'),
--     PARTITION p_future VALUES LESS THAN (MAXVALUE)
--   );
--
-- Ví dụ: thêm partition cho tháng 04/2026 (cover đến trước 2026-05-01)

-- Idempotent: kiểm tra partition đã tồn tại chưa trước khi tạo
SET @p_target := 'p2026_04';
SET @p_exists := (
  SELECT COUNT(*)
  FROM information_schema.partitions
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_events'
    AND partition_name = @p_target
);
SET @sql_roll := IF(
  @p_exists = 0,
  CONCAT(
    'ALTER TABLE gate_events REORGANIZE PARTITION p_future INTO (',
    '  PARTITION ', @p_target, ' VALUES LESS THAN (''2026-05-01''),',
    '  PARTITION p_future VALUES LESS THAN (MAXVALUE)',
    ')'
  ),
  'SELECT ''', @p_target, ' already exists — skipping'' AS result'
);
PREPARE stmt FROM @sql_roll;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Gợi ý archive (chạy riêng khi cần):
--  1) export dữ liệu partition cũ ra file (mysqldump hoặc SELECT ... INTO OUTFILE)
--  2) DROP PARTITION để giảm dung lượng
--  ALTER TABLE gate_events DROP PARTITION p2026_01;

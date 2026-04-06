-- V8: Outbox tracking + retry nâng cao (IDEMPOTENT)
-- Mục tiêu:
-- - Thêm sent_at: thời điểm đánh dấu SENT
-- - Thêm updated_at: timestamp cập nhật cuối (auto ON UPDATE)
-- - Không fail nếu cột đã tồn tại (tránh Duplicate column khi bạn đã add thủ công trước đó)

-- NOTE: MySQL 8 vẫn hỗ trợ INFORMATION_SCHEMA.COLUMNS (không liên quan PROCESSLIST).

SET @schema := DATABASE();
SET @table  := 'gate_event_outbox';

-- 1) sent_at
SET @has_sent_at := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema AND table_name = @table AND column_name = 'sent_at'
);
SET @sql_sent_at := IF(
  @has_sent_at = 0,
  'ALTER TABLE gate_event_outbox ADD COLUMN sent_at DATETIME NULL AFTER status',
  'SELECT 1'
);
PREPARE stmt FROM @sql_sent_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) updated_at
SET @has_updated_at := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @schema AND table_name = @table AND column_name = 'updated_at'
);
SET @sql_updated_at := IF(
  @has_updated_at = 0,
  'ALTER TABLE gate_event_outbox ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql_updated_at;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Backfill updated_at ONLY when column is newly added.
-- (Nếu cột đã tồn tại, không đụng dữ liệu để tránh ghi đè lịch sử update thật.)
UPDATE gate_event_outbox
SET updated_at = created_at
WHERE @has_updated_at = 0 AND (updated_at IS NULL OR updated_at > created_at);

-- 3) Index hỗ trợ worker scan (status + next_retry_at) nếu chưa có.
SET @has_ix := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @schema AND table_name = @table AND index_name = 'ix_outbox_next_retry'
);
SET @sql_ix := IF(
  @has_ix = 0,
  'CREATE INDEX ix_outbox_next_retry ON gate_event_outbox(status, next_retry_at)',
  'SELECT 1'
);
PREPARE stmt3 FROM @sql_ix;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

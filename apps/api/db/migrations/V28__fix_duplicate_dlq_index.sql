-- ============================================================
-- V28__fix_duplicate_dlq_index.sql
--
-- Fix duplicate index on gate_event_outbox_dlq.
--
-- V26__enterprise_hardening.sql tạo hai index gần như trùng lặp:
--   1) KEY ix_dlq_status_created (final_status, moved_at)  -- trong CREATE TABLE
--   2) KEY ix_dlq_requeue (final_status, moved_at)         -- bởi idempotent CREATE INDEX script
--
-- Cả hai đều là B-tree index trên cùng cột (final_status, moved_at).
-- Index thứ hai là thừa và gây lãng phí space + write overhead.
--
-- Giải pháp: DROP INDEX ix_dlq_status_created, giữ lại ix_dlq_requeue
-- vì tên ix_dlq_requeue có ngữ nghĩa rõ ràng hơn (phục vụ requeue DLQ records).
-- ============================================================

-- Kiểm tra xem index ix_dlq_status_created có tồn tại không trước khi drop
SET @idx_status_created_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_event_outbox_dlq'
    AND index_name = 'ix_dlq_status_created'
);

SET @sql_drop := IF(
  @idx_status_created_exists > 0,
  'ALTER TABLE gate_event_outbox_dlq DROP INDEX ix_dlq_status_created',
  'SELECT ''INDEX ix_dlq_status_created does not exist — skipping'' AS result'
);

PREPARE stmt_drop FROM @sql_drop;
EXECUTE stmt_drop;
DEALLOCATE PREPARE stmt_drop;

-- Xác minh: kiểm tra các index còn lại trên bảng gate_event_outbox_dlq
SELECT
  index_name       AS indexName,
  column_name      AS columnName,
  seq_in_index     AS seqInIndex,
  non_unique       AS isNonUnique,
  index_type       AS indexType
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'gate_event_outbox_dlq'
ORDER BY index_name, seq_in_index;

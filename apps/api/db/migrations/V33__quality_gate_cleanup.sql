-- V33: Quality gate cleanup
-- Remove duplicate ticket index introduced by V29 and keep a single canonical composite index.

SET @idx_tickets_open_vehicle_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'tickets'
    AND index_name = 'ix_tickets_open_vehicle'
);

SET @sql_drop_tickets_open_vehicle := IF(
  @idx_tickets_open_vehicle_exists = 1,
  'ALTER TABLE tickets DROP INDEX ix_tickets_open_vehicle',
  'SELECT 1'
);

PREPARE stmt_drop_tickets_open_vehicle FROM @sql_drop_tickets_open_vehicle;
EXECUTE stmt_drop_tickets_open_vehicle;
DEALLOCATE PREPARE stmt_drop_tickets_open_vehicle;

-- V27: Rolling Partition Maintenance Automation
-- Bám theo báo cáo audit ngày 2026-03-20
-- Mục tiêu:
--   - Tự động tạo partitions cho các tháng còn lại của 2026
--   - Tạo MySQL Events để tự động maintain partitions hàng tháng
--   - Thêm partition cho gate_events vào các tháng còn thiếu

-- ============================================================
-- 1) ROLLING PARTITIONS CHO GATE_EVENTS 2026
-- ============================================================

-- Kiểm tra và thêm partitions còn thiếu trong năm 2026
-- Pattern: ALTER TABLE REORGANIZE PARTITION p_future INTO (new_partition, p_future)

-- Partition tháng 05/2026
SET @part_2026_04_exists := (
  SELECT COUNT(*) FROM information_schema.partitions
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_events'
    AND partition_name = 'p2026_04'
);
SET @part_2026_05_exists := (
  SELECT COUNT(*) FROM information_schema.partitions
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_events'
    AND partition_name = 'p2026_05'
);

SET @sql_part_may := IF(
  @part_2026_04_exists > 0 AND @part_2026_05_exists = 0,
  'ALTER TABLE gate_events REORGANIZE PARTITION p_future INTO (PARTITION p2026_05 VALUES LESS THAN (''2026-06-01''), PARTITION p_future VALUES LESS THAN (MAXVALUE))',
  'SELECT ''p2026_05 already exists or p2026_04 missing'' AS status'
);
PREPARE stmt_part_may FROM @sql_part_may;
EXECUTE stmt_part_may;
DEALLOCATE PREPARE stmt_part_may;

-- Partition tháng 06/2026
SET @part_2026_06_exists := (
  SELECT COUNT(*) FROM information_schema.partitions
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_events'
    AND partition_name = 'p2026_06'
);
SET @sql_part_jun := IF(
  @part_2026_05_exists > 0 AND @part_2026_06_exists = 0,
  'ALTER TABLE gate_events REORGANIZE PARTITION p_future INTO (PARTITION p2026_06 VALUES LESS THAN (''2026-07-01''), PARTITION p_future VALUES LESS THAN (MAXVALUE))',
  'SELECT ''p2026_06 already exists or p2026_05 missing'' AS status'
);
PREPARE stmt_part_jun FROM @sql_part_jun;
EXECUTE stmt_part_jun;
DEALLOCATE PREPARE stmt_part_jun;

-- Partition tháng 07/2026
SET @part_2026_07_exists := (
  SELECT COUNT(*) FROM information_schema.partitions
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_events'
    AND partition_name = 'p2026_07'
);
SET @sql_part_jul := IF(
  @part_2026_06_exists > 0 AND @part_2026_07_exists = 0,
  'ALTER TABLE gate_events REORGANIZE PARTITION p_future INTO (PARTITION p2026_07 VALUES LESS THAN (''2026-08-01''), PARTITION p_future VALUES LESS THAN (MAXVALUE))',
  'SELECT ''p2026_07 already exists or p2026_06 missing'' AS status'
);
PREPARE stmt_part_jul FROM @sql_part_jul;
EXECUTE stmt_part_jul;
DEALLOCATE PREPARE stmt_part_jul;

-- Partition tháng 08/2026
SET @part_2026_08_exists := (
  SELECT COUNT(*) FROM information_schema.partitions
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_events'
    AND partition_name = 'p2026_08'
);
SET @sql_part_aug := IF(
  @part_2026_07_exists > 0 AND @part_2026_08_exists = 0,
  'ALTER TABLE gate_events REORGANIZE PARTITION p_future INTO (PARTITION p2026_08 VALUES LESS THAN (''2026-09-01''), PARTITION p_future VALUES LESS THAN (MAXVALUE))',
  'SELECT ''p2026_08 already exists or p2026_07 missing'' AS status'
);
PREPARE stmt_part_aug FROM @sql_part_aug;
EXECUTE stmt_part_aug;
DEALLOCATE PREPARE stmt_part_aug;

-- Partition tháng 09/2026
SET @part_2026_09_exists := (
  SELECT COUNT(*) FROM information_schema.partitions
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_events'
    AND partition_name = 'p2026_09'
);
SET @sql_part_sep := IF(
  @part_2026_08_exists > 0 AND @part_2026_09_exists = 0,
  'ALTER TABLE gate_events REORGANIZE PARTITION p_future INTO (PARTITION p2026_09 VALUES LESS THAN (''2026-10-01''), PARTITION p_future VALUES LESS THAN (MAXVALUE))',
  'SELECT ''p2026_09 already exists or p2026_08 missing'' AS status'
);
PREPARE stmt_part_sep FROM @sql_part_sep;
EXECUTE stmt_part_sep;
DEALLOCATE PREPARE stmt_part_sep;

-- Partition tháng 10/2026
SET @part_2026_10_exists := (
  SELECT COUNT(*) FROM information_schema.partitions
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_events'
    AND partition_name = 'p2026_10'
);
SET @sql_part_oct := IF(
  @part_2026_09_exists > 0 AND @part_2026_10_exists = 0,
  'ALTER TABLE gate_events REORGANIZE PARTITION p_future INTO (PARTITION p2026_10 VALUES LESS THAN (''2026-11-01''), PARTITION p_future VALUES LESS THAN (MAXVALUE))',
  'SELECT ''p2026_10 already exists or p2026_09 missing'' AS status'
);
PREPARE stmt_part_oct FROM @sql_part_oct;
EXECUTE stmt_part_oct;
DEALLOCATE PREPARE stmt_part_oct;

-- Partition tháng 11/2026
SET @part_2026_11_exists := (
  SELECT COUNT(*) FROM information_schema.partitions
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_events'
    AND partition_name = 'p2026_11'
);
SET @sql_part_nov := IF(
  @part_2026_10_exists > 0 AND @part_2026_11_exists = 0,
  'ALTER TABLE gate_events REORGANIZE PARTITION p_future INTO (PARTITION p2026_11 VALUES LESS THAN (''2026-12-01''), PARTITION p_future VALUES LESS THAN (MAXVALUE))',
  'SELECT ''p2026_11 already exists or p2026_10 missing'' AS status'
);
PREPARE stmt_part_nov FROM @sql_part_nov;
EXECUTE stmt_part_nov;
DEALLOCATE PREPARE stmt_part_nov;

-- Partition tháng 12/2026
SET @part_2026_12_exists := (
  SELECT COUNT(*) FROM information_schema.partitions
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_events'
    AND partition_name = 'p2026_12'
);
SET @sql_part_dec := IF(
  @part_2026_11_exists > 0 AND @part_2026_12_exists = 0,
  'ALTER TABLE gate_events REORGANIZE PARTITION p_future INTO (PARTITION p2026_12 VALUES LESS THAN (''2027-01-01''), PARTITION p_future VALUES LESS THAN (MAXVALUE))',
  'SELECT ''p2026_12 already exists or p2026_11 missing'' AS status'
);
PREPARE stmt_part_dec FROM @sql_part_dec;
EXECUTE stmt_part_dec;
DEALLOCATE PREPARE stmt_part_dec;

-- ============================================================
-- 2) STORED PROCEDURE: sp_create_next_gate_partition
-- ============================================================
-- Procedure để tự động tạo partition cho tháng tiếp theo
-- Có thể được gọi bởi MySQL Event hoặc cron job bên ngoài

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_create_next_gate_partition $$
CREATE PROCEDURE sp_create_next_gate_partition()
BEGIN
  DECLARE next_month_start DATE;
  DECLARE partition_name_str VARCHAR(32);
  DECLARE next_month_end DATE;
  DECLARE partition_exists INT DEFAULT 0;
  DECLARE partition_list VARCHAR(512);
  DECLARE has_error INT DEFAULT 0;
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET has_error = 1;

  SET next_month_start = DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY);
  SET partition_name_str = CONCAT('p', DATE_FORMAT(next_month_start, '%Y_%m'));
  SET next_month_end = DATE_ADD(next_month_start, INTERVAL 1 MONTH);

  SELECT COUNT(*) INTO partition_exists
  FROM information_schema.partitions
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_events'
    AND partition_name = partition_name_str;

  IF partition_exists > 0 THEN
    SELECT CONCAT('Partition ', partition_name_str, ' already exists') AS result;
  ELSE
    SET partition_list = CONCAT(
      'PARTITION ', partition_name_str, ' VALUES LESS THAN (''',
      DATE_FORMAT(next_month_end, '%Y-%m-%d'),
      '''), PARTITION p_future VALUES LESS THAN (MAXVALUE)'
    );

    SET @sql_roll := CONCAT(
      'ALTER TABLE gate_events REORGANIZE PARTITION p_future INTO (',
      partition_list, ')'
    );

    PREPARE stmt_roll FROM @sql_roll;
    EXECUTE stmt_roll;
    DEALLOCATE PREPARE stmt_roll;

    IF has_error = 0 THEN
      SELECT CONCAT('Created partition: ', partition_name_str, ' for month starting ', DATE_FORMAT(next_month_start, '%Y-%m-%d')) AS result;
    ELSE
      SELECT CONCAT('Error creating partition: ', partition_name_str) AS result;
    END IF;
  END IF;
END $$

DELIMITER ;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_archive_old_gate_partitions $$
CREATE PROCEDURE sp_archive_old_gate_partitions(
  IN p_retention_months INT
)
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE v_partition_name VARCHAR(64);
  DECLARE v_partition_description VARCHAR(64);
  DECLARE cutoff_date DATE;
  DECLARE cur CURSOR FOR
    SELECT partition_name, partition_description
    FROM information_schema.partitions
    WHERE table_schema = DATABASE()
      AND table_name = 'gate_events'
      AND partition_name NOT IN ('p_future')
      AND partition_description < DATE_FORMAT(cutoff_date, '%Y-%m-%d')
    ORDER BY partition_description ASC;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  SET cutoff_date = DATE_SUB(CURDATE(), INTERVAL p_retention_months MONTH);

  OPEN cur;

  read_loop: LOOP
    FETCH cur INTO v_partition_name, v_partition_description;
    IF done THEN
      LEAVE read_loop;
    END IF;

    SELECT CONCAT(
      'Would archive partition: ', v_partition_name,
      ' (data before ', v_partition_description, ')'
    ) AS archive_candidate;

  END LOOP;

  CLOSE cur;
END $$

DELIMITER ;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_setup_mysql_events $$
CREATE PROCEDURE sp_setup_mysql_events()
BEGIN
  DECLARE evt_exists INT DEFAULT 0;
  DECLARE has_error INT DEFAULT 0;
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET has_error = 1;

  -- Event: Tạo partition mới hàng tháng
  SELECT COUNT(*) INTO evt_exists
  FROM information_schema.events
  WHERE event_schema = DATABASE() AND event_name = 'evt_create_next_gate_partition';

  IF evt_exists = 0 THEN
    SET @sql_evt1 = 'CREATE EVENT evt_create_next_gate_partition ON SCHEDULE EVERY 1 MONTH STARTS LAST_DAY(CURDATE()) + INTERVAL 25 DAY DO CALL sp_create_next_gate_partition()';
    PREPARE stmt1 FROM @sql_evt1;
    EXECUTE stmt1;
    DEALLOCATE PREPARE stmt1;
  END IF;

  -- Event: Cleanup expired auth sessions hàng giờ
  SELECT COUNT(*) INTO evt_exists
  FROM information_schema.events
  WHERE event_schema = DATABASE() AND event_name = 'evt_cleanup_expired_sessions';

  IF evt_exists = 0 THEN
    SET @sql_evt2 = 'CREATE EVENT evt_cleanup_expired_sessions ON SCHEDULE EVERY 1 HOUR DO DELETE FROM auth_user_sessions WHERE refresh_expires_at < DATE_SUB(NOW(), INTERVAL 1 HOUR) AND revoked_at IS NULL';
    PREPARE stmt2 FROM @sql_evt2;
    EXECUTE stmt2;
    DEALLOCATE PREPARE stmt2;
  END IF;

  -- Event: Cleanup api_idempotency hàng ngày
  SELECT COUNT(*) INTO evt_exists
  FROM information_schema.events
  WHERE event_schema = DATABASE() AND event_name = 'evt_cleanup_idempotency';

  IF evt_exists = 0 THEN
    SET @sql_evt3 = 'CREATE EVENT evt_cleanup_idempotency ON SCHEDULE EVERY 1 DAY DO DELETE FROM api_idempotency WHERE created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR) AND status IN (''SUCCEEDED'', ''FAILED'')';
    PREPARE stmt3 FROM @sql_evt3;
    EXECUTE stmt3;
    DEALLOCATE PREPARE stmt3;
  END IF;

  -- Event: Move FAILED outbox records to DLQ (chạy mỗi 6 giờ)
  SELECT COUNT(*) INTO evt_exists
  FROM information_schema.events
  WHERE event_schema = DATABASE() AND event_name = 'evt_outbox_dlq_migration';

  IF evt_exists = 0 THEN
    SET @sql_evt4 = 'CREATE EVENT evt_outbox_dlq_migration ON SCHEDULE EVERY 6 HOUR DO INSERT INTO gate_event_outbox_dlq (outbox_id, site_id, event_id, event_time, payload_json, final_status, failure_reason, attempts, moved_at) SELECT outbox_id, site_id, event_id, event_time, payload_json, ''MAX_RETRIES'', last_error, attempts, NOW() FROM gate_event_outbox WHERE status = ''FAILED'' AND attempts >= 8 AND outbox_id NOT IN (SELECT outbox_id FROM gate_event_outbox_dlq) LIMIT 1000';
    PREPARE stmt4 FROM @sql_evt4;
    EXECUTE stmt4;
    DEALLOCATE PREPARE stmt4;
  END IF;

END $$

DELIMITER ;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_create_partition_health_view $$
CREATE PROCEDURE sp_create_partition_health_view()
BEGIN
  DECLARE v_exists INT DEFAULT 0;

  SELECT COUNT(*) INTO v_exists
  FROM information_schema.views
  WHERE table_schema = DATABASE() AND table_name = 'v_partition_health';

  IF v_exists > 0 THEN
    DROP VIEW IF EXISTS v_partition_health;
  END IF;

  SET @sql_view = CONCAT(
    'CREATE VIEW v_partition_health AS SELECT partition_name, partition_ordinal_position, ',
    'partition_description, partition_method, partition_expression, table_rows, ',
    'ROUND(data_length / 1024 / 1024, 2) AS data_size_mb, ',
    'ROUND(index_length / 1024 / 1024, 2) AS index_size_mb, ',
    'ROUND((data_length + index_length) / 1024 / 1024, 2) AS total_size_mb ',
    'FROM information_schema.partitions WHERE table_schema = ''', DATABASE(),
    ''' AND table_name = ''gate_events'' ORDER BY partition_ordinal_position DESC'
  );

  PREPARE stmt_view FROM @sql_view;
  EXECUTE stmt_view;
  DEALLOCATE PREPARE stmt_view;
END $$

DELIMITER ;

-- Gọi procedures để tạo events và view
-- NOTE: Nếu procedures/events đã tồn tại, chúng sẽ không được tạo lại
CALL sp_setup_mysql_events();
CALL sp_create_partition_health_view();

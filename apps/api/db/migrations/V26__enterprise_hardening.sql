-- V26: Enterprise Hardening - Security, Performance & Operational Improvements
-- Bám theo báo cáo audit ngày 2026-03-20
-- Mục tiêu:
--   - Index improvements cho performance
--   - FK constraints còn thiếu
--   - Outbox DLQ cho error handling
--   - Audit trigger cho session state transitions
--   - Anti-passback optimization indexes

-- ============================================================
-- 1) INDEX IMPROVEMENTS
-- ============================================================

-- Issue #3: Ticket exit flow optimization
-- Khi xe ra, hệ thống tìm OPEN ticket bằng vehicle_id + status.
-- Index compound (site_id, vehicle_id, status) giúp query nhanh hơn.
SET @idx_tickets_vehicle_status_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'tickets'
    AND index_name = 'ix_tickets_site_vehicle_status'
);
SET @sql_tickets_idx := IF(
  @idx_tickets_vehicle_status_exists = 0,
  'ALTER TABLE tickets ADD INDEX ix_tickets_site_vehicle_status (site_id, vehicle_id, status)',
  'SELECT 1'
);
PREPARE stmt_tickets_idx FROM @sql_tickets_idx;
EXECUTE stmt_tickets_idx;
DEALLOCATE PREPARE stmt_tickets_idx;

-- Issue #11: Spot occupancy projection
-- Reconciliation engine thường query theo site + occupancy_status không có zone_code.
SET @idx_occ_proj_status_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'spot_occupancy_projection'
    AND index_name = 'ix_spot_occ_proj_site_status'
);
SET @sql_occ_proj_idx := IF(
  @idx_occ_proj_status_exists = 0,
  'ALTER TABLE spot_occupancy_projection ADD INDEX ix_spot_occ_proj_site_status (site_id, occupancy_status)',
  'SELECT 1'
);
PREPARE stmt_occ_proj_idx FROM @sql_occ_proj_idx;
EXECUTE stmt_occ_proj_idx;
DEALLOCATE PREPARE stmt_occ_proj_idx;

-- Issue #12: ALPR session covering index
-- Giúp query preview theo session_id cover luôn read_type và plate_compact.
SET @idx_gate_reads_covering_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_read_events'
    AND index_name = 'ix_gate_reads_session_covering'
);
SET @sql_gate_reads_idx := IF(
  @idx_gate_reads_covering_exists = 0,
  'ALTER TABLE gate_read_events ADD INDEX ix_gate_reads_session_covering (session_id, occurred_at, read_type, plate_compact)',
  'SELECT 1'
);
PREPARE stmt_gate_reads_idx FROM @sql_gate_reads_idx;
EXECUTE stmt_gate_reads_idx;
DEALLOCATE PREPARE stmt_gate_reads_idx;

-- Issue #17: Auth throttle optimization
-- Login throttle check cần query nhanh theo username + lockout_until + failure_count.
SET @idx_auth_throttle_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'auth_login_attempts'
    AND index_name = 'ix_auth_login_throttle'
);
SET @sql_auth_throttle_idx := IF(
  @idx_auth_throttle_exists = 0,
  'ALTER TABLE auth_login_attempts ADD INDEX ix_auth_login_throttle (username, lockout_until, failure_count)',
  'SELECT 1'
);
PREPARE stmt_auth_throttle_idx FROM @sql_auth_throttle_idx;
EXECUTE stmt_auth_throttle_idx;
DEALLOCATE PREPARE stmt_auth_throttle_idx;

-- Issue #19: Anti-passback credential index
-- Anti-passback check cần query nhanh theo site + last_direction + last_event_time.
SET @idx_cred_anti_passback_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'credentials'
    AND index_name = 'ix_cred_anti_passback'
);
SET @sql_cred_idx := IF(
  @idx_cred_anti_passback_exists = 0,
  'ALTER TABLE credentials ADD INDEX ix_cred_anti_passback (site_id, last_direction, last_event_time)',
  'SELECT 1'
);
PREPARE stmt_cred_idx FROM @sql_cred_idx;
EXECUTE stmt_cred_idx;
DEALLOCATE PREPARE stmt_cred_idx;

-- ============================================================
-- 2) SHIFT CLOSURE TIME RANGE OPTIMIZATION
-- ============================================================

-- Issue #5: Shift closure time range query optimization
-- Query shift_closures thường filter theo start_time/end_time.
SET @idx_shift_start_end_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'shift_closures'
    AND index_name = 'ix_shift_site_start_end'
);
SET @sql_shift_idx := IF(
  @idx_shift_start_end_exists = 0,
  'ALTER TABLE shift_closures ADD INDEX ix_shift_site_start_end (site_id, start_time, end_time)',
  'SELECT 1'
);
PREPARE stmt_shift_idx FROM @sql_shift_idx;
EXECUTE stmt_shift_idx;
DEALLOCATE PREPARE stmt_shift_idx;

-- ============================================================
-- 3) FK CONSTRAINTS CÒN THIẾU
-- ============================================================

-- Issue #7: FK for incident history media
-- gate_incident_history có evidence_media_id nhưng thiếu FK constraint.
SET @fk_incident_media_exists := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'gate_incident_history'
    AND constraint_name = 'fk_gate_incident_history_media'
    AND constraint_type = 'FOREIGN KEY'
);
SET @sql_fk_media := IF(
  @fk_incident_media_exists = 0,
  'ALTER TABLE gate_incident_history ADD CONSTRAINT fk_gate_incident_history_media FOREIGN KEY (evidence_media_id) REFERENCES gate_read_media(media_id)',
  'SELECT 1'
);
PREPARE stmt_fk_media FROM @sql_fk_media;
EXECUTE stmt_fk_media;
DEALLOCATE PREPARE stmt_fk_media;

-- ============================================================
-- 4) OUTBOX DLQ (DEAD LETTER QUEUE)
-- ============================================================

-- Issue #14: Outbox DLQ cho error handling
-- Khi outbox records fail vượt max attempts, chuyển sang DLQ.
CREATE TABLE IF NOT EXISTS gate_event_outbox_dlq (
  dlq_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  outbox_id BIGINT NOT NULL,
  site_id BIGINT NOT NULL,
  event_id BIGINT NULL,
  event_time DATETIME NULL,
  payload_json JSON NOT NULL,
  final_status ENUM('TERMINAL_FAILED','MAX_RETRIES','SYSTEM_ERROR','DLQ_MANUAL') NOT NULL DEFAULT 'TERMINAL_FAILED',
  failure_reason TEXT NULL,
  attempts INT NOT NULL DEFAULT 0,
  moved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  moved_by_user_id BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dlq_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  UNIQUE KEY uq_dlq_outbox (outbox_id),
  KEY ix_dlq_site_created (site_id, moved_at),
  KEY ix_dlq_status_created (final_status, moved_at),
  KEY ix_dlq_moved_by (moved_by_user_id, moved_at)
) ENGINE=InnoDB;

-- Index để support DLQ requeue (chuyển dlq record về outbox để retry)
-- NOTE: Chỉ tạo nếu chưa tồn tại (idempotent)
SET @idx_dlq_requeue_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_event_outbox_dlq'
    AND index_name = 'ix_dlq_requeue'
);
SET @sql_dlq_requeue := IF(
  @idx_dlq_requeue_exists = 0,
  'CREATE INDEX ix_dlq_requeue ON gate_event_outbox_dlq (final_status, moved_at)',
  'SELECT 1'
);
PREPARE stmt_dlq_requeue FROM @sql_dlq_requeue;
EXECUTE stmt_dlq_requeue;
DEALLOCATE PREPARE stmt_dlq_requeue;

-- ============================================================
-- 5) SPOT OCCUPANCY PROJECTION: THUMBNAIL SNAPSHOT JSON
-- ============================================================

-- Thêm cột để lưu thumbnail metadata cho parking live board
SET @col_thumb_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'spot_occupancy_projection'
    AND column_name = 'snapshot_thumb_key'
);
SET @sql_thumb := IF(
  @col_thumb_exists = 0,
  'ALTER TABLE spot_occupancy_projection ADD COLUMN snapshot_thumb_key VARCHAR(512) NULL AFTER snapshot_json',
  'SELECT 1'
);
PREPARE stmt_thumb FROM @sql_thumb;
EXECUTE stmt_thumb;
DEALLOCATE PREPARE stmt_thumb;

-- ============================================================
-- 6) GATE ACTIVE PRESENCE: ENHANCED UNIQUE CONSTRAINT
-- ============================================================

-- Issue #2: Enhanced uniqueness for presence
-- Khi plate_compact hoặc rfid_uid là NULL, cần handle race condition.
-- Thêm cột composite hash để đảm bảo uniqueness ngay cả khi có NULL values.
SET @col_presence_hash_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_active_presence'
    AND column_name = 'presence_hash'
);
SET @sql_presence_hash := IF(
  @col_presence_hash_exists = 0,
  'ALTER TABLE gate_active_presence ADD COLUMN presence_hash VARCHAR(64) NULL AFTER active_flag',
  'SELECT 1'
);
PREPARE stmt_presence_hash FROM @sql_presence_hash;
EXECUTE stmt_presence_hash;
DEALLOCATE PREPARE stmt_presence_hash;

-- Backfill presence_hash cho existing records
UPDATE gate_active_presence
SET presence_hash = SHA2(
  CONCAT(
    COALESCE(site_id, ''),
    '|',
    COALESCE(ticket_id, ''),
    '|',
    COALESCE(plate_compact, ''),
    '|',
    COALESCE(rfid_uid, '')
  ), 256
)
WHERE presence_hash IS NULL;

ALTER TABLE gate_active_presence
  MODIFY COLUMN presence_hash VARCHAR(64) NOT NULL;

CREATE UNIQUE INDEX ix_gate_presence_hash_active
  ON gate_active_presence (site_id, presence_hash, active_flag);

-- ============================================================
-- 7) SESSION STATE AUDIT TRIGGER
-- ============================================================

-- Issue #16: Audit trigger cho session state transitions
-- Mỗi khi gate_passage_sessions thay đổi status, ghi log audit.
DELIMITER $$

DROP TRIGGER IF EXISTS trg_gate_sessions_status_audit $$
CREATE TRIGGER trg_gate_sessions_status_audit
AFTER UPDATE ON gate_passage_sessions
FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status OR OLD.lane_id <> NEW.lane_id THEN
    INSERT INTO audit_logs (
      site_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      before_json,
      after_json,
      occurred_at
    ) VALUES (
      NEW.site_id,
      COALESCE(@actor_user_id, 0),
      CONCAT('SESSION_STATUS_CHANGE_', OLD.status, '_TO_', NEW.status),
      'gate_passage_sessions',
      CAST(NEW.session_id AS CHAR),
      JSON_OBJECT(
        'status', OLD.status,
        'lane_id', CAST(OLD.lane_id AS CHAR),
        'ticket_id', CAST(OLD.ticket_id AS CHAR),
        'resolved_at', OLD.resolved_at
      ),
      JSON_OBJECT(
        'status', NEW.status,
        'lane_id', CAST(NEW.lane_id AS CHAR),
        'ticket_id', CAST(NEW.ticket_id AS CHAR),
        'resolved_at', NEW.resolved_at
      ),
      NOW()
    );
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_gate_reviews_status_audit $$
CREATE TRIGGER trg_gate_reviews_status_audit
AFTER UPDATE ON gate_manual_reviews
FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO audit_logs (
      site_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      before_json,
      after_json,
      occurred_at
    ) VALUES (
      NEW.site_id,
      COALESCE(@actor_user_id, 0),
      CONCAT('REVIEW_STATUS_CHANGE_', OLD.status, '_TO_', NEW.status),
      'gate_manual_reviews',
      CAST(NEW.review_id AS CHAR),
      JSON_OBJECT(
        'status', OLD.status,
        'claimed_by_user_id', CAST(OLD.claimed_by_user_id AS CHAR),
        'queue_reason_code', OLD.queue_reason_code
      ),
      JSON_OBJECT(
        'status', NEW.status,
        'claimed_by_user_id', CAST(NEW.claimed_by_user_id AS CHAR),
        'resolved_by_user_id', CAST(NEW.resolved_by_user_id AS CHAR),
        'queue_reason_code', NEW.queue_reason_code
      ),
      NOW()
    );
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_gate_incidents_status_audit $$
CREATE TRIGGER trg_gate_incidents_status_audit
AFTER UPDATE ON gate_incidents
FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO audit_logs (
      site_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      before_json,
      after_json,
      occurred_at
    ) VALUES (
      NEW.site_id,
      COALESCE(@actor_user_id, 0),
      CONCAT('INCIDENT_STATUS_CHANGE_', OLD.status, '_TO_', NEW.status),
      'gate_incidents',
      CAST(NEW.incident_id AS CHAR),
      JSON_OBJECT(
        'status', OLD.status,
        'incident_type', OLD.incident_type,
        'severity', OLD.severity
      ),
      JSON_OBJECT(
        'status', NEW.status,
        'incident_type', NEW.incident_type,
        'severity', NEW.severity,
        'resolved_by_user_id', CAST(NEW.resolved_by_user_id AS CHAR),
        'resolution_action', NEW.resolution_action
      ),
      NOW()
    );
  END IF;
END $$

DELIMITER ;

-- ============================================================
-- 8) CREDENTIAL STATUS CHANGE AUDIT TRIGGER
-- ============================================================

DELIMITER $$

DROP TRIGGER IF EXISTS trg_credentials_status_audit $$
CREATE TRIGGER trg_credentials_status_audit
AFTER UPDATE ON credentials
FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO audit_logs (
      site_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      before_json,
      after_json,
      occurred_at
    ) VALUES (
      NEW.site_id,
      COALESCE(@actor_user_id, 0),
      CONCAT('CREDENTIAL_STATUS_CHANGE_', OLD.status, '_TO_', NEW.status),
      'credentials',
      CAST(NEW.credential_id AS CHAR),
      JSON_OBJECT(
        'credential_id', CAST(OLD.credential_id AS CHAR),
        'site_id', CAST(OLD.site_id AS CHAR),
        'subscription_id', CAST(OLD.subscription_id AS CHAR),
        'rfid_uid', OLD.rfid_uid,
        'status', OLD.status
      ),
      JSON_OBJECT(
        'credential_id', CAST(NEW.credential_id AS CHAR),
        'site_id', CAST(NEW.site_id AS CHAR),
        'subscription_id', CAST(NEW.subscription_id AS CHAR),
        'rfid_uid', NEW.rfid_uid,
        'status', NEW.status
      ),
      NOW()
    );
  END IF;
END $$

DELIMITER ;

-- ============================================================
-- 9) SUBSCRIPTION STATUS CHANGE AUDIT TRIGGER
-- ============================================================

DELIMITER $$

DROP TRIGGER IF EXISTS trg_subscriptions_status_audit $$
CREATE TRIGGER trg_subscriptions_status_audit
AFTER UPDATE ON subscriptions
FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO audit_logs (
      site_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      before_json,
      after_json,
      occurred_at
    ) VALUES (
      NEW.site_id,
      COALESCE(@actor_user_id, 0),
      CONCAT('SUBSCRIPTION_STATUS_CHANGE_', OLD.status, '_TO_', NEW.status),
      'subscriptions',
      CAST(NEW.subscription_id AS CHAR),
      JSON_OBJECT(
        'subscription_id', CAST(OLD.subscription_id AS CHAR),
        'site_id', CAST(OLD.site_id AS CHAR),
        'customer_id', CAST(OLD.customer_id AS CHAR),
        'plan_type', OLD.plan_type,
        'status', OLD.status,
        'start_date', OLD.start_date,
        'end_date', OLD.end_date
      ),
      JSON_OBJECT(
        'subscription_id', CAST(NEW.subscription_id AS CHAR),
        'site_id', CAST(NEW.site_id AS CHAR),
        'customer_id', CAST(NEW.customer_id AS CHAR),
        'plan_type', NEW.plan_type,
        'status', NEW.status,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date
      ),
      NOW()
    );
  END IF;
END $$

DELIMITER ;

-- ============================================================
-- 10) ANALYZE TABLES SAU KHI THÊM INDEXES
-- ============================================================
ANALYZE TABLE tickets;
ANALYZE TABLE spot_occupancy_projection;
ANALYZE TABLE gate_read_events;
ANALYZE TABLE auth_login_attempts;
ANALYZE TABLE credentials;
ANALYZE TABLE shift_closures;
ANALYZE TABLE gate_active_presence;
ANALYZE TABLE gate_passage_sessions;
ANALYZE TABLE gate_manual_reviews;
ANALYZE TABLE gate_incidents;
ANALYZE TABLE subscriptions;

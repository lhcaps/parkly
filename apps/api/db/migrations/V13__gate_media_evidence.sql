-- V13: Gate media evidence foundation
-- Mục tiêu:
--   - tách evidence/media ra khỏi payload_json treo tạm
--   - cho phép read event link rõ tới media/source metadata
--   - giữ forward-only migration, không sửa V11/V12

CREATE TABLE IF NOT EXISTS gate_read_media (
  media_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  lane_id BIGINT NULL,
  device_id BIGINT NULL,
  storage_kind ENUM('UPLOAD','URL','INLINE','MOCK','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  media_url VARCHAR(1024) NULL,
  file_path VARCHAR(1024) NULL,
  mime_type VARCHAR(128) NULL,
  sha256 VARCHAR(64) NULL,
  width_px INT NULL,
  height_px INT NULL,
  metadata_json JSON NULL,
  captured_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gate_read_media_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_gate_read_media_lane FOREIGN KEY (lane_id) REFERENCES gate_lanes(lane_id),
  CONSTRAINT fk_gate_read_media_device FOREIGN KEY (device_id) REFERENCES gate_devices(device_id),
  KEY ix_gate_read_media_site_created (site_id, created_at),
  KEY ix_gate_read_media_site_device_time (site_id, device_id, captured_at),
  KEY ix_gate_read_media_lane_time (lane_id, captured_at),
  KEY ix_gate_read_media_sha256 (sha256)
) ENGINE=InnoDB;

ALTER TABLE gate_read_events
  ADD COLUMN source_media_id BIGINT NULL AFTER payload_json,
  ADD COLUMN raw_ocr_text TEXT NULL AFTER source_media_id,
  ADD COLUMN ocr_confidence DECIMAL(5,4) NULL AFTER raw_ocr_text,
  ADD COLUMN camera_frame_ref VARCHAR(255) NULL AFTER ocr_confidence,
  ADD COLUMN crop_ref VARCHAR(255) NULL AFTER camera_frame_ref,
  ADD COLUMN source_device_code VARCHAR(64) NULL AFTER crop_ref,
  ADD COLUMN source_capture_ts DATETIME(3) NULL AFTER source_device_code;

SET @fk_gate_reads_source_media_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'gate_read_events'
    AND CONSTRAINT_NAME = 'fk_gate_reads_source_media'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @fk_gate_reads_source_media_sql := IF(
  @fk_gate_reads_source_media_exists = 0,
  'ALTER TABLE gate_read_events ADD CONSTRAINT fk_gate_reads_source_media FOREIGN KEY (source_media_id) REFERENCES gate_read_media(media_id)',
  'SELECT 1'
);
PREPARE stmt_fk_gate_reads_source_media FROM @fk_gate_reads_source_media_sql;
EXECUTE stmt_fk_gate_reads_source_media;
DEALLOCATE PREPARE stmt_fk_gate_reads_source_media;

SET @ix_gate_reads_media_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'gate_read_events'
    AND INDEX_NAME = 'ix_gate_reads_media'
);
SET @ix_gate_reads_media_sql := IF(
  @ix_gate_reads_media_exists = 0,
  'ALTER TABLE gate_read_events ADD KEY ix_gate_reads_media (source_media_id)',
  'SELECT 1'
);
PREPARE stmt_ix_gate_reads_media FROM @ix_gate_reads_media_sql;
EXECUTE stmt_ix_gate_reads_media;
DEALLOCATE PREPARE stmt_ix_gate_reads_media;

SET @ix_gate_reads_source_device_time_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'gate_read_events'
    AND INDEX_NAME = 'ix_gate_reads_source_device_time'
);
SET @ix_gate_reads_source_device_time_sql := IF(
  @ix_gate_reads_source_device_time_exists = 0,
  'ALTER TABLE gate_read_events ADD KEY ix_gate_reads_source_device_time (source_device_code, source_capture_ts)',
  'SELECT 1'
);
PREPARE stmt_ix_gate_reads_source_device_time FROM @ix_gate_reads_source_device_time_sql;
EXECUTE stmt_ix_gate_reads_source_device_time;
DEALLOCATE PREPARE stmt_ix_gate_reads_source_device_time;

UPDATE gate_read_events gre
JOIN gate_devices gd
  ON gd.device_id = gre.device_id
SET gre.source_device_code = gd.device_code
WHERE gre.source_device_code IS NULL;

UPDATE gate_read_events
SET source_capture_ts = occurred_at
WHERE source_capture_ts IS NULL;

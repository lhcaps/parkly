-- V11: Gate v4 foundation (lane / session / read / decision / barrier)
-- Mục tiêu: chuyển gate từ raw event log sang session orchestration foundation.

-- ============ 0) Expand gate_devices.device_type ============
ALTER TABLE gate_devices
  MODIFY COLUMN device_type ENUM('RFID_READER','CAMERA_ALPR','BARRIER','LOOP_SENSOR') NOT NULL;

-- ============ 1) gate_lanes ============
CREATE TABLE IF NOT EXISTS gate_lanes (
  lane_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  gate_code VARCHAR(32) NOT NULL,
  lane_code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  direction ENUM('ENTRY','EXIT') NOT NULL,
  status ENUM('ACTIVE','INACTIVE','MAINTENANCE') NOT NULL DEFAULT 'ACTIVE',
  sort_order INT NOT NULL DEFAULT 0,
  primary_device_id BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_gate_lanes_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_gate_lanes_primary_device FOREIGN KEY (primary_device_id) REFERENCES gate_devices(device_id),
  UNIQUE KEY uq_gate_lanes_code (site_id, lane_code),
  KEY ix_gate_lanes_site (site_id),
  KEY ix_gate_lanes_site_gate (site_id, gate_code),
  KEY ix_gate_lanes_site_direction (site_id, direction),
  KEY ix_gate_lanes_site_status (site_id, status)
) ENGINE=InnoDB;

-- ============ 2) gate_lane_devices ============
CREATE TABLE IF NOT EXISTS gate_lane_devices (
  lane_device_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  lane_id BIGINT NOT NULL,
  device_id BIGINT NOT NULL,
  device_role ENUM('PRIMARY','CAMERA','RFID','LOOP_SENSOR','BARRIER') NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  is_required TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gate_lane_devices_lane FOREIGN KEY (lane_id) REFERENCES gate_lanes(lane_id),
  CONSTRAINT fk_gate_lane_devices_device FOREIGN KEY (device_id) REFERENCES gate_devices(device_id),
  UNIQUE KEY uq_gate_lane_devices_lane_device (lane_id, device_id),
  UNIQUE KEY uq_gate_lane_devices_device (device_id),
  KEY ix_gate_lane_devices_lane_role (lane_id, device_role),
  KEY ix_gate_lane_devices_lane_primary (lane_id, is_primary)
) ENGINE=InnoDB;

-- ============ 3) gate_passage_sessions ============
CREATE TABLE IF NOT EXISTS gate_passage_sessions (
  session_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  lane_id BIGINT NOT NULL,
  direction ENUM('ENTRY','EXIT') NOT NULL,
  status ENUM('OPEN','WAITING_DECISION','APPROVED','WAITING_PAYMENT','DENIED','PASSED','TIMEOUT','CANCELLED','ERROR') NOT NULL DEFAULT 'OPEN',
  ticket_id BIGINT NULL,
  correlation_id VARCHAR(64) NULL,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_read_at DATETIME NULL,
  resolved_at DATETIME NULL,
  closed_at DATETIME NULL,
  plate_compact VARCHAR(32) NULL,
  rfid_uid VARCHAR(64) NULL,
  presence_active TINYINT(1) NOT NULL DEFAULT 0,
  review_required TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_gate_sessions_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_gate_sessions_lane FOREIGN KEY (lane_id) REFERENCES gate_lanes(lane_id),
  CONSTRAINT fk_gate_sessions_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id),
  KEY ix_gate_sessions_site_lane_status (site_id, lane_id, status),
  KEY ix_gate_sessions_site_opened (site_id, opened_at),
  KEY ix_gate_sessions_site_plate (site_id, plate_compact),
  KEY ix_gate_sessions_site_rfid (site_id, rfid_uid),
  KEY ix_gate_sessions_ticket (ticket_id),
  KEY ix_gate_sessions_corr (correlation_id)
) ENGINE=InnoDB;

-- ============ 4) gate_read_events ============
CREATE TABLE IF NOT EXISTS gate_read_events (
  read_event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NULL,
  site_id BIGINT NOT NULL,
  lane_id BIGINT NOT NULL,
  device_id BIGINT NOT NULL,
  read_type ENUM('ALPR','RFID','SENSOR') NOT NULL,
  direction ENUM('ENTRY','EXIT') NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  plate_raw VARCHAR(32) NULL,
  plate_compact VARCHAR(32) NULL,
  ocr_confidence DECIMAL(6,4) NULL,
  rfid_uid VARCHAR(64) NULL,
  sensor_state ENUM('PRESENT','CLEARED','TRIGGERED') NULL,
  payload_json JSON NULL,
  request_id VARCHAR(64) NULL,
  idempotency_key VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gate_reads_session FOREIGN KEY (session_id) REFERENCES gate_passage_sessions(session_id),
  CONSTRAINT fk_gate_reads_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_gate_reads_lane FOREIGN KEY (lane_id) REFERENCES gate_lanes(lane_id),
  CONSTRAINT fk_gate_reads_device FOREIGN KEY (device_id) REFERENCES gate_devices(device_id),
  UNIQUE KEY uq_gate_reads_site_idem (site_id, idempotency_key),
  KEY ix_gate_reads_session (session_id),
  KEY ix_gate_reads_site_lane_time (site_id, lane_id, occurred_at),
  KEY ix_gate_reads_site_type_time (site_id, read_type, occurred_at),
  KEY ix_gate_reads_device_time (device_id, occurred_at)
) ENGINE=InnoDB;

-- ============ 5) gate_decisions ============
CREATE TABLE IF NOT EXISTS gate_decisions (
  decision_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  site_id BIGINT NOT NULL,
  lane_id BIGINT NOT NULL,
  decision_code ENUM('AUTO_APPROVED','REVIEW_REQUIRED','AUTO_DENIED','PAYMENT_REQUIRED','TICKET_NOT_FOUND','PLATE_RFID_MISMATCH','ANTI_PASSBACK_BLOCKED','DEVICE_DEGRADED') NOT NULL,
  final_action ENUM('APPROVE','REVIEW','DENY','PAYMENT_HOLD') NOT NULL,
  reason_code VARCHAR(64) NOT NULL,
  reason_detail VARCHAR(255) NULL,
  input_snapshot_json JSON NULL,
  threshold_snapshot_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gate_decisions_session FOREIGN KEY (session_id) REFERENCES gate_passage_sessions(session_id),
  CONSTRAINT fk_gate_decisions_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_gate_decisions_lane FOREIGN KEY (lane_id) REFERENCES gate_lanes(lane_id),
  KEY ix_gate_decisions_session (session_id),
  KEY ix_gate_decisions_site_lane_time (site_id, lane_id, created_at),
  KEY ix_gate_decisions_code_time (decision_code, created_at)
) ENGINE=InnoDB;

-- ============ 6) gate_barrier_commands ============
CREATE TABLE IF NOT EXISTS gate_barrier_commands (
  command_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NULL,
  site_id BIGINT NOT NULL,
  lane_id BIGINT NOT NULL,
  device_id BIGINT NULL,
  command_type ENUM('OPEN','CLOSE','HOLD_OPEN','LOCK') NOT NULL,
  status ENUM('PENDING','SENT','ACKED','NACKED','TIMEOUT','CANCELLED') NOT NULL DEFAULT 'PENDING',
  request_id VARCHAR(64) NULL,
  reason_code VARCHAR(64) NULL,
  payload_json JSON NULL,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ack_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_gate_barrier_commands_session FOREIGN KEY (session_id) REFERENCES gate_passage_sessions(session_id),
  CONSTRAINT fk_gate_barrier_commands_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_gate_barrier_commands_lane FOREIGN KEY (lane_id) REFERENCES gate_lanes(lane_id),
  CONSTRAINT fk_gate_barrier_commands_device FOREIGN KEY (device_id) REFERENCES gate_devices(device_id),
  KEY ix_gate_barrier_commands_session (session_id),
  KEY ix_gate_barrier_commands_lane_status (lane_id, status),
  KEY ix_gate_barrier_commands_site_status (site_id, status),
  KEY ix_gate_barrier_commands_device (device_id)
) ENGINE=InnoDB;

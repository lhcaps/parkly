-- V12: Gate v4 foundation (review queue / device health / incidents)

-- ============ 1) gate_manual_reviews ============
CREATE TABLE IF NOT EXISTS gate_manual_reviews (
  review_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  site_id BIGINT NOT NULL,
  lane_id BIGINT NOT NULL,
  status ENUM('OPEN','CLAIMED','RESOLVED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  queue_reason_code VARCHAR(64) NOT NULL,
  claimed_by_user_id BIGINT NULL,
  claimed_at DATETIME NULL,
  resolved_by_user_id BIGINT NULL,
  resolved_at DATETIME NULL,
  note TEXT NULL,
  snapshot_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_gate_reviews_session FOREIGN KEY (session_id) REFERENCES gate_passage_sessions(session_id),
  CONSTRAINT fk_gate_reviews_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_gate_reviews_lane FOREIGN KEY (lane_id) REFERENCES gate_lanes(lane_id),
  CONSTRAINT fk_gate_reviews_claimed_by FOREIGN KEY (claimed_by_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_gate_reviews_resolved_by FOREIGN KEY (resolved_by_user_id) REFERENCES users(user_id),
  KEY ix_gate_reviews_status_created (status, created_at),
  KEY ix_gate_reviews_site_lane (site_id, lane_id),
  KEY ix_gate_reviews_claimed_by (claimed_by_user_id),
  KEY ix_gate_reviews_resolved_by (resolved_by_user_id)
) ENGINE=InnoDB;

-- ============ 2) device_heartbeats ============
CREATE TABLE IF NOT EXISTS device_heartbeats (
  heartbeat_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  device_id BIGINT NOT NULL,
  status ENUM('ONLINE','DEGRADED','OFFLINE') NOT NULL DEFAULT 'ONLINE',
  reported_at DATETIME NOT NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  latency_ms INT NULL,
  firmware_version VARCHAR(64) NULL,
  ip_address VARCHAR(64) NULL,
  payload_json JSON NULL,
  CONSTRAINT fk_device_heartbeats_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_device_heartbeats_device FOREIGN KEY (device_id) REFERENCES gate_devices(device_id),
  KEY ix_device_heartbeats_site_device_time (site_id, device_id, reported_at),
  KEY ix_device_heartbeats_site_status (site_id, status),
  KEY ix_device_heartbeats_device_time (device_id, reported_at)
) ENGINE=InnoDB;

-- ============ 3) gate_incidents ============
CREATE TABLE IF NOT EXISTS gate_incidents (
  incident_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NULL,
  site_id BIGINT NOT NULL,
  lane_id BIGINT NULL,
  device_id BIGINT NULL,
  severity ENUM('INFO','WARN','CRITICAL') NOT NULL,
  status ENUM('OPEN','ACKED','RESOLVED','IGNORED') NOT NULL DEFAULT 'OPEN',
  incident_type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  detail TEXT NULL,
  snapshot_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  CONSTRAINT fk_gate_incidents_session FOREIGN KEY (session_id) REFERENCES gate_passage_sessions(session_id),
  CONSTRAINT fk_gate_incidents_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_gate_incidents_lane FOREIGN KEY (lane_id) REFERENCES gate_lanes(lane_id),
  CONSTRAINT fk_gate_incidents_device FOREIGN KEY (device_id) REFERENCES gate_devices(device_id),
  KEY ix_gate_incidents_status_created (status, created_at),
  KEY ix_gate_incidents_site_lane (site_id, lane_id),
  KEY ix_gate_incidents_site_device (site_id, device_id),
  KEY ix_gate_incidents_severity_created (severity, created_at)
) ENGINE=InnoDB;

-- ============ 4) Lane-device map view ============
DROP VIEW IF EXISTS v_gate_lane_device_map;
CREATE VIEW v_gate_lane_device_map AS
SELECT
  ps.site_code AS site_code,
  ps.name AS site_name,
  gl.site_id AS site_id,
  gl.lane_id AS lane_id,
  gl.gate_code AS gate_code,
  gl.lane_code AS lane_code,
  gl.name AS lane_name,
  gl.direction AS direction,
  gl.status AS lane_status,
  gld.device_role AS device_role,
  gld.is_primary AS is_primary,
  gld.is_required AS is_required,
  gld.sort_order AS sort_order,
  gd.device_id AS device_id,
  gd.device_code AS device_code,
  gd.device_type AS device_type,
  gd.location_hint AS location_hint
FROM gate_lanes gl
JOIN parking_sites ps
  ON ps.site_id = gl.site_id
JOIN gate_lane_devices gld
  ON gld.lane_id = gl.lane_id
JOIN gate_devices gd
  ON gd.device_id = gld.device_id;

-- V34: Module-oriented SQL surface
-- Mục tiêu:
--  - Bổ sung +12 VIEW theo module (giả lập package read-model)
--  - Bổ sung +15 PROCEDURE theo module nghiệp vụ
--  - Bổ sung +1 TRIGGER để đồng bộ plate_compact của subscription_vehicles

-- ============================================================
-- Views
-- ============================================================

DROP VIEW IF EXISTS pkg_dashboard_incident_summary_v;
DROP VIEW IF EXISTS pkg_dashboard_occupancy_summary_v;
DROP VIEW IF EXISTS pkg_dashboard_topology_summary_v;
DROP VIEW IF EXISTS pkg_gate_lane_health_v;
DROP VIEW IF EXISTS pkg_gate_active_queue_v;
DROP VIEW IF EXISTS pkg_gate_incident_feed_v;
DROP VIEW IF EXISTS pkg_subscription_vehicle_active_v;
DROP VIEW IF EXISTS pkg_subscription_spot_assignments_v;
DROP VIEW IF EXISTS pkg_subscription_effective_status_v;
DROP VIEW IF EXISTS pkg_auth_active_sessions_v;
DROP VIEW IF EXISTS pkg_auth_login_risk_v;
DROP VIEW IF EXISTS pkg_pricing_effective_rules_v;

CREATE VIEW pkg_subscription_effective_status_v AS
SELECT
  s.subscription_id,
  s.site_id,
  ps.site_code,
  ps.name AS site_name,
  s.customer_id,
  c.full_name AS customer_name,
  c.phone AS customer_phone,
  c.email AS customer_email,
  s.plan_type,
  s.start_date,
  s.end_date,
  s.status,
  CASE
    WHEN s.status = 'SUSPENDED' THEN 'SUSPENDED'
    WHEN s.status = 'CANCELLED' THEN 'CANCELLED'
    WHEN s.status = 'EXPIRED' OR s.end_date < CURDATE() THEN 'EXPIRED'
    ELSE 'ACTIVE'
  END AS effective_status,
  CASE
    WHEN s.status = 'ACTIVE' AND CURDATE() BETWEEN s.start_date AND s.end_date THEN 1
    ELSE 0
  END AS active_window_flag,
  DATEDIFF(s.end_date, CURDATE()) AS days_to_expiry,
  (
    SELECT COUNT(*)
    FROM subscription_vehicles sv
    WHERE sv.subscription_id = s.subscription_id
      AND sv.status = 'ACTIVE'
      AND CURDATE() BETWEEN COALESCE(sv.valid_from, s.start_date) AND COALESCE(sv.valid_to, s.end_date)
  ) AS active_vehicle_link_count,
  (
    SELECT COUNT(*)
    FROM subscription_spots ss
    WHERE ss.subscription_id = s.subscription_id
      AND ss.status = 'ACTIVE'
      AND CURDATE() BETWEEN COALESCE(ss.assigned_from, s.start_date) AND COALESCE(ss.assigned_until, s.end_date)
  ) AS active_spot_link_count
FROM subscriptions s
JOIN parking_sites ps
  ON ps.site_id = s.site_id
JOIN customers c
  ON c.customer_id = s.customer_id;

CREATE VIEW pkg_subscription_spot_assignments_v AS
SELECT
  ss.subscription_spot_id,
  ss.subscription_id,
  ss.site_id,
  ps.site_code,
  s.customer_id,
  c.full_name AS customer_name,
  ss.spot_id,
  sp.code AS spot_code,
  z.code AS zone_code,
  ss.assigned_mode,
  ss.status,
  ss.is_primary,
  ss.assigned_from,
  ss.assigned_until,
  ss.note,
  s.status AS subscription_status,
  CASE
    WHEN s.status = 'SUSPENDED' THEN 'SUSPENDED'
    WHEN s.status = 'CANCELLED' THEN 'CANCELLED'
    WHEN s.status = 'EXPIRED' OR s.end_date < CURDATE() THEN 'EXPIRED'
    ELSE 'ACTIVE'
  END AS effective_subscription_status,
  COALESCE(ss.assigned_from, s.start_date) AS effective_from,
  COALESCE(ss.assigned_until, s.end_date) AS effective_until,
  CASE
    WHEN ss.status = 'ACTIVE'
     AND s.status IN ('ACTIVE', 'SUSPENDED')
     AND CURDATE() BETWEEN COALESCE(ss.assigned_from, s.start_date) AND COALESCE(ss.assigned_until, s.end_date)
    THEN 1
    ELSE 0
  END AS active_window_flag
FROM subscription_spots ss
JOIN subscriptions s
  ON s.subscription_id = ss.subscription_id
JOIN parking_sites ps
  ON ps.site_id = ss.site_id
JOIN customers c
  ON c.customer_id = s.customer_id
JOIN spots sp
  ON sp.spot_id = ss.spot_id
JOIN zones z
  ON z.zone_id = sp.zone_id;

CREATE VIEW pkg_subscription_vehicle_active_v AS
SELECT
  sv.subscription_vehicle_id,
  sv.subscription_id,
  sv.site_id,
  ps.site_code,
  s.customer_id,
  c.full_name AS customer_name,
  sv.vehicle_id,
  v.license_plate,
  sv.plate_compact,
  v.vehicle_type,
  sv.status,
  sv.is_primary,
  sv.valid_from,
  sv.valid_to,
  sv.note,
  s.status AS subscription_status,
  CASE
    WHEN s.status = 'SUSPENDED' THEN 'SUSPENDED'
    WHEN s.status = 'CANCELLED' THEN 'CANCELLED'
    WHEN s.status = 'EXPIRED' OR s.end_date < CURDATE() THEN 'EXPIRED'
    ELSE 'ACTIVE'
  END AS effective_subscription_status,
  COALESCE(sv.valid_from, s.start_date) AS effective_from,
  COALESCE(sv.valid_to, s.end_date) AS effective_until,
  CASE
    WHEN sv.status = 'ACTIVE'
     AND s.status IN ('ACTIVE', 'SUSPENDED')
     AND CURDATE() BETWEEN COALESCE(sv.valid_from, s.start_date) AND COALESCE(sv.valid_to, s.end_date)
    THEN 1
    ELSE 0
  END AS active_window_flag
FROM subscription_vehicles sv
JOIN subscriptions s
  ON s.subscription_id = sv.subscription_id
JOIN parking_sites ps
  ON ps.site_id = sv.site_id
JOIN customers c
  ON c.customer_id = s.customer_id
JOIN vehicles v
  ON v.vehicle_id = sv.vehicle_id;

CREATE VIEW pkg_auth_active_sessions_v AS
SELECT
  aus.session_id,
  aus.user_id,
  u.username,
  u.status AS user_status,
  aus.role_code,
  aus.access_token_hash,
  aus.refresh_token_hash,
  aus.access_expires_at,
  aus.refresh_expires_at,
  aus.last_seen_at,
  aus.last_refreshed_at,
  aus.revoked_at,
  aus.revoke_reason,
  aus.last_ip_address,
  aus.last_user_agent,
  aus.created_at,
  aus.updated_at,
  CASE
    WHEN aus.revoked_at IS NOT NULL THEN 0
    WHEN aus.refresh_expires_at < CURRENT_TIMESTAMP THEN 0
    ELSE 1
  END AS active_flag,
  CASE
    WHEN aus.revoked_at IS NOT NULL THEN 'REVOKED'
    WHEN aus.refresh_expires_at < CURRENT_TIMESTAMP THEN 'EXPIRED'
    WHEN aus.access_expires_at < CURRENT_TIMESTAMP THEN 'STALE_ACCESS'
    ELSE 'ACTIVE'
  END AS session_state
FROM auth_user_sessions aus
JOIN users u
  ON u.user_id = aus.user_id;

CREATE VIEW pkg_auth_login_risk_v AS
SELECT
  attempt_key,
  bucket_kind,
  username,
  ip_address,
  failure_count,
  first_failure_at,
  last_failure_at,
  lockout_until,
  last_delay_ms,
  created_at,
  updated_at,
  CASE
    WHEN lockout_until IS NOT NULL AND lockout_until > CURRENT_TIMESTAMP THEN 1
    ELSE 0
  END AS active_lockout_flag,
  CASE
    WHEN lockout_until IS NOT NULL AND lockout_until > CURRENT_TIMESTAMP THEN 'CRITICAL'
    WHEN failure_count >= 10 THEN 'CRITICAL'
    WHEN failure_count >= 5 THEN 'HIGH'
    WHEN failure_count >= 3 THEN 'MEDIUM'
    ELSE 'LOW'
  END AS risk_level
FROM auth_login_attempts;

CREATE VIEW pkg_pricing_effective_rules_v AS
SELECT
  t.site_id,
  ps.site_code,
  t.tariff_id,
  t.name AS tariff_name,
  t.applies_to,
  t.vehicle_type,
  t.is_active AS tariff_is_active,
  t.valid_from,
  t.valid_until,
  t.zone_code AS tariff_zone_code,
  t.description AS tariff_description,
  t.short_code AS tariff_short_code,
  COALESCE(t.display_order, 0) AS display_order,
  COALESCE(t.is_default, 0) AS is_default,
  COALESCE(t.requires_subscription, 0) AS requires_subscription,
  COALESCE(t.grace_period_minutes, 0) AS grace_period_minutes,
  t.max_duration_hours,
  tr.rule_id,
  tr.rule_type,
  tr.rule_code,
  tr.zone_code AS rule_zone_code,
  tr.vehicle_type_filter,
  tr.param_json,
  tr.condition_json,
  tr.action_json,
  tr.priority,
  COALESCE(tr.priority_override, tr.priority) AS priority_sort,
  COALESCE(tr.is_active, 1) AS rule_is_active,
  tr.effective_date,
  tr.expiration_date
FROM tariffs t
JOIN parking_sites ps
  ON ps.site_id = t.site_id
LEFT JOIN tariff_rules tr
  ON tr.tariff_id = t.tariff_id;

CREATE VIEW pkg_gate_incident_feed_v AS
SELECT
  gi.incident_id AS incidentId,
  gi.site_id AS siteId,
  ps.site_code AS siteCode,
  gi.lane_id AS laneId,
  gl.lane_code AS laneCode,
  gi.device_id AS deviceId,
  gd.device_code AS deviceCode,
  gi.session_id AS sessionId,
  gi.severity AS severity,
  gi.status AS status,
  gi.incident_type AS incidentType,
  gi.title AS title,
  gi.detail AS detail,
  gi.source_key AS sourceKey,
  gi.resolution_action AS resolutionAction,
  gi.resolved_by_user_id AS resolvedByUserId,
  gi.resolved_by_role AS resolvedByRole,
  gi.evidence_media_id AS evidenceMediaId,
  gi.last_signal_at AS lastSignalAt,
  gi.snapshot_json AS snapshotJson,
  gi.created_at AS createdAt,
  gi.updated_at AS updatedAt,
  gi.resolved_at AS resolvedAt
FROM gate_incidents gi
JOIN parking_sites ps
  ON ps.site_id = gi.site_id
LEFT JOIN gate_lanes gl
  ON gl.lane_id = gi.lane_id
LEFT JOIN gate_devices gd
  ON gd.device_id = gi.device_id;

CREATE VIEW pkg_dashboard_incident_summary_v AS
SELECT
  incidentId,
  siteId,
  siteCode,
  status,
  severity,
  createdAt,
  updatedAt,
  resolvedAt
FROM pkg_gate_incident_feed_v;

CREATE VIEW pkg_dashboard_occupancy_summary_v AS
SELECT
  ps.site_id,
  ps.site_code AS siteCode,
  COUNT(sp.spot_id) AS totalSpots,
  COALESCE(SUM(CASE WHEN pop.occupancy_status = 'EMPTY' THEN 1 ELSE 0 END), 0) AS emptyCount,
  COALESCE(SUM(CASE WHEN pop.occupancy_status = 'OCCUPIED_MATCHED' THEN 1 ELSE 0 END), 0) AS occupiedMatchedCount,
  COALESCE(SUM(CASE WHEN pop.occupancy_status = 'OCCUPIED_UNKNOWN' THEN 1 ELSE 0 END), 0) AS occupiedUnknownCount,
  COALESCE(SUM(CASE WHEN pop.occupancy_status = 'OCCUPIED_VIOLATION' THEN 1 ELSE 0 END), 0) AS occupiedViolationCount,
  COALESCE(SUM(CASE WHEN pop.occupancy_status = 'SENSOR_STALE' THEN 1 ELSE 0 END), 0) AS sensorStaleCount,
  COALESCE(SUM(CASE WHEN sp.spot_id IS NOT NULL AND pop.projection_id IS NULL THEN 1 ELSE 0 END), 0) AS unreportedCount,
  COALESCE(SUM(CASE WHEN pop.occupancy_status IN ('OCCUPIED_MATCHED', 'OCCUPIED_UNKNOWN', 'OCCUPIED_VIOLATION', 'SENSOR_STALE') THEN 1 ELSE 0 END), 0) AS occupiedTotal,
  MAX(pop.updated_at) AS lastProjectedAt
FROM parking_sites ps
LEFT JOIN spots sp
  ON sp.site_id = ps.site_id
LEFT JOIN spot_occupancy_projection pop
  ON pop.site_id = sp.site_id
 AND pop.spot_id = sp.spot_id
GROUP BY ps.site_id, ps.site_code;

CREATE VIEW pkg_dashboard_topology_summary_v AS
SELECT
  ps.site_id,
  ps.site_code AS siteCode,
  COUNT(DISTINCT z.zone_id) AS zoneCount,
  COUNT(DISTINCT gl.gate_code) AS gateCount,
  COUNT(DISTINCT gl.lane_id) AS laneCount,
  COUNT(DISTINCT gd.device_id) AS deviceCount,
  GROUP_CONCAT(DISTINCT CASE WHEN z.code IS NOT NULL THEN z.code END SEPARATOR ',') AS zoneCodes,
  GROUP_CONCAT(DISTINCT CASE WHEN z.name IS NOT NULL THEN z.name END SEPARATOR '|||') AS zoneNames,
  GROUP_CONCAT(DISTINCT CASE WHEN z.vehicle_type IS NOT NULL THEN z.vehicle_type END SEPARATOR ',') AS vehicleTypes
FROM parking_sites ps
LEFT JOIN zones z
  ON z.site_id = ps.site_id
LEFT JOIN gate_lanes gl
  ON gl.site_id = ps.site_id
LEFT JOIN gate_devices gd
  ON gd.site_id = ps.site_id
GROUP BY ps.site_id, ps.site_code;

CREATE VIEW pkg_gate_active_queue_v AS
SELECT
  gps.session_id AS sessionId,
  gps.site_id AS siteId,
  ps.site_code AS siteCode,
  gps.lane_id AS laneId,
  gl.lane_code AS laneCode,
  gps.direction AS direction,
  gps.status AS status,
  gps.ticket_id AS ticketId,
  gps.correlation_id AS correlationId,
  gps.opened_at AS openedAt,
  gps.last_read_at AS lastReadAt,
  gps.resolved_at AS resolvedAt,
  gps.closed_at AS closedAt,
  gps.plate_compact AS plateCompact,
  gps.rfid_uid AS rfidUid,
  gps.presence_active AS presenceActive,
  gps.review_required AS reviewRequired,
  (
    SELECT COUNT(*)
    FROM gate_active_presence gap
    WHERE gap.session_id = gps.session_id
      AND COALESCE(gap.active_flag, 1) = 1
  ) AS activePresenceCount,
  (
    SELECT COUNT(*)
    FROM gate_manual_reviews gmr
    WHERE gmr.session_id = gps.session_id
      AND gmr.status IN ('OPEN', 'CLAIMED')
  ) AS openManualReviewCount
FROM gate_passage_sessions gps
JOIN parking_sites ps
  ON ps.site_id = gps.site_id
JOIN gate_lanes gl
  ON gl.lane_id = gps.lane_id;

CREATE VIEW pkg_gate_lane_health_v AS
SELECT
  gl.lane_id,
  gl.site_id,
  ps.site_code AS siteCode,
  gl.gate_code AS gateCode,
  gl.lane_code AS laneCode,
  COALESCE(gl.name, gl.lane_code) AS laneLabel,
  gl.direction AS direction,
  gl.status AS laneOperationalStatus,
  health.lastBarrierStatus,
  health.lastBarrierIssuedAt,
  health.lastSessionStatus,
  health.activePresenceCount,
  health.requiredDeviceCount,
  health.onlineDeviceCount,
  health.degradedDeviceCount,
  health.offlineDeviceCount,
  CASE
    WHEN health.lastBarrierStatus IN ('NACKED', 'TIMEOUT') THEN 'BARRIER_FAULT'
    WHEN health.requiredDeviceCount = 0 THEN 'OFFLINE'
    WHEN health.onlineDeviceCount = 0 THEN 'OFFLINE'
    WHEN health.barrierProblemFlag = 1 THEN 'BARRIER_FAULT'
    WHEN health.cameraProblemFlag = 1 THEN 'DEGRADED_CAMERA'
    WHEN health.rfidProblemFlag = 1 THEN 'DEGRADED_RFID'
    WHEN health.sensorProblemFlag = 1 THEN 'DEGRADED_SENSOR'
    WHEN health.degradedDeviceCount > 0 OR health.offlineDeviceCount > 0 THEN 'DEGRADED'
    ELSE 'HEALTHY'
  END AS aggregateHealth
FROM gate_lanes gl
JOIN parking_sites ps
  ON ps.site_id = gl.site_id
LEFT JOIN (
  SELECT
    lane_data.lane_id,
    lane_data.lastBarrierStatus,
    lane_data.lastBarrierIssuedAt,
    lane_data.lastSessionStatus,
    lane_data.activePresenceCount,
    lane_data.requiredDeviceCount,
    lane_data.onlineDeviceCount,
    lane_data.degradedDeviceCount,
    lane_data.offlineDeviceCount,
    lane_data.barrierProblemFlag,
    lane_data.cameraProblemFlag,
    lane_data.rfidProblemFlag,
    lane_data.sensorProblemFlag
  FROM (
    SELECT
      ldh.lane_id,
      (
        SELECT gbc.status
        FROM gate_barrier_commands gbc
        WHERE gbc.lane_id = ldh.lane_id
        ORDER BY gbc.issued_at DESC, gbc.command_id DESC
        LIMIT 1
      ) AS lastBarrierStatus,
      (
        SELECT gbc.issued_at
        FROM gate_barrier_commands gbc
        WHERE gbc.lane_id = ldh.lane_id
        ORDER BY gbc.issued_at DESC, gbc.command_id DESC
        LIMIT 1
      ) AS lastBarrierIssuedAt,
      (
        SELECT gps.status
        FROM gate_passage_sessions gps
        WHERE gps.lane_id = ldh.lane_id
        ORDER BY gps.opened_at DESC, gps.session_id DESC
        LIMIT 1
      ) AS lastSessionStatus,
      (
        SELECT COUNT(*)
        FROM gate_active_presence gap
        WHERE gap.session_id IN (
          SELECT gps2.session_id
          FROM gate_passage_sessions gps2
          WHERE gps2.lane_id = ldh.lane_id
        )
          AND COALESCE(gap.active_flag, 1) = 1
      ) AS activePresenceCount,
      SUM(CASE WHEN ldh.is_required = 1 THEN 1 ELSE 0 END) AS requiredDeviceCount,
      SUM(
        CASE
          WHEN ldh.is_required = 1
           AND ldh.heartbeat_reported_at IS NOT NULL
           AND TIMESTAMPDIFF(SECOND, ldh.heartbeat_reported_at, CURRENT_TIMESTAMP) <= 90
           AND UPPER(COALESCE(ldh.heartbeat_status, 'ONLINE')) NOT IN ('DEGRADED', 'OFFLINE')
          THEN 1
          ELSE 0
        END
      ) AS onlineDeviceCount,
      SUM(
        CASE
          WHEN ldh.is_required = 1
           AND ldh.heartbeat_reported_at IS NOT NULL
           AND TIMESTAMPDIFF(SECOND, ldh.heartbeat_reported_at, CURRENT_TIMESTAMP) <= 300
           AND (
             UPPER(COALESCE(ldh.heartbeat_status, 'ONLINE')) = 'DEGRADED'
             OR TIMESTAMPDIFF(SECOND, ldh.heartbeat_reported_at, CURRENT_TIMESTAMP) > 90
           )
          THEN 1
          ELSE 0
        END
      ) AS degradedDeviceCount,
      SUM(
        CASE
          WHEN ldh.is_required = 1
           AND (
             ldh.heartbeat_reported_at IS NULL
             OR UPPER(COALESCE(ldh.heartbeat_status, 'OFFLINE')) = 'OFFLINE'
             OR TIMESTAMPDIFF(SECOND, ldh.heartbeat_reported_at, CURRENT_TIMESTAMP) > 300
           )
          THEN 1
          ELSE 0
        END
      ) AS offlineDeviceCount,
      MAX(
        CASE
          WHEN ldh.is_required = 1
           AND ldh.device_role = 'BARRIER'
           AND (
             ldh.heartbeat_reported_at IS NULL
             OR UPPER(COALESCE(ldh.heartbeat_status, 'OFFLINE')) IN ('DEGRADED', 'OFFLINE')
             OR TIMESTAMPDIFF(SECOND, ldh.heartbeat_reported_at, CURRENT_TIMESTAMP) > 90
           )
          THEN 1
          ELSE 0
        END
      ) AS barrierProblemFlag,
      MAX(
        CASE
          WHEN ldh.is_required = 1
           AND ldh.device_role = 'CAMERA'
           AND (
             ldh.heartbeat_reported_at IS NULL
             OR UPPER(COALESCE(ldh.heartbeat_status, 'OFFLINE')) IN ('DEGRADED', 'OFFLINE')
             OR TIMESTAMPDIFF(SECOND, ldh.heartbeat_reported_at, CURRENT_TIMESTAMP) > 90
           )
          THEN 1
          ELSE 0
        END
      ) AS cameraProblemFlag,
      MAX(
        CASE
          WHEN ldh.is_required = 1
           AND ldh.device_role = 'RFID'
           AND (
             ldh.heartbeat_reported_at IS NULL
             OR UPPER(COALESCE(ldh.heartbeat_status, 'OFFLINE')) IN ('DEGRADED', 'OFFLINE')
             OR TIMESTAMPDIFF(SECOND, ldh.heartbeat_reported_at, CURRENT_TIMESTAMP) > 90
           )
          THEN 1
          ELSE 0
        END
      ) AS rfidProblemFlag,
      MAX(
        CASE
          WHEN ldh.is_required = 1
           AND ldh.device_role = 'LOOP_SENSOR'
           AND (
             ldh.heartbeat_reported_at IS NULL
             OR UPPER(COALESCE(ldh.heartbeat_status, 'OFFLINE')) IN ('DEGRADED', 'OFFLINE')
             OR TIMESTAMPDIFF(SECOND, ldh.heartbeat_reported_at, CURRENT_TIMESTAMP) > 90
           )
          THEN 1
          ELSE 0
        END
      ) AS sensorProblemFlag
    FROM (
      SELECT
        gld.lane_id,
        UPPER(COALESCE(gld.device_role, 'PRIMARY')) AS device_role,
        COALESCE(gld.is_required, 1) AS is_required,
        (
          SELECT dh.status
          FROM device_heartbeats dh
          WHERE dh.device_id = gld.device_id
          ORDER BY dh.reported_at DESC, dh.heartbeat_id DESC
          LIMIT 1
        ) AS heartbeat_status,
        (
          SELECT dh.reported_at
          FROM device_heartbeats dh
          WHERE dh.device_id = gld.device_id
          ORDER BY dh.reported_at DESC, dh.heartbeat_id DESC
          LIMIT 1
        ) AS heartbeat_reported_at
      FROM gate_lane_devices gld
    ) ldh
    GROUP BY ldh.lane_id
  ) lane_data
) health
  ON health.lane_id = gl.lane_id;

-- ============================================================
-- Procedures + trigger
-- ============================================================

DELIMITER $$

DROP TRIGGER IF EXISTS trg_vehicles_sync_subscription_plate $$
-- Use direct CREATE TRIGGER here. PREPARE/EXECUTE fails with ER_UNSUPPORTED_PS on MySQL.
CREATE TRIGGER trg_vehicles_sync_subscription_plate
AFTER UPDATE ON vehicles
FOR EACH ROW
BEGIN
  IF COALESCE(OLD.license_plate, '') <> COALESCE(NEW.license_plate, '') THEN
    UPDATE subscription_vehicles
    SET plate_compact = UPPER(REGEXP_REPLACE(COALESCE(NEW.license_plate, ''), '[^A-Za-z0-9]', '')),
        updated_at = CURRENT_TIMESTAMP
    WHERE vehicle_id = NEW.vehicle_id;
  END IF;
END $$

DROP PROCEDURE IF EXISTS pkg_auth_revoke_user_sessions $$
CREATE PROCEDURE pkg_auth_revoke_user_sessions(
  IN p_user_id BIGINT,
  IN p_revoked_at DATETIME,
  IN p_reason VARCHAR(255),
  IN p_except_session_id CHAR(36)
)
BEGIN
  UPDATE auth_user_sessions
  SET revoked_at = COALESCE(p_revoked_at, CURRENT_TIMESTAMP),
      revoke_reason = COALESCE(p_reason, revoke_reason)
  WHERE user_id = p_user_id
    AND revoked_at IS NULL
    AND (p_except_session_id IS NULL OR session_id <> p_except_session_id);
END $$

DROP PROCEDURE IF EXISTS pkg_auth_cleanup_sessions $$
CREATE PROCEDURE pkg_auth_cleanup_sessions(
  IN p_now DATETIME,
  IN p_expired_retention_days INT,
  IN p_revoked_retention_days INT,
  IN p_batch_limit INT
)
BEGIN
  DECLARE v_now DATETIME;
  DECLARE v_expired_cutoff DATETIME;
  DECLARE v_revoked_cutoff DATETIME;
  DECLARE v_limit INT;

  SET v_now = COALESCE(p_now, CURRENT_TIMESTAMP);
  SET v_expired_cutoff = DATE_SUB(v_now, INTERVAL GREATEST(COALESCE(p_expired_retention_days, 1), 1) DAY);
  SET v_revoked_cutoff = DATE_SUB(v_now, INTERVAL GREATEST(COALESCE(p_revoked_retention_days, 1), 1) DAY);
  SET v_limit = GREATEST(COALESCE(p_batch_limit, 1), 1);

  DELETE FROM auth_user_sessions
  WHERE refresh_expires_at < v_expired_cutoff
  ORDER BY refresh_expires_at ASC
  LIMIT v_limit;

  DELETE FROM auth_user_sessions
  WHERE revoked_at IS NOT NULL
    AND revoked_at < v_revoked_cutoff
  ORDER BY revoked_at ASC
  LIMIT v_limit;
END $$

DROP PROCEDURE IF EXISTS pkg_auth_set_user_status $$
CREATE PROCEDURE pkg_auth_set_user_status(
  IN p_user_id BIGINT,
  IN p_status VARCHAR(32)
)
BEGIN
  UPDATE users
  SET status = COALESCE(p_status, status)
  WHERE user_id = p_user_id;
END $$

DROP PROCEDURE IF EXISTS pkg_subscription_create $$
CREATE PROCEDURE pkg_subscription_create(
  IN p_site_id BIGINT,
  IN p_customer_id BIGINT,
  IN p_plan_type VARCHAR(32),
  IN p_start_date DATE,
  IN p_end_date DATE,
  IN p_status VARCHAR(32)
)
BEGIN
  IF p_end_date < p_start_date THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'subscription end_date must be >= start_date';
  END IF;

  INSERT INTO subscriptions (site_id, customer_id, plan_type, start_date, end_date, status)
  VALUES (
    p_site_id,
    p_customer_id,
    p_plan_type,
    p_start_date,
    p_end_date,
    COALESCE(p_status, 'ACTIVE')
  );
END $$

DROP PROCEDURE IF EXISTS pkg_subscription_update $$
CREATE PROCEDURE pkg_subscription_update(
  IN p_subscription_id BIGINT,
  IN p_plan_type VARCHAR(32),
  IN p_start_date DATE,
  IN p_end_date DATE,
  IN p_status VARCHAR(32)
)
BEGIN
  DECLARE v_start_date DATE;
  DECLARE v_end_date DATE;

  SELECT
    COALESCE(p_start_date, start_date),
    COALESCE(p_end_date, end_date)
  INTO v_start_date, v_end_date
  FROM subscriptions
  WHERE subscription_id = p_subscription_id
  LIMIT 1;

  IF v_start_date IS NULL OR v_end_date IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'subscription not found';
  END IF;

  IF v_end_date < v_start_date THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'subscription end_date must be >= start_date';
  END IF;

  UPDATE subscriptions
  SET plan_type = COALESCE(p_plan_type, plan_type),
      start_date = v_start_date,
      end_date = v_end_date,
      status = COALESCE(p_status, status)
  WHERE subscription_id = p_subscription_id;
END $$

DROP PROCEDURE IF EXISTS pkg_subscription_assign_spot $$
CREATE PROCEDURE pkg_subscription_assign_spot(
  IN p_subscription_id BIGINT,
  IN p_site_id BIGINT,
  IN p_spot_id BIGINT,
  IN p_assigned_mode VARCHAR(32),
  IN p_status VARCHAR(32),
  IN p_is_primary TINYINT,
  IN p_assigned_from DATE,
  IN p_assigned_until DATE,
  IN p_note VARCHAR(255)
)
BEGIN
  DECLARE v_start_date DATE;
  DECLARE v_end_date DATE;
  DECLARE v_effective_from DATE;
  DECLARE v_effective_until DATE;

  SELECT start_date, end_date
  INTO v_start_date, v_end_date
  FROM subscriptions
  WHERE subscription_id = p_subscription_id
    AND site_id = p_site_id
  LIMIT 1;

  IF v_start_date IS NULL OR v_end_date IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'subscription/site mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM spots
    WHERE spot_id = p_spot_id
      AND site_id = p_site_id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'spot/site mismatch';
  END IF;

  SET v_effective_from = COALESCE(p_assigned_from, v_start_date);
  SET v_effective_until = COALESCE(p_assigned_until, v_end_date);

  IF v_effective_until < v_effective_from THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'assigned_until must be >= assigned_from';
  END IF;

  IF COALESCE(p_status, 'ACTIVE') = 'ACTIVE' AND EXISTS (
    SELECT 1
    FROM subscription_spots ss
    JOIN subscriptions s
      ON s.subscription_id = ss.subscription_id
    WHERE ss.site_id = p_site_id
      AND ss.spot_id = p_spot_id
      AND ss.status = 'ACTIVE'
      AND s.status IN ('ACTIVE', 'SUSPENDED')
      AND ss.subscription_id <> p_subscription_id
      AND NOT (
        v_effective_until < COALESCE(ss.assigned_from, s.start_date)
        OR v_effective_from > COALESCE(ss.assigned_until, s.end_date)
      )
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'spot already assigned in overlapping window';
  END IF;

  IF COALESCE(p_is_primary, 0) = 1 THEN
    UPDATE subscription_spots
    SET is_primary = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE subscription_id = p_subscription_id
      AND status = 'ACTIVE';
  END IF;

  INSERT INTO subscription_spots (
    subscription_id,
    site_id,
    spot_id,
    assigned_mode,
    status,
    is_primary,
    assigned_from,
    assigned_until,
    note
  ) VALUES (
    p_subscription_id,
    p_site_id,
    p_spot_id,
    COALESCE(p_assigned_mode, 'ASSIGNED'),
    COALESCE(p_status, 'ACTIVE'),
    COALESCE(p_is_primary, 0),
    p_assigned_from,
    p_assigned_until,
    p_note
  );
END $$

DROP PROCEDURE IF EXISTS pkg_subscription_update_spot $$
CREATE PROCEDURE pkg_subscription_update_spot(
  IN p_subscription_spot_id BIGINT,
  IN p_status VARCHAR(32),
  IN p_assigned_mode VARCHAR(32),
  IN p_is_primary TINYINT,
  IN p_assigned_from DATE,
  IN p_assigned_until DATE,
  IN p_note VARCHAR(255)
)
BEGIN
  DECLARE v_subscription_id BIGINT;
  DECLARE v_site_id BIGINT;
  DECLARE v_spot_id BIGINT;
  DECLARE v_sub_start DATE;
  DECLARE v_sub_end DATE;
  DECLARE v_effective_from DATE;
  DECLARE v_effective_until DATE;
  DECLARE v_next_status VARCHAR(32);

  SELECT
    ss.subscription_id,
    ss.site_id,
    ss.spot_id,
    s.start_date,
    s.end_date,
    COALESCE(p_assigned_from, ss.assigned_from, s.start_date),
    COALESCE(p_assigned_until, ss.assigned_until, s.end_date),
    COALESCE(p_status, ss.status)
  INTO
    v_subscription_id,
    v_site_id,
    v_spot_id,
    v_sub_start,
    v_sub_end,
    v_effective_from,
    v_effective_until,
    v_next_status
  FROM subscription_spots ss
  JOIN subscriptions s
    ON s.subscription_id = ss.subscription_id
  WHERE ss.subscription_spot_id = p_subscription_spot_id
  LIMIT 1;

  IF v_subscription_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'subscription spot not found';
  END IF;

  IF v_effective_from IS NULL THEN
    SET v_effective_from = v_sub_start;
  END IF;

  IF v_effective_until IS NULL THEN
    SET v_effective_until = v_sub_end;
  END IF;

  IF v_effective_until < v_effective_from THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'assigned_until must be >= assigned_from';
  END IF;

  IF v_next_status = 'ACTIVE' AND EXISTS (
    SELECT 1
    FROM subscription_spots ss
    JOIN subscriptions s
      ON s.subscription_id = ss.subscription_id
    WHERE ss.site_id = v_site_id
      AND ss.spot_id = v_spot_id
      AND ss.status = 'ACTIVE'
      AND s.status IN ('ACTIVE', 'SUSPENDED')
      AND ss.subscription_spot_id <> p_subscription_spot_id
      AND NOT (
        v_effective_until < COALESCE(ss.assigned_from, s.start_date)
        OR v_effective_from > COALESCE(ss.assigned_until, s.end_date)
      )
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'spot already assigned in overlapping window';
  END IF;

  IF COALESCE(p_is_primary, 0) = 1 THEN
    UPDATE subscription_spots
    SET is_primary = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE subscription_id = v_subscription_id
      AND subscription_spot_id <> p_subscription_spot_id
      AND status = 'ACTIVE';
  END IF;

  UPDATE subscription_spots
  SET status = COALESCE(p_status, status),
      assigned_mode = COALESCE(p_assigned_mode, assigned_mode),
      is_primary = COALESCE(p_is_primary, is_primary),
      assigned_from = COALESCE(p_assigned_from, assigned_from),
      assigned_until = COALESCE(p_assigned_until, assigned_until),
      note = COALESCE(p_note, note),
      updated_at = CURRENT_TIMESTAMP
  WHERE subscription_spot_id = p_subscription_spot_id;
END $$

DROP PROCEDURE IF EXISTS pkg_subscription_bind_vehicle $$
CREATE PROCEDURE pkg_subscription_bind_vehicle(
  IN p_subscription_id BIGINT,
  IN p_site_id BIGINT,
  IN p_vehicle_id BIGINT,
  IN p_status VARCHAR(32),
  IN p_is_primary TINYINT,
  IN p_valid_from DATE,
  IN p_valid_to DATE,
  IN p_note VARCHAR(255)
)
BEGIN
  DECLARE v_start_date DATE;
  DECLARE v_end_date DATE;
  DECLARE v_license_plate VARCHAR(20);

  SELECT start_date, end_date
  INTO v_start_date, v_end_date
  FROM subscriptions
  WHERE subscription_id = p_subscription_id
    AND site_id = p_site_id
  LIMIT 1;

  IF v_start_date IS NULL OR v_end_date IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'subscription/site mismatch';
  END IF;

  SELECT license_plate
  INTO v_license_plate
  FROM vehicles
  WHERE vehicle_id = p_vehicle_id
  LIMIT 1;

  IF v_license_plate IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'vehicle not found';
  END IF;

  IF COALESCE(p_valid_to, v_end_date) < COALESCE(p_valid_from, v_start_date) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'valid_to must be >= valid_from';
  END IF;

  IF COALESCE(p_is_primary, 0) = 1 THEN
    UPDATE subscription_vehicles
    SET is_primary = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE subscription_id = p_subscription_id
      AND status = 'ACTIVE';
  END IF;

  INSERT INTO subscription_vehicles (
    subscription_id,
    site_id,
    vehicle_id,
    plate_compact,
    status,
    is_primary,
    valid_from,
    valid_to,
    note
  ) VALUES (
    p_subscription_id,
    p_site_id,
    p_vehicle_id,
    UPPER(REGEXP_REPLACE(COALESCE(v_license_plate, ''), '[^A-Za-z0-9]', '')),
    COALESCE(p_status, 'ACTIVE'),
    COALESCE(p_is_primary, 0),
    p_valid_from,
    p_valid_to,
    p_note
  );
END $$

DROP PROCEDURE IF EXISTS pkg_subscription_update_vehicle $$
CREATE PROCEDURE pkg_subscription_update_vehicle(
  IN p_subscription_vehicle_id BIGINT,
  IN p_status VARCHAR(32),
  IN p_is_primary TINYINT,
  IN p_valid_from DATE,
  IN p_valid_to DATE,
  IN p_note VARCHAR(255)
)
BEGIN
  DECLARE v_subscription_id BIGINT;
  DECLARE v_sub_start DATE;
  DECLARE v_sub_end DATE;
  DECLARE v_effective_from DATE;
  DECLARE v_effective_until DATE;

  SELECT
    sv.subscription_id,
    s.start_date,
    s.end_date,
    COALESCE(p_valid_from, sv.valid_from, s.start_date),
    COALESCE(p_valid_to, sv.valid_to, s.end_date)
  INTO
    v_subscription_id,
    v_sub_start,
    v_sub_end,
    v_effective_from,
    v_effective_until
  FROM subscription_vehicles sv
  JOIN subscriptions s
    ON s.subscription_id = sv.subscription_id
  WHERE sv.subscription_vehicle_id = p_subscription_vehicle_id
  LIMIT 1;

  IF v_subscription_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'subscription vehicle not found';
  END IF;

  IF v_effective_from IS NULL THEN
    SET v_effective_from = v_sub_start;
  END IF;

  IF v_effective_until IS NULL THEN
    SET v_effective_until = v_sub_end;
  END IF;

  IF v_effective_until < v_effective_from THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'valid_to must be >= valid_from';
  END IF;

  IF COALESCE(p_is_primary, 0) = 1 THEN
    UPDATE subscription_vehicles
    SET is_primary = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE subscription_id = v_subscription_id
      AND subscription_vehicle_id <> p_subscription_vehicle_id
      AND status = 'ACTIVE';
  END IF;

  UPDATE subscription_vehicles
  SET status = COALESCE(p_status, status),
      is_primary = COALESCE(p_is_primary, is_primary),
      valid_from = COALESCE(p_valid_from, valid_from),
      valid_to = COALESCE(p_valid_to, valid_to),
      note = COALESCE(p_note, note),
      updated_at = CURRENT_TIMESTAMP
  WHERE subscription_vehicle_id = p_subscription_vehicle_id;
END $$

DROP PROCEDURE IF EXISTS pkg_gate_close_stale_sessions $$
CREATE PROCEDURE pkg_gate_close_stale_sessions(
  IN p_stale_minutes INT
)
BEGIN
  UPDATE gate_passage_sessions
  SET status = 'TIMEOUT',
      resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP),
      closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
  WHERE status IN ('OPEN', 'WAITING_READ', 'WAITING_DECISION', 'APPROVED', 'WAITING_PAYMENT')
    AND opened_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL GREATEST(COALESCE(p_stale_minutes, 5), 1) MINUTE);
END $$

DROP PROCEDURE IF EXISTS pkg_gate_force_lane_recovery $$
CREATE PROCEDURE pkg_gate_force_lane_recovery(
  IN p_lane_id BIGINT
)
BEGIN
  UPDATE gate_barrier_commands
  SET status = 'CANCELLED',
      updated_at = CURRENT_TIMESTAMP
  WHERE lane_id = p_lane_id
    AND status IN ('PENDING', 'SENT');

  UPDATE gate_lanes
  SET status = 'ACTIVE',
      updated_at = CURRENT_TIMESTAMP
  WHERE lane_id = p_lane_id;

  UPDATE gate_passage_sessions
  SET review_required = 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE lane_id = p_lane_id
    AND status IN ('OPEN', 'WAITING_READ', 'WAITING_DECISION', 'APPROVED', 'WAITING_PAYMENT');
END $$

DROP PROCEDURE IF EXISTS pkg_gate_create_manual_review $$
CREATE PROCEDURE pkg_gate_create_manual_review(
  IN p_session_id BIGINT,
  IN p_site_id BIGINT,
  IN p_lane_id BIGINT,
  IN p_queue_reason_code VARCHAR(64),
  IN p_note TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM gate_manual_reviews
    WHERE session_id = p_session_id
      AND status IN ('OPEN', 'CLAIMED')
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'manual review already open for session';
  END IF;

  INSERT INTO gate_manual_reviews (
    session_id,
    site_id,
    lane_id,
    status,
    queue_reason_code,
    note,
    snapshot_json
  ) VALUES (
    p_session_id,
    p_site_id,
    p_lane_id,
    'OPEN',
    p_queue_reason_code,
    p_note,
    JSON_OBJECT(
      'source', 'pkg_gate_create_manual_review',
      'queue_reason_code', p_queue_reason_code,
      'note', p_note
    )
  );
END $$

DROP PROCEDURE IF EXISTS pkg_incident_resolve $$
CREATE PROCEDURE pkg_incident_resolve(
  IN p_incident_id BIGINT,
  IN p_action VARCHAR(64),
  IN p_status VARCHAR(32),
  IN p_actor_role VARCHAR(32),
  IN p_actor_user_id BIGINT,
  IN p_note TEXT,
  IN p_evidence_media_id BIGINT
)
BEGIN
  DECLARE v_previous_status VARCHAR(32);
  DECLARE v_snapshot JSON;

  SELECT status, snapshot_json
  INTO v_previous_status, v_snapshot
  FROM gate_incidents
  WHERE incident_id = p_incident_id
  LIMIT 1;

  IF v_previous_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'incident not found';
  END IF;

  UPDATE gate_incidents
  SET status = COALESCE(p_status, status),
      resolution_action = COALESCE(p_action, resolution_action),
      resolved_by_user_id = p_actor_user_id,
      resolved_by_role = p_actor_role,
      evidence_media_id = p_evidence_media_id,
      resolved_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE incident_id = p_incident_id;

  INSERT INTO gate_incident_history (
    incident_id,
    action_code,
    previous_status,
    next_status,
    actor_role,
    actor_user_id,
    note,
    evidence_media_id,
    snapshot_before_json,
    snapshot_after_json
  )
  SELECT
    p_incident_id,
    COALESCE(p_action, 'RESOLVED'),
    v_previous_status,
    gi.status,
    p_actor_role,
    p_actor_user_id,
    p_note,
    p_evidence_media_id,
    v_snapshot,
    gi.snapshot_json
  FROM gate_incidents gi
  WHERE gi.incident_id = p_incident_id;
END $$

DROP PROCEDURE IF EXISTS pkg_payment_mark_ticket_paid $$
CREATE PROCEDURE pkg_payment_mark_ticket_paid(
  IN p_site_id BIGINT,
  IN p_ticket_id BIGINT,
  IN p_amount DECIMAL(12, 2),
  IN p_method VARCHAR(32),
  IN p_paid_at DATETIME
)
BEGIN
  INSERT INTO payments (
    site_id,
    ticket_id,
    amount,
    method,
    status,
    paid_at,
    paid_date
  ) VALUES (
    p_site_id,
    p_ticket_id,
    p_amount,
    p_method,
    'PAID',
    COALESCE(p_paid_at, CURRENT_TIMESTAMP),
    DATE(COALESCE(p_paid_at, CURRENT_TIMESTAMP))
  );
END $$

DROP PROCEDURE IF EXISTS pkg_pricing_quote_ticket $$
CREATE PROCEDURE pkg_pricing_quote_ticket(
  IN p_site_id BIGINT,
  IN p_vehicle_type VARCHAR(32),
  IN p_entry_time DATETIME,
  IN p_exit_time DATETIME
)
BEGIN
  DECLARE v_minutes INT DEFAULT 0;
  DECLARE v_tariff_id BIGINT DEFAULT NULL;
  DECLARE v_free_minutes INT DEFAULT 0;
  DECLARE v_per_hour DECIMAL(12, 2) DEFAULT 0;
  DECLARE v_daily_cap DECIMAL(12, 2) DEFAULT NULL;
  DECLARE v_billable_minutes INT DEFAULT 0;
  DECLARE v_hours INT DEFAULT 0;
  DECLARE v_subtotal DECIMAL(12, 2) DEFAULT 0;
  DECLARE v_total DECIMAL(12, 2) DEFAULT 0;

  SET v_minutes = GREATEST(TIMESTAMPDIFF(MINUTE, p_entry_time, p_exit_time), 0);

  SELECT t.tariff_id
  INTO v_tariff_id
  FROM tariffs t
  WHERE t.site_id = p_site_id
    AND t.applies_to = 'TICKET'
    AND t.vehicle_type = p_vehicle_type
    AND t.is_active = 1
    AND t.valid_from <= p_entry_time
    AND (t.valid_until IS NULL OR t.valid_until >= DATE(p_entry_time))
  ORDER BY t.valid_from DESC, t.tariff_id DESC
  LIMIT 1;

  IF v_tariff_id IS NULL THEN
    SELECT
      NULL AS tariff_id,
      v_minutes AS minutes,
      0 AS free_minutes,
      0 AS per_hour,
      NULL AS daily_cap,
      0 AS subtotal,
      0 AS total;
  ELSE
    SELECT
      COALESCE(MAX(CASE WHEN tr.rule_type = 'FREE_MINUTES' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(tr.param_json, '$.minutes')) AS UNSIGNED) END), 0),
      COALESCE(MAX(CASE WHEN tr.rule_type = 'HOURLY' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(tr.param_json, '$.perHour')) AS DECIMAL(12, 2)) END), 0),
      MAX(CASE WHEN tr.rule_type = 'DAILY_CAP' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(tr.param_json, '$.capAmount')) AS DECIMAL(12, 2)) END)
    INTO
      v_free_minutes,
      v_per_hour,
      v_daily_cap
    FROM tariff_rules tr
    WHERE tr.tariff_id = v_tariff_id
      AND COALESCE(tr.is_active, 1) = 1
      AND (tr.effective_date IS NULL OR tr.effective_date <= DATE(p_entry_time))
      AND (tr.expiration_date IS NULL OR tr.expiration_date >= DATE(p_entry_time));

    SET v_billable_minutes = GREATEST(v_minutes - v_free_minutes, 0);
    SET v_hours = CASE
      WHEN v_billable_minutes <= 0 THEN 0
      ELSE CEIL(v_billable_minutes / 60)
    END;
    SET v_subtotal = v_hours * v_per_hour;
    SET v_total = CASE
      WHEN v_daily_cap IS NULL THEN v_subtotal
      ELSE LEAST(v_subtotal, v_daily_cap)
    END;

    SELECT
      v_tariff_id AS tariff_id,
      v_minutes AS minutes,
      v_free_minutes AS free_minutes,
      v_per_hour AS per_hour,
      v_daily_cap AS daily_cap,
      v_subtotal AS subtotal,
      v_total AS total;
  END IF;
END $$

DELIMITER ;

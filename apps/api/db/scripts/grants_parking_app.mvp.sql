-- IMPORTANT: This file must be runnable by parking_root.
-- Therefore it MUST contain only schema-level GRANT statements.
-- User/account creation belongs to db/scripts/bootstrap.sql and must be run once by MySQL root/system admin.

-- grants_parking_app.mvp.sql (PARKING_ROOT-SAFE)
-- Profile: MVP (full demo nghiệp vụ + API)
-- NOTE: File này chỉ chứa GRANT (không REVOKE account-level).
-- RC1 consolidated runtime surface: auth / dashboard / presence / incidents / audit.
-- Baseline này là grant source-of-truth cho backend-rc1 và smoke bundle release.

-- ============================================================
-- Baseline
-- ============================================================
GRANT SHOW VIEW ON parking_mgmt.* TO 'parking_app'@'localhost';
GRANT SHOW VIEW ON parking_mgmt.* TO 'parking_app'@'127.0.0.1';
GRANT SHOW VIEW ON parking_mgmt.* TO 'parking_app'@'::1';

-- ============================================================
-- LOG-ONLY
-- ============================================================
GRANT SELECT ON parking_mgmt.parking_sites TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.parking_sites TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.parking_sites TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.zones        TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.zones        TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.zones        TO 'parking_app'@'::1';

GRANT SELECT, INSERT ON parking_mgmt.gate_events TO 'parking_app'@'localhost';
GRANT SELECT, INSERT ON parking_mgmt.gate_events TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT ON parking_mgmt.gate_events TO 'parking_app'@'::1';
GRANT SELECT, INSERT ON parking_mgmt.audit_logs  TO 'parking_app'@'localhost';
GRANT SELECT, INSERT ON parking_mgmt.audit_logs  TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT ON parking_mgmt.audit_logs  TO 'parking_app'@'::1';

GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_event_outbox TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_event_outbox TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_event_outbox TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.gate_devices TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.gate_devices TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.gate_devices TO 'parking_app'@'::1';

-- Idempotency runtime
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.api_idempotency TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.api_idempotency TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.api_idempotency TO 'parking_app'@'::1';

-- ============================================================
-- DEV-LOG (seed_min)
-- ============================================================
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.parking_sites TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.parking_sites TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.parking_sites TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_devices  TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_devices  TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_devices  TO 'parking_app'@'::1';

-- Gate v4 foundation / runtime
GRANT SELECT ON parking_mgmt.gate_lanes             TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.gate_lanes             TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.gate_lanes             TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.gate_lane_devices      TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.gate_lane_devices      TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.gate_lane_devices      TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_passage_sessions TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_passage_sessions TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_passage_sessions TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_read_events      TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_read_events      TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_read_events      TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_read_media       TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_read_media       TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_read_media       TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_decisions        TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_decisions        TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_decisions        TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_barrier_commands TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_barrier_commands TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_barrier_commands TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_manual_reviews   TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_manual_reviews   TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_manual_reviews   TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.device_heartbeats     TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.device_heartbeats     TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.device_heartbeats     TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_incidents        TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_incidents        TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_incidents        TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.gate_incident_history TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.gate_incident_history TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.gate_incident_history TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.v_gate_lane_device_map TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.v_gate_lane_device_map TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.v_gate_lane_device_map TO 'parking_app'@'::1';

-- Projection / reconciliation / dashboard read-models
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.spot_occupancy_projection TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.spot_occupancy_projection TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.spot_occupancy_projection TO 'parking_app'@'::1';
GRANT SELECT, INSERT, DELETE ON parking_mgmt.internal_presence_events TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON parking_mgmt.internal_presence_events TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, DELETE ON parking_mgmt.internal_presence_events TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.subscription_vehicles TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.subscription_vehicles TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.subscription_vehicles TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.subscription_spots TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.subscription_spots TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.subscription_spots TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_active_presence TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_active_presence TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_active_presence TO 'parking_app'@'::1';

-- ============================================================
-- MVP (full demo)
-- ============================================================
GRANT EXECUTE ON PROCEDURE parking_mgmt.sp_close_shift TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.sp_close_shift TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.sp_close_shift TO 'parking_app'@'::1';

GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.spots         TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.spots         TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.spots         TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.customers     TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.customers     TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.customers     TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.vehicles      TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.vehicles      TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.vehicles      TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.subscriptions TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.subscriptions TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.subscriptions TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.credentials   TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.credentials   TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.credentials   TO 'parking_app'@'::1';

GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tickets       TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tickets       TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tickets       TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE         ON parking_mgmt.payments      TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE         ON parking_mgmt.payments      TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE         ON parking_mgmt.payments      TO 'parking_app'@'::1';

GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tariffs       TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tariffs       TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tariffs       TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tariff_rules  TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tariff_rules  TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tariff_rules  TO 'parking_app'@'::1';

GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.users         TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.users         TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.users         TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.roles         TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.roles         TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.roles         TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.user_roles    TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.user_roles    TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.user_roles    TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.user_site_scopes TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.user_site_scopes TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.user_site_scopes TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.auth_user_sessions TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.auth_user_sessions TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.auth_user_sessions TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.auth_login_attempts TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.auth_login_attempts TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.auth_login_attempts TO 'parking_app'@'::1';

GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.shift_closures TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.shift_closures TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.shift_closures TO 'parking_app'@'::1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.shift_closure_breakdowns TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.shift_closure_breakdowns TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.shift_closure_breakdowns TO 'parking_app'@'::1';

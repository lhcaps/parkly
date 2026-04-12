-- IMPORTANT: This file must be runnable by parking_root.
-- Therefore it MUST contain only schema-level GRANT statements.
-- User/account creation belongs to db/scripts/bootstrap.sql and must be run once by MySQL root/system admin.

-- grants_parking_app.sql (PARKING_ROOT-SAFE)
-- Mục tiêu: cấp quyền cho parking_app theo profile, KHÔNG dùng account-level REVOKE.
-- Chạy file này bằng parking_root (schema admin) sau khi đã migrate schema.
-- Nếu muốn "reset sạch" trước khi đổi profile (downgrade quyền), chạy thêm:
--   db/scripts/reset_parking_app.sql (ROOT-ONLY)

-- Profiles:
--  A) LOG-ONLY  : app chỉ ghi log + outbox (tối thiểu)
--  B) DEV-LOG   : để chạy pnpm e2e (seed_min/test/outbox) bằng parking_app  ✅ (BẬT MẶC ĐỊNH)
--  C) MVP       : full demo nghiệp vụ (tariff/close shift/...) (comment)

-- ============================================================
-- Baseline: cho phép connect với default schema (tránh lỗi 1044)
-- ============================================================
GRANT SHOW VIEW ON parking_mgmt.* TO 'parking_app'@'localhost';
GRANT SHOW VIEW ON parking_mgmt.* TO 'parking_app'@'127.0.0.1';
GRANT SHOW VIEW ON parking_mgmt.* TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.flyway_schema_history TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.flyway_schema_history TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.flyway_schema_history TO 'parking_app'@'::1';
-- (dev) nếu bạn connect bằng 127.0.0.1 thì bật thêm:

-- ============================================================
-- A) LOG-ONLY (tối thiểu)
-- ============================================================
-- Core minimal (chỉ đọc)
GRANT SELECT ON parking_mgmt.parking_sites TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.parking_sites TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.parking_sites TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.zones        TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.zones        TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.zones        TO 'parking_app'@'::1';

-- Log tables (append-only)
GRANT SELECT, INSERT ON parking_mgmt.gate_events TO 'parking_app'@'localhost';
GRANT SELECT, INSERT ON parking_mgmt.gate_events TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT ON parking_mgmt.gate_events TO 'parking_app'@'::1';
GRANT SELECT, INSERT ON parking_mgmt.audit_logs  TO 'parking_app'@'localhost';
GRANT SELECT, INSERT ON parking_mgmt.audit_logs  TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT ON parking_mgmt.audit_logs  TO 'parking_app'@'::1';

-- Outbox cần UPDATE để mark SENT/FAILED
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_event_outbox TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_event_outbox TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_event_outbox TO 'parking_app'@'::1';

-- Helper read (resolve deviceId theo code)
GRANT SELECT ON parking_mgmt.gate_devices TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.gate_devices TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.gate_devices TO 'parking_app'@'::1';

-- ============================================================
-- B) DEV-LOG (BẬT) - để pnpm e2e chạy seed_min bằng parking_app
-- seed_min.sql có:
--  - INSERT parking_sites ... ON DUPLICATE KEY UPDATE  => cần INSERT+UPDATE
--  - INSERT gate_devices ... SELECT @site_id ...       => (mariadb/mysql) thường cần SELECT trên gate_devices
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
GRANT SELECT ON parking_mgmt.v_gate_lane_device_map TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.v_gate_lane_device_map TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.v_gate_lane_device_map TO 'parking_app'@'::1';

-- ============================================================
-- C) MVP (comment) - bật khi chạy full demo nghiệp vụ
-- ============================================================
-- GRANT EXECUTE ON PROCEDURE parking_mgmt.sp_close_shift TO 'parking_app'@'localhost';
-- GRANT EXECUTE ON PROCEDURE parking_mgmt.sp_close_shift TO 'parking_app'@'127.0.0.1';
-- GRANT EXECUTE ON PROCEDURE parking_mgmt.sp_close_shift TO 'parking_app'@'::1';
--
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.spots         TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.spots         TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.spots         TO 'parking_app'@'::1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.customers     TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.customers     TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.customers     TO 'parking_app'@'::1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.vehicles      TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.vehicles      TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.vehicles      TO 'parking_app'@'::1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.subscriptions TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.subscriptions TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.subscriptions TO 'parking_app'@'::1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.credentials   TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.credentials   TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.credentials   TO 'parking_app'@'::1';
--
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tickets       TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tickets       TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tickets       TO 'parking_app'@'::1';
-- GRANT SELECT, INSERT, UPDATE         ON parking_mgmt.payments      TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE         ON parking_mgmt.payments      TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE         ON parking_mgmt.payments      TO 'parking_app'@'::1';
--
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tariffs       TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tariffs       TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tariffs       TO 'parking_app'@'::1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tariff_rules  TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tariff_rules  TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.tariff_rules  TO 'parking_app'@'::1';
--
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.users         TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.users         TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.users         TO 'parking_app'@'::1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.roles         TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.roles         TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.roles         TO 'parking_app'@'::1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.user_roles    TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.user_roles    TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.user_roles    TO 'parking_app'@'::1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.user_site_scopes TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.user_site_scopes TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.user_site_scopes TO 'parking_app'@'::1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.auth_user_sessions TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.auth_user_sessions TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.auth_user_sessions TO 'parking_app'@'::1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.auth_login_attempts TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.auth_login_attempts TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.auth_login_attempts TO 'parking_app'@'::1';
--
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.shift_closures TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.shift_closures TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.shift_closures TO 'parking_app'@'::1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.shift_closure_breakdowns TO 'parking_app'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.shift_closure_breakdowns TO 'parking_app'@'127.0.0.1';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.shift_closure_breakdowns TO 'parking_app'@'::1';

-- Grant cho DLQ table (V26)
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.gate_event_outbox_dlq TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.gate_event_outbox_dlq TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.gate_event_outbox_dlq TO 'parking_app'@'::1';

-- Grant cho spot_occupancy_projection (V26): reconciliation worker cần INSERT/UPDATE
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.spot_occupancy_projection TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.spot_occupancy_projection TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.spot_occupancy_projection TO 'parking_app'@'::1';

-- Grant cho gate_incident_history (V21)
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.gate_incident_history TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.gate_incident_history TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.gate_incident_history TO 'parking_app'@'::1';

-- Grant cho internal_presence_events (V19): reconciliation worker cần SELECT/INSERT/DELETE
GRANT SELECT, INSERT, DELETE ON parking_mgmt.internal_presence_events TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON parking_mgmt.internal_presence_events TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, DELETE ON parking_mgmt.internal_presence_events TO 'parking_app'@'::1';

-- Grant cho gate_active_presence (V15)
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_active_presence TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_active_presence TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON parking_mgmt.gate_active_presence TO 'parking_app'@'::1';

-- Grant cho v_partition_health view (V27)
GRANT SELECT ON parking_mgmt.v_partition_health TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.v_partition_health TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.v_partition_health TO 'parking_app'@'::1';

-- Grant cho subscription read-models (DEV-LOG profile để chạy seed + e2e)
GRANT SELECT ON parking_mgmt.subscription_vehicles TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.subscription_vehicles TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.subscription_vehicles TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.subscription_spots TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.subscription_spots TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.subscription_spots TO 'parking_app'@'::1';

-- NOTE: KHÔNG cần FLUSH PRIVILEGES sau GRANT trong MySQL.

-- V34: module views / procedures used by dashboard, auth, subscriptions, incidents, pricing
GRANT SELECT ON parking_mgmt.pkg_dashboard_incident_summary_v TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.pkg_dashboard_incident_summary_v TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.pkg_dashboard_incident_summary_v TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.pkg_dashboard_occupancy_summary_v TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.pkg_dashboard_occupancy_summary_v TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.pkg_dashboard_occupancy_summary_v TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.pkg_dashboard_topology_summary_v TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.pkg_dashboard_topology_summary_v TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.pkg_dashboard_topology_summary_v TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.pkg_gate_lane_health_v TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.pkg_gate_lane_health_v TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.pkg_gate_lane_health_v TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.pkg_gate_active_queue_v TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.pkg_gate_active_queue_v TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.pkg_gate_active_queue_v TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.pkg_gate_incident_feed_v TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.pkg_gate_incident_feed_v TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.pkg_gate_incident_feed_v TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.pkg_subscription_effective_status_v TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.pkg_subscription_effective_status_v TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.pkg_subscription_effective_status_v TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.pkg_subscription_spot_assignments_v TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.pkg_subscription_spot_assignments_v TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.pkg_subscription_spot_assignments_v TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.pkg_subscription_vehicle_active_v TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.pkg_subscription_vehicle_active_v TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.pkg_subscription_vehicle_active_v TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.pkg_auth_active_sessions_v TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.pkg_auth_active_sessions_v TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.pkg_auth_active_sessions_v TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.pkg_auth_login_risk_v TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.pkg_auth_login_risk_v TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.pkg_auth_login_risk_v TO 'parking_app'@'::1';
GRANT SELECT ON parking_mgmt.pkg_pricing_effective_rules_v TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.pkg_pricing_effective_rules_v TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.pkg_pricing_effective_rules_v TO 'parking_app'@'::1';

GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_auth_revoke_user_sessions TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_auth_revoke_user_sessions TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_auth_revoke_user_sessions TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_auth_cleanup_sessions TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_auth_cleanup_sessions TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_auth_cleanup_sessions TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_auth_set_user_status TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_auth_set_user_status TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_auth_set_user_status TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_create TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_create TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_create TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_update TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_update TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_update TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_assign_spot TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_assign_spot TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_assign_spot TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_update_spot TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_update_spot TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_update_spot TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_bind_vehicle TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_bind_vehicle TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_bind_vehicle TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_update_vehicle TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_update_vehicle TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_subscription_update_vehicle TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_gate_close_stale_sessions TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_gate_close_stale_sessions TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_gate_close_stale_sessions TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_gate_force_lane_recovery TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_gate_force_lane_recovery TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_gate_force_lane_recovery TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_gate_create_manual_review TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_gate_create_manual_review TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_gate_create_manual_review TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_incident_resolve TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_incident_resolve TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_incident_resolve TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_payment_mark_ticket_paid TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_payment_mark_ticket_paid TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_payment_mark_ticket_paid TO 'parking_app'@'::1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_pricing_quote_ticket TO 'parking_app'@'localhost';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_pricing_quote_ticket TO 'parking_app'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE parking_mgmt.pkg_pricing_quote_ticket TO 'parking_app'@'::1';

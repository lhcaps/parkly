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
GRANT SELECT ON parking_mgmt.flyway_schema_history TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.flyway_schema_history TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.flyway_schema_history TO 'parking_app'@'::1';

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
-- V26: gate_event_outbox_dlq (dead letter queue)
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.gate_event_outbox_dlq TO 'parking_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.gate_event_outbox_dlq TO 'parking_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON parking_mgmt.gate_event_outbox_dlq TO 'parking_app'@'::1';

-- V27: v_partition_health view
GRANT SELECT ON parking_mgmt.v_partition_health TO 'parking_app'@'localhost';
GRANT SELECT ON parking_mgmt.v_partition_health TO 'parking_app'@'127.0.0.1';
GRANT SELECT ON parking_mgmt.v_partition_health TO 'parking_app'@'::1';

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

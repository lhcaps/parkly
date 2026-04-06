-- ============================================================
-- PARKLY - Database Reset Script
-- Xóa toàn bộ dữ liệu, giữ nguyên cấu trúc bảng
-- ============================================================
-- Chạy với quyền admin: DATABASE_URL_ADMIN
-- ============================================================

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- Domain 12: Events & Audit (xóa trước - không có FK từ bảng khác)
-- ============================================================
TRUNCATE TABLE api_idempotency;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE gate_event_outbox;
TRUNCATE TABLE gate_event_outbox_dlq;
TRUNCATE TABLE gate_events;

-- ============================================================
-- Domain 8: Real-time Tracking
-- ============================================================
TRUNCATE TABLE gate_read_events;
TRUNCATE TABLE gate_read_media;
TRUNCATE TABLE spot_occupancy_projection;
TRUNCATE TABLE gate_active_presence;

-- ============================================================
-- Domain 9: Decision & Control
-- ============================================================
TRUNCATE TABLE gate_decisions;
TRUNCATE TABLE gate_barrier_commands;
TRUNCATE TABLE gate_manual_reviews;

-- ============================================================
-- Domain 10: Incidents
-- ============================================================
TRUNCATE TABLE gate_incident_history;
TRUNCATE TABLE gate_incidents;

-- ============================================================
-- Domain 11: Pricing
-- ============================================================
TRUNCATE TABLE tariff_rules;
TRUNCATE TABLE tariffs;

-- ============================================================
-- Domain 7: Operations - Tickets & Payments
-- ============================================================
TRUNCATE TABLE shift_closure_breakdowns;
TRUNCATE TABLE shift_closures;
TRUNCATE TABLE payments;
TRUNCATE TABLE tickets;

-- ============================================================
-- Domain 6: Vehicle Management
-- ============================================================
TRUNCATE TABLE vehicles;

-- ============================================================
-- Domain 5: Subscriptions & Plans
-- ============================================================
TRUNCATE TABLE subscription_vehicles;
TRUNCATE TABLE subscription_spots;
TRUNCATE TABLE credentials;
TRUNCATE TABLE subscriptions;

-- ============================================================
-- Domain 4: Access Credentials
-- ============================================================
TRUNCATE TABLE customers;

-- ============================================================
-- Domain 3: Gate & Device Management
-- ============================================================
TRUNCATE TABLE device_heartbeats;
TRUNCATE TABLE gate_lane_devices;
TRUNCATE TABLE gate_passage_sessions;
TRUNCATE TABLE gate_lanes;
TRUNCATE TABLE gate_devices;

-- ============================================================
-- Domain 2: Parking Structure
-- ============================================================
TRUNCATE TABLE spots;
TRUNCATE TABLE zones;

-- ============================================================
-- Domain 1: Organization & Access Control (xóa cuối - có FK từ bảng khác)
-- ============================================================
TRUNCATE TABLE user_site_scopes;
TRUNCATE TABLE user_roles;
TRUNCATE TABLE auth_user_sessions;
TRUNCATE TABLE auth_login_attempts;
TRUNCATE TABLE users;
TRUNCATE TABLE roles;
TRUNCATE TABLE parking_sites;

-- ============================================================
-- Re-enable foreign key checks
-- ============================================================
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Reset Auto Increment về 1 cho các bảng chính
-- ============================================================
ALTER TABLE parking_sites AUTO_INCREMENT = 1;
ALTER TABLE zones AUTO_INCREMENT = 1;
ALTER TABLE spots AUTO_INCREMENT = 1;
ALTER TABLE gate_devices AUTO_INCREMENT = 1;
ALTER TABLE gate_lanes AUTO_INCREMENT = 1;
ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE roles AUTO_INCREMENT = 1;
ALTER TABLE customers AUTO_INCREMENT = 1;
ALTER TABLE vehicles AUTO_INCREMENT = 1;
ALTER TABLE subscriptions AUTO_INCREMENT = 1;
ALTER TABLE credentials AUTO_INCREMENT = 1;
ALTER TABLE tariffs AUTO_INCREMENT = 1;
ALTER TABLE tariff_rules AUTO_INCREMENT = 1;
ALTER TABLE tickets AUTO_INCREMENT = 1;
ALTER TABLE payments AUTO_INCREMENT = 1;

-- ============================================================
-- Xác nhận đã reset thành công
-- ============================================================
SELECT 'DATABASE RESET COMPLETED' AS status;

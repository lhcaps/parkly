-- ============================================================
-- PARKLY - Comprehensive Seed Data Script
-- Tạo dữ liệu mẫu đa dạng cho:
-- - Multiple Sites (5 sites across Vietnam)
-- - Multiple Gates (multiple gates per site)
-- - Multiple Zones (VIP, Regular, Motorbike, Reserved)
-- - Multiple Subscriptions (Monthly, VIP, Corporate)
-- - Multiple Users (Admin, Manager, Cashier, Guard roles)
-- - Multiple Tariffs (Hourly, Daily, Monthly, VIP)
-- - Demo Vehicles and Customers
-- ============================================================
-- Run with admin credentials: DATABASE_URL_ADMIN
-- Safe to run repeatedly (uses ON DUPLICATE KEY UPDATE)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- PHASE 1: ROLES (Foundation)
-- ============================================================
INSERT INTO roles(role_code, name) VALUES
  ('SUPER_ADMIN', 'Super Administrator'),
  ('SITE_ADMIN', 'Site Administrator'),
  ('MANAGER', 'Site Manager'),
  ('CASHIER', 'Cashier'),
  ('GUARD', 'Security Guard'),
  ('OPERATOR', 'Operations Operator'),
  ('VIEWER', 'Read-only Viewer')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================================
-- PHASE 2: USERS (System Users)
-- ============================================================
INSERT INTO users(username, password_hash, status) VALUES
  ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.8uQxVr.7hM8GKy', 'ACTIVE'),
  ('manager_hcm', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.8uQxVr.7hM8GKy', 'ACTIVE'),
  ('manager_dn', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.8uQxVr.7hM8GKy', 'ACTIVE'),
  ('manager_hn', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.8uQxVr.7hM8GKy', 'ACTIVE'),
  ('cashier_hcm_01', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.8uQxVr.7hM8GKy', 'ACTIVE'),
  ('cashier_hcm_02', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.8uQxVr.7hM8GKy', 'ACTIVE'),
  ('cashier_dn_01', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.8uQxVr.7hM8GKy', 'ACTIVE'),
  ('guard_hcm_01_1', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.8uQxVr.7hM8GKy', 'ACTIVE'),
  ('guard_hcm_01_2', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.8uQxVr.7hM8GKy', 'ACTIVE'),
  ('guard_dn_01_1', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.8uQxVr.7hM8GKy', 'ACTIVE')
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), status = VALUES(status);

-- User-Role mappings
INSERT INTO user_roles(user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u
CROSS JOIN roles r
WHERE (u.username = 'admin' AND r.role_code = 'SUPER_ADMIN')
   OR (u.username LIKE 'manager_%' AND r.role_code = 'MANAGER')
   OR (u.username LIKE 'cashier_%' AND r.role_code = 'CASHIER')
   OR (u.username LIKE 'guard_%' AND r.role_code = 'GUARD')
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

-- ============================================================
-- PHASE 3: PARKING SITES (5 Sites across Vietnam)
-- ============================================================
INSERT INTO parking_sites(site_code, name, timezone, is_active) VALUES
  ('PARK_HCM_CENTRAL', 'Parkly TP.HCM - Trung Tâm', 'Asia/Ho_Chi_Minh', 1),
  ('PARK_HCM_DISCOVERY', 'Parkly TP.HCM - Discovery', 'Asia/Ho_Chi_Minh', 1),
  ('PARK_DN_CENTRAL', 'Parkly Đà Nẵng - Trung Tâm', 'Asia/Ho_Chi_Minh', 1),
  ('PARK_HA_CENTRAL', 'Parkly Hà Nội - Trung Tâm', 'Asia/Ho_Chi_Minh', 1),
  ('PARK_CT_CENTRAL', 'Parkly Cần Thơ - Trung Tâm', 'Asia/Ho_Chi_Minh', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), timezone = VALUES(timezone), is_active = VALUES(is_active);

SET @site_hcm_c := (SELECT site_id FROM parking_sites WHERE site_code = 'PARK_HCM_CENTRAL' LIMIT 1);
SET @site_hcm_d := (SELECT site_id FROM parking_sites WHERE site_code = 'PARK_HCM_DISCOVERY' LIMIT 1);
SET @site_dn_c   := (SELECT site_id FROM parking_sites WHERE site_code = 'PARK_DN_CENTRAL' LIMIT 1);
SET @site_ha_c   := (SELECT site_id FROM parking_sites WHERE site_code = 'PARK_HA_CENTRAL' LIMIT 1);
SET @site_ct_c   := (SELECT site_id FROM parking_sites WHERE site_code = 'PARK_CT_CENTRAL' LIMIT 1);

-- User-Site scopes
INSERT INTO user_site_scopes(user_id, site_id, scope_level)
SELECT u.user_id, s.site_id, 'MANAGER'
FROM users u
CROSS JOIN parking_sites s
WHERE u.username LIKE 'manager_%'
ON DUPLICATE KEY UPDATE scope_level = VALUES(scope_level);

INSERT INTO user_site_scopes(user_id, site_id, scope_level)
SELECT u.user_id, s.site_id, 'CASHIER'
FROM users u
CROSS JOIN parking_sites s
WHERE u.username LIKE 'cashier_%'
ON DUPLICATE KEY UPDATE scope_level = VALUES(scope_level);

INSERT INTO user_site_scopes(user_id, site_id, scope_level)
SELECT u.user_id, s.site_id, 'GUARD'
FROM users u
CROSS JOIN parking_sites s
WHERE u.username LIKE 'guard_%'
ON DUPLICATE KEY UPDATE scope_level = VALUES(scope_level);

-- ============================================================
-- PHASE 4: ZONES (Multiple zone types per site)
-- ============================================================
-- HCM Central Zones
INSERT INTO zones(site_id, code, name, vehicle_type) VALUES
  (@site_hcm_c, 'VIP_PLATINUM', 'VIP Platinum - Tầng 1', 'CAR'),
  (@site_hcm_c, 'VIP_GOLD', 'VIP Gold - Tầng 2', 'CAR'),
  (@site_hcm_c, 'REGULAR_FLOOR1', 'Khu Thường - Tầng 1', 'CAR'),
  (@site_hcm_c, 'REGULAR_FLOOR2', 'Khu Thường - Tầng 2', 'CAR'),
  (@site_hcm_c, 'REGULAR_FLOOR3', 'Khu Thường - Tầng 3', 'CAR'),
  (@site_hcm_c, 'MOTORBIKE_A', 'Khu Xe Máy A', 'MOTORBIKE'),
  (@site_hcm_c, 'MOTORBIKE_B', 'Khu Xe Máy B', 'MOTORBIKE'),
  (@site_hcm_c, 'DISABLED', 'Khu Xe Dành Cho Người Khuyết Tật', 'CAR'),
  (@site_hcm_c, 'ELECTRIC', 'Khu Xe Điện', 'CAR')
ON DUPLICATE KEY UPDATE name = VALUES(name), vehicle_type = VALUES(vehicle_type);

-- HCM Discovery Zones
INSERT INTO zones(site_id, code, name, vehicle_type) VALUES
  (@site_hcm_d, 'VIP_PREMIUM', 'VIP Premium', 'CAR'),
  (@site_hcm_d, 'REGULAR_A', 'Khu A - Thường', 'CAR'),
  (@site_hcm_d, 'REGULAR_B', 'Khu B - Thường', 'CAR'),
  (@site_hcm_d, 'MOTORBIKE', 'Khu Xe Máy', 'MOTORBIKE')
ON DUPLICATE KEY UPDATE name = VALUES(name), vehicle_type = VALUES(vehicle_type);

-- DN Central Zones
INSERT INTO zones(site_id, code, name, vehicle_type) VALUES
  (@site_dn_c, 'VIP_GOLD', 'VIP Gold', 'CAR'),
  (@site_dn_c, 'REGULAR_FLOOR1', 'Khu Thường - Tầng 1', 'CAR'),
  (@site_dn_c, 'REGULAR_FLOOR2', 'Khu Thường - Tầng 2', 'CAR'),
  (@site_dn_c, 'MOTORBIKE', 'Khu Xe Máy', 'MOTORBIKE')
ON DUPLICATE KEY UPDATE name = VALUES(name), vehicle_type = VALUES(vehicle_type);

-- HA Central Zones
INSERT INTO zones(site_id, code, name, vehicle_type) VALUES
  (@site_ha_c, 'VIP_EXECUTIVE', 'VIP Executive', 'CAR'),
  (@site_ha_c, 'REGULAR_FLOOR1', 'Khu Thường - Tầng 1', 'CAR'),
  (@site_ha_c, 'REGULAR_FLOOR2', 'Khu Thường - Tầng 2', 'CAR'),
  (@site_ha_c, 'MOTORBIKE', 'Khu Xe Máy', 'MOTORBIKE')
ON DUPLICATE KEY UPDATE name = VALUES(name), vehicle_type = VALUES(vehicle_type);

-- CT Central Zones
INSERT INTO zones(site_id, code, name, vehicle_type) VALUES
  (@site_ct_c, 'VIP_STANDARD', 'VIP Standard', 'CAR'),
  (@site_ct_c, 'REGULAR', 'Khu Thường', 'CAR'),
  (@site_ct_c, 'MOTORBIKE', 'Khu Xe Máy', 'MOTORBIKE')
ON DUPLICATE KEY UPDATE name = VALUES(name), vehicle_type = VALUES(vehicle_type);

-- ============================================================
-- PHASE 5: GATE DEVICES (Per site)
-- ============================================================
-- HCM Central - 3 Gates (Entry/Exit combinations)
INSERT INTO gate_devices(site_id, device_code, device_type, direction, location_hint) VALUES
  -- Gate 1 (Main Entrance)
  (@site_hcm_c, 'G1_ENTRY_CAM', 'CAMERA_ALPR', 'ENTRY', 'Gate 1 - Lối Vào Chính - Camera'),
  (@site_hcm_c, 'G1_ENTRY_RFID', 'RFID_READER', 'ENTRY', 'Gate 1 - Lối Vào Chính - RFID'),
  (@site_hcm_c, 'G1_ENTRY_LOOP', 'LOOP_SENSOR', 'ENTRY', 'Gate 1 - Lối Vào Chính - Loop'),
  (@site_hcm_c, 'G1_ENTRY_BAR', 'BARRIER', 'ENTRY', 'Gate 1 - Lối Vào Chính - Barrier'),
  (@site_hcm_c, 'G1_EXIT_CAM', 'CAMERA_ALPR', 'EXIT', 'Gate 1 - Lối Ra Chính - Camera'),
  (@site_hcm_c, 'G1_EXIT_RFID', 'RFID_READER', 'EXIT', 'Gate 1 - Lối Ra Chính - RFID'),
  (@site_hcm_c, 'G1_EXIT_LOOP', 'LOOP_SENSOR', 'EXIT', 'Gate 1 - Lối Ra Chính - Loop'),
  (@site_hcm_c, 'G1_EXIT_BAR', 'BARRIER', 'EXIT', 'Gate 1 - Lối Ra Chính - Barrier'),
  -- Gate 2 (VIP Express)
  (@site_hcm_c, 'G2_ENTRY_CAM', 'CAMERA_ALPR', 'ENTRY', 'Gate 2 - VIP Express - Camera'),
  (@site_hcm_c, 'G2_ENTRY_RFID', 'RFID_READER', 'ENTRY', 'Gate 2 - VIP Express - RFID'),
  (@site_hcm_c, 'G2_ENTRY_BAR', 'BARRIER', 'ENTRY', 'Gate 2 - VIP Express - Barrier'),
  (@site_hcm_c, 'G2_EXIT_CAM', 'CAMERA_ALPR', 'EXIT', 'Gate 2 - VIP Express - Camera'),
  (@site_hcm_c, 'G2_EXIT_RFID', 'RFID_READER', 'EXIT', 'Gate 2 - VIP Express - RFID'),
  (@site_hcm_c, 'G2_EXIT_BAR', 'BARRIER', 'EXIT', 'Gate 2 - VIP Express - Barrier'),
  -- Gate 3 (Side Entrance)
  (@site_hcm_c, 'G3_ENTRY_CAM', 'CAMERA_ALPR', 'ENTRY', 'Gate 3 - Lối Vào Phụ - Camera'),
  (@site_hcm_c, 'G3_ENTRY_RFID', 'RFID_READER', 'ENTRY', 'Gate 3 - Lối Vào Phụ - RFID'),
  (@site_hcm_c, 'G3_ENTRY_LOOP', 'LOOP_SENSOR', 'ENTRY', 'Gate 3 - Lối Vào Phụ - Loop'),
  (@site_hcm_c, 'G3_ENTRY_BAR', 'BARRIER', 'ENTRY', 'Gate 3 - Lối Vào Phụ - Barrier'),
  (@site_hcm_c, 'G3_EXIT_CAM', 'CAMERA_ALPR', 'EXIT', 'Gate 3 - Lối Ra Phụ - Camera'),
  (@site_hcm_c, 'G3_EXIT_RFID', 'RFID_READER', 'EXIT', 'Gate 3 - Lối Ra Phụ - RFID'),
  (@site_hcm_c, 'G3_EXIT_LOOP', 'LOOP_SENSOR', 'EXIT', 'Gate 3 - Lối Ra Phụ - Loop'),
  (@site_hcm_c, 'G3_EXIT_BAR', 'BARRIER', 'EXIT', 'Gate 3 - Lối Ra Phụ - Barrier')
ON DUPLICATE KEY UPDATE device_type = VALUES(device_type), direction = VALUES(direction), location_hint = VALUES(location_hint);

-- HCM Discovery - 2 Gates
INSERT INTO gate_devices(site_id, device_code, device_type, direction, location_hint) VALUES
  (@site_hcm_d, 'G1_ENTRY_CAM', 'CAMERA_ALPR', 'ENTRY', 'Gate 1 - Entry - Camera'),
  (@site_hcm_d, 'G1_ENTRY_RFID', 'RFID_READER', 'ENTRY', 'Gate 1 - Entry - RFID'),
  (@site_hcm_d, 'G1_ENTRY_BAR', 'BARRIER', 'ENTRY', 'Gate 1 - Entry - Barrier'),
  (@site_hcm_d, 'G1_EXIT_CAM', 'CAMERA_ALPR', 'EXIT', 'Gate 1 - Exit - Camera'),
  (@site_hcm_d, 'G1_EXIT_RFID', 'RFID_READER', 'EXIT', 'Gate 1 - Exit - RFID'),
  (@site_hcm_d, 'G1_EXIT_BAR', 'BARRIER', 'EXIT', 'Gate 1 - Exit - Barrier'),
  (@site_hcm_d, 'G2_ENTRY_CAM', 'CAMERA_ALPR', 'ENTRY', 'Gate 2 - Entry - Camera'),
  (@site_hcm_d, 'G2_ENTRY_RFID', 'RFID_READER', 'ENTRY', 'Gate 2 - Entry - RFID'),
  (@site_hcm_d, 'G2_ENTRY_BAR', 'BARRIER', 'ENTRY', 'Gate 2 - Entry - Barrier'),
  (@site_hcm_d, 'G2_EXIT_CAM', 'CAMERA_ALPR', 'EXIT', 'Gate 2 - Exit - Camera'),
  (@site_hcm_d, 'G2_EXIT_RFID', 'RFID_READER', 'EXIT', 'Gate 2 - Exit - RFID'),
  (@site_hcm_d, 'G2_EXIT_BAR', 'BARRIER', 'EXIT', 'Gate 2 - Exit - Barrier')
ON DUPLICATE KEY UPDATE device_type = VALUES(device_type), direction = VALUES(direction), location_hint = VALUES(location_hint);

-- DN Central - 2 Gates
INSERT INTO gate_devices(site_id, device_code, device_type, direction, location_hint) VALUES
  (@site_dn_c, 'G1_ENTRY_CAM', 'CAMERA_ALPR', 'ENTRY', 'Gate 1 - Entry'),
  (@site_dn_c, 'G1_ENTRY_RFID', 'RFID_READER', 'ENTRY', 'Gate 1 - Entry'),
  (@site_dn_c, 'G1_ENTRY_BAR', 'BARRIER', 'ENTRY', 'Gate 1 - Entry'),
  (@site_dn_c, 'G1_EXIT_CAM', 'CAMERA_ALPR', 'EXIT', 'Gate 1 - Exit'),
  (@site_dn_c, 'G1_EXIT_RFID', 'RFID_READER', 'EXIT', 'Gate 1 - Exit'),
  (@site_dn_c, 'G1_EXIT_BAR', 'BARRIER', 'EXIT', 'Gate 1 - Exit'),
  (@site_dn_c, 'G2_ENTRY_CAM', 'CAMERA_ALPR', 'ENTRY', 'Gate 2 - Entry'),
  (@site_dn_c, 'G2_ENTRY_RFID', 'RFID_READER', 'ENTRY', 'Gate 2 - Entry'),
  (@site_dn_c, 'G2_ENTRY_BAR', 'BARRIER', 'ENTRY', 'Gate 2 - Entry'),
  (@site_dn_c, 'G2_EXIT_CAM', 'CAMERA_ALPR', 'EXIT', 'Gate 2 - Exit'),
  (@site_dn_c, 'G2_EXIT_RFID', 'RFID_READER', 'EXIT', 'Gate 2 - Exit'),
  (@site_dn_c, 'G2_EXIT_BAR', 'BARRIER', 'EXIT', 'Gate 2 - Exit')
ON DUPLICATE KEY UPDATE device_type = VALUES(device_type), direction = VALUES(direction), location_hint = VALUES(location_hint);

-- HA Central - 2 Gates
INSERT INTO gate_devices(site_id, device_code, device_type, direction, location_hint) VALUES
  (@site_ha_c, 'G1_ENTRY_CAM', 'CAMERA_ALPR', 'ENTRY', 'Gate 1 - Entry'),
  (@site_ha_c, 'G1_ENTRY_RFID', 'RFID_READER', 'ENTRY', 'Gate 1 - Entry'),
  (@site_ha_c, 'G1_ENTRY_BAR', 'BARRIER', 'ENTRY', 'Gate 1 - Entry'),
  (@site_ha_c, 'G1_EXIT_CAM', 'CAMERA_ALPR', 'EXIT', 'Gate 1 - Exit'),
  (@site_ha_c, 'G1_EXIT_RFID', 'RFID_READER', 'EXIT', 'Gate 1 - Exit'),
  (@site_ha_c, 'G1_EXIT_BAR', 'BARRIER', 'EXIT', 'Gate 1 - Exit'),
  (@site_ha_c, 'G2_ENTRY_CAM', 'CAMERA_ALPR', 'ENTRY', 'Gate 2 - Entry'),
  (@site_ha_c, 'G2_ENTRY_RFID', 'RFID_READER', 'ENTRY', 'Gate 2 - Entry'),
  (@site_ha_c, 'G2_ENTRY_BAR', 'BARRIER', 'ENTRY', 'Gate 2 - Entry'),
  (@site_ha_c, 'G2_EXIT_CAM', 'CAMERA_ALPR', 'EXIT', 'Gate 2 - Exit'),
  (@site_ha_c, 'G2_EXIT_RFID', 'RFID_READER', 'EXIT', 'Gate 2 - Exit'),
  (@site_ha_c, 'G2_EXIT_BAR', 'BARRIER', 'EXIT', 'Gate 2 - Exit')
ON DUPLICATE KEY UPDATE device_type = VALUES(device_type), direction = VALUES(direction), location_hint = VALUES(location_hint);

-- CT Central - 1 Gate
INSERT INTO gate_devices(site_id, device_code, device_type, direction, location_hint) VALUES
  (@site_ct_c, 'G1_ENTRY_CAM', 'CAMERA_ALPR', 'ENTRY', 'Gate 1 - Entry'),
  (@site_ct_c, 'G1_ENTRY_RFID', 'RFID_READER', 'ENTRY', 'Gate 1 - Entry'),
  (@site_ct_c, 'G1_ENTRY_BAR', 'BARRIER', 'ENTRY', 'Gate 1 - Entry'),
  (@site_ct_c, 'G1_EXIT_CAM', 'CAMERA_ALPR', 'EXIT', 'Gate 1 - Exit'),
  (@site_ct_c, 'G1_EXIT_RFID', 'RFID_READER', 'EXIT', 'Gate 1 - Exit'),
  (@site_ct_c, 'G1_EXIT_BAR', 'BARRIER', 'EXIT', 'Gate 1 - Exit')
ON DUPLICATE KEY UPDATE device_type = VALUES(device_type), direction = VALUES(direction), location_hint = VALUES(location_hint);

-- ============================================================
-- PHASE 6: GATE LANES
-- ============================================================
-- HCM Central Lanes
INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_hcm_c, 'G1', 'G1_ENTRY', 'Gate 1 - Lối Vào', 'ENTRY', 'ACTIVE', 10,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_c AND device_code = 'G1_ENTRY_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_hcm_c, 'G1', 'G1_EXIT', 'Gate 1 - Lối Ra', 'EXIT', 'ACTIVE', 11,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_c AND device_code = 'G1_EXIT_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_hcm_c, 'G2', 'G2_ENTRY', 'Gate 2 - VIP Express Vào', 'ENTRY', 'ACTIVE', 20,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_c AND device_code = 'G2_ENTRY_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_hcm_c, 'G2', 'G2_EXIT', 'Gate 2 - VIP Express Ra', 'EXIT', 'ACTIVE', 21,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_c AND device_code = 'G2_EXIT_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_hcm_c, 'G3', 'G3_ENTRY', 'Gate 3 - Lối Vào Phụ', 'ENTRY', 'ACTIVE', 30,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_c AND device_code = 'G3_ENTRY_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_hcm_c, 'G3', 'G3_EXIT', 'Gate 3 - Lối Ra Phụ', 'EXIT', 'ACTIVE', 31,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_c AND device_code = 'G3_EXIT_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

-- HCM Discovery Lanes
INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_hcm_d, 'G1', 'G1_ENTRY', 'Gate 1 - Entry', 'ENTRY', 'ACTIVE', 10,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_d AND device_code = 'G1_ENTRY_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_hcm_d, 'G1', 'G1_EXIT', 'Gate 1 - Exit', 'EXIT', 'ACTIVE', 11,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_d AND device_code = 'G1_EXIT_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_hcm_d, 'G2', 'G2_ENTRY', 'Gate 2 - Entry', 'ENTRY', 'ACTIVE', 20,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_d AND device_code = 'G2_ENTRY_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_hcm_d, 'G2', 'G2_EXIT', 'Gate 2 - Exit', 'EXIT', 'ACTIVE', 21,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_d AND device_code = 'G2_EXIT_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

-- DN Central Lanes
INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_dn_c, 'G1', 'G1_ENTRY', 'Gate 1 - Entry', 'ENTRY', 'ACTIVE', 10,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_c AND device_code = 'G1_ENTRY_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_dn_c, 'G1', 'G1_EXIT', 'Gate 1 - Exit', 'EXIT', 'ACTIVE', 11,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_c AND device_code = 'G1_EXIT_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_dn_c, 'G2', 'G2_ENTRY', 'Gate 2 - Entry', 'ENTRY', 'ACTIVE', 20,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_c AND device_code = 'G2_ENTRY_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_dn_c, 'G2', 'G2_EXIT', 'Gate 2 - Exit', 'EXIT', 'ACTIVE', 21,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_c AND device_code = 'G2_EXIT_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

-- HA Central Lanes
INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_ha_c, 'G1', 'G1_ENTRY', 'Gate 1 - Entry', 'ENTRY', 'ACTIVE', 10,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_ha_c AND device_code = 'G1_ENTRY_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_ha_c, 'G1', 'G1_EXIT', 'Gate 1 - Exit', 'EXIT', 'ACTIVE', 11,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_ha_c AND device_code = 'G1_EXIT_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_ha_c, 'G2', 'G2_ENTRY', 'Gate 2 - Entry', 'ENTRY', 'ACTIVE', 20,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_ha_c AND device_code = 'G2_ENTRY_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_ha_c, 'G2', 'G2_EXIT', 'Gate 2 - Exit', 'EXIT', 'ACTIVE', 21,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_ha_c AND device_code = 'G2_EXIT_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

-- CT Central Lanes
INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_ct_c, 'G1', 'G1_ENTRY', 'Gate 1 - Entry', 'ENTRY', 'ACTIVE', 10,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_ct_c AND device_code = 'G1_ENTRY_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
SELECT @site_ct_c, 'G1', 'G1_EXIT', 'Gate 1 - Exit', 'EXIT', 'ACTIVE', 11,
       (SELECT device_id FROM gate_devices WHERE site_id = @site_ct_c AND device_code = 'G1_EXIT_RFID' LIMIT 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), primary_device_id = VALUES(primary_device_id);

-- ============================================================
-- PHASE 7: GATE LANE DEVICES (Device-to-Lane Mapping)
-- ============================================================
-- Map devices to lanes for HCM Central
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20
FROM gate_lanes l
CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10
FROM gate_lanes l
CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'LOOP_SENSOR', 0, 1, 15
FROM gate_lanes l
CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_LOOP'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30
FROM gate_lanes l
CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

-- Exit lanes
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20
FROM gate_lanes l
CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10
FROM gate_lanes l
CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'LOOP_SENSOR', 0, 1, 15
FROM gate_lanes l
CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_LOOP'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30
FROM gate_lanes l
CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

-- ============================================================
-- PHASE 7b: GATE LANE DEVICES (Remaining Sites)
-- ============================================================
-- HCM Central - G2 Entry/Exit
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G2_ENTRY' AND d.device_code = 'G2_ENTRY_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G2_ENTRY' AND d.device_code = 'G2_ENTRY_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G2_ENTRY' AND d.device_code = 'G2_ENTRY_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G2_EXIT' AND d.device_code = 'G2_EXIT_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G2_EXIT' AND d.device_code = 'G2_EXIT_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G2_EXIT' AND d.device_code = 'G2_EXIT_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

-- HCM Central - G3 Entry/Exit
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G3_ENTRY' AND d.device_code = 'G3_ENTRY_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G3_ENTRY' AND d.device_code = 'G3_ENTRY_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'LOOP_SENSOR', 0, 1, 15 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G3_ENTRY' AND d.device_code = 'G3_ENTRY_LOOP'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G3_ENTRY' AND d.device_code = 'G3_ENTRY_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G3_EXIT' AND d.device_code = 'G3_EXIT_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G3_EXIT' AND d.device_code = 'G3_EXIT_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'LOOP_SENSOR', 0, 1, 15 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G3_EXIT' AND d.device_code = 'G3_EXIT_LOOP'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_c AND l.lane_code = 'G3_EXIT' AND d.device_code = 'G3_EXIT_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

-- HCM Discovery - G1 & G2 Entry/Exit
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_d AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_d AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_d AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_d AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_d AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_d AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_d AND l.lane_code = 'G2_ENTRY' AND d.device_code = 'G2_ENTRY_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_d AND l.lane_code = 'G2_ENTRY' AND d.device_code = 'G2_ENTRY_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_d AND l.lane_code = 'G2_ENTRY' AND d.device_code = 'G2_ENTRY_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_d AND l.lane_code = 'G2_EXIT' AND d.device_code = 'G2_EXIT_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_d AND l.lane_code = 'G2_EXIT' AND d.device_code = 'G2_EXIT_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_hcm_d AND l.lane_code = 'G2_EXIT' AND d.device_code = 'G2_EXIT_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

-- DN Central - G1 & G2 Entry/Exit
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_dn_c AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_dn_c AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_dn_c AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_dn_c AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_dn_c AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_dn_c AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_dn_c AND l.lane_code = 'G2_ENTRY' AND d.device_code = 'G2_ENTRY_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_dn_c AND l.lane_code = 'G2_ENTRY' AND d.device_code = 'G2_ENTRY_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_dn_c AND l.lane_code = 'G2_ENTRY' AND d.device_code = 'G2_ENTRY_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_dn_c AND l.lane_code = 'G2_EXIT' AND d.device_code = 'G2_EXIT_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_dn_c AND l.lane_code = 'G2_EXIT' AND d.device_code = 'G2_EXIT_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_dn_c AND l.lane_code = 'G2_EXIT' AND d.device_code = 'G2_EXIT_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

-- HA Central - G1 & G2 Entry/Exit
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ha_c AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ha_c AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ha_c AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ha_c AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ha_c AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ha_c AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ha_c AND l.lane_code = 'G2_ENTRY' AND d.device_code = 'G2_ENTRY_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ha_c AND l.lane_code = 'G2_ENTRY' AND d.device_code = 'G2_ENTRY_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ha_c AND l.lane_code = 'G2_ENTRY' AND d.device_code = 'G2_ENTRY_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ha_c AND l.lane_code = 'G2_EXIT' AND d.device_code = 'G2_EXIT_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ha_c AND l.lane_code = 'G2_EXIT' AND d.device_code = 'G2_EXIT_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ha_c AND l.lane_code = 'G2_EXIT' AND d.device_code = 'G2_EXIT_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

-- CT Central - G1 Entry/Exit
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ct_c AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ct_c AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ct_c AND l.lane_code = 'G1_ENTRY' AND d.device_code = 'G1_ENTRY_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'RFID', 1, 1, 20 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ct_c AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_RFID'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'CAMERA', 0, 1, 10 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ct_c AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_CAM'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'BARRIER', 0, 1, 30 FROM gate_lanes l CROSS JOIN gate_devices d
WHERE l.site_id = @site_ct_c AND l.lane_code = 'G1_EXIT' AND d.device_code = 'G1_EXIT_BAR'
ON DUPLICATE KEY UPDATE device_role = VALUES(device_role);

-- ============================================================
-- PHASE 8: PARKING SPOTS (Per zone)
-- ============================================================
-- HCM Central - VIP Platinum (10 spots)
INSERT INTO spots(site_id, zone_id, code, status, floor_key, layout_order, slot_kind, display_label)
SELECT @site_hcm_c, z.zone_id, CONCAT('HCM-PT-', LPAD(n, 3, '0')), 'FREE', 'F1', n, 'PLATINUM', CONCAT('P', n)
FROM zones z
CROSS JOIN (
  SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
) nums
WHERE z.site_id = @site_hcm_c AND z.code = 'VIP_PLATINUM'
ON DUPLICATE KEY UPDATE zone_id = VALUES(zone_id), status = VALUES(status);

-- HCM Central - VIP Gold (20 spots)
INSERT INTO spots(site_id, zone_id, code, status, floor_key, layout_order, slot_kind, display_label)
SELECT @site_hcm_c, z.zone_id, CONCAT('HCM-GD-', LPAD(n, 3, '0')), 'FREE', 'F2', n, 'GOLD', CONCAT('G', n)
FROM zones z
CROSS JOIN (
  SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
  UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
) nums
WHERE z.site_id = @site_hcm_c AND z.code = 'VIP_GOLD'
ON DUPLICATE KEY UPDATE zone_id = VALUES(zone_id), status = VALUES(status);

-- HCM Central - Regular Floor 1 (50 spots)
INSERT INTO spots(site_id, zone_id, code, status, floor_key, layout_order, slot_kind, display_label)
SELECT @site_hcm_c, z.zone_id, CONCAT('HCM-R1-', LPAD(n, 3, '0')), 'FREE', 'F1', 10+n, 'REGULAR', CONCAT('R', n)
FROM zones z
CROSS JOIN (
  SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
  UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
  UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25
  UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30
  UNION SELECT 31 UNION SELECT 32 UNION SELECT 33 UNION SELECT 34 UNION SELECT 35
  UNION SELECT 36 UNION SELECT 37 UNION SELECT 38 UNION SELECT 39 UNION SELECT 40
  UNION SELECT 41 UNION SELECT 42 UNION SELECT 43 UNION SELECT 44 UNION SELECT 45
  UNION SELECT 46 UNION SELECT 47 UNION SELECT 48 UNION SELECT 49 UNION SELECT 50
) nums
WHERE z.site_id = @site_hcm_c AND z.code = 'REGULAR_FLOOR1'
ON DUPLICATE KEY UPDATE zone_id = VALUES(zone_id), status = VALUES(status);

-- HCM Central - Motorbike zones (100 spots total)
INSERT INTO spots(site_id, zone_id, code, status, floor_key, layout_order, slot_kind, display_label)
SELECT @site_hcm_c, z.zone_id, CONCAT('HCM-M-', LPAD(n, 3, '0')), 'FREE', 'G', n, 'MOTORBIKE', CONCAT('M', n)
FROM zones z
CROSS JOIN (
  SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
  UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
  UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25
  UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30
  UNION SELECT 31 UNION SELECT 32 UNION SELECT 33 UNION SELECT 34 UNION SELECT 35
  UNION SELECT 36 UNION SELECT 37 UNION SELECT 38 UNION SELECT 39 UNION SELECT 40
  UNION SELECT 41 UNION SELECT 42 UNION SELECT 43 UNION SELECT 44 UNION SELECT 45
  UNION SELECT 46 UNION SELECT 47 UNION SELECT 48 UNION SELECT 49 UNION SELECT 50
) nums
WHERE z.site_id = @site_hcm_c AND z.code IN ('MOTORBIKE_A', 'MOTORBIKE_B')
ON DUPLICATE KEY UPDATE zone_id = VALUES(zone_id), status = VALUES(status);

-- HCM Discovery - Spots (30 regular + 20 motorbike)
INSERT INTO spots(site_id, zone_id, code, status, floor_key, layout_order, slot_kind, display_label)
SELECT @site_hcm_d, z.zone_id, CONCAT('HCMD-R-', LPAD(n, 3, '0')), 'FREE', 'F1', n, 'REGULAR', CONCAT('R', n)
FROM zones z
CROSS JOIN (
  SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
  UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
  UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25
  UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30
) nums
WHERE z.site_id = @site_hcm_d AND z.code = 'REGULAR_A'
ON DUPLICATE KEY UPDATE zone_id = VALUES(zone_id), status = VALUES(status);

INSERT INTO spots(site_id, zone_id, code, status, floor_key, layout_order, slot_kind, display_label)
SELECT @site_hcm_d, z.zone_id, CONCAT('HCMD-M-', LPAD(n, 3, '0')), 'FREE', 'G', n, 'MOTORBIKE', CONCAT('M', n)
FROM zones z
CROSS JOIN (
  SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
  UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
) nums
WHERE z.site_id = @site_hcm_d AND z.code = 'MOTORBIKE'
ON DUPLICATE KEY UPDATE zone_id = VALUES(zone_id), status = VALUES(status);

-- DN Central - Spots (40 regular + 20 motorbike)
INSERT INTO spots(site_id, zone_id, code, status, floor_key, layout_order, slot_kind, display_label)
SELECT @site_dn_c, z.zone_id, CONCAT('DN-R-', LPAD(n, 3, '0')), 'FREE', 'F1', n, 'REGULAR', CONCAT('R', n)
FROM zones z
CROSS JOIN (
  SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
  UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
  UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25
  UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30
  UNION SELECT 31 UNION SELECT 32 UNION SELECT 33 UNION SELECT 34 UNION SELECT 35
  UNION SELECT 36 UNION SELECT 37 UNION SELECT 38 UNION SELECT 39 UNION SELECT 40
) nums
WHERE z.site_id = @site_dn_c AND z.code = 'REGULAR_FLOOR1'
ON DUPLICATE KEY UPDATE zone_id = VALUES(zone_id), status = VALUES(status);

INSERT INTO spots(site_id, zone_id, code, status, floor_key, layout_order, slot_kind, display_label)
SELECT @site_dn_c, z.zone_id, CONCAT('DN-M-', LPAD(n, 3, '0')), 'FREE', 'G', n, 'MOTORBIKE', CONCAT('M', n)
FROM zones z
CROSS JOIN (
  SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
  UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
) nums
WHERE z.site_id = @site_dn_c AND z.code = 'MOTORBIKE'
ON DUPLICATE KEY UPDATE zone_id = VALUES(zone_id), status = VALUES(status);

-- HA Central - Spots (30 regular + 15 motorbike)
INSERT INTO spots(site_id, zone_id, code, status, floor_key, layout_order, slot_kind, display_label)
SELECT @site_ha_c, z.zone_id, CONCAT('HA-R-', LPAD(n, 3, '0')), 'FREE', 'F1', n, 'REGULAR', CONCAT('R', n)
FROM zones z
CROSS JOIN (
  SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
  UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
  UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25
  UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30
) nums
WHERE z.site_id = @site_ha_c AND z.code = 'REGULAR_FLOOR1'
ON DUPLICATE KEY UPDATE zone_id = VALUES(zone_id), status = VALUES(status);

INSERT INTO spots(site_id, zone_id, code, status, floor_key, layout_order, slot_kind, display_label)
SELECT @site_ha_c, z.zone_id, CONCAT('HA-M-', LPAD(n, 3, '0')), 'FREE', 'G', n, 'MOTORBIKE', CONCAT('M', n)
FROM zones z
CROSS JOIN (
  SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
) nums
WHERE z.site_id = @site_ha_c AND z.code = 'MOTORBIKE'
ON DUPLICATE KEY UPDATE zone_id = VALUES(zone_id), status = VALUES(status);

-- CT Central - Spots (20 regular + 10 motorbike)
INSERT INTO spots(site_id, zone_id, code, status, floor_key, layout_order, slot_kind, display_label)
SELECT @site_ct_c, z.zone_id, CONCAT('CT-R-', LPAD(n, 3, '0')), 'FREE', 'F1', n, 'REGULAR', CONCAT('R', n)
FROM zones z
CROSS JOIN (
  SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
  UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
) nums
WHERE z.site_id = @site_ct_c AND z.code = 'REGULAR'
ON DUPLICATE KEY UPDATE zone_id = VALUES(zone_id), status = VALUES(status);

INSERT INTO spots(site_id, zone_id, code, status, floor_key, layout_order, slot_kind, display_label)
SELECT @site_ct_c, z.zone_id, CONCAT('CT-M-', LPAD(n, 3, '0')), 'FREE', 'G', n, 'MOTORBIKE', CONCAT('M', n)
FROM zones z
CROSS JOIN (
  SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
) nums
WHERE z.site_id = @site_ct_c AND z.code = 'MOTORBIKE'
ON DUPLICATE KEY UPDATE zone_id = VALUES(zone_id), status = VALUES(status);

-- ============================================================
-- PHASE 9: TARIFFS (Pricing)
-- ============================================================
-- HCM Central Tariffs
INSERT INTO tariffs(site_id, name, applies_to, vehicle_type, is_active, valid_from) VALUES
  (@site_hcm_c, 'Giá Giờ - Ô Tô Thường', 'TICKET', 'CAR', 1, NOW()),
  (@site_hcm_c, 'Giá Giờ - Xe Máy', 'TICKET', 'MOTORBIKE', 1, NOW()),
  (@site_hcm_c, 'Gói Tháng - Ô Tô', 'SUBSCRIPTION', 'CAR', 1, NOW()),
  (@site_hcm_c, 'Gói Tháng - Xe Máy', 'SUBSCRIPTION', 'MOTORBIKE', 1, NOW()),
  (@site_hcm_c, 'Gói VIP - Ô Tô Platinum', 'SUBSCRIPTION', 'CAR', 1, NOW()),
  (@site_hcm_c, 'Gói VIP - Ô Tô Gold', 'SUBSCRIPTION', 'CAR', 1, NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = VALUES(is_active);

SET @tariff_hcm_car_hourly := (SELECT tariff_id FROM tariffs WHERE site_id = @site_hcm_c AND name = 'Giá Giờ - Ô Tô Thường' LIMIT 1);
SET @tariff_hcm_moto_hourly := (SELECT tariff_id FROM tariffs WHERE site_id = @site_hcm_c AND name = 'Giá Giờ - Xe Máy' LIMIT 1);
SET @tariff_hcm_car_monthly := (SELECT tariff_id FROM tariffs WHERE site_id = @site_hcm_c AND name = 'Gói Tháng - Ô Tô' LIMIT 1);
SET @tariff_hcm_moto_monthly := (SELECT tariff_id FROM tariffs WHERE site_id = @site_hcm_c AND name = 'Gói Tháng - Xe Máy' LIMIT 1);
SET @tariff_hcm_vip_platinum := (SELECT tariff_id FROM tariffs WHERE site_id = @site_hcm_c AND name = 'Gói VIP - Ô Tô Platinum' LIMIT 1);
SET @tariff_hcm_vip_gold := (SELECT tariff_id FROM tariffs WHERE site_id = @site_hcm_c AND name = 'Gói VIP - Ô Tô Gold' LIMIT 1);

-- Tariff Rules for HCM Car Hourly
INSERT INTO tariff_rules(tariff_id, rule_type, param_json, priority) VALUES
  (@tariff_hcm_car_hourly, 'FREE_MINUTES', '{"minutes": 15}', 10),
  (@tariff_hcm_car_hourly, 'HOURLY', '{"rate": 35000, "unit": "hour", "max_daily": 350000}', 20),
  (@tariff_hcm_car_hourly, 'OVERNIGHT', '{"flat_rate": 100000, "start_hour": 22, "end_hour": 6}', 30)
ON DUPLICATE KEY UPDATE rule_type = VALUES(rule_type);

-- Tariff Rules for HCM Motorbike Hourly
INSERT INTO tariff_rules(tariff_id, rule_type, param_json, priority) VALUES
  (@tariff_hcm_moto_hourly, 'FREE_MINUTES', '{"minutes": 15}', 10),
  (@tariff_hcm_moto_hourly, 'HOURLY', '{"rate": 10000, "unit": "hour", "max_daily": 80000}', 20)
ON DUPLICATE KEY UPDATE rule_type = VALUES(rule_type);

-- Tariff Rules for VIP Platinum
INSERT INTO tariff_rules(tariff_id, rule_type, param_json, priority) VALUES
  (@tariff_hcm_vip_platinum, 'DAILY_CAP', '{"flat_rate": 500000, "billing": "monthly"}', 10)
ON DUPLICATE KEY UPDATE rule_type = VALUES(rule_type);

-- Tariff Rules for VIP Gold
INSERT INTO tariff_rules(tariff_id, rule_type, param_json, priority) VALUES
  (@tariff_hcm_vip_gold, 'DAILY_CAP', '{"flat_rate": 300000, "billing": "monthly"}', 10)
ON DUPLICATE KEY UPDATE rule_type = VALUES(rule_type);

-- ============================================================
-- PHASE 10: CUSTOMERS (VIP and Regular)
-- ============================================================
INSERT INTO customers(full_name, phone, email, status) VALUES
  -- VIP Platinum Customers
  ('Nguyễn Văn A - Platinum', '0900100001', 'vip.platinum.01@parkly.local', 'ACTIVE'),
  ('Trần Thị B - Platinum', '0900100002', 'vip.platinum.02@parkly.local', 'ACTIVE'),
  ('Lê Văn C - Platinum', '0900100003', 'vip.platinum.03@parkly.local', 'ACTIVE'),
  ('Phạm Thị D - Platinum', '0900100004', 'vip.platinum.04@parkly.local', 'ACTIVE'),
  ('Hoàng Văn E - Platinum', '0900100005', 'vip.platinum.05@parkly.local', 'ACTIVE'),
  -- VIP Gold Customers
  ('Vũ Thị F - Gold', '0900200001', 'vip.gold.01@parkly.local', 'ACTIVE'),
  ('Đặng Văn G - Gold', '0900200002', 'vip.gold.02@parkly.local', 'ACTIVE'),
  ('Bùi Thị H - Gold', '0900200003', 'vip.gold.03@parkly.local', 'ACTIVE'),
  ('Cao Văn I - Gold', '0900200004', 'vip.gold.04@parkly.local', 'ACTIVE'),
  -- Monthly Subscription Customers
  ('Đỗ Thị K - Monthly', '0900300001', 'monthly.01@parkly.local', 'ACTIVE'),
  ('Ngô Văn L - Monthly', '0900300002', 'monthly.02@parkly.local', 'ACTIVE'),
  ('Trịnh Thị M - Monthly', '0900300003', 'monthly.03@parkly.local', 'ACTIVE'),
  ('Phan Văn N - Monthly', '0900300004', 'monthly.04@parkly.local', 'ACTIVE'),
  ('Lương Thị P - Monthly', '0900300005', 'monthly.05@parkly.local', 'ACTIVE'),
  -- Regular Customers (Walk-in)
  ('Võ Văn Q - Regular', '0900400001', 'regular.01@parkly.local', 'ACTIVE'),
  ('Đinh Thị R - Regular', '0900400002', 'regular.02@parkly.local', 'ACTIVE'),
  ('Hồ Văn S - Regular', '0900400003', 'regular.03@parkly.local', 'ACTIVE')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), status = VALUES(status);

-- ============================================================
-- PHASE 11: VEHICLES (Per customer)
-- ============================================================
SET @cust_pt1 := (SELECT customer_id FROM customers WHERE email = 'vip.platinum.01@parkly.local');
SET @cust_pt2 := (SELECT customer_id FROM customers WHERE email = 'vip.platinum.02@parkly.local');
SET @cust_pt3 := (SELECT customer_id FROM customers WHERE email = 'vip.platinum.03@parkly.local');
SET @cust_gd1 := (SELECT customer_id FROM customers WHERE email = 'vip.gold.01@parkly.local');
SET @cust_gd2 := (SELECT customer_id FROM customers WHERE email = 'vip.gold.02@parkly.local');
SET @cust_mo1 := (SELECT customer_id FROM customers WHERE email = 'monthly.01@parkly.local');
SET @cust_mo2 := (SELECT customer_id FROM customers WHERE email = 'monthly.02@parkly.local');

INSERT INTO vehicles(license_plate, vehicle_type, owner_customer_id) VALUES
  -- Platinum Vehicles
  ('51A-11111', 'CAR', @cust_pt1),
  ('51A-22222', 'CAR', @cust_pt1),
  ('51B-11111', 'CAR', @cust_pt2),
  ('51C-11111', 'CAR', @cust_pt3),
  -- Gold Vehicles
  ('51D-11111', 'CAR', @cust_gd1),
  ('51E-11111', 'CAR', @cust_gd1),
  ('51F-11111', 'CAR', @cust_gd2),
  -- Monthly Vehicles
  ('51G-11111', 'CAR', @cust_mo1),
  ('51H-11111', 'CAR', @cust_mo1),
  ('51K-11111', 'CAR', @cust_mo2),
  -- Motorbikes
  ('51M1-1111', 'MOTORBIKE', @cust_pt1),
  ('51M2-1111', 'MOTORBIKE', @cust_gd1),
  ('51M3-1111', 'MOTORBIKE', @cust_mo1)
ON DUPLICATE KEY UPDATE vehicle_type = VALUES(vehicle_type);

-- ============================================================
-- PHASE 12: SUBSCRIPTIONS
-- ============================================================
INSERT INTO subscriptions(site_id, customer_id, plan_type, start_date, end_date, status) VALUES
  -- VIP Platinum Active
  (@site_hcm_c, @cust_pt1, 'VIP', DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_ADD(CURDATE(), INTERVAL 335 DAY), 'ACTIVE'),
  (@site_hcm_c, @cust_pt2, 'VIP', DATE_SUB(CURDATE(), INTERVAL 60 DAY), DATE_ADD(CURDATE(), INTERVAL 305 DAY), 'ACTIVE'),
  (@site_hcm_c, @cust_pt3, 'VIP', DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_ADD(CURDATE(), INTERVAL 350 DAY), 'ACTIVE'),
  -- VIP Gold Active
  (@site_hcm_c, @cust_gd1, 'VIP', DATE_SUB(CURDATE(), INTERVAL 45 DAY), DATE_ADD(CURDATE(), INTERVAL 320 DAY), 'ACTIVE'),
  (@site_hcm_c, @cust_gd2, 'VIP', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 345 DAY), 'ACTIVE'),
  -- Monthly Active
  (@site_hcm_c, @cust_mo1, 'MONTHLY', DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 25 DAY), 'ACTIVE'),
  (@site_hcm_c, @cust_mo2, 'MONTHLY', DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'ACTIVE'),
  -- Expired Subscription
  (@site_hcm_c, @cust_pt1, 'VIP', DATE_SUB(CURDATE(), INTERVAL 400 DAY), DATE_SUB(CURDATE(), INTERVAL 35 DAY), 'EXPIRED')
ON DUPLICATE KEY UPDATE plan_type = VALUES(plan_type), status = VALUES(status);

SET @sub_pt1 := (SELECT subscription_id FROM subscriptions WHERE site_id = @site_hcm_c AND customer_id = @cust_pt1 AND status = 'ACTIVE' ORDER BY subscription_id DESC LIMIT 1);
SET @sub_pt2 := (SELECT subscription_id FROM subscriptions WHERE site_id = @site_hcm_c AND customer_id = @cust_pt2 AND status = 'ACTIVE' ORDER BY subscription_id DESC LIMIT 1);
SET @sub_gd1 := (SELECT subscription_id FROM subscriptions WHERE site_id = @site_hcm_c AND customer_id = @cust_gd1 AND status = 'ACTIVE' ORDER BY subscription_id DESC LIMIT 1);
SET @sub_mo1 := (SELECT subscription_id FROM subscriptions WHERE site_id = @site_hcm_c AND customer_id = @cust_mo1 AND status = 'ACTIVE' ORDER BY subscription_id DESC LIMIT 1);

-- ============================================================
-- PHASE 13: CREDENTIALS (RFID Cards)
-- ============================================================
INSERT INTO credentials(site_id, subscription_id, rfid_uid, status) VALUES
  (@site_hcm_c, @sub_pt1, 'PLAT-HCM-0001', 'ACTIVE'),
  (@site_hcm_c, @sub_pt1, 'PLAT-HCM-0002', 'ACTIVE'),
  (@site_hcm_c, @sub_pt2, 'PLAT-HCM-0003', 'ACTIVE'),
  (@site_hcm_c, @sub_gd1, 'GOLD-HCM-0001', 'ACTIVE'),
  (@site_hcm_c, @sub_mo1, 'MNTH-HCM-0001', 'ACTIVE')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- ============================================================
-- PHASE 14: SUBSCRIPTION SPOTS (Assigned Parking Spots)
-- ============================================================
SET @spot_pt1 := (SELECT spot_id FROM spots WHERE site_id = @site_hcm_c AND code = 'HCM-PT-001' LIMIT 1);
SET @spot_pt2 := (SELECT spot_id FROM spots WHERE site_id = @site_hcm_c AND code = 'HCM-PT-002' LIMIT 1);
SET @spot_gd1 := (SELECT spot_id FROM spots WHERE site_id = @site_hcm_c AND code = 'HCM-GD-001' LIMIT 1);

INSERT INTO subscription_spots(subscription_id, site_id, spot_id, assigned_mode, status, is_primary, assigned_from, assigned_until) VALUES
  (@sub_pt1, @site_hcm_c, @spot_pt1, 'ASSIGNED', 'ACTIVE', 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 335 DAY)),
  (@sub_pt1, @site_hcm_c, @spot_pt2, 'PREFERRED', 'ACTIVE', 0, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 335 DAY)),
  (@sub_pt2, @site_hcm_c, (SELECT spot_id FROM spots WHERE site_id = @site_hcm_c AND code = 'HCM-PT-003' LIMIT 1), 'ASSIGNED', 'ACTIVE', 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 305 DAY)),
  (@sub_gd1, @site_hcm_c, @spot_gd1, 'ASSIGNED', 'ACTIVE', 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 320 DAY))
ON DUPLICATE KEY UPDATE assigned_mode = VALUES(assigned_mode), status = VALUES(status);

-- ============================================================
-- PHASE 15: SUBSCRIPTION VEHICLES (Linked Vehicles)
-- ============================================================
SET @veh_pt1_car1 := (SELECT vehicle_id FROM vehicles WHERE license_plate = '51A-11111');
SET @veh_pt1_car2 := (SELECT vehicle_id FROM vehicles WHERE license_plate = '51A-22222');
SET @veh_pt2_car := (SELECT vehicle_id FROM vehicles WHERE license_plate = '51B-11111');
SET @veh_gd1_car := (SELECT vehicle_id FROM vehicles WHERE license_plate = '51D-11111');
SET @veh_mo1_moto := (SELECT vehicle_id FROM vehicles WHERE license_plate = '51M1-1111');

INSERT INTO subscription_vehicles(subscription_id, site_id, vehicle_id, plate_compact, status, is_primary, valid_from, valid_to) VALUES
  (@sub_pt1, @site_hcm_c, @veh_pt1_car1, '51A11111', 'ACTIVE', 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 335 DAY)),
  (@sub_pt1, @site_hcm_c, @veh_pt1_car2, '51A22222', 'ACTIVE', 0, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 335 DAY)),
  (@sub_pt2, @site_hcm_c, @veh_pt2_car, '51B11111', 'ACTIVE', 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 305 DAY)),
  (@sub_gd1, @site_hcm_c, @veh_gd1_car, '51D11111', 'ACTIVE', 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 320 DAY)),
  (@sub_mo1, @site_hcm_c, @veh_mo1_moto, '51M11111', 'ACTIVE', 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 25 DAY))
ON DUPLICATE KEY UPDATE status = VALUES(status), is_primary = VALUES(is_primary);

-- ============================================================
-- PHASE 16: SAMPLE TICKETS (For testing)
-- ============================================================
SET @veh_sample1 := (SELECT vehicle_id FROM vehicles WHERE license_plate = '51G-11111');
SET @veh_sample2 := (SELECT vehicle_id FROM vehicles WHERE license_plate = '51H-11111');

INSERT INTO tickets(site_id, ticket_code, vehicle_id, entry_time, status) VALUES
  (@site_hcm_c, 'DEMO-T-00000001', @veh_sample1, TIMESTAMP(CURDATE(), '09:00:00'), 'OPEN'),
  (@site_hcm_c, 'DEMO-T-00000002', @veh_sample2, TIMESTAMP(CURDATE(), '10:30:00'), 'OPEN')
ON DUPLICATE KEY UPDATE entry_time = VALUES(entry_time);

-- ============================================================
-- PHASE 17: DEVICE HEARTBEATS (Simulate device health)
-- ============================================================
INSERT INTO device_heartbeats(site_id, device_id, status, reported_at, latency_ms, firmware_version, ip_address)
SELECT @site_hcm_c, device_id, 'ONLINE', NOW(), FLOOR(RAND() * 50) + 10, 'FW-2.1.0', '192.168.1.10'
FROM gate_devices WHERE site_id = @site_hcm_c
ON DUPLICATE KEY UPDATE status = VALUES(status), reported_at = VALUES(reported_at);

-- ============================================================
-- PHASE 18: Sync lane primary device
-- ============================================================
UPDATE gate_lanes gl
LEFT JOIN gate_lane_devices gld ON gld.lane_id = gl.lane_id AND gld.is_primary = 1
SET gl.primary_device_id = COALESCE(gld.device_id, gl.primary_device_id)
WHERE gld.device_id IS NOT NULL
  AND (gl.primary_device_id IS NULL OR gl.primary_device_id <> gld.device_id);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Summary Report
-- ============================================================
SELECT 'SEED DATA COMPLETED SUCCESSFULLY' AS status;
SELECT '========================================' AS '';
SELECT COUNT(*) AS total_sites FROM parking_sites;
SELECT COUNT(*) AS total_users FROM users;
SELECT COUNT(*) AS total_zones FROM zones;
SELECT COUNT(*) AS total_spots FROM spots;
SELECT COUNT(*) AS total_devices FROM gate_devices;
SELECT COUNT(*) AS total_lanes FROM gate_lanes;
SELECT COUNT(*) AS total_customers FROM customers;
SELECT COUNT(*) AS total_vehicles FROM vehicles;
SELECT COUNT(*) AS total_subscriptions FROM subscriptions;
SELECT COUNT(*) AS active_subscriptions FROM subscriptions WHERE status = 'ACTIVE';
SELECT COUNT(*) AS total_tariffs FROM tariffs;
SELECT COUNT(*) AS total_credentials FROM credentials;

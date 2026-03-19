-- Seed MIN dataset (idempotent)
-- PR-03 foundation seed:
--   - 2 sites
--   - each site has 2 physical gates
--   - each gate has ENTRY / EXIT lanes
--   - each lane has CAMERA / RFID / LOOP_SENSOR / BARRIER

INSERT INTO parking_sites(site_code, name, timezone, is_active)
VALUES
  ('SITE_HCM_01', 'Bãi TP.HCM – Cơ sở 01', 'Asia/Ho_Chi_Minh', 1),
  ('SITE_DN_01',  'Bãi Đà Nẵng – Cơ sở 01', 'Asia/Ho_Chi_Minh', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  timezone = VALUES(timezone),
  is_active = VALUES(is_active);

SET @site_hcm_01 := (SELECT site_id FROM parking_sites WHERE site_code = 'SITE_HCM_01' LIMIT 1);
SET @site_dn_01  := (SELECT site_id FROM parking_sites WHERE site_code = 'SITE_DN_01' LIMIT 1);

INSERT INTO gate_devices(site_id, device_code, device_type, direction, location_hint)
VALUES
  (@site_hcm_01, 'GATE_01_ENTRY_CAMERA',  'CAMERA_ALPR', 'ENTRY', 'Gate 01 - ENTRY - Camera'),
  (@site_hcm_01, 'GATE_01_ENTRY_RFID',    'RFID_READER', 'ENTRY', 'Gate 01 - ENTRY - RFID'),
  (@site_hcm_01, 'GATE_01_ENTRY_LOOP',    'LOOP_SENSOR', 'ENTRY', 'Gate 01 - ENTRY - Loop Sensor'),
  (@site_hcm_01, 'GATE_01_ENTRY_BARRIER', 'BARRIER',     'ENTRY', 'Gate 01 - ENTRY - Barrier'),
  (@site_hcm_01, 'GATE_01_EXIT_CAMERA',   'CAMERA_ALPR', 'EXIT',  'Gate 01 - EXIT - Camera'),
  (@site_hcm_01, 'GATE_01_EXIT_RFID',     'RFID_READER', 'EXIT',  'Gate 01 - EXIT - RFID'),
  (@site_hcm_01, 'GATE_01_EXIT_LOOP',     'LOOP_SENSOR', 'EXIT',  'Gate 01 - EXIT - Loop Sensor'),
  (@site_hcm_01, 'GATE_01_EXIT_BARRIER',  'BARRIER',     'EXIT',  'Gate 01 - EXIT - Barrier'),
  (@site_hcm_01, 'GATE_02_ENTRY_CAMERA',  'CAMERA_ALPR', 'ENTRY', 'Gate 02 - ENTRY - Camera'),
  (@site_hcm_01, 'GATE_02_ENTRY_RFID',    'RFID_READER', 'ENTRY', 'Gate 02 - ENTRY - RFID'),
  (@site_hcm_01, 'GATE_02_ENTRY_LOOP',    'LOOP_SENSOR', 'ENTRY', 'Gate 02 - ENTRY - Loop Sensor'),
  (@site_hcm_01, 'GATE_02_ENTRY_BARRIER', 'BARRIER',     'ENTRY', 'Gate 02 - ENTRY - Barrier'),
  (@site_hcm_01, 'GATE_02_EXIT_CAMERA',   'CAMERA_ALPR', 'EXIT',  'Gate 02 - EXIT - Camera'),
  (@site_hcm_01, 'GATE_02_EXIT_RFID',     'RFID_READER', 'EXIT',  'Gate 02 - EXIT - RFID'),
  (@site_hcm_01, 'GATE_02_EXIT_LOOP',     'LOOP_SENSOR', 'EXIT',  'Gate 02 - EXIT - Loop Sensor'),
  (@site_hcm_01, 'GATE_02_EXIT_BARRIER',  'BARRIER',     'EXIT',  'Gate 02 - EXIT - Barrier'),

  (@site_dn_01, 'GATE_01_ENTRY_CAMERA',   'CAMERA_ALPR', 'ENTRY', 'Gate 01 - ENTRY - Camera'),
  (@site_dn_01, 'GATE_01_ENTRY_RFID',     'RFID_READER', 'ENTRY', 'Gate 01 - ENTRY - RFID'),
  (@site_dn_01, 'GATE_01_ENTRY_LOOP',     'LOOP_SENSOR', 'ENTRY', 'Gate 01 - ENTRY - Loop Sensor'),
  (@site_dn_01, 'GATE_01_ENTRY_BARRIER',  'BARRIER',     'ENTRY', 'Gate 01 - ENTRY - Barrier'),
  (@site_dn_01, 'GATE_01_EXIT_CAMERA',    'CAMERA_ALPR', 'EXIT',  'Gate 01 - EXIT - Camera'),
  (@site_dn_01, 'GATE_01_EXIT_RFID',      'RFID_READER', 'EXIT',  'Gate 01 - EXIT - RFID'),
  (@site_dn_01, 'GATE_01_EXIT_LOOP',      'LOOP_SENSOR', 'EXIT',  'Gate 01 - EXIT - Loop Sensor'),
  (@site_dn_01, 'GATE_01_EXIT_BARRIER',   'BARRIER',     'EXIT',  'Gate 01 - EXIT - Barrier'),
  (@site_dn_01, 'GATE_02_ENTRY_CAMERA',   'CAMERA_ALPR', 'ENTRY', 'Gate 02 - ENTRY - Camera'),
  (@site_dn_01, 'GATE_02_ENTRY_RFID',     'RFID_READER', 'ENTRY', 'Gate 02 - ENTRY - RFID'),
  (@site_dn_01, 'GATE_02_ENTRY_LOOP',     'LOOP_SENSOR', 'ENTRY', 'Gate 02 - ENTRY - Loop Sensor'),
  (@site_dn_01, 'GATE_02_ENTRY_BARRIER',  'BARRIER',     'ENTRY', 'Gate 02 - ENTRY - Barrier'),
  (@site_dn_01, 'GATE_02_EXIT_CAMERA',    'CAMERA_ALPR', 'EXIT',  'Gate 02 - EXIT - Camera'),
  (@site_dn_01, 'GATE_02_EXIT_RFID',      'RFID_READER', 'EXIT',  'Gate 02 - EXIT - RFID'),
  (@site_dn_01, 'GATE_02_EXIT_LOOP',      'LOOP_SENSOR', 'EXIT',  'Gate 02 - EXIT - Loop Sensor'),
  (@site_dn_01, 'GATE_02_EXIT_BARRIER',   'BARRIER',     'EXIT',  'Gate 02 - EXIT - Barrier')
ON DUPLICATE KEY UPDATE
  device_type = VALUES(device_type),
  direction = VALUES(direction),
  location_hint = VALUES(location_hint);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
VALUES
  (@site_hcm_01, 'GATE_01', 'GATE_01_ENTRY', 'Gate 01 - ENTRY', 'ENTRY', 'ACTIVE', 10,
    (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_01_ENTRY_RFID' LIMIT 1)),
  (@site_hcm_01, 'GATE_01', 'GATE_01_EXIT',  'Gate 01 - EXIT',  'EXIT',  'ACTIVE', 11,
    (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_01_EXIT_RFID' LIMIT 1)),
  (@site_hcm_01, 'GATE_02', 'GATE_02_ENTRY', 'Gate 02 - ENTRY', 'ENTRY', 'ACTIVE', 20,
    (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_02_ENTRY_RFID' LIMIT 1)),
  (@site_hcm_01, 'GATE_02', 'GATE_02_EXIT',  'Gate 02 - EXIT',  'EXIT',  'ACTIVE', 21,
    (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_02_EXIT_RFID' LIMIT 1)),

  (@site_dn_01, 'GATE_01', 'GATE_01_ENTRY', 'Gate 01 - ENTRY', 'ENTRY', 'ACTIVE', 10,
    (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_01_ENTRY_RFID' LIMIT 1)),
  (@site_dn_01, 'GATE_01', 'GATE_01_EXIT',  'Gate 01 - EXIT',  'EXIT',  'ACTIVE', 11,
    (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_01_EXIT_RFID' LIMIT 1)),
  (@site_dn_01, 'GATE_02', 'GATE_02_ENTRY', 'Gate 02 - ENTRY', 'ENTRY', 'ACTIVE', 20,
    (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_02_ENTRY_RFID' LIMIT 1)),
  (@site_dn_01, 'GATE_02', 'GATE_02_EXIT',  'Gate 02 - EXIT',  'EXIT',  'ACTIVE', 21,
    (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_02_EXIT_RFID' LIMIT 1))
ON DUPLICATE KEY UPDATE
  gate_code = VALUES(gate_code),
  name = VALUES(name),
  direction = VALUES(direction),
  status = VALUES(status),
  sort_order = VALUES(sort_order),
  primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
VALUES
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_01_ENTRY_CAMERA' LIMIT 1),  'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_01_ENTRY_RFID' LIMIT 1),    'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_01_ENTRY_LOOP' LIMIT 1),    'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_01_ENTRY_BARRIER' LIMIT 1), 'BARRIER',     0, 1, 40),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_01_EXIT_CAMERA' LIMIT 1),   'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_01_EXIT_RFID' LIMIT 1),     'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_01_EXIT_LOOP' LIMIT 1),     'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_01_EXIT_BARRIER' LIMIT 1),  'BARRIER',     0, 1, 40),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_02_ENTRY_CAMERA' LIMIT 1),  'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_02_ENTRY_RFID' LIMIT 1),    'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_02_ENTRY_LOOP' LIMIT 1),    'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_02_ENTRY_BARRIER' LIMIT 1), 'BARRIER',     0, 1, 40),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_02_EXIT_CAMERA' LIMIT 1),   'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_02_EXIT_RFID' LIMIT 1),     'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_02_EXIT_LOOP' LIMIT 1),     'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_hcm_01 AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_hcm_01 AND device_code = 'GATE_02_EXIT_BARRIER' LIMIT 1),  'BARRIER',     0, 1, 40),

  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_01_ENTRY_CAMERA' LIMIT 1),  'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_01_ENTRY_RFID' LIMIT 1),    'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_01_ENTRY_LOOP' LIMIT 1),    'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_01_ENTRY_BARRIER' LIMIT 1), 'BARRIER',     0, 1, 40),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_01_EXIT_CAMERA' LIMIT 1),   'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_01_EXIT_RFID' LIMIT 1),     'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_01_EXIT_LOOP' LIMIT 1),     'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_01_EXIT_BARRIER' LIMIT 1),  'BARRIER',     0, 1, 40),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_02_ENTRY_CAMERA' LIMIT 1),  'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_02_ENTRY_RFID' LIMIT 1),    'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_02_ENTRY_LOOP' LIMIT 1),    'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_02_ENTRY_BARRIER' LIMIT 1), 'BARRIER',     0, 1, 40),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_02_EXIT_CAMERA' LIMIT 1),   'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_02_EXIT_RFID' LIMIT 1),     'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_02_EXIT_LOOP' LIMIT 1),     'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_dn_01 AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_dn_01 AND device_code = 'GATE_02_EXIT_BARRIER' LIMIT 1),  'BARRIER',     0, 1, 40)
ON DUPLICATE KEY UPDATE
  device_role = VALUES(device_role),
  is_primary = VALUES(is_primary),
  is_required = VALUES(is_required),
  sort_order = VALUES(sort_order);

-- PR-03 sync: lane aggregate luôn trỏ đúng primary device theo lane-device mapping.
UPDATE gate_lanes gl
LEFT JOIN gate_lane_devices gld
  ON gld.lane_id = gl.lane_id
 AND gld.is_primary = 1
SET gl.primary_device_id = COALESCE(gld.device_id, gl.primary_device_id)
WHERE gld.device_id IS NOT NULL
  AND (gl.primary_device_id IS NULL OR gl.primary_device_id <> gld.device_id);


-- PR08 subscription / VIP seed
INSERT INTO zones(site_id, code, name, vehicle_type)
VALUES
  (@site_hcm_01, 'VIP_A', 'VIP Zone A', 'CAR'),
  (@site_hcm_01, 'GEN_A', 'General Zone A', 'CAR'),
  (@site_dn_01, 'VIP_A', 'VIP Zone A', 'CAR')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  vehicle_type = VALUES(vehicle_type);

INSERT INTO spots(site_id, zone_id, code, status)
VALUES
  (@site_hcm_01, (SELECT zone_id FROM zones WHERE site_id = @site_hcm_01 AND code = 'VIP_A' LIMIT 1), 'HCM-VIP-01', 'FREE'),
  (@site_hcm_01, (SELECT zone_id FROM zones WHERE site_id = @site_hcm_01 AND code = 'VIP_A' LIMIT 1), 'HCM-VIP-02', 'FREE'),
  (@site_hcm_01, (SELECT zone_id FROM zones WHERE site_id = @site_hcm_01 AND code = 'GEN_A' LIMIT 1), 'HCM-GEN-01', 'FREE'),
  (@site_dn_01,  (SELECT zone_id FROM zones WHERE site_id = @site_dn_01  AND code = 'VIP_A' LIMIT 1), 'DN-VIP-01',  'FREE')
ON DUPLICATE KEY UPDATE
  zone_id = VALUES(zone_id),
  status = VALUES(status);

INSERT INTO customers(full_name, phone, email, status)
VALUES
  ('Nguyen Van VIP Active', '0909000001', 'vip.active@parkly.local', 'ACTIVE'),
  ('Nguyen Van VIP Expired', '0909000002', 'vip.expired@parkly.local', 'ACTIVE'),
  ('Nguyen Van VIP Suspended', '0909000003', 'vip.suspended@parkly.local', 'SUSPENDED')
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  status = VALUES(status);

SET @cust_vip_active := (SELECT customer_id FROM customers WHERE email = 'vip.active@parkly.local' LIMIT 1);
SET @cust_vip_expired := (SELECT customer_id FROM customers WHERE email = 'vip.expired@parkly.local' LIMIT 1);
SET @cust_vip_suspended := (SELECT customer_id FROM customers WHERE email = 'vip.suspended@parkly.local' LIMIT 1);

INSERT INTO vehicles(license_plate, vehicle_type, owner_customer_id)
VALUES
  ('51A-12345', 'CAR', @cust_vip_active),
  ('51H-88888', 'CAR', @cust_vip_expired),
  ('43A-99999', 'CAR', @cust_vip_suspended)
ON DUPLICATE KEY UPDATE
  vehicle_type = VALUES(vehicle_type),
  owner_customer_id = VALUES(owner_customer_id);

SET @veh_vip_active := (SELECT vehicle_id FROM vehicles WHERE license_plate = '51A-12345' LIMIT 1);
SET @veh_vip_expired := (SELECT vehicle_id FROM vehicles WHERE license_plate = '51H-88888' LIMIT 1);
SET @veh_vip_suspended := (SELECT vehicle_id FROM vehicles WHERE license_plate = '43A-99999' LIMIT 1);

INSERT INTO subscriptions(site_id, customer_id, plan_type, start_date, end_date, status)
SELECT @site_hcm_01, @cust_vip_active, 'VIP', DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions
  WHERE site_id = @site_hcm_01 AND customer_id = @cust_vip_active AND plan_type = 'VIP'
);

INSERT INTO subscriptions(site_id, customer_id, plan_type, start_date, end_date, status)
SELECT @site_hcm_01, @cust_vip_expired, 'VIP', DATE_SUB(CURDATE(), INTERVAL 90 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'EXPIRED'
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions
  WHERE site_id = @site_hcm_01 AND customer_id = @cust_vip_expired AND plan_type = 'VIP'
);

INSERT INTO subscriptions(site_id, customer_id, plan_type, start_date, end_date, status)
SELECT @site_hcm_01, @cust_vip_suspended, 'VIP', DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'SUSPENDED'
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions
  WHERE site_id = @site_hcm_01 AND customer_id = @cust_vip_suspended AND plan_type = 'VIP'
);

SET @sub_vip_active := (
  SELECT subscription_id FROM subscriptions
  WHERE site_id = @site_hcm_01 AND customer_id = @cust_vip_active AND plan_type = 'VIP'
  ORDER BY subscription_id DESC LIMIT 1
);
SET @sub_vip_expired := (
  SELECT subscription_id FROM subscriptions
  WHERE site_id = @site_hcm_01 AND customer_id = @cust_vip_expired AND plan_type = 'VIP'
  ORDER BY subscription_id DESC LIMIT 1
);
SET @sub_vip_suspended := (
  SELECT subscription_id FROM subscriptions
  WHERE site_id = @site_hcm_01 AND customer_id = @cust_vip_suspended AND plan_type = 'VIP'
  ORDER BY subscription_id DESC LIMIT 1
);

INSERT INTO credentials(site_id, subscription_id, rfid_uid, status)
VALUES
  (@site_hcm_01, @sub_vip_active, 'VIP-HCM-0001', 'ACTIVE'),
  (@site_hcm_01, @sub_vip_expired, 'VIP-HCM-0002', 'BLOCKED'),
  (@site_hcm_01, @sub_vip_suspended, 'VIP-HCM-0003', 'BLOCKED')
ON DUPLICATE KEY UPDATE
  subscription_id = VALUES(subscription_id),
  status = VALUES(status);

INSERT INTO subscription_spots(subscription_id, site_id, spot_id, assigned_mode, status, is_primary, assigned_from, assigned_until, note)
SELECT @sub_vip_active, @site_hcm_01,
       (SELECT spot_id FROM spots WHERE site_id = @site_hcm_01 AND code = 'HCM-VIP-01' LIMIT 1),
       'ASSIGNED', 'ACTIVE', 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'VIP assigned bay active'
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_spots
  WHERE subscription_id = @sub_vip_active
    AND spot_id = (SELECT spot_id FROM spots WHERE site_id = @site_hcm_01 AND code = 'HCM-VIP-01' LIMIT 1)
);

INSERT INTO subscription_spots(subscription_id, site_id, spot_id, assigned_mode, status, is_primary, assigned_from, assigned_until, note)
SELECT @sub_vip_expired, @site_hcm_01,
       (SELECT spot_id FROM spots WHERE site_id = @site_hcm_01 AND code = 'HCM-VIP-02' LIMIT 1),
       'ASSIGNED', 'RELEASED', 1, DATE_SUB(CURDATE(), INTERVAL 90 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Expired VIP bay'
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_spots
  WHERE subscription_id = @sub_vip_expired
    AND spot_id = (SELECT spot_id FROM spots WHERE site_id = @site_hcm_01 AND code = 'HCM-VIP-02' LIMIT 1)
);

INSERT INTO subscription_vehicles(subscription_id, site_id, vehicle_id, plate_compact, status, is_primary, valid_from, valid_to, note)
SELECT @sub_vip_active, @site_hcm_01, @veh_vip_active, '51A12345', 'ACTIVE', 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'VIP active vehicle'
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_vehicles
  WHERE subscription_id = @sub_vip_active AND vehicle_id = @veh_vip_active
);

INSERT INTO subscription_vehicles(subscription_id, site_id, vehicle_id, plate_compact, status, is_primary, valid_from, valid_to, note)
SELECT @sub_vip_expired, @site_hcm_01, @veh_vip_expired, '51H88888', 'SUSPENDED', 1, DATE_SUB(CURDATE(), INTERVAL 90 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Expired VIP vehicle'
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_vehicles
  WHERE subscription_id = @sub_vip_expired AND vehicle_id = @veh_vip_expired
);

INSERT INTO subscription_vehicles(subscription_id, site_id, vehicle_id, plate_compact, status, is_primary, valid_from, valid_to, note)
SELECT @sub_vip_suspended, @site_hcm_01, @veh_vip_suspended, '43A99999', 'SUSPENDED', 1, DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'Suspended VIP vehicle'
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_vehicles
  WHERE subscription_id = @sub_vip_suspended AND vehicle_id = @veh_vip_suspended
);


-- PR13 auth seed: default demo users for real login flow
INSERT INTO roles(role_code, name)
VALUES
  ('ADMIN', 'Administrator'),
  ('OPS', 'Operations'),
  ('GUARD', 'Gate Guard'),
  ('CASHIER', 'Cashier'),
  ('WORKER', 'Worker')
ON DUPLICATE KEY UPDATE
  name = VALUES(name);

INSERT INTO users(username, password_hash, status)
VALUES
  ('admin',   'scrypt$YWRtaW4tcGFya2x5LWF1dG$v5ZS2odLJLr1GDHrejZxSh1dZstnbb3iqRYX44IGSMtt4KZeBjMpVUW57x0j9ZW0WJoSJYA6EEmw2POhKGyb9g', 'ACTIVE'),
  ('ops',     'scrypt$b3BzLXBhcmtseS1hdXRo$cOTE7zsMIfqmrJ3AFmN0axOg9cL4SgQoUA6zLtihczxiNGXfreiY_2_4X_aqTEalxXFxCeqG3LKe2-srXQerCg', 'ACTIVE'),
  ('guard',   'scrypt$Z3VhcmQtcGFya2x5LWF1dG$6eYEhDZ_MDUq4eslooSTPcLWQ85x3AxZxOevjIntrGYvw1tBsTkTSo23duxdS3rqVtE-bB6B4AzAm0md2a9G5Q', 'ACTIVE'),
  ('cashier', 'scrypt$Y2FzaGllci1wYXJrbHktYX$hOlEAwGy5bps3HfGH91vBOZ5mBvlpK2PPnXGG5ItrC9eJvQ4iy5bwbCxMAzqaauCMZhlgSICcVfHFkCUqYy17Q', 'ACTIVE'),
  ('worker',  'scrypt$d29ya2VyLXBhcmtseS1hdX$IDkGhsZe1EBAAb4k0mraG5DRNco7vQ1mpODn0XkFQuIg4DsxahzWGuEEyfEZXlWNxoCVyMaX4oBNLCZCtmU-Zg', 'ACTIVE')
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  status = VALUES(status);

INSERT IGNORE INTO user_roles(user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u
JOIN roles r ON r.role_code = 'ADMIN'
WHERE u.username = 'admin';

INSERT IGNORE INTO user_roles(user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u
JOIN roles r ON r.role_code = 'OPS'
WHERE u.username = 'ops';

INSERT IGNORE INTO user_roles(user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u
JOIN roles r ON r.role_code = 'GUARD'
WHERE u.username = 'guard';

INSERT IGNORE INTO user_roles(user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u
JOIN roles r ON r.role_code = 'CASHIER'
WHERE u.username = 'cashier';

INSERT IGNORE INTO user_roles(user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u
JOIN roles r ON r.role_code = 'WORKER'
WHERE u.username = 'worker';

INSERT IGNORE INTO user_site_scopes(user_id, site_id, scope_level)
SELECT u.user_id, ps.site_id, 'ADMIN'
FROM users u
JOIN parking_sites ps ON ps.site_code IN ('SITE_HCM_01', 'SITE_DN_01')
WHERE u.username = 'admin';

INSERT IGNORE INTO user_site_scopes(user_id, site_id, scope_level)
SELECT u.user_id, ps.site_id, 'MANAGER'
FROM users u
JOIN parking_sites ps ON ps.site_code IN ('SITE_HCM_01', 'SITE_DN_01')
WHERE u.username = 'ops';

INSERT IGNORE INTO user_site_scopes(user_id, site_id, scope_level)
SELECT u.user_id, ps.site_id, 'GUARD'
FROM users u
JOIN parking_sites ps ON ps.site_code = 'SITE_HCM_01'
WHERE u.username = 'guard';

INSERT IGNORE INTO user_site_scopes(user_id, site_id, scope_level)
SELECT u.user_id, ps.site_id, 'CASHIER'
FROM users u
JOIN parking_sites ps ON ps.site_code = 'SITE_HCM_01'
WHERE u.username = 'cashier';

INSERT IGNORE INTO user_site_scopes(user_id, site_id, scope_level)
SELECT u.user_id, ps.site_id, 'MANAGER'
FROM users u
JOIN parking_sites ps ON ps.site_code IN ('SITE_HCM_01', 'SITE_DN_01')
WHERE u.username = 'worker';

-- PR PL-02: Backfill layout metadata for SITE_HCM_01 demo spots
-- floor_key derives from zone; layout_order is sequential within floor row.
-- This seed makes SITE_HCM_01 display a proper grid in Parking Live.
-- Sites without this data fall back to spotCode-based sort in the mapper.

UPDATE spots
SET
  floor_key    = 'F1',
  layout_row   = 1,
  layout_col   = 1,
  layout_order = 1,
  slot_kind    = 'CAR',
  is_reserved  = 1,
  display_label = 'VIP-01'
WHERE site_id = @site_hcm_01
  AND code = 'HCM-VIP-01';

UPDATE spots
SET
  floor_key    = 'F1',
  layout_row   = 1,
  layout_col   = 2,
  layout_order = 2,
  slot_kind    = 'CAR',
  is_reserved  = 1,
  display_label = 'VIP-02'
WHERE site_id = @site_hcm_01
  AND code = 'HCM-VIP-02';

UPDATE spots
SET
  floor_key    = 'F2',
  layout_row   = 1,
  layout_col   = 1,
  layout_order = 1,
  slot_kind    = 'CAR',
  is_reserved  = 0,
  display_label = 'GEN-01'
WHERE site_id = @site_hcm_01
  AND code = 'HCM-GEN-01';

UPDATE spots
SET
  floor_key    = 'F1',
  layout_row   = 1,
  layout_col   = 1,
  layout_order = 1,
  slot_kind    = 'CAR',
  is_reserved  = 1,
  display_label = 'DN-VIP-01'
WHERE site_id = @site_dn_01
  AND code = 'DN-VIP-01';

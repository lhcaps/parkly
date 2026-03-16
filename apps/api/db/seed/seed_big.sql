-- Seed BIG dataset (DEV/DEMO ONLY)
-- Goals:
--   - ensure PR-03 lane foundation exists
--   - create 20k tickets + payments
--   - create 100k gate_events
--   - create a small outbox batch
--
-- Notes:
--   - run with admin creds
--   - safe to run repeatedly

-- ========== 0) Ensure multi-site + lane foundation ==========
INSERT INTO parking_sites(site_code, name, timezone, is_active)
VALUES
  ('SITE_HCM_01', 'Bai HCM - Co so 01', 'Asia/Ho_Chi_Minh', 1),
  ('SITE_DN_01',  'Bai Da Nang - Co so 01', 'Asia/Ho_Chi_Minh', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  timezone = VALUES(timezone),
  is_active = VALUES(is_active);

SET @site_id    := (SELECT site_id FROM parking_sites WHERE site_code = 'SITE_HCM_01' LIMIT 1);
SET @site_id_dn := (SELECT site_id FROM parking_sites WHERE site_code = 'SITE_DN_01' LIMIT 1);

INSERT INTO gate_devices(site_id, device_code, device_type, direction, location_hint)
VALUES
  (@site_id, 'GATE_01_ENTRY_CAMERA',  'CAMERA_ALPR', 'ENTRY', 'Gate 01 - ENTRY - Camera'),
  (@site_id, 'GATE_01_ENTRY_RFID',    'RFID_READER', 'ENTRY', 'Gate 01 - ENTRY - RFID'),
  (@site_id, 'GATE_01_ENTRY_LOOP',    'LOOP_SENSOR', 'ENTRY', 'Gate 01 - ENTRY - Loop Sensor'),
  (@site_id, 'GATE_01_ENTRY_BARRIER', 'BARRIER',     'ENTRY', 'Gate 01 - ENTRY - Barrier'),
  (@site_id, 'GATE_01_EXIT_CAMERA',   'CAMERA_ALPR', 'EXIT',  'Gate 01 - EXIT - Camera'),
  (@site_id, 'GATE_01_EXIT_RFID',     'RFID_READER', 'EXIT',  'Gate 01 - EXIT - RFID'),
  (@site_id, 'GATE_01_EXIT_LOOP',     'LOOP_SENSOR', 'EXIT',  'Gate 01 - EXIT - Loop Sensor'),
  (@site_id, 'GATE_01_EXIT_BARRIER',  'BARRIER',     'EXIT',  'Gate 01 - EXIT - Barrier'),
  (@site_id, 'GATE_02_ENTRY_CAMERA',  'CAMERA_ALPR', 'ENTRY', 'Gate 02 - ENTRY - Camera'),
  (@site_id, 'GATE_02_ENTRY_RFID',    'RFID_READER', 'ENTRY', 'Gate 02 - ENTRY - RFID'),
  (@site_id, 'GATE_02_ENTRY_LOOP',    'LOOP_SENSOR', 'ENTRY', 'Gate 02 - ENTRY - Loop Sensor'),
  (@site_id, 'GATE_02_ENTRY_BARRIER', 'BARRIER',     'ENTRY', 'Gate 02 - ENTRY - Barrier'),
  (@site_id, 'GATE_02_EXIT_CAMERA',   'CAMERA_ALPR', 'EXIT',  'Gate 02 - EXIT - Camera'),
  (@site_id, 'GATE_02_EXIT_RFID',     'RFID_READER', 'EXIT',  'Gate 02 - EXIT - RFID'),
  (@site_id, 'GATE_02_EXIT_LOOP',     'LOOP_SENSOR', 'EXIT',  'Gate 02 - EXIT - Loop Sensor'),
  (@site_id, 'GATE_02_EXIT_BARRIER',  'BARRIER',     'EXIT',  'Gate 02 - EXIT - Barrier'),
  (@site_id_dn, 'GATE_01_ENTRY_CAMERA',  'CAMERA_ALPR', 'ENTRY', 'Gate 01 - ENTRY - Camera'),
  (@site_id_dn, 'GATE_01_ENTRY_RFID',    'RFID_READER', 'ENTRY', 'Gate 01 - ENTRY - RFID'),
  (@site_id_dn, 'GATE_01_ENTRY_LOOP',    'LOOP_SENSOR', 'ENTRY', 'Gate 01 - ENTRY - Loop Sensor'),
  (@site_id_dn, 'GATE_01_ENTRY_BARRIER', 'BARRIER',     'ENTRY', 'Gate 01 - ENTRY - Barrier'),
  (@site_id_dn, 'GATE_01_EXIT_CAMERA',   'CAMERA_ALPR', 'EXIT',  'Gate 01 - EXIT - Camera'),
  (@site_id_dn, 'GATE_01_EXIT_RFID',     'RFID_READER', 'EXIT',  'Gate 01 - EXIT - RFID'),
  (@site_id_dn, 'GATE_01_EXIT_LOOP',     'LOOP_SENSOR', 'EXIT',  'Gate 01 - EXIT - Loop Sensor'),
  (@site_id_dn, 'GATE_01_EXIT_BARRIER',  'BARRIER',     'EXIT',  'Gate 01 - EXIT - Barrier'),
  (@site_id_dn, 'GATE_02_ENTRY_CAMERA',  'CAMERA_ALPR', 'ENTRY', 'Gate 02 - ENTRY - Camera'),
  (@site_id_dn, 'GATE_02_ENTRY_RFID',    'RFID_READER', 'ENTRY', 'Gate 02 - ENTRY - RFID'),
  (@site_id_dn, 'GATE_02_ENTRY_LOOP',    'LOOP_SENSOR', 'ENTRY', 'Gate 02 - ENTRY - Loop Sensor'),
  (@site_id_dn, 'GATE_02_ENTRY_BARRIER', 'BARRIER',     'ENTRY', 'Gate 02 - ENTRY - Barrier'),
  (@site_id_dn, 'GATE_02_EXIT_CAMERA',   'CAMERA_ALPR', 'EXIT',  'Gate 02 - EXIT - Camera'),
  (@site_id_dn, 'GATE_02_EXIT_RFID',     'RFID_READER', 'EXIT',  'Gate 02 - EXIT - RFID'),
  (@site_id_dn, 'GATE_02_EXIT_LOOP',     'LOOP_SENSOR', 'EXIT',  'Gate 02 - EXIT - Loop Sensor'),
  (@site_id_dn, 'GATE_02_EXIT_BARRIER',  'BARRIER',     'EXIT',  'Gate 02 - EXIT - Barrier')
ON DUPLICATE KEY UPDATE
  device_type = VALUES(device_type),
  direction = VALUES(direction),
  location_hint = VALUES(location_hint);

INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order, primary_device_id)
VALUES
  (@site_id, 'GATE_01', 'GATE_01_ENTRY', 'Gate 01 - ENTRY', 'ENTRY', 'ACTIVE', 10, (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_01_ENTRY_RFID' LIMIT 1)),
  (@site_id, 'GATE_01', 'GATE_01_EXIT',  'Gate 01 - EXIT',  'EXIT',  'ACTIVE', 11, (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_01_EXIT_RFID' LIMIT 1)),
  (@site_id, 'GATE_02', 'GATE_02_ENTRY', 'Gate 02 - ENTRY', 'ENTRY', 'ACTIVE', 20, (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_02_ENTRY_RFID' LIMIT 1)),
  (@site_id, 'GATE_02', 'GATE_02_EXIT',  'Gate 02 - EXIT',  'EXIT',  'ACTIVE', 21, (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_02_EXIT_RFID' LIMIT 1)),
  (@site_id_dn, 'GATE_01', 'GATE_01_ENTRY', 'Gate 01 - ENTRY', 'ENTRY', 'ACTIVE', 10, (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_01_ENTRY_RFID' LIMIT 1)),
  (@site_id_dn, 'GATE_01', 'GATE_01_EXIT',  'Gate 01 - EXIT',  'EXIT',  'ACTIVE', 11, (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_01_EXIT_RFID' LIMIT 1)),
  (@site_id_dn, 'GATE_02', 'GATE_02_ENTRY', 'Gate 02 - ENTRY', 'ENTRY', 'ACTIVE', 20, (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_02_ENTRY_RFID' LIMIT 1)),
  (@site_id_dn, 'GATE_02', 'GATE_02_EXIT',  'Gate 02 - EXIT',  'EXIT',  'ACTIVE', 21, (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_02_EXIT_RFID' LIMIT 1))
ON DUPLICATE KEY UPDATE
  gate_code = VALUES(gate_code),
  name = VALUES(name),
  direction = VALUES(direction),
  status = VALUES(status),
  sort_order = VALUES(sort_order),
  primary_device_id = VALUES(primary_device_id);

INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
VALUES
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_01_ENTRY_CAMERA' LIMIT 1),  'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_01_ENTRY_RFID' LIMIT 1),    'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_01_ENTRY_LOOP' LIMIT 1),    'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_01_ENTRY_BARRIER' LIMIT 1), 'BARRIER',     0, 1, 40),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_01_EXIT_CAMERA' LIMIT 1),   'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_01_EXIT_RFID' LIMIT 1),     'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_01_EXIT_LOOP' LIMIT 1),     'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_01_EXIT_BARRIER' LIMIT 1),  'BARRIER',     0, 1, 40),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_02_ENTRY_CAMERA' LIMIT 1),  'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_02_ENTRY_RFID' LIMIT 1),    'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_02_ENTRY_LOOP' LIMIT 1),    'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_02_ENTRY_BARRIER' LIMIT 1), 'BARRIER',     0, 1, 40),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_02_EXIT_CAMERA' LIMIT 1),   'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_02_EXIT_RFID' LIMIT 1),     'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_02_EXIT_LOOP' LIMIT 1),     'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id AND device_code = 'GATE_02_EXIT_BARRIER' LIMIT 1),  'BARRIER',     0, 1, 40),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_01_ENTRY_CAMERA' LIMIT 1),  'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_01_ENTRY_RFID' LIMIT 1),    'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_01_ENTRY_LOOP' LIMIT 1),    'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_01_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_01_ENTRY_BARRIER' LIMIT 1), 'BARRIER',     0, 1, 40),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_01_EXIT_CAMERA' LIMIT 1),   'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_01_EXIT_RFID' LIMIT 1),     'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_01_EXIT_LOOP' LIMIT 1),     'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_01_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_01_EXIT_BARRIER' LIMIT 1),  'BARRIER',     0, 1, 40),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_02_ENTRY_CAMERA' LIMIT 1),  'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_02_ENTRY_RFID' LIMIT 1),    'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_02_ENTRY_LOOP' LIMIT 1),    'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_02_ENTRY' LIMIT 1), (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_02_ENTRY_BARRIER' LIMIT 1), 'BARRIER',     0, 1, 40),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_02_EXIT_CAMERA' LIMIT 1),   'CAMERA',      0, 1, 10),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_02_EXIT_RFID' LIMIT 1),     'RFID',        1, 1, 20),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_02_EXIT_LOOP' LIMIT 1),     'LOOP_SENSOR', 0, 1, 30),
  ((SELECT lane_id FROM gate_lanes WHERE site_id = @site_id_dn AND lane_code = 'GATE_02_EXIT' LIMIT 1),  (SELECT device_id FROM gate_devices WHERE site_id = @site_id_dn AND device_code = 'GATE_02_EXIT_BARRIER' LIMIT 1),  'BARRIER',     0, 1, 40)
ON DUPLICATE KEY UPDATE
  device_role = VALUES(device_role),
  is_primary = VALUES(is_primary),
  is_required = VALUES(is_required),
  sort_order = VALUES(sort_order);

SELECT device_id INTO @dev_entry
FROM gate_devices
WHERE site_id = @site_id AND device_code = 'GATE_01_ENTRY_RFID'
LIMIT 1;

SELECT device_id INTO @dev_exit
FROM gate_devices
WHERE site_id = @site_id AND device_code = 'GATE_01_EXIT_RFID'
LIMIT 1;

-- ========== 0.5) Cleanup previous SEED ==========
DELETE FROM gate_event_outbox
WHERE site_id = @site_id
  AND JSON_EXTRACT(payload_json, '$.seed') = true;

DELETE FROM gate_events
WHERE site_id = @site_id
  AND idempotency_key LIKE 'SEED_EVT_%';

DELETE p
FROM payments p
JOIN tickets t ON t.ticket_id = p.ticket_id
WHERE t.site_id = @site_id
  AND t.ticket_code LIKE 'SEED_T%';

DELETE FROM tickets
WHERE site_id = @site_id
  AND ticket_code LIKE 'SEED_T%';

DELETE FROM vehicles
WHERE license_plate LIKE 'SEED_PLATE_%';

DELETE FROM customers
WHERE email LIKE 'seed_%@example.com';

-- ========== 1) Customers (5k) ==========
INSERT INTO customers(full_name, phone, email, status, created_at)
SELECT
  CONCAT('Seed Customer ', LPAD(n, 5, '0')),
  CONCAT('SEED_PHONE_', LPAD(n, 5, '0')),
  CONCAT('seed_', LPAD(n, 5, '0'), '@example.com'),
  'ACTIVE',
  NOW()
FROM (
  SELECT (d1.d + 10*d2.d + 100*d3.d + 1000*d4.d + 10000*d5.d) + 1 AS n
  FROM (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d1
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d2
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d3
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d4
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d5
) t
WHERE n BETWEEN 1 AND 5000
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  phone = VALUES(phone),
  email = VALUES(email),
  status = VALUES(status);

-- ========== 2) Vehicles (20k) ==========
INSERT INTO vehicles(license_plate, vehicle_type, owner_customer_id, created_at)
SELECT
  CONCAT('SEED_PLATE_', LPAD(n, 6, '0')) AS license_plate,
  CASE WHEN MOD(n, 2) = 0 THEN 'CAR' ELSE 'MOTORBIKE' END AS vehicle_type,
  c.customer_id,
  NOW()
FROM (
  SELECT (d1.d + 10*d2.d + 100*d3.d + 1000*d4.d + 10000*d5.d) + 1 AS n
  FROM (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d1
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d2
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d3
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d4
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d5
) t
JOIN customers c
  ON c.email = CONCAT('seed_', LPAD(MOD(n - 1, 5000) + 1, 5, '0'), '@example.com')
WHERE n BETWEEN 1 AND 20000
ON DUPLICATE KEY UPDATE
  vehicle_type = VALUES(vehicle_type),
  owner_customer_id = VALUES(owner_customer_id);

-- ========== 3) Tickets CLOSED (20k) ==========
INSERT INTO tickets(site_id, ticket_code, vehicle_id, credential_id, entry_time, exit_time, status)
SELECT
  @site_id,
  CONCAT('SEED_T', LPAD(n, 8, '0')),
  v.vehicle_id,
  NULL,
  TIMESTAMP('2026-02-01 00:00:00') + INTERVAL n MINUTE,
  TIMESTAMP('2026-02-01 00:00:00') + INTERVAL n MINUTE + INTERVAL (5 + MOD(n, 180)) MINUTE,
  'CLOSED'
FROM (
  SELECT (d1.d + 10*d2.d + 100*d3.d + 1000*d4.d + 10000*d5.d) + 1 AS n
  FROM (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d1
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d2
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d3
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d4
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d5
) t
JOIN vehicles v
  ON v.license_plate = CONCAT('SEED_PLATE_', LPAD(t.n, 6, '0'))
WHERE t.n BETWEEN 1 AND 20000
ON DUPLICATE KEY UPDATE
  vehicle_id = VALUES(vehicle_id),
  entry_time = VALUES(entry_time),
  exit_time = VALUES(exit_time),
  status = VALUES(status);

-- ========== 4) Payments (20k) ==========
INSERT INTO payments(site_id, ticket_id, amount, method, status, paid_at)
SELECT
  @site_id,
  t.ticket_id,
  (10000 + MOD(t.ticket_id, 41) * 1000) AS amount,
  CASE MOD(t.ticket_id, 3)
    WHEN 0 THEN 'CASH'
    WHEN 1 THEN 'CARD'
    ELSE 'EWALLET'
  END AS method,
  'PAID',
  t.exit_time
FROM tickets t
WHERE t.site_id = @site_id
  AND t.ticket_code LIKE 'SEED_T%'
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.ticket_id = t.ticket_id
      AND p.status = 'PAID'
  );

-- ========== 5) gate_events (100k) ==========
INSERT INTO gate_events(
  site_id, device_id, direction, event_time,
  rfid_uid, license_plate_raw, image_url, ticket_id, idempotency_key
)
SELECT
  @site_id,
  CASE WHEN MOD(n, 2) = 0 THEN @dev_entry ELSE @dev_exit END,
  CASE WHEN MOD(n, 2) = 0 THEN 'ENTRY' ELSE 'EXIT' END,
  TIMESTAMP('2026-02-01 00:00:00') + INTERVAL n SECOND,
  CONCAT('SEED_UID_', LPAD(MOD(n, 5000) + 1, 5, '0')),
  CONCAT('SEED_PLATE_', LPAD(MOD(n, 20000) + 1, 6, '0')),
  NULL,
  NULL,
  CONCAT('SEED_EVT_', LPAD(n, 6, '0'))
FROM (
  SELECT (d1.d + 10*d2.d + 100*d3.d + 1000*d4.d + 10000*d5.d) AS n
  FROM (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d1
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d2
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d3
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d4
  CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d5
) t
WHERE n BETWEEN 0 AND 99999
ON DUPLICATE KEY UPDATE
  device_id = VALUES(device_id),
  direction = VALUES(direction),
  rfid_uid = VALUES(rfid_uid),
  license_plate_raw = VALUES(license_plate_raw),
  image_url = VALUES(image_url),
  ticket_id = VALUES(ticket_id);

-- ========== 6) Create a small outbox batch (50 rows) ==========
INSERT INTO gate_event_outbox(site_id, event_id, event_time, payload_json, status, attempts, created_at, next_retry_at)
SELECT
  ge.site_id,
  ge.event_id,
  ge.event_time,
  JSON_OBJECT(
    'seed', TRUE,
    'mysql_event_id', ge.event_id,
    'site_id', ge.site_id,
    'event_time', DATE_FORMAT(ge.event_time, '%Y-%m-%d %H:%i:%s'),
    'direction', ge.direction
  ) AS payload_json,
  'PENDING' AS status,
  0 AS attempts,
  NOW() AS created_at,
  NULL AS next_retry_at
FROM gate_events ge
WHERE ge.site_id = @site_id
  AND ge.idempotency_key LIKE 'SEED_EVT_%'
ORDER BY ge.event_id DESC
LIMIT 50
ON DUPLICATE KEY UPDATE
  payload_json = VALUES(payload_json),
  status = VALUES(status),
  attempts = VALUES(attempts),
  next_retry_at = VALUES(next_retry_at);

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


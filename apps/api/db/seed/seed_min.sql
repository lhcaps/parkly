-- Seed MIN dataset (idempotent)
-- PR-03 foundation seed:
--   - 2 sites
--   - each site has 2 physical gates
--   - each gate has ENTRY / EXIT lanes
--   - each lane has CAMERA / RFID / LOOP_SENSOR / BARRIER

INSERT INTO parking_sites(site_code, name, timezone, is_active)
VALUES
  ('SITE_HCM_01', 'Bai HCM - Co so 01', 'Asia/Ho_Chi_Minh', 1),
  ('SITE_DN_01',  'Bai Da Nang - Co so 01', 'Asia/Ho_Chi_Minh', 1)
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

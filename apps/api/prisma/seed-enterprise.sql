-- =========================================================================
-- PARKLY ENTERPRISE SEED (SPEC V9.2 COMPATIBLE - FULL MULTI-SITE TOPOLOGY)
-- Wipe, reset, and populate realistic live data for all 3 Class-A Sites
-- =========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ========== 0) WIPE OUT OLD DATA ==========
TRUNCATE TABLE payments;
TRUNCATE TABLE gate_passage_sessions;
TRUNCATE TABLE gate_read_events;
TRUNCATE TABLE tickets;
TRUNCATE TABLE gate_event_outbox;
TRUNCATE TABLE gate_active_presence;
TRUNCATE TABLE gate_lane_devices;
TRUNCATE TABLE gate_lanes;
TRUNCATE TABLE gate_devices;
TRUNCATE TABLE subscription_spots;
TRUNCATE TABLE subscription_vehicles;
TRUNCATE TABLE subscriptions;
TRUNCATE TABLE credentials;
TRUNCATE TABLE vehicles;
TRUNCATE TABLE spots;
TRUNCATE TABLE zones;
TRUNCATE TABLE customers;
TRUNCATE TABLE parking_sites;

-- ========== 1) MASTER DATA: SITES ==========
INSERT INTO parking_sites(site_code, name, timezone, is_active, created_at)
VALUES
  ('SITE_HCM_BITEXCO', 'Bitexco Financial Tower - Quận 1, TP.HCM', 'Asia/Ho_Chi_Minh', 1, NOW()),
  ('SITE_HN_LOTTE', 'Lotte Center - Ba Đình, Hà Nội', 'Asia/Ho_Chi_Minh', 1, NOW()),
  ('SITE_DN_VINCOM', 'Vincom Plaza - Sơn Trà, Đà Nẵng', 'Asia/Ho_Chi_Minh', 1, NOW());

SET @site_hcm := (SELECT site_id FROM parking_sites WHERE site_code = 'SITE_HCM_BITEXCO' LIMIT 1);
SET @site_hn  := (SELECT site_id FROM parking_sites WHERE site_code = 'SITE_HN_LOTTE'  LIMIT 1);
SET @site_dn  := (SELECT site_id FROM parking_sites WHERE site_code = 'SITE_DN_VINCOM' LIMIT 1);

-- ========== 2) ZONES & SPOTS (PHÂN BỔ CHUYÊN NGHIỆP CHO 3 SITE) ==========
INSERT INTO zones(site_id, code, name, vehicle_type)
VALUES
  -- HCM
  (@site_hcm, 'HCM_B1_VIP',  'Hầm B1 - Khu VIP (Ô tô)',        'CAR'),
  (@site_hcm, 'HCM_B2_REG',  'Hầm B2 - Khách Vãng Lai (Ô tô)',  'CAR'),
  (@site_hcm, 'HCM_B3_MOTO', 'Hầm B3 - Khu Xe Máy',             'MOTORBIKE'),
  -- HN
  (@site_hn,  'HN_B1_VIP',   'Hầm B1 - Khu VIP (Ô tô)',         'CAR'),
  (@site_hn,  'HN_B2_REG',   'Hầm B2 - Khách Vãng Lai (Ô tô)',  'CAR'),
  (@site_hn,  'HN_B3_MOTO',  'Hầm B3 - Khu Xe Máy',             'MOTORBIKE'),
  (@site_hn,  'HN_B4_MOTO',  'Hầm B4 - Khu Xe Máy (Bổ sung)',   'MOTORBIKE'),
  -- DN
  (@site_dn,  'DN_B1_CAR',   'Hầm B1 - Khu Ô tô',               'CAR'),
  (@site_dn,  'DN_B2_MOTO',  'Hầm B2 - Khu Xe Máy',             'MOTORBIKE');

-- Tạo Spots đại diện cho Parking Live Board (Mỗi site 3 chỗ)
INSERT INTO spots(site_id, zone_id, code, status, floor_key, layout_row, layout_col)
VALUES
  -- Spots HCM
  (@site_hcm, (SELECT zone_id FROM zones WHERE code = 'HCM_B1_VIP'), 'HCM-VIP-01', 'FREE', 'B1', 1, 1),
  (@site_hcm, (SELECT zone_id FROM zones WHERE code = 'HCM_B1_VIP'), 'HCM-VIP-02', 'OCCUPIED', 'B1', 1, 2),
  (@site_hcm, (SELECT zone_id FROM zones WHERE code = 'HCM_B2_REG'), 'HCM-REG-01', 'FREE', 'B2', 1, 1),
  -- Spots HN
  (@site_hn, (SELECT zone_id FROM zones WHERE code = 'HN_B1_VIP'), 'HN-VIP-01', 'OCCUPIED', 'B1', 1, 1),
  (@site_hn, (SELECT zone_id FROM zones WHERE code = 'HN_B1_VIP'), 'HN-VIP-02', 'FREE', 'B1', 1, 2),
  (@site_hn, (SELECT zone_id FROM zones WHERE code = 'HN_B2_REG'), 'HN-REG-01', 'FREE', 'B2', 1, 1),
  -- Spots DN
  (@site_dn, (SELECT zone_id FROM zones WHERE code = 'DN_B1_CAR'), 'DN-CAR-01', 'FREE', 'B1', 1, 1),
  (@site_dn, (SELECT zone_id FROM zones WHERE code = 'DN_B1_CAR'), 'DN-CAR-02', 'OCCUPIED', 'B1', 1, 2),
  (@site_dn, (SELECT zone_id FROM zones WHERE code = 'DN_B1_CAR'), 'DN-CAR-03', 'FREE', 'B1', 1, 3);


-- ========== 3) TOPOLOGY: GATES & LANES (PHÂN LUỒNG THỰC TẾ) ==========
INSERT INTO gate_lanes(site_id, gate_code, lane_code, name, direction, status, sort_order)
VALUES
  -- BITEXCO HCM: 2 Cổng (Phân luồng cứng)
  (@site_hcm, 'GATE_HAI_TRIEU',   'HCM_HT_IN_CAR',   'VÀO - Ô tô (Hải Triều)',     'ENTRY', 'ACTIVE', 1),
  (@site_hcm, 'GATE_HAI_TRIEU',   'HCM_HT_OUT_CAR',  'RA - Ô tô (Hải Triều)',      'EXIT',  'ACTIVE', 2),
  (@site_hcm, 'GATE_HO_TUNG_MAU', 'HCM_HTM_IN_MOTO', 'VÀO - Xe máy (Hồ Tùng Mậu)', 'ENTRY', 'ACTIVE', 3),
  (@site_hcm, 'GATE_HO_TUNG_MAU', 'HCM_HTM_OUT_MOTO','RA - Xe máy (Hồ Tùng Mậu)',  'EXIT',  'ACTIVE', 4),
  
  -- LOTTE HN: 2 Cổng (Mặt trước Ô tô, Mặt bên Xe máy)
  (@site_hn, 'GATE_DAO_TAN',   'HN_DT_IN_CAR',   'VÀO - Ô tô (Đào Tấn)',          'ENTRY', 'ACTIVE', 1),
  (@site_hn, 'GATE_DAO_TAN',   'HN_DT_OUT_CAR',  'RA - Ô tô (Đào Tấn)',           'EXIT',  'ACTIVE', 2),
  (@site_hn, 'GATE_LIEU_GIAI', 'HN_LG_IN_MOTO',  'VÀO - Xe máy (Liễu Giai)',      'ENTRY', 'ACTIVE', 3),
  (@site_hn, 'GATE_LIEU_GIAI', 'HN_LG_OUT_MOTO', 'RA - Xe máy (Liễu Giai)',       'EXIT',  'ACTIVE', 4),

  -- VINCOM ĐN: 2 Cổng (Trước/Sau)
  (@site_dn, 'GATE_NGO_QUYEN', 'DN_NQ_IN_MIX',   'VÀO - Hỗn hợp (Ngô Quyền)',     'ENTRY', 'ACTIVE', 1),
  (@site_dn, 'GATE_NGO_QUYEN', 'DN_NQ_OUT_MIX',  'RA - Hỗn hợp (Ngô Quyền)',      'EXIT',  'ACTIVE', 2),
  (@site_dn, 'GATE_TRAN_PHU',  'DN_TP_IN_MOTO',  'VÀO - Xe máy (Trần Phú)',       'ENTRY', 'ACTIVE', 3),
  (@site_dn, 'GATE_TRAN_PHU',  'DN_TP_OUT_MOTO', 'RA - Xe máy (Trần Phú)',        'EXIT',  'ACTIVE', 4);

-- Cài đặt thiết bị mẫu cho Làn Ô tô VÀO/RA của cả 3 Site (để phục vụ Live Dashboard)
INSERT INTO gate_devices(site_id, device_code, device_type, direction, location_hint)
VALUES
  (@site_hcm, 'CAM_HCM_IN_CAR',  'CAMERA_ALPR', 'ENTRY', 'Cam Biển số HCM'),
  (@site_hcm, 'BAR_HCM_IN_CAR',  'BARRIER',     'ENTRY', 'Barrier HCM'),
  (@site_hcm, 'CAM_HCM_OUT_CAR', 'CAMERA_ALPR', 'EXIT',  'Cam Biển số HCM'),
  (@site_hcm, 'BAR_HCM_OUT_CAR', 'BARRIER',     'EXIT',  'Barrier HCM'),

  (@site_hn,  'CAM_HN_IN_CAR',   'CAMERA_ALPR', 'ENTRY', 'Cam Biển số HN'),
  (@site_hn,  'BAR_HN_IN_CAR',   'BARRIER',     'ENTRY', 'Barrier HN'),
  (@site_hn,  'CAM_HN_OUT_CAR',  'CAMERA_ALPR', 'EXIT',  'Cam Biển số HN'),
  (@site_hn,  'BAR_HN_OUT_CAR',  'BARRIER',     'EXIT',  'Barrier HN'),

  (@site_dn,  'CAM_DN_IN_MIX',   'CAMERA_ALPR', 'ENTRY', 'Cam Biển số ĐN'),
  (@site_dn,  'BAR_DN_IN_MIX',   'BARRIER',     'ENTRY', 'Barrier ĐN'),
  (@site_dn,  'CAM_DN_OUT_MIX',  'CAMERA_ALPR', 'EXIT',  'Cam Biển số ĐN'),
  (@site_dn,  'BAR_DN_OUT_MIX',  'BARRIER',     'EXIT',  'Barrier ĐN');

-- Mapping Device vào Lane
-- HCM
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'PRIMARY', 1, 1, 1 FROM gate_lanes l JOIN gate_devices d ON d.site_id = l.site_id AND d.device_code = 'CAM_HCM_IN_CAR' WHERE l.lane_code = 'HCM_HT_IN_CAR';
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'PRIMARY', 1, 1, 1 FROM gate_lanes l JOIN gate_devices d ON d.site_id = l.site_id AND d.device_code = 'CAM_HCM_OUT_CAR' WHERE l.lane_code = 'HCM_HT_OUT_CAR';

-- HN
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'PRIMARY', 1, 1, 1 FROM gate_lanes l JOIN gate_devices d ON d.site_id = l.site_id AND d.device_code = 'CAM_HN_IN_CAR' WHERE l.lane_code = 'HN_DT_IN_CAR';
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'PRIMARY', 1, 1, 1 FROM gate_lanes l JOIN gate_devices d ON d.site_id = l.site_id AND d.device_code = 'CAM_HN_OUT_CAR' WHERE l.lane_code = 'HN_DT_OUT_CAR';

-- DN
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'PRIMARY', 1, 1, 1 FROM gate_lanes l JOIN gate_devices d ON d.site_id = l.site_id AND d.device_code = 'CAM_DN_IN_MIX' WHERE l.lane_code = 'DN_NQ_IN_MIX';
INSERT INTO gate_lane_devices(lane_id, device_id, device_role, is_primary, is_required, sort_order)
SELECT l.lane_id, d.device_id, 'PRIMARY', 1, 1, 1 FROM gate_lanes l JOIN gate_devices d ON d.site_id = l.site_id AND d.device_code = 'CAM_DN_OUT_MIX' WHERE l.lane_code = 'DN_NQ_OUT_MIX';


-- ========== 4) CUSTOMERS & VIP VEHICLES ==========
INSERT INTO customers(full_name, phone, email, status)
VALUES
  ('Tập đoàn Vingroup',           '02439749999', 'contact@vingroup.net', 'ACTIVE'),
  ('Ngân hàng TMCP Ngoại thương', '1900545413',  'support@vietcombank.com.vn', 'ACTIVE'),
  ('Công ty CP FPT',              '02473007300', 'admin@fpt.com.vn', 'ACTIVE');

SET @cust_vin := (SELECT customer_id FROM customers WHERE email = 'contact@vingroup.net' LIMIT 1);
SET @cust_vcb := (SELECT customer_id FROM customers WHERE email = 'support@vietcombank.com.vn' LIMIT 1);

INSERT INTO vehicles(license_plate, vehicle_type, owner_customer_id)
VALUES
  ('30G-999.99', 'CAR', @cust_vin),
  ('51H-123.45', 'CAR', @cust_vin),
  ('29A-888.88', 'CAR', @cust_vcb);

-- ========== 5) GENERATE REALISTIC LIVE DATA FOR DASHBOARDS (CROSS-SITE) ==========
-- Sinh 600 records chia cho 3 miền (HCM 50%, HN 30%, DN 20%)
DROP TABLE IF EXISTS _temp_nums;
CREATE TABLE _temp_nums (n INT PRIMARY KEY);
INSERT INTO _temp_nums(n)
SELECT a.N + b.N * 10 + c.N * 100
FROM (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
     (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b,
     (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) c;

-- Sinh biển số vãng lai
INSERT INTO vehicles(license_plate, vehicle_type, owner_customer_id)
SELECT
  CONCAT(
    CASE MOD(n, 3) WHEN 0 THEN '51F-' WHEN 1 THEN '30E-' ELSE '43A-' END, 
    LPAD(MOD(n * 137, 99999), 5, '0')
  ),
  'CAR',
  NULL
FROM _temp_nums
WHERE n BETWEEN 1 AND 600;

-- 5.1 Tickets (Phân bổ Data: HCM = 0->299, HN = 300->479, DN = 480->600)
INSERT INTO tickets(site_id, ticket_code, vehicle_id, credential_id, entry_time, exit_time, status)
SELECT
  CASE
    WHEN n < 300 THEN @site_hcm
    WHEN n < 480 THEN @site_hn
    ELSE @site_dn
  END,
  CONCAT('TK-', DATE_FORMAT(NOW() - INTERVAL n * 25 MINUTE, '%y%m%d'), '-', LPAD(n, 4, '0')),
  (SELECT vehicle_id FROM vehicles WHERE license_plate = CONCAT(CASE MOD(n, 3) WHEN 0 THEN '51F-' WHEN 1 THEN '30E-' ELSE '43A-' END, LPAD(MOD(n * 137, 99999), 5, '0')) LIMIT 1),
  NULL,
  NOW() - INTERVAL n * 25 MINUTE,
  NOW() - INTERVAL n * 25 MINUTE + INTERVAL (45 + MOD(n, 240)) MINUTE,
  'CLOSED'
FROM _temp_nums
WHERE n BETWEEN 1 AND 600;

-- 5.2 Payments
INSERT INTO payments(site_id, ticket_id, amount, method, status, paid_at)
SELECT
  site_id,
  ticket_id,
  (20000 + MOD(n * 137, 4) * 10000),
  CASE MOD(n * 137, 10)
    WHEN 0 THEN 'CASH'
    WHEN 1 THEN 'CASH'
    WHEN 2 THEN 'CARD'
    ELSE 'EWALLET'
  END,
  'PAID',
  exit_time
FROM (
  SELECT ticket_id, site_id, exit_time, ROW_NUMBER() OVER (ORDER BY ticket_id) AS n
  FROM tickets WHERE status = 'CLOSED'
) t;

-- 5.3 Sessions ENTRY (Auto-map tới Lane IN tương ứng của từng Site)
INSERT INTO gate_passage_sessions(site_id, lane_id, direction, status, ticket_id, plate_compact, opened_at, last_read_at, resolved_at, closed_at)
SELECT
  t.site_id,
  CASE t.site_id 
    WHEN @site_hcm THEN (SELECT lane_id FROM gate_lanes WHERE lane_code = 'HCM_HT_IN_CAR')
    WHEN @site_hn  THEN (SELECT lane_id FROM gate_lanes WHERE lane_code = 'HN_DT_IN_CAR')
    ELSE                (SELECT lane_id FROM gate_lanes WHERE lane_code = 'DN_NQ_IN_MIX')
  END,
  'ENTRY',
  'PASSED',
  t.ticket_id,
  v.license_plate,
  t.entry_time,
  t.entry_time + INTERVAL 1 SECOND,
  t.entry_time + INTERVAL 2 SECOND,
  t.entry_time + INTERVAL 5 SECOND
FROM tickets t
JOIN vehicles v ON v.vehicle_id = t.vehicle_id
WHERE t.status = 'CLOSED';

-- 5.4 Sessions EXIT (Auto-map tới Lane OUT tương ứng của từng Site)
INSERT INTO gate_passage_sessions(site_id, lane_id, direction, status, ticket_id, plate_compact, opened_at, last_read_at, resolved_at, closed_at)
SELECT
  t.site_id,
  CASE t.site_id 
    WHEN @site_hcm THEN (SELECT lane_id FROM gate_lanes WHERE lane_code = 'HCM_HT_OUT_CAR')
    WHEN @site_hn  THEN (SELECT lane_id FROM gate_lanes WHERE lane_code = 'HN_DT_OUT_CAR')
    ELSE                (SELECT lane_id FROM gate_lanes WHERE lane_code = 'DN_NQ_OUT_MIX')
  END,
  'EXIT',
  'PASSED',
  t.ticket_id,
  v.license_plate,
  t.exit_time,
  t.exit_time + INTERVAL 2 SECOND,
  t.exit_time + INTERVAL 3 SECOND,
  t.exit_time + INTERVAL 6 SECOND
FROM tickets t
JOIN vehicles v ON v.vehicle_id = t.vehicle_id
WHERE t.status = 'CLOSED';

DROP TABLE _temp_nums;
SET FOREIGN_KEY_CHECKS = 1;
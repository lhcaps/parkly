-- ============================================================
-- V31: Seed Data for Enhanced Tariff Pricing System
-- Seed data cho Bảng giá Vãng lai và Bảng giá Thuê bao
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- PHASE 1: Update existing tariffs with new metadata
-- ============================================================

SET @site_hcm_c := (SELECT site_id FROM parking_sites WHERE site_code = 'PARK_HCM_CENTRAL' LIMIT 1);

UPDATE tariffs SET
    zone_code = NULL,
    description = 'Gia ap dung cho khach gui xe vang lai (lay ve ngay)',
    short_code = 'HOURLY_CAR',
    display_order = 1,
    is_default = TRUE,
    requires_subscription = FALSE,
    grace_period_minutes = 15,
    max_duration_hours = 72
WHERE name = 'Gia Gi - O To Thuc';

UPDATE tariffs SET
    zone_code = NULL,
    description = 'Gia ap dung cho khach gui xe may vang lai',
    short_code = 'HOURLY_MOTO',
    display_order = 2,
    is_default = TRUE,
    requires_subscription = FALSE,
    grace_period_minutes = 15,
    max_duration_hours = 72
WHERE name = 'Gia Gi - Xe My';

UPDATE tariffs SET
    zone_code = 'VIP_PLATINUM',
    description = 'Goi VIP Platinum - Gui xe o to tai khu VIP Platinum. Gan co dinh 1 bien so vao 1 vi tri.',
    short_code = 'VIP_PLATINUM',
    display_order = 10,
    is_default = FALSE,
    requires_subscription = TRUE,
    grace_period_minutes = 0,
    max_duration_hours = NULL
WHERE name = 'Goi VIP - O To Platinum';

UPDATE tariffs SET
    zone_code = 'VIP_GOLD',
    description = 'Goi VIP Gold - Gui xe o to tai khu VIP Gold. Gan co dinh 1 bien so vao 1 vi tri.',
    short_code = 'VIP_GOLD',
    display_order = 9,
    is_default = FALSE,
    requires_subscription = TRUE,
    grace_period_minutes = 0,
    max_duration_hours = NULL
WHERE name = 'Goi VIP - O To Gold';

-- ============================================================
-- PHASE 2: Create new tariffs
-- ============================================================

-- 2.1: Tariff for Motorbike - Daytime (06:00 - 18:00)
INSERT INTO tariffs(site_id, name, applies_to, vehicle_type, zone_code, description, short_code, display_order, is_default, requires_subscription, grace_period_minutes, max_duration_hours, is_active, valid_from, metadata_json)
VALUES
  (@site_hcm_c, 'Motorbike - Ban Ngay (06:00-18:00)', 'TICKET', 'MOTORBIKE', NULL, 
   'Gia xe may ban ngay - Block 4 gio dau tien', 'MOTO_DAY', 3, FALSE, FALSE, 0, 24, TRUE, NOW(),
   '{"time_range":{"start":"06:00","end":"18:00"},"billing_unit":"BLOCK_4HOURS","block_size_hours":4,"rate_per_block":5000,"max_blocks":6}')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2.2: Tariff for Motorbike - Nighttime (18:00 - 06:00)
INSERT INTO tariffs(site_id, name, applies_to, vehicle_type, zone_code, description, short_code, display_order, is_default, requires_subscription, grace_period_minutes, max_duration_hours, is_active, valid_from, metadata_json)
VALUES
  (@site_hcm_c, 'Motorbike - Ban Dem (18:00-06:00)', 'TICKET', 'MOTORBIKE', NULL, 
   'Gia xe may ban dem - Per entry', 'MOTO_NIGHT', 4, FALSE, FALSE, 0, 24, TRUE, NOW(),
   '{"time_range":{"start":"18:00","end":"06:00"},"billing_unit":"PER_ENTRY","flat_rate":10000}')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2.3: Tariff for Car - Standard (First 2 hours)
INSERT INTO tariffs(site_id, name, applies_to, vehicle_type, zone_code, description, short_code, display_order, is_default, requires_subscription, grace_period_minutes, max_duration_hours, is_active, valid_from, metadata_json)
VALUES
  (@site_hcm_c, 'Car - Tieu Chuon (Block 2h dau)', 'TICKET', 'CAR', 'REGULAR_FLOOR1', 
   'Gia o to tieu chuan - Block 2 gio dau tien', 'CAR_STD_2H', 5, TRUE, FALSE, 15, 72, TRUE, NOW(),
   '{"time_range":{"start":"00:00","end":"23:59"},"billing_unit":"FIRST_BLOCK","block_size_hours":2,"rate_per_block":35000,"progressive_after_block":true}')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2.4: Tariff for Car - Progressive (After first 2 hours)
INSERT INTO tariffs(site_id, name, applies_to, vehicle_type, zone_code, description, short_code, display_order, is_default, requires_subscription, grace_period_minutes, max_duration_hours, is_active, valid_from, metadata_json)
VALUES
  (@site_hcm_c, 'Car - Lu Tiến (Sau Block 2h)', 'TICKET', 'CAR', 'REGULAR_FLOOR1', 
   'Gia o to luu tien - Moi 1 gio tiep theo', 'CAR_PROG_1H', 6, FALSE, FALSE, 0, 72, TRUE, NOW(),
   '{"time_range":{"start":"00:00","end":"23:59"},"billing_unit":"PROGRESSIVE_HOURLY","block_size_hours":1,"rate_per_block":20000,"requires_base_tariff":true,"base_tariff_min_hours":2}')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2.5: Tariff for Car - Overnight Surcharge
INSERT INTO tariffs(site_id, name, applies_to, vehicle_type, zone_code, description, short_code, display_order, is_default, requires_subscription, grace_period_minutes, max_duration_hours, is_active, valid_from, metadata_json)
VALUES
  (@site_hcm_c, 'Car - Phu Thu Qua Dem', 'TICKET', 'CAR', NULL, 
   'Phu thu gui xe qua dem (18:00 - 06:00)', 'CAR_OVERNIGHT', 7, FALSE, FALSE, 0, 72, TRUE, NOW(),
   '{"time_range":{"start":"18:00","end":"06:00"},"billing_unit":"SURCHARGE","flat_surcharge":50000,"surcharge_type":"OVERNIGHT","applies_to":"PER_NIGHT"}')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2.6: Motorbike Standard Commuter Subscription
INSERT INTO tariffs(site_id, name, applies_to, vehicle_type, zone_code, description, short_code, display_order, is_default, requires_subscription, grace_period_minutes, max_duration_hours, is_active, valid_from, metadata_json)
VALUES
  (@site_hcm_c, 'Motorbike - Standard Commuter', 'SUBSCRIPTION', 'MOTORBIKE', 'MOTORBIKE_A', 
   'Goi xe may Standard - Gui khong gioi han tai Zone Motorbike',
   'MOTO_STD', 20, TRUE, TRUE, 0, NULL, TRUE, NOW(),
   '{"billing_period":"MONTHLY","monthly_rate":200000,"zone_restriction":"MOTORBIKE_A","unlimited_parking":true,"spot_assignment":"FLOATING","max_vehicles":1}')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2.7: Car Regular Monthly - Floating Spot
INSERT INTO tariffs(site_id, name, applies_to, vehicle_type, zone_code, description, short_code, display_order, is_default, requires_subscription, grace_period_minutes, max_duration_hours, is_active, valid_from, metadata_json)
VALUES
  (@site_hcm_c, 'Car - Regular Monthly (Floating)', 'SUBSCRIPTION', 'CAR', 'REGULAR_FLOOR1', 
   'Goi o to Regular - Gui linh hoat (floating spot) tai Regular Zone',
   'CAR_REG_FLT', 21, TRUE, TRUE, 0, NULL, TRUE, NOW(),
   '{"billing_period":"MONTHLY","monthly_rate":2500000,"zone_restriction":"REGULAR_FLOOR1,REGULAR_FLOOR2","unlimited_parking":true,"spot_assignment":"FLOATING","max_vehicles":2}')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2.8: Car VIP Dedicated - Fixed Spot
INSERT INTO tariffs(site_id, name, applies_to, vehicle_type, zone_code, description, short_code, display_order, is_default, requires_subscription, grace_period_minutes, max_duration_hours, is_active, valid_from, metadata_json)
VALUES
  (@site_hcm_c, 'Car - VIP Dedicated (Fixed)', 'SUBSCRIPTION', 'CAR', 'VIP_PLATINUM', 
   'Goi VIP Dedicated - Gan cung bien so vao 1 vi tri co dinh tai VIP Zone',
   'CAR_VIP_FIX', 22, FALSE, TRUE, 0, NULL, TRUE, NOW(),
   '{"billing_period":"MONTHLY","monthly_rate":3500000,"zone_restriction":"VIP_PLATINUM,VIP_GOLD","unlimited_parking":true,"spot_assignment":"FIXED","max_vehicles":1}')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================================
-- PHASE 3: Create Tariff Rules
-- ============================================================

SET @tariff_moto_day := (SELECT tariff_id FROM tariffs WHERE short_code = 'MOTO_DAY' LIMIT 1);
SET @tariff_moto_night := (SELECT tariff_id FROM tariffs WHERE short_code = 'MOTO_NIGHT' LIMIT 1);
SET @tariff_car_std := (SELECT tariff_id FROM tariffs WHERE short_code = 'CAR_STD_2H' LIMIT 1);
SET @tariff_car_prog := (SELECT tariff_id FROM tariffs WHERE short_code = 'CAR_PROG_1H' LIMIT 1);
SET @tariff_car_overnight := (SELECT tariff_id FROM tariffs WHERE short_code = 'CAR_OVERNIGHT' LIMIT 1);
SET @tariff_moto_std := (SELECT tariff_id FROM tariffs WHERE short_code = 'MOTO_STD' LIMIT 1);
SET @tariff_car_reg_flt := (SELECT tariff_id FROM tariffs WHERE short_code = 'CAR_REG_FLT' LIMIT 1);
SET @tariff_car_vip_fix := (SELECT tariff_id FROM tariffs WHERE short_code = 'CAR_VIP_FIX' LIMIT 1);

-- MOTORBIKE DAYTIME RULES
INSERT INTO tariff_rules(tariff_id, rule_code, rule_type, zone_code, time_range_json, priority, param_json)
VALUES
  (@tariff_moto_day, 'MOTO_DAY_GRACE', 'FREE_MINUTES', NULL, 
   '{"start_hour":6,"end_hour":18,"days_of_week":[1,2,3,4,5,6,7]}',
   10,
   '{"free_minutes":15,"description":"15 phut mien phi drop-off"}'),
  
  (@tariff_moto_day, 'MOTO_DAY_BLOCK4H', 'HOURLY', NULL, 
   '{"start_hour":6,"end_hour":18,"days_of_week":[1,2,3,4,5,6,7]}',
   20,
   '{"block_size_hours":4,"rate_per_block":5000,"billing":"BLOCK"}'),
  
  (@tariff_moto_day, 'MOTO_DAY_CAP', 'DAILY_CAP', NULL, NULL,
   90,
   '{"max_daily_rate":30000,"description":"Gia tran ban ngay"}');

-- MOTORBIKE NIGHTTIME RULES
INSERT INTO tariff_rules(tariff_id, rule_code, rule_type, zone_code, time_range_json, priority, param_json)
VALUES
  (@tariff_moto_night, 'MOTO_NIGHT_FLAT', 'FLAT_RATE', NULL, 
   '{"start_hour":18,"end_hour":6,"days_of_week":[1,2,3,4,5,6,7]}',
   20,
   '{"flat_rate":10000,"billing":"PER_ENTRY","description":"Phi qua dem co dinh"}');

-- CAR STANDARD RULES
INSERT INTO tariff_rules(tariff_id, rule_code, rule_type, zone_code, time_range_json, priority, param_json)
VALUES
  (@tariff_car_std, 'CAR_STD_GRACE', 'FREE_MINUTES', 'REGULAR_FLOOR1', 
   '{"start_hour":0,"end_hour":23,"days_of_week":[1,2,3,4,5,6,7]}',
   10,
   '{"free_minutes":15,"description":"15 phut mien phi drop-off"}'),
  
  (@tariff_car_std, 'CAR_STD_2H', 'DURATION_BLOCK', 'REGULAR_FLOOR1', 
   '{"start_hour":0,"end_hour":23,"days_of_week":[1,2,3,4,5,6,7]}',
   20,
   '{"block_size_hours":2,"rate":35000,"description":"Block 2 gio dau tien"}'),
  
  (@tariff_car_std, 'CAR_STD_CAP', 'DAILY_CAP', NULL, NULL,
   90,
   '{"max_daily_rate":200000,"description":"Gia tran 200k/ngay - tran 24h bi luy tien"}');

-- CAR PROGRESSIVE RULES
INSERT INTO tariff_rules(tariff_id, rule_code, rule_type, zone_code, time_range_json, priority, param_json)
VALUES
  (@tariff_car_prog, 'CAR_PROG_HOURLY', 'PROGRESSION_RATE', 'REGULAR_FLOOR1', 
   '{"start_hour":0,"end_hour":23,"days_of_week":[1,2,3,4,5,6,7]}',
   20,
   '{"block_size_hours":1,"rate":20000,"description":"20k/gio tiep theo"}'),
  
  (@tariff_car_prog, 'CAR_PROG_CAP', 'DAILY_CAP', NULL, NULL,
   90,
   '{"max_daily_rate":200000,"description":"Gia tran 200k/ngay"}');

-- CAR OVERNIGHT SURCHARGE
INSERT INTO tariff_rules(tariff_id, rule_code, rule_type, zone_code, time_range_json, priority, param_json, is_stackable)
VALUES
  (@tariff_car_overnight, 'CAR_OVERNIGHT_SUR', 'OVERNIGHT_SURCHARGE', NULL, 
   '{"start_hour":18,"end_hour":6,"days_of_week":[1,2,3,4,5,6,7]}',
   30,
   '{"surcharge":50000,"description":"Phu thu qua dem 50k"}',
   TRUE);

-- SUBSCRIPTION RULES - MOTORBIKE STANDARD
INSERT INTO tariff_rules(tariff_id, rule_code, rule_type, zone_code, priority, param_json)
VALUES
  (@tariff_moto_std, 'MOTO_STD_UNLIMITED', 'SUBSCRIPTION_UNLIMITED', 'MOTORBIKE_A', 10,
   '{"unlimited_entries":true,"zone_restriction":"MOTORBIKE_A,MOTORBIKE_B"}'),
  (@tariff_moto_std, 'MOTO_STD_FLEXIBLE', 'SPOT_ASSIGNMENT_FLEXIBLE', 'MOTORBIKE_A', 20,
   '{"spot_mode":"FLOATING","description":"Khong co dinh vi tri"}');

-- SUBSCRIPTION RULES - CAR REGULAR MONTHLY
INSERT INTO tariff_rules(tariff_id, rule_code, rule_type, zone_code, priority, param_json)
VALUES
  (@tariff_car_reg_flt, 'CAR_REG_UNLIMITED', 'SUBSCRIPTION_UNLIMITED', 'REGULAR_FLOOR1', 10,
   '{"unlimited_entries":true,"zone_restriction":"REGULAR_FLOOR1,REGULAR_FLOOR2"}'),
  (@tariff_car_reg_flt, 'CAR_REG_FLEXIBLE', 'SPOT_ASSIGNMENT_FLEXIBLE', 'REGULAR_FLOOR1', 20,
   '{"spot_mode":"FLOATING","description":"Floating spot for car regular"}');

-- SUBSCRIPTION RULES - CAR VIP DEDICATED
INSERT INTO tariff_rules(tariff_id, rule_code, rule_type, zone_code, priority, param_json)
VALUES
  (@tariff_car_vip_fix, 'CAR_VIP_FIXED', 'SUBSCRIPTION_FIXED', 'VIP_PLATINUM', 10,
   '{"spot_mode":"FIXED","description":"Fixed 1 spot VIP"}'),
  (@tariff_car_vip_fix, 'CAR_VIP_PRIORITY', 'SUBSCRIPTION_PRIORITY', 'VIP_PLATINUM', 20,
   '{"priority_level":"HIGH","description":"High priority access"}');

-- ============================================================
-- PHASE 4: Holiday Calendar
-- ============================================================
INSERT INTO holiday_calendar(site_id, holiday_date, holiday_name, holiday_type, multiplier, flat_surcharge, is_active, apply_to_subscriptions, description)
VALUES
  (@site_hcm_c, '2026-01-01', 'Tet Duong Lich', 'NATIONAL', 1.50, 0, TRUE, FALSE, 'Tang 50% gia vang lai'),
  (@site_hcm_c, '2026-04-30', 'Ngay Thong Nhat', 'NATIONAL', 1.50, 0, TRUE, FALSE, 'Tang 50% gia vang lai'),
  (@site_hcm_c, '2026-05-01', 'Ngay Quoc Te Lao Dong', 'NATIONAL', 1.50, 0, TRUE, FALSE, 'Tang 50% gia vang lai'),
  (@site_hcm_c, '2026-09-02', 'Ngay Quoc Khanh', 'NATIONAL', 1.50, 0, TRUE, FALSE, 'Tang 50% gia vang lai'),
  (@site_hcm_c, '2026-01-28', 'Giao Thua Tet Nguyen Dan', 'NATIONAL', 1.20, 20000, TRUE, FALSE, 'Tang 20% + phu thu 20k'),
  (@site_hcm_c, '2026-01-29', 'Mung 1 Tet Nguyen Dan', 'NATIONAL', 1.20, 20000, TRUE, FALSE, 'Tang 20% + phu thu 20k'),
  (@site_hcm_c, '2026-01-30', 'Mung 2 Tet Nguyen Dan', 'NATIONAL', 1.20, 20000, TRUE, FALSE, 'Tang 20% + phu thu 20k'),
  (@site_hcm_c, '2026-01-31', 'Mung 3 Tet Nguyen Dan', 'NATIONAL', 1.20, 0, TRUE, FALSE, 'Tang 20%'),
  (@site_hcm_c, '2026-02-01', 'Mung 4 Tet Nguyen Dan', 'NATIONAL', 1.20, 0, TRUE, FALSE, 'Tang 20%'),
  (@site_hcm_c, '2026-02-02', 'Mung 5 Tet Nguyen Dan', 'NATIONAL', 1.20, 0, TRUE, FALSE, 'Tang 20%')
ON DUPLICATE KEY UPDATE holiday_name = VALUES(holiday_name), multiplier = VALUES(multiplier);

-- ============================================================
-- PHASE 5: Lost Credential Fees
-- ============================================================
INSERT INTO lost_credential_fees(site_id, vehicle_type, base_penalty, include_parking_fee, max_penalty, grace_period_hours, require_verification, evidence_required)
VALUES
  (@site_hcm_c, 'MOTORBIKE', 50000, TRUE, 200000, 0, TRUE, FALSE),
  (@site_hcm_c, 'CAR', 100000, TRUE, 500000, 0, TRUE, TRUE)
ON DUPLICATE KEY UPDATE base_penalty = VALUES(base_penalty);

-- ============================================================
-- PHASE 6: Discount Rules
-- ============================================================
INSERT INTO discount_rules(tariff_id, site_id, discount_code, discount_name, discount_type, discount_value, min_parking_duration_minutes, max_discount, valid_from, valid_until, is_active, stackable)
VALUES
  (NULL, @site_hcm_c, 'EARLYBIRD', 'Early Bird Discount - Giam 10% cho khach den truoc 8h sang', 
   'PERCENTAGE', 10, 0, 50000, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), TRUE, FALSE),
  
  (NULL, @site_hcm_c, 'LONGSTAY', 'Long Stay - Giam 15% cho khach gui > 8 gio', 
   'PERCENTAGE', 15, 480, 100000, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), TRUE, TRUE),
  
  (NULL, @site_hcm_c, 'NEWCUSTOMER', 'Khach hang moi - Mien phi 2 gio dau', 
   'FREE_HOURS', 2, 0, NULL, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), TRUE, FALSE),
  
  (NULL, @site_hcm_c, 'WEEKEND', 'Weekend Special - Giam 20% cuoi tuan', 
   'PERCENTAGE', 20, 0, 100000, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), TRUE, TRUE)
ON DUPLICATE KEY UPDATE discount_name = VALUES(discount_name);

-- ============================================================
-- PHASE 7: Special Pricing Periods
-- ============================================================
INSERT INTO special_pricing_periods(site_id, tariff_id, period_name, period_type, start_date, end_date, start_time, end_time, days_of_week, rate_multiplier, flat_surcharge, priority, is_active, is_recurring)
VALUES
  (@site_hcm_c, NULL, 'Gio Cao Diem Sang', 'PEAK', '2026-01-01', '2026-12-31', '07:00:00', '09:00:00', '[1,2,3,4,5]', 1.10, 0, 50, TRUE, TRUE),
  
  (@site_hcm_c, NULL, 'Gio Cao Diem Chieu', 'PEAK', '2026-01-01', '2026-12-31', '17:00:00', '19:00:00', '[1,2,3,4,5]', 1.10, 0, 50, TRUE, TRUE),
  
  (@site_hcm_c, NULL, 'Gio Thap Diem Trua', 'OFF_PEAK', '2026-01-01', '2026-12-31', '10:00:00', '15:00:00', '[1,2,3,4,5]', 0.90, 0, 40, TRUE, TRUE),
  
  (@site_hcm_c, NULL, 'Cuoi Tuan', 'WEEKEND', '2026-01-01', '2026-12-31', '00:00:00', '23:59:00', '[6,7]', 0.95, 0, 30, TRUE, TRUE)
ON DUPLICATE KEY UPDATE period_name = VALUES(period_name);

-- ============================================================
-- PHASE 8: Tariff Zones mapping
-- ============================================================
INSERT INTO tariff_zones(tariff_id, zone_code, zone_id, is_primary, rate_multiplier, flat_addition, spot_assignment_mode, priority, is_active)
SELECT 
    t.tariff_id,
    z.code,
    z.zone_id,
    CASE WHEN z.code = 'VIP_PLATINUM' THEN TRUE ELSE FALSE END,
    CASE 
        WHEN z.code = 'VIP_PLATINUM' THEN 1.50
        WHEN z.code = 'VIP_GOLD' THEN 1.30
        WHEN z.code = 'VIP_PREMIUM' THEN 1.40
        ELSE 1.00
    END,
    CASE 
        WHEN z.code = 'VIP_PLATINUM' THEN 50000
        WHEN z.code = 'VIP_GOLD' THEN 30000
        ELSE 0
    END,
    CASE 
        WHEN z.code LIKE 'VIP%' THEN 'FIXED'
        ELSE 'FLOATING'
    END,
    CASE 
        WHEN z.code = 'VIP_PLATINUM' THEN 100
        WHEN z.code = 'VIP_GOLD' THEN 90
        WHEN z.code = 'VIP_PREMIUM' THEN 95
        WHEN z.code LIKE 'REGULAR%' THEN 50
        WHEN z.code LIKE 'MOTORBIKE%' THEN 30
        ELSE 10
    END,
    TRUE
FROM tariffs t
CROSS JOIN zones z
WHERE t.site_id = @site_hcm_c AND z.site_id = @site_hcm_c
ON DUPLICATE KEY UPDATE rate_multiplier = VALUES(rate_multiplier);

-- ============================================================
-- PHASE 9: Vehicle Type Overrides
-- ============================================================
INSERT INTO vehicle_type_overrides(tariff_id, vehicle_type, override_name, multiplier_override, conditions_json, priority, is_active)
SELECT 
    t.tariff_id,
    'CAR',
    'Electric Vehicle Discount',
    0.80,
    '{"vehicle_attribute":"is_electric","value":true}',
    100,
    TRUE
FROM tariffs t
WHERE t.short_code = 'CAR_STD_2H'
ON DUPLICATE KEY UPDATE multiplier_override = VALUES(multiplier_override);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Verification Summary
-- ============================================================
SELECT '========================================' AS '';
SELECT 'TARIFF PRICING SYSTEM SEED COMPLETED' AS status;
SELECT '========================================' AS '';

SELECT '--- Tariffs ---' AS '';
SELECT tariff_id, name, short_code, applies_to, vehicle_type, is_default, grace_period_minutes 
FROM tariffs WHERE is_active = TRUE ORDER BY display_order;

SELECT '--- Tariff Rules Summary ---' AS '';
SELECT t.name AS tariff, COUNT(tr.rule_id) AS rules_count
FROM tariffs t
LEFT JOIN tariff_rules tr ON tr.tariff_id = t.tariff_id
WHERE t.is_active = TRUE
GROUP BY t.tariff_id, t.name
ORDER BY t.display_order;

SELECT '--- Holiday Calendar (2026) ---' AS '';
SELECT holiday_date, holiday_name, holiday_type, multiplier, flat_surcharge 
FROM holiday_calendar 
WHERE holiday_date >= '2026-01-01' AND holiday_date <= '2026-12-31'
ORDER BY holiday_date;

SELECT '--- Lost Credential Fees ---' AS '';
SELECT vehicle_type, base_penalty, include_parking_fee, max_penalty
FROM lost_credential_fees WHERE site_id = @site_hcm_c;

SELECT '--- Discount Rules ---' AS '';
SELECT discount_code, discount_name, discount_type, discount_value, max_discount, is_active
FROM discount_rules WHERE is_active = TRUE;

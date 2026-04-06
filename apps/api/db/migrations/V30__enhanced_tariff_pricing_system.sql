-- ============================================================
-- V30: Enhanced Tariff Pricing System (Fixed)
-- 
-- Chỉ tạo các bảng còn thiếu và cập nhật enum values
-- Các cột đã được thêm từ Prisma schema
-- ============================================================

-- ============================================================
-- SECTION 1: Tạo bảng holiday_calendar (nếu chưa có)
-- ============================================================
CREATE TABLE IF NOT EXISTS holiday_calendar (
    holiday_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    site_id BIGINT NOT NULL COMMENT 'Site áp dụng (NULL = tất cả sites)',
    holiday_date DATE NOT NULL COMMENT 'Ngày lễ',
    holiday_name VARCHAR(255) NOT NULL COMMENT 'Tên ngày lễ',
    holiday_type ENUM('NATIONAL', 'REGIONAL', 'SPECIAL', 'CUSTOM') DEFAULT 'NATIONAL' COMMENT 'Loại ngày lễ',
    multiplier DECIMAL(4,2) DEFAULT 1.00 COMMENT 'Hệ số nhân giá (VD: 1.20 = +20%)',
    flat_surcharge DECIMAL(12,2) DEFAULT 0 COMMENT 'Phụ thu cố định (VND)',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Có đang active không',
    apply_to_subscriptions BOOLEAN DEFAULT FALSE COMMENT 'Áp dụng cho subscriptions không',
    description TEXT NULL COMMENT 'Mô tả',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
    
    UNIQUE KEY uq_holiday_site_date (site_id, holiday_date),
    INDEX ix_holiday_date (holiday_date),
    INDEX ix_holiday_type (holiday_type),
    INDEX ix_holiday_active (is_active, holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch ngày lễ và sự kiện đặc biệt';

-- ============================================================
-- SECTION 2: Tạo bảng special_pricing_periods (nếu chưa có)
-- ============================================================
CREATE TABLE IF NOT EXISTS special_pricing_periods (
    period_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    site_id BIGINT NOT NULL COMMENT 'Site ID',
    tariff_id BIGINT NULL COMMENT 'Tariff ID (NULL = áp dụng cho tất cả)',
    period_name VARCHAR(255) NOT NULL COMMENT 'Tên gọi (VD: Giờ cao điểm)',
    period_type ENUM('PEAK', 'OFF_PEAK', 'NIGHT', 'WEEKEND', 'SPECIAL', 'CUSTOM') DEFAULT 'CUSTOM' COMMENT 'Loại period',
    start_date DATE NOT NULL COMMENT 'Ngày bắt đầu',
    end_date DATE NOT NULL COMMENT 'Ngày kết thúc',
    start_time TIME NOT NULL COMMENT 'Giờ bắt đầu trong ngày',
    end_time TIME NOT NULL COMMENT 'Giờ kết thúc trong ngày',
    days_of_week VARCHAR(255) NULL COMMENT 'Ngày trong tuần (1,2,3,4,5,6,7)',
    rate_multiplier DECIMAL(4,2) DEFAULT 1.00 COMMENT 'Hệ số nhân giá',
    flat_surcharge DECIMAL(12,2) DEFAULT 0 COMMENT 'Phụ thu cố định',
    absolute_rate DECIMAL(12,2) NULL COMMENT 'Giá tuyệt đối (NULL = dùng multiplier)',
    priority INT DEFAULT 0 COMMENT 'Ưu tiên (số càng cao càng được ưu tiên)',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Có đang active không',
    is_recurring BOOLEAN DEFAULT FALSE COMMENT 'Có lặp lại hàng năm không',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
    
    INDEX ix_periods_site (site_id),
    INDEX ix_periods_tariff (tariff_id),
    INDEX ix_periods_dates (start_date, end_date),
    INDEX ix_periods_active (is_active, start_date, end_date),
    INDEX ix_periods_recurring (is_recurring, period_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Các khoảng thời gian tính giá đặc biệt';

-- ============================================================
-- SECTION 3: Tạo bảng lost_credential_fees (nếu chưa có)
-- ============================================================
CREATE TABLE IF NOT EXISTS lost_credential_fees (
    fee_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    site_id BIGINT NOT NULL COMMENT 'Site ID',
    vehicle_type ENUM('MOTORBIKE', 'CAR', 'ALL') NOT NULL DEFAULT 'ALL' COMMENT 'Loại xe',
    base_penalty DECIMAL(12,2) NOT NULL COMMENT 'Tiền phạt cơ bản (VND)',
    include_parking_fee BOOLEAN DEFAULT TRUE COMMENT 'Bao gồm tiền gửi xe không',
    max_penalty DECIMAL(12,2) NULL COMMENT 'Tiền phạt tối đa (NULL = không giới hạn)',
    grace_period_hours INT DEFAULT 0 COMMENT 'Thời gian ân hạn trước khi phạt (hours)',
    require_verification BOOLEAN DEFAULT TRUE COMMENT 'Yêu cầu xác minh không',
    evidence_required BOOLEAN DEFAULT FALSE COMMENT 'Yêu cầu bằng chứng không',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
    
    INDEX ix_lost_fee_site_vehicle (site_id, vehicle_type),
    INDEX ix_lost_fee_active (site_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phí mất thẻ/vé cho từng loại xe';

-- ============================================================
-- SECTION 4: Tạo bảng vehicle_type_overrides (nếu chưa có)
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicle_type_overrides (
    override_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tariff_id BIGINT NOT NULL COMMENT 'Tariff ID gốc',
    vehicle_type ENUM('MOTORBIKE', 'CAR') NOT NULL COMMENT 'Loại xe override',
    override_name VARCHAR(255) NOT NULL COMMENT 'Tên override',
    rate_override DECIMAL(12,2) NULL COMMENT 'Giá override (NULL = dùng base rate)',
    multiplier_override DECIMAL(4,2) NULL COMMENT 'Multiplier override (NULL = dùng base)',
    max_duration_override INT NULL COMMENT 'Max duration override',
    grace_period_override INT NULL COMMENT 'Grace period override',
    conditions_json VARCHAR(255) NULL COMMENT 'Điều kiện áp dụng override',
    priority INT DEFAULT 0 COMMENT 'Ưu tiên khi có nhiều override',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Có đang active không',
    effective_from DATE NULL COMMENT 'Ngày bắt đầu hiệu lực',
    effective_until DATE NULL COMMENT 'Ngày kết thúc hiệu lực',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
    
    UNIQUE KEY uq_override_tariff_vehicle (tariff_id, vehicle_type),
    INDEX ix_override_tariff (tariff_id),
    INDEX ix_override_active (is_active, effective_from, effective_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Override rates cho từng loại xe';

-- ============================================================
-- SECTION 5: Tạo bảng discount_rules (nếu chưa có)
-- ============================================================
CREATE TABLE IF NOT EXISTS discount_rules (
    discount_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tariff_id BIGINT NULL COMMENT 'Tariff ID (NULL = áp dụng global)',
    site_id BIGINT NULL COMMENT 'Site ID (NULL = tất cả)',
    discount_code VARCHAR(64) UNIQUE COMMENT 'Mã giảm giá',
    discount_name VARCHAR(255) NOT NULL COMMENT 'Tên chương trình giảm giá',
    discount_type ENUM('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_MINUTES', 'FREE_HOURS', 'MULTIPLIER') NOT NULL DEFAULT 'PERCENTAGE' COMMENT 'Loại giảm giá',
    discount_value DECIMAL(12,2) NOT NULL COMMENT 'Giá trị giảm (VD: 20% hoặc 10000 VND)',
    min_parking_duration_minutes INT DEFAULT 0 COMMENT 'Thời gian đỗ tối thiểu để áp dụng',
    max_discount DECIMAL(12,2) NULL COMMENT 'Giảm giá tối đa (VD: 50000 VND)',
    applicable_hours_json VARCHAR(255) NULL COMMENT 'Giờ áp dụng trong ngày',
    applicable_days_json VARCHAR(255) NULL COMMENT 'Ngày áp dụng trong tuần',
    max_uses INT NULL COMMENT 'Số lần sử dụng tối đa',
    current_uses INT DEFAULT 0 COMMENT 'Số lần đã sử dụng',
    valid_from DATETIME NOT NULL COMMENT 'Bắt đầu hiệu lực',
    valid_until DATETIME NOT NULL COMMENT 'Kết thúc hiệu lực',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Có đang active không',
    require_promo_code BOOLEAN DEFAULT FALSE COMMENT 'Yêu cầu mã khuyến mãi',
    stackable BOOLEAN DEFAULT FALSE COMMENT 'Có thể kết hợp với discount khác không',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
    
    INDEX ix_discount_tariff (tariff_id),
    INDEX ix_discount_site (site_id),
    INDEX ix_discount_active (is_active, valid_from, valid_until),
    INDEX ix_discount_code (discount_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quy tắc giảm giá và khuyến mãi';

-- ============================================================
-- SECTION 6: Tạo bảng pricing_audit_log (nếu chưa có)
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_audit_log (
    audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_id BIGINT NULL COMMENT 'Ticket ID nếu có',
    session_id BIGINT NULL COMMENT 'Session ID nếu có',
    calculation_type ENUM('TRANSIENT', 'SUBSCRIPTION', 'CORRECTION', 'REFUND') NOT NULL DEFAULT 'TRANSIENT' COMMENT 'Loại tính giá',
    input_data_json TEXT NOT NULL COMMENT 'Dữ liệu đầu vào',
    applied_tariff_id BIGINT NOT NULL COMMENT 'Tariff đã áp dụng',
    applied_rules_json TEXT NOT NULL COMMENT 'Rules đã áp dụng',
    calculated_amount DECIMAL(12,2) NOT NULL COMMENT 'Số tiền đã tính',
    final_amount DECIMAL(12,2) NOT NULL COMMENT 'Số tiền cuối cùng (sau discount)',
    discount_applied DECIMAL(12,2) DEFAULT 0 COMMENT 'Số tiền giảm giá',
    holiday_multiplier DECIMAL(4,2) DEFAULT 1.00 COMMENT 'Holiday multiplier đã áp dụng',
    calculation_time_ms INT NOT NULL COMMENT 'Thời gian tính toán (ms)',
    calculation_version VARCHAR(20) NOT NULL COMMENT 'Phiên bản engine',
    is_final BOOLEAN DEFAULT TRUE COMMENT 'Là kết quả cuối cùng không',
    parent_audit_id BIGINT NULL COMMENT 'Audit cha (cho recalculation)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
    
    INDEX ix_pricing_audit_ticket (ticket_id),
    INDEX ix_pricing_audit_session (session_id),
    INDEX ix_pricing_audit_tariff (applied_tariff_id),
    INDEX ix_pricing_audit_amount (calculated_amount),
    INDEX ix_pricing_audit_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Audit log cho pricing engine';

-- ============================================================
-- SECTION 7: Cập nhật tariff_rules enum (thêm các giá trị mới)
-- ============================================================
ALTER TABLE tariff_rules
MODIFY COLUMN rule_type ENUM(
    'FREE_MINUTES',
    'HOURLY',
    'DAILY_CAP',
    'OVERNIGHT',
    'FLAT_RATE',
    'DURATION_BLOCK',
    'PROGRESSION_RATE',
    'OVERNIGHT_SURCHARGE',
    'ZONE_SPECIFIC_RATE',
    'SPECIAL_EVENT_RATE',
    'LOST_CREDENTIAL_FEE',
    'HOLIDAY_MULTIPLIER',
    'TIME_OF_DAY_RATE',
    'SUBSCRIPTION_UNLIMITED',
    'SUBSCRIPTION_FIXED',
    'SUBSCRIPTION_FLEXIBLE',
    'SUBSCRIPTION_PRIORITY',
    'SPOT_ASSIGNMENT_FIXED',
    'SPOT_ASSIGNMENT_FLEXIBLE'
) NOT NULL;

-- ============================================================
-- SECTION 8: Cập nhật compound_tariff_rules
-- ============================================================
ALTER TABLE compound_tariff_rules
ADD COLUMN tariff_rule_id BIGINT NULL AFTER priority,
ADD CONSTRAINT fk_compound_rule FOREIGN KEY (tariff_rule_id) REFERENCES tariff_rules(rule_id) ON DELETE SET NULL;

-- ============================================================
-- SECTION 9: Cập nhật tariffs table (thêm các cột mới nếu chưa có)
-- ============================================================
-- Kiểm tra và thêm các cột còn thiếu
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariffs' AND COLUMN_NAME = 'short_code') = 0,
    'ALTER TABLE tariffs ADD COLUMN short_code VARCHAR(20) NULL AFTER vehicle_type',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariffs' AND COLUMN_NAME = 'description') = 0,
    'ALTER TABLE tariffs ADD COLUMN description TEXT NULL AFTER zone_code',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariffs' AND COLUMN_NAME = 'display_order') = 0,
    'ALTER TABLE tariffs ADD COLUMN display_order INT DEFAULT 0 AFTER description',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariffs' AND COLUMN_NAME = 'is_default') = 0,
    'ALTER TABLE tariffs ADD COLUMN is_default BOOLEAN DEFAULT FALSE AFTER display_order',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariffs' AND COLUMN_NAME = 'requires_subscription') = 0,
    'ALTER TABLE tariffs ADD COLUMN requires_subscription BOOLEAN DEFAULT FALSE AFTER is_default',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariffs' AND COLUMN_NAME = 'grace_period_minutes') = 0,
    'ALTER TABLE tariffs ADD COLUMN grace_period_minutes INT DEFAULT 0 AFTER requires_subscription',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariffs' AND COLUMN_NAME = 'max_duration_hours') = 0,
    'ALTER TABLE tariffs ADD COLUMN max_duration_hours INT NULL AFTER grace_period_minutes',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariffs' AND COLUMN_NAME = 'valid_until') = 0,
    'ALTER TABLE tariffs ADD COLUMN valid_until DATE NULL AFTER valid_from',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariffs' AND COLUMN_NAME = 'metadata_json') = 0,
    'ALTER TABLE tariffs ADD COLUMN metadata_json JSON NULL AFTER valid_until',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- SECTION 10: Thêm indexes cho tariffs
-- ============================================================
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariffs' AND INDEX_NAME = 'ix_tariffs_zone') = 0,
    'ALTER TABLE tariffs ADD INDEX ix_tariffs_zone (zone_code)',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariffs' AND INDEX_NAME = 'ix_tariffs_default') = 0,
    'ALTER TABLE tariffs ADD INDEX ix_tariffs_default (is_default, vehicle_type, applies_to)',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- SECTION 11: Thêm indexes cho tariff_rules
-- ============================================================
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariff_rules' AND INDEX_NAME = 'ix_rules_code') = 0,
    'ALTER TABLE tariff_rules ADD INDEX ix_rules_code (rule_code)',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariff_rules' AND INDEX_NAME = 'ix_rules_zone') = 0,
    'ALTER TABLE tariff_rules ADD INDEX ix_rules_zone (zone_code)',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tariff_rules' AND INDEX_NAME = 'ix_rules_effective') = 0,
    'ALTER TABLE tariff_rules ADD INDEX ix_rules_effective (is_active, effective_date, expiration_date)',
    'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- SECTION 12: Tạo pricing_engine helper view
-- ============================================================
DROP VIEW IF EXISTS v_pricing_engine_config;
CREATE VIEW v_pricing_engine_config AS
SELECT 
    t.tariff_id,
    t.site_id,
    t.name AS tariff_name,
    t.short_code,
    t.applies_to,
    t.vehicle_type,
    t.zone_code,
    t.is_active,
    t.is_default,
    t.grace_period_minutes,
    t.max_duration_hours,
    t.requires_subscription,
    COUNT(DISTINCT tr.rule_id) AS total_rules,
    COUNT(DISTINCT tz.tariff_zone_id) AS total_zones
FROM tariffs t
LEFT JOIN tariff_rules tr ON tr.tariff_id = t.tariff_id
LEFT JOIN tariff_zones tz ON tz.tariff_id = t.tariff_id AND tz.is_active = TRUE
GROUP BY t.tariff_id, t.site_id, t.name, t.short_code, t.applies_to, t.vehicle_type, 
         t.zone_code, t.is_active, t.is_default, t.grace_period_minutes, 
         t.max_duration_hours, t.requires_subscription;

-- ============================================================
-- Xác nhận hoàn thành
-- ============================================================
SELECT 'V30 MIGRATION COMPLETED' AS status;

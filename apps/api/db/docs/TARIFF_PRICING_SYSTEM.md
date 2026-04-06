# PARKLY - Enhanced Tariff Pricing System Documentation

## 📋 Tổng Quan

Hệ thống bảng giá mới được thiết kế để hỗ trợ:
1. **Bảng giá Vãng lai (Transient)** - Cho khách gửi xe lấy vé ngày
2. **Bảng giá Thuê bao (Subscriptions)** - Cho khách hàng định danh, thuê bao hàng tháng
3. **Quy tắc giá nâng cao** - Daily Cap, Lost Fee, Holiday Multiplier

---

## 🗄️ Database Schema

### Bảng Chính

#### 1. `tariffs` - Bảng giá chính
```sql
tariff_id          BIGINT PRIMARY KEY
site_id            BIGINT (FK)
name               VARCHAR(255)
applies_to         ENUM('TICKET', 'SUBSCRIPTION')
vehicle_type       ENUM('MOTORBIKE', 'CAR')
is_active          TINYINT(1) DEFAULT 1  -- Bật/tắt tariff (index: ix_tariffs_site_active)
zone_code          VARCHAR(32) NULL  -- NULL = tất cả zones
description        TEXT NULL
short_code         VARCHAR(20) NULL  -- Mã ngắn: CAR_STD_2H, MOTO_DAY
display_order      INT DEFAULT 0
is_default         BOOLEAN           -- Tariff mặc định cho loại xe
requires_subscription BOOLEAN        -- Yêu cầu subscription
grace_period_minutes INT DEFAULT 0  -- Thời gian miễn phí (phút)
max_duration_hours INT NULL          -- Thời gian tối đa (NULL = unlimited)
valid_from         DATETIME
valid_until        DATE NULL
metadata_json      JSON NULL         -- JSON bổ sung
```

#### 2. `tariff_rules` - Quy tắc tính giá
```sql
rule_id            BIGINT PRIMARY KEY
tariff_id          BIGINT (FK)
rule_code          VARCHAR(64) NULL  -- Mã duy nhất: CAR_STD_2H_GRACE
rule_type          ENUM(...)
zone_code          VARCHAR(32) NULL
time_range_json    JSON NULL         -- Khung giờ áp dụng
vehicle_type_filter VARCHAR(20) NULL
condition_json     JSON NULL          -- Điều kiện kích hoạt
action_json        JSON NULL          -- Hành động khi kích hoạt
param_json         JSON               -- Tham số rule
priority           INT
is_stackable       BOOLEAN DEFAULT TRUE
is_compound        BOOLEAN DEFAULT FALSE
effective_date     DATE NULL
expiration_date    DATE NULL
```

#### 3. Bảng mới (V30 Migration)

| Bảng | Mô tả |
|------|--------|
| `holiday_calendar` | Lịch ngày lễ với hệ số nhân |
| `tariff_zone_configs` | Cấu hình tariff theo zone (Prisma: `tariff_zone_configs`) |
| `special_pricing_periods` | Khoảng thời gian giá đặc biệt |
| `lost_credential_fees` | Phí mất thẻ/vé |
| `compound_tariff_rules` | Quy tắc phức hợp |
| `vehicle_type_overrides` | Override theo loại xe |
| `discount_rules` | Quy tắc giảm giá |
| `pricing_audit_log` | Audit log tính giá |

---

## 📊 Cấu Trúc JSON Chi Tiết

### 1. Time Range JSON
```json
{
  "start_hour": 6,
  "end_hour": 18,
  "days_of_week": [1, 2, 3, 4, 5, 6, 7],
  "start_time": "06:00:00",
  "end_time": "18:00:00"
}
```

### 2. Tariff Rule Types & JSON Structures

#### a) `FREE_MINUTES` - Miễn phí thời gian
```json
{
  "free_minutes": 15,
  "description": "15 phút miễn phí drop-off",
  "applies_to": "ALL_VEHICLES"
}
```

#### b) `DURATION_BLOCK` - Block thời gian cố định
```json
{
  "block_size_hours": 2,
  "rate": 35000,
  "description": "Block 2 giờ đầu tiên",
  "billing": "PER_BLOCK"
}
```

#### c) `HOURLY` - Tính theo giờ
```json
{
  "block_size_hours": 4,
  "rate_per_block": 5000,
  "billing": "BLOCK",
  "description": "Mỗi block 4 giờ = 5,000 VND"
}
```

#### d) `PROGRESSION_RATE` - Lũy tiến
```json
{
  "block_size_hours": 1,
  "rate": 20000,
  "description": "20,000 VND mỗi giờ tiếp theo",
  "is_progressive": true,
  "min_duration_hours": 2
}
```

#### e) `OVERNIGHT_SURCHARGE` - Phụ thu qua đêm
```json
{
  "surcharge": 50000,
  "description": "Phụ thu gửi qua đêm 50,000 VND",
  "time_range": {
    "start_hour": 18,
    "end_hour": 6
  },
  "applies_to": "PER_NIGHT"
}
```

#### f) `FLAT_RATE` - Giá cố định
```json
{
  "flat_rate": 10000,
  "billing": "PER_ENTRY",
  "description": "10,000 VND/lượt"
}
```

#### g) `DAILY_CAP` - Giá trần ngày
```json
{
  "max_daily_rate": 200000,
  "description": "Tối đa 200,000 VND/ngày",
  "applies_to": "24_HOURS"
}
```

#### h) `SUBSCRIPTION_UNLIMITED` - Gói không giới hạn
```json
{
  "unlimited_entries": true,
  "zone_restriction": "MOTORBIKE_A,MOTORBIKE_B",
  "monthly_rate": 200000,
  "description": "Gửi không giới hạn tại zone"
}
```

#### i) `SUBSCRIPTION_FIXED` - Gói cố định
```json
{
  "spot_mode": "FIXED",
  "description": "Cố định 1 vị trí VIP",
  "plate_lock_required": true,
  "max_vehicles": 1
}
```

#### j) `SUBSCRIPTION_FLEXIBLE` - Gói linh hoạt
```json
{
  "spot_mode": "FLOATING",
  "description": "Không cố định vị trí",
  "priority_over_transient": true
}
```

### 3. Condition JSON
```json
{
  "min_duration_minutes": 120,
  "max_duration_minutes": null,
  "is_business_hours": false,
  "is_progressive": true,
  "spans_overnight": true,
  "vehicle_attribute": "is_electric",
  "value": true
}
```

### 4. Action JSON
```json
{
  "action": "APPLY_RATE",
  "next_rule": "CAR_STD_PROG",
  "surcharge_type": "OVERNIGHT"
}
```

### 5. Tariff Metadata JSON
```json
{
  "time_range": {
    "start": "06:00",
    "end": "18:00"
  },
  "billing_unit": "BLOCK_4HOURS",
  "block_size_hours": 4,
  "rate_per_block": 5000,
  "max_blocks": 6,
  "benefits": [
    "Dedicated parking spot",
    "Priority gate access",
    "24/7 support"
  ],
  "max_vehicles": 2,
  "transfer_allowed": false
}
```

### 6. Holiday Calendar JSON
```json
{
  "holiday_date": "2026-01-01",
  "holiday_name": "Tết Dương Lịch",
  "holiday_type": "NATIONAL",
  "multiplier": 1.50,
  "flat_surcharge": 0,
  "description": "Tăng 50% giá vãng lai"
}
```

### 7. Lost Credential Fee JSON
```json
{
  "vehicle_type": "CAR",
  "base_penalty": 100000,
  "include_parking_fee": true,
  "max_penalty": 500000,
  "grace_period_hours": 0,
  "require_verification": true,
  "evidence_required": true
}
```

### 8. Discount Rule JSON
```json
{
  "discount_code": "EARLYBIRD",
  "discount_name": "Early Bird Discount",
  "discount_type": "PERCENTAGE",
  "discount_value": 10,
  "min_parking_duration_minutes": 0,
  "max_discount": 50000,
  "applicable_hours": {
    "start": "00:00",
    "end": "08:00"
  },
  "applicable_days": [1, 2, 3, 4, 5],
  "stackable": false
}
```

### 9. Special Pricing Period JSON
```json
{
  "period_name": "Giờ Cao Điểm Sáng",
  "period_type": "PEAK",
  "start_date": "2026-01-01",
  "end_date": "2026-12-31",
  "start_time": "07:00:00",
  "end_time": "09:00:00",
  "days_of_week": [1, 2, 3, 4, 5],
  "rate_multiplier": 1.10,
  "flat_surcharge": 0,
  "priority": 50,
  "is_recurring": true
}
```

---

## 💰 Bảng Giá Mẫu

### Bảng 1: Giá Vãng lai (Transient)

| Loại xe | Zone | Khung giờ | Mức giá | Đơn vị |
|---------|------|----------|---------|--------|
| Tất cả | Mọi Zone | 15 phút đầu | 0 | Grace Period (Miễn phí) |
| Xe máy | Motorbike | Ban ngày (06:00-18:00) | 5,000 | Block 4 giờ |
| Xe máy | Motorbike | Ban đêm (18:00-06:00) | 10,000 | Per entry |
| Ô tô | Regular | Tiêu chuẩn | 35,000 | Block 2 giờ đầu |
| Ô tô | Regular | Lũy tiến | 20,000 | Mỗi 1 giờ tiếp theo |
| Ô tô | Regular | Ban đêm (18:00-06:00) | 50,000 | Phụ thu qua đêm |

### Bảng 2: Giá Thuê bao / Gói tháng

| Loại xe | Gói | Giá/Tháng | Quyền lợi |
|---------|------|-----------|-----------|
| Xe máy | Standard Commuter | 200,000 | Gửi không giới hạn tại Zone Motorbike |
| Ô tô | Regular Monthly | 2,500,000 | Gửi linh hoạt (Floating spot) tại Regular Zone |
| Ô tô | VIP Dedicated | 3,500,000 | Gắn cứng biển số vào 1 vị trí cố định tại VIP Zone |

---

## 🔧 Quy Tắc Giá Nâng Cao

### 1. Daily Maximum Capping (Giá trần ngày)
- **Ô tô**: Tối đa **200,000 VND/ngày**
- Tránh trường hợp khách gửi xe 24h bị lũy tiến lên mức giá phi lý (~500k)

```sql
-- Rule configuration
rule_type = 'DAILY_CAP'
param_json = {
  "max_daily_rate": 200000,
  "description": "Giá trần 200k/ngày"
}
```

### 2. Lost Credential Fee (Phí mất thẻ/vé)
- **Xe máy**: 50,000 VND + Tiền cước tính từ check-in
- **Ô tô**: 100,000 VND + Tiền cước

```sql
-- Lost fee configuration
INSERT INTO lost_credential_fees 
(site_id, vehicle_type, base_penalty, include_parking_fee, max_penalty)
VALUES 
  (@site, 'MOTORBIKE', 50000, TRUE, 200000),
  (@site, 'CAR', 100000, TRUE, 500000);
```

### 3. Holiday Multiplier (Hệ số ngày lễ)

| Ngày lễ | Hệ số | Phụ thu |
|---------|-------|---------|
| Tết Dương Lịch (01/01) | 1.50x (+50%) | 0 |
| Tết Nguyên Đán | 1.20x (+20%) | 20,000 VND |
| Ngày Thống Nhất (30/04) | 1.50x (+50%) | 0 |
| Quốc Khánh (02/09) | 1.50x (+50%) | 0 |

```sql
-- Holiday configuration
INSERT INTO holiday_calendar
(site_id, holiday_date, holiday_name, multiplier, flat_surcharge)
VALUES 
  (@site, '2026-01-01', 'Tết Dương Lịch', 1.50, 0),
  (@site, '2026-01-28', 'Giao Thừa Tết', 1.20, 20000);
```

---

## 🎯 Pricing Engine Logic

### Luồng tính giá cho vé vãng lai (Transient)

```
1. Xác định loại xe (MOTORBIKE / CAR)
2. Chọn tariff phù hợp (theo vehicle_type)
3. Kiểm tra grace period (15 phút đầu miễn phí)
4. Tính block/thời gian:
   - Block 2 giờ đầu: 35,000 VND
   - Mỗi giờ tiếp theo: 20,000 VND
5. Kiểm tra overnight surcharge (18:00-06:00)
6. Áp dụng holiday multiplier (nếu có)
7. Áp dụng daily cap (max 200k/ngày)
8. Áp dụng discount (nếu có)
9. Tính final amount
```

### Luồng tính giá cho subscription

```
1. Xác định loại subscription (STANDARD / VIP)
2. Kiểm tra validity dates
3. Kiểm tra vehicle assignment
4. Kiểm tra zone restrictions
5. Tính monthly rate
6. Áp dụng discounts (nếu có)
7. Tính final amount
```

---

## 📁 Các File Migration

| Migration | Mô tả |
|-----------|--------|
| `V30__enhanced_tariff_pricing_system.sql` | Tạo schema mới cho pricing |
| `V31__seed_tariff_pricing.sql` | Seed data cho bảng giá |

---

## 🔗 Entity Relationships

```
tariffs
├── tariff_rules (1:N)
│   └── compound_tariff_rules (1:N)
├── tariff_zones (1:N)
├── vehicle_type_overrides (1:N)
├── discount_rules (1:N)
└── special_pricing_periods (1:N)

tariff_rules
├── compound_tariff_rules (1:N)
└── tariff_zones (1:N)

holiday_calendar (stand-alone)
├── special_pricing_periods (1:N)
└── lost_credential_fees (1:N)

pricing_audit_log (audit trail)
└── tariffs (N:1)
```

---

## 🚀 API Endpoints for Pricing

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/api/tariffs` | Lấy danh sách tariffs |
| GET | `/api/tariffs/:id` | Lấy chi tiết tariff |
| POST | `/api/tariffs` | Tạo tariff mới |
| PUT | `/api/tariffs/:id` | Cập nhật tariff |
| GET | `/api/tariffs/:id/rules` | Lấy rules của tariff |
| POST | `/api/tariffs/:id/rules` | Thêm rule mới |
| GET | `/api/pricing/calculate` | Tính giá vé |
| GET | `/api/holidays` | Lấy lịch lễ |
| POST | `/api/holidays` | Thêm ngày lễ |
| GET | `/api/discounts` | Lấy danh sách discount |
| POST | `/api/discounts/:code/validate` | Validate discount code |

---

## 📝 Ví dụ Pricing Calculation

### Ví dụ 1: Ô tô gửi 3 giờ vào ngày thường

```
Input:
- Vehicle: CAR
- Duration: 3 hours (180 minutes)
- Entry: 10:00, Exit: 13:00
- Date: 2026-03-21 (Thứ Bảy - Weekend)
- Zone: REGULAR_FLOOR1

Calculation:
1. Grace Period: 15 minutes free → 0 VND
2. Remaining: 165 minutes = 2h 45m
3. First 2 hours: 35,000 VND (CAR_STD_2H)
4. Progressive (45 min = 1h): 20,000 VND
5. Subtotal: 55,000 VND
6. Weekend Discount (20%): -11,000 VND
7. Final Amount: 44,000 VND
```

### Ví dụ 2: Ô tô gửi qua đêm (24 giờ)

```
Input:
- Vehicle: CAR
- Duration: 24 hours
- Entry: 20:00 ngày 21/03, Exit: 20:00 ngày 22/03
- Date span: 1 night (18:00-06:00)
- Zone: REGULAR_FLOOR1

Calculation:
1. Day 1 (6 hours): 
   - First 2h: 35,000
   - Progressive 4h: 80,000
   - Subtotal Day 1: 115,000
2. Night surcharge: +50,000
3. Day 2 (18 hours):
   - First 2h: 35,000
   - Progressive 16h: 320,000
   - Subtotal Day 2: 355,000
4. Total before cap: 520,000
5. Daily Cap Applied: 200,000 per day × 2 = 400,000
6. Final Amount: 400,000 VND (sau khi áp dụng cap)
```

### Ví dụ 3: Xe máy gửi 6 giờ ban ngày

```
Input:
- Vehicle: MOTORBIKE
- Duration: 6 hours
- Time: 08:00 - 14:00 (within 06:00-18:00)
- Zone: MOTORBIKE_A

Calculation:
1. Grace Period: 15 minutes free → 0 VND
2. Remaining: 5h 45m = 5.75 hours
3. Blocks (4 hours each):
   - Block 1 (0-4h): 5,000 VND
   - Block 2 (4-6h): 5,000 VND (charged for partial block)
4. Total: 10,000 VND
```

### Ví dụ 4: Subscription VIP Platinum

```
Input:
- Subscription: VIP Dedicated
- Vehicle: 51A-12345 (registered)
- Duration: Full month
- Zone: VIP_PLATINUM

Calculation:
1. Monthly Rate: 3,500,000 VND
2. Spot Assignment: FIXED (spot locked)
3. Benefits Applied:
   - Unlimited entries
   - Priority gate access
   - 24/7 support
4. Final Amount: 3,500,000 VND/month
```

---

## 📊 Database Views

### `v_pricing_engine_config`
```sql
SELECT 
    tariff_id,
    tariff_name,
    short_code,
    applies_to,
    vehicle_type,
    zone_code,
    is_active,
    is_default,
    grace_period_minutes,
    total_rules,
    total_zones
FROM v_pricing_engine_config
WHERE is_active = TRUE
ORDER BY display_order;
```

---

## 🔒 Security & Audit

### Pricing Audit Log
```json
{
  "audit_id": 12345,
  "ticket_id": 67890,
  "calculation_type": "TRANSIENT",
  "input_data": {
    "vehicle_type": "CAR",
    "entry_time": "2026-03-21 10:00:00",
    "exit_time": "2026-03-21 13:00:00",
    "zone_code": "REGULAR_FLOOR1"
  },
  "applied_tariff_id": 5,
  "applied_rules": [
    "CAR_STD_GRACE",
    "CAR_STD_2H",
    "CAR_PROG_HOURLY",
    "WEEKEND_DISCOUNT"
  ],
  "calculated_amount": 55000,
  "final_amount": 44000,
  "discount_applied": 11000,
  "holiday_multiplier": 1.00,
  "calculation_time_ms": 15,
  "calculation_version": "1.0.0"
}
```

---

## 📞 Support

Để biết thêm chi tiết về cách tích hợp với pricing engine, xem:
- `apps/api/src/modules/pricing/` - Pricing module
- `apps/api/src/services/pricing-service.ts` - Pricing service
- `apps/api/src/modules/tariffs/` - Tariff management module

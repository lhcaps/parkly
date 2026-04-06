# PARKLY — Technical Specification v10.0
**Version:** 10.0 (RC3 - Enterprise Hardened)
**Project:** Parkly Parking Management System
**Updated:** 2026-03-25
**Authors:** Parkly Dev Team

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)
5. [API Endpoints](#5-api-endpoints)
6. [ALPR / License Plate Recognition](#6-alpr--license-plate-recognition)
7. [Gate & Lane Management](#7-gate--lane-management)
8. [Decision Engine](#8-decision-engine)
9. [Session Orchestration](#9-session-orchestration)
10. [Subscription Management](#10-subscription-management)
11. [Tariff & Pricing System](#11-tariff--pricing-system)
12. [Incident Management](#12-incident-management)
13. [Dashboard & Reporting](#13-dashboard--reporting)
14. [Audit & Observability](#14-audit--observability)
15. [Authentication & Authorization](#15-authentication--authorization)
16. [Mobile Capture (Pairing)](#16-mobile-capture-pairing)
17. [Media Storage Pipeline](#17-media-storage-pipeline)
18. [Outbox & Event Delivery](#18-outbox--event-delivery)
19. [Background Workers](#19-background-workers)
20. [Frontend (Web App)](#20-frontend-web-app)
21. [Deployment & Infrastructure](#21-deployment--infrastructure)
22. [Scripts & Automation](#22-scripts--automation)
23. [Environment Configuration](#23-environment-configuration)
24. [Migration History](#24-migration-history)
25. [Enums Reference](#25-enums-reference)
26. [Redis Distributed Lock — Race Condition Prevention](#26-redis-distributed-lock--race-condition-prevention)
27. [Parkly Edge Node — Local Survivability](#27-parkly-edge-node--local-survivability)
28. [Media Auth Split](#28-media-auth-split)
29. [Idempotency Middleware](#29-idempotency-middleware)
30. [Bulk Import Subscriptions (BullMQ)](#30-bulk-import-subscriptions-bullmq)
31. [Webhook Management & Delivery](#31-webhook-management--delivery)
32. [Database Schema Changes (V31)](#32-database-schema-changes-v31)
33. [New Enums (V31)](#33-new-enums-v31)
34. [New Module Map](#34-new-module-map)
35. [Ghost Presence Purge Worker](#35-ghost-presence-purge-worker)
36. [SSE Stream Event Reference (v10.0)](#36-sse-stream-event-reference-v100)
37. [Extended Decision Engine Codes (v10.0)](#37-extended-decision-engine-codes-v100)
38. [New Server Services (v10.0)](#38-new-server-services-v100)
39. [Security Hardening Summary (v10.0)](#39-security-hardening-summary-v100)
40. [Topology Admin Module (v10.0)](#40-topology-admin-module-v100)
41. [Enhanced Frontend Topology Dashboard (v10.0)](#41-enhanced-frontend-topology-dashboard-v100)
42. [Error Hierarchy & Global Error Handler (v10.0)](#42-error-hierarchy--global-error-handler-v100)
43. [Domain Events Bus (v10.0)](#43-domain-events-bus-v100)
44. [Multi-Tenancy Middleware (v10.0)](#44-multi-tenancy-middleware-v100)
45. [CI/CD Pipeline (v10.0)](#45-cicd-pipeline-v100)
46. [Production Readiness (v10.0)](#46-production-readiness-v100)

---

## 1. Project Overview

**Parkly** là hệ thống quản lý bãi đỗ xe thông minh (Smart Parking Management System) được xây dựng theo kiến trúc microservices-ready, hỗ trợ:

- **Quản lý đa bãi đỗ** (Multi-site parking)
- **Nhận diện biển số tự động** (ALPR / ANPR)
- **Ra vào tự động** qua camera & RFID
- **Thuê bao tháng** (Subscription management)
- **Thanh toán** (Cash, Card, E-Wallet)
- **Giám sát realtime** (SSE streams)
- **Dashboard tổng hợp** (Occupancy, Incidents, Revenue)
- **Mobile Camera Pairing** (Điện thoại làm camera edge)
- **Hệ thống bảng giá nâng cao** (Holiday, Peak/Off-Peak, Lost Fee, Compound rules)
- **Audit trail đầy đủ** cho compliance

---

## 2. Technology Stack

### Backend (apps/api)

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 LTS + TypeScript |
| Web Framework | Express.js 4 |
| ORM | Prisma 7 (MySQL/MariaDB adapter) |
| Database | MySQL 8.x |
| Cache / Queue | Redis 7 (BullMQ for background jobs) |
| Object Storage | MinIO (S3-compatible) |
| Auth | JWT (access token 15min / refresh token 7 days) |
| Validation | Zod |
| HTTP Client | Axios (HTTP ALPR provider) |
| API Docs | Swagger UI + OpenAPI 3.0 |
| Security | HSTS, CSP, X-Frame-Options, Rate Limiting (sliding window), CORS |
| Error Handling | Centralized `ApiError` hierarchy (7 subclasses) + `globalErrorHandler` middleware |
| Logging | Custom structured logger (Pino-like), JSON format |
| Config | dotenv + Zod schema validation |
| Testing | Vitest (55+ tests: decision engine, error hierarchy, domain events, multi-tenancy) |
| Process Manager | BullMQ Worker (outbox processing) |
| Migration | Flyway CLI (32 versioned migrations) |
| Observability | prom-client (Prometheus), domain events bus (Zod-validated) |
| Multi-Tenancy | `enforceSiteScope` middleware, `assertSiteAccess` query guards |

### Frontend (apps/web)

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite (2463 modules, manual chunk splitting) |
| Routing | React Router v6 |
| State | TanStack Query (React Query) + Zustand |
| UI Primitives | Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-scroll-area`) |
| Design System | Custom design tokens + shared components (`Skeleton`, `StatusBadge`, `MetricCard`, `EmptyState`) |
| Graph Visualization | React Flow (`@xyflow/react`) + dagre (auto-layout) |
| Toast Notifications | Sonner |
| Charts | Recharts |
| HTTP | Axios + interceptors + auto idempotency keys |

### Infrastructure

| Component | Technology |
|-----------|-----------|
| Container | Docker + Docker Compose |
| Database | MySQL 8 (via Docker Compose) |
| Cache | Redis 7 (via Docker Compose) |
| Object Storage | MinIO (via Docker Compose) |
| ALPR Engine | YOLOv8 + PaddleOCR GPU microservice (HTTP) |
| Tesseract OCR | Local fallback (ALPR_MODE=TESSERACT) |

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENTS                                │
│  Web Dashboard (React) │ Mobile Camera (Pairing) │ Devices  │
└────────────────────────────┬─────────────────────────────────┘
                            │ HTTP / SSE
┌────────────────────────────▼─────────────────────────────────┐
│                     PARKLY API (Express)                      │
│  ┌──────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ Auth Module  │  │ Gate Module│  │ Dashboard Module   │  │
│  │ Auth Routes  │  │ Capture    │  │ Ops Query Routes   │  │
│  │ JWT + RBAC   │  │ Decision   │  │ SSE Streams        │  │
│  └──────────────┘  │ Session    │  └────────────────────┘  │
│  ┌──────────────┐  │ Review     │  ┌────────────────────┐  │
│  │ ALPR Service │  │ Open/Close │  │ Incident Module    │  │
│  │ Tesseract/HTTP│ │ Barrier    │  │ Incident Routes    │  │
│  └──────────────┘  └────────────┘  │ SSE Stream         │  │
│  ┌──────────────┐  ┌────────────┐  └────────────────────┘  │
│  │ Tariff Module│  │ Presence   │  ┌────────────────────┐  │
│  │ Rules Engine │  │ Zone Events│  │ Subscription Admin │  │
│  │ Pricing Audit│  │ Ingest     │  │ CRUD + Spots      │  │
│  └──────────────┘  └────────────┘  └────────────────────┘  │
│  ┌──────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ Audit Module │  │ Parking Live│  │ Reconciliation    │  │
│  │ Audit Routes │  │ Board      │  │ Run Reconciliation│  │
│  └──────────────┘  └────────────┘  └────────────────────┘  │
└────────────────────────────┬─────────────────────────────────┘
         ┌───────────────────┼───────────────────┐
         │                   │                    │
    ┌────▼────┐        ┌─────▼─────┐        ┌─────▼─────┐
    │  MySQL  │        │   Redis   │        │  MinIO    │
    │ 8.x     │        │ 7.x       │        │ S3 Storage│
    │ Prisma  │        │ BullMQ    │        │ Media     │
    └─────────┘        │ Preview   │        │ Images    │
                      │ Cache     │        └───────────┘
                      │ Sessions  │
                      │ Rate Limit│
                      └───────────┘

    ┌──────────────────────────────────────────────────────┐
    │              WORKER PROCESS (BullMQ)                  │
    │  Outbox Worker │ DLQ Processor │ Enqueue Producer   │
    └──────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### 4.1 Core Entity-Relationship Overview

```
parking_sites (1) ────── (N) zones
                         (N) spots ───── (N) subscription_spots
                         (N) gate_devices ─ (N) gate_lanes ─ (N) gate_lane_devices
                         (N) gate_read_events
                         (N) gate_read_media
                         (N) gate_passage_sessions
                         (N) gate_decisions
                         (N) gate_barrier_commands
                         (N) gate_incidents
                         (N) gate_manual_reviews
                         (N) device_heartbeats
                         (N) gate_active_presence
                         (N) internal_presence_events
                         (N) tickets ─── (N) payments
                         (N) credentials
                         (N) subscriptions ─── (N) subscription_vehicles
                         (N) tariffs ─── (N) tariff_rules
                                        ─── (N) tariff_zone_configs
                                        ─── (N) compound_tariff_rules
                                        ─── (N) vehicle_type_overrides
                                        ─── (N) discount_rules
                                        ─── (N) special_pricing_periods
                         (N) holiday_calendar
                         (N) lost_credential_fees
                         (N) pricing_audit_log
                         (N) spot_occupancy_projection
                         (N) shift_closures ─── (N) shift_closure_breakdowns
                         (N) audit_logs
                         (N) user_site_scopes
                         (N) gate_event_outbox ─── (N) gate_event_outbox_dlq
                         (N) api_idempotency_keys
                         (N) spot_occupancy_projection
```

### 4.2 Core Tables

#### `parking_sites`
| Column | Type | Description |
|--------|------|-------------|
| site_id | BIGINT PK | Auto-increment |
| site_code | VARCHAR(32) UNIQUE | Mã site: `SITE_HCM_01` |
| name | VARCHAR(255) | Tên bãi đỗ |
| timezone | VARCHAR(64) | Default: `Asia/Ho_Chi_Minh` |
| is_active | BOOLEAN | Kích hoạt/bị khóa |
| created_at | DATETIME | Thời điểm tạo |

#### `zones`
| Column | Type | Description |
|--------|------|-------------|
| zone_id | BIGINT PK | |
| site_id | BIGINT FK | |
| code | VARCHAR(32) | `VIP_A`, `REGULAR_B`, `MOTORBIKE_ZONE` |
| name | VARCHAR(255) | Tên zone |
| vehicle_type | ENUM(MOTORBIKE, CAR) | Loại xe được phép |
| total_spots | INT | Tổng số chỗ |
| is_active | BOOLEAN | |

#### `spots`
| Column | Type | Description |
|--------|------|-------------|
| spot_id | BIGINT PK | |
| site_id | BIGINT FK | |
| zone_id | BIGINT FK | |
| code | VARCHAR(32) | `HCM-VIP-01` |
| name | VARCHAR(255) | |
| status | ENUM(FREE, OCCUPIED, OUT_OF_SERVICE) | |
| is_active | BOOLEAN | |

#### `gate_devices`
| Column | Type | Description |
|--------|------|-------------|
| device_id | BIGINT PK | |
| site_id | BIGINT FK | |
| device_code | VARCHAR(32) | `GATE_01_ENTRY_CAMERA` |
| device_type | ENUM(RFID_READER, CAMERA_ALPR, BARRIER, LOOP_SENSOR) | |
| direction | ENUM(ENTRY, EXIT) | |
| location_hint | VARCHAR(255) | Vị trí lắp đặt |
| firmware_version | VARCHAR(64) | Phiên bản firmware |
| ip_address | VARCHAR(45) | IP thiết bị |
| is_active | BOOLEAN | |

#### `gate_lanes`
| Column | Type | Description |
|--------|------|-------------|
| lane_id | BIGINT PK | |
| site_id | BIGINT FK | |
| gate_code | VARCHAR(32) | `GATE_01` |
| lane_code | VARCHAR(32) | `ENTRY`, `EXIT` |
| name | VARCHAR(255) | Tên lane |
| direction | ENUM(ENTRY, EXIT) | |
| status | ENUM(ACTIVE, INACTIVE, MAINTENANCE) | |
| sort_order | INT | Thứ tự hiển thị |
| primary_device_id | BIGINT FK | Thiết bị chính |

#### `gate_lane_devices`
| Column | Type | Description |
|--------|------|-------------|
| lane_device_id | BIGINT PK | |
| lane_id | BIGINT FK | |
| device_id | BIGINT FK | |
| device_role | ENUM(PRIMARY, CAMERA, RFID, LOOP_SENSOR, BARRIER) | |
| is_primary | BOOLEAN | |
| is_required | BOOLEAN | |
| sort_order | INT | |

#### `gate_passage_sessions`
| Column | Type | Description |
|--------|------|-------------|
| session_id | BIGINT PK | |
| site_id | BIGINT FK | |
| lane_id | BIGINT FK | |
| direction | ENUM(ENTRY, EXIT) | |
| status | ENUM(OPEN, WAITING_READ, WAITING_DECISION, APPROVED, WAITING_PAYMENT, DENIED, PASSED, TIMEOUT, CANCELLED, ERROR) | |
| ticket_id | BIGINT FK | Ticket liên quan |
| plate_raw | VARCHAR(32) | Biển số thô |
| rfid_uid | VARCHAR(64) | Mã RFID |
| opened_at | DATETIME | Thời điểm mở cổng |
| decided_at | DATETIME | Thời điểm quyết định |
| passed_at | DATETIME | Thời điểm xe đi qua |
| barrier_command_id | BIGINT FK | Lệnh điều khiển barrier |

#### `gate_decisions`
| Column | Type | Description |
|--------|------|-------------|
| decision_id | BIGINT PK | |
| session_id | BIGINT FK | |
| decision_code | ENUM(AUTO_APPROVED, REVIEW_REQUIRED, AUTO_DENIED, PAYMENT_REQUIRED, TICKET_NOT_FOUND, PLATE_RFID_MISMATCH, ANTI_PASSBACK_BLOCKED, DEVICE_DEGRADED, SUBSCRIPTION_AUTO_APPROVED, SUBSCRIPTION_EXIT_BYPASS_PAYMENT, SUBSCRIPTION_REVIEW_REQUIRED) | |
| final_action | ENUM(APPROVE, REVIEW, DENY, PAYMENT_HOLD) | |
| reason_code | VARCHAR(64) | Mã lý do chi tiết |
| reason_detail | TEXT | Mô tả lý do |
| review_required | BOOLEAN | |
| input_snapshot | JSON | Bản snapshot đầu vào decision engine |
| threshold_snapshot | JSON | Bản snapshot ngưỡng |

#### `gate_barrier_commands`
| Column | Type | Description |
|--------|------|-------------|
| command_id | BIGINT PK | |
| session_id | BIGINT FK | |
| device_id | BIGINT FK | |
| command_type | ENUM(OPEN, CLOSE, HOLD_OPEN, LOCK) | |
| status | ENUM(PENDING, SENT, ACKED, NACKED, TIMEOUT, CANCELLED) | |
| sent_at | DATETIME | |
| acknowledged_at | DATETIME | |
| error_message | TEXT | |

#### `gate_read_events`
| Column | Type | Description |
|--------|------|-------------|
| read_id | BIGINT PK | |
| session_id | BIGINT FK | |
| device_id | BIGINT FK | |
| read_type | ENUM(ALPR, RFID, SENSOR) | |
| direction | ENUM(ENTRY, EXIT) | |
| plate_raw | VARCHAR(32) | Biển số thô |
| plate_canonical | VARCHAR(32) | Biển số chuẩn hóa |
| rfid_uid | VARCHAR(64) | |
| sensor_state | ENUM(PRESENT, CLEARED, TRIGGERED) | |
| confidence | DECIMAL(5,4) | Độ tin cậy OCR |
| occurred_at | DATETIME | |

#### `gate_read_media`
| Column | Type | Description |
|--------|------|-------------|
| media_id | BIGINT PK | |
| read_id | BIGINT FK | |
| storage_kind | ENUM(UPLOAD, URL, INLINE, MOCK, UNKNOWN) | |
| storage_provider | VARCHAR(64) | `MINIO`, `LOCAL` |
| media_url | VARCHAR(512) | URL truy cập |
| bucket_name | VARCHAR(255) | |
| object_key | VARCHAR(512) | S3 object key |
| mime_type | VARCHAR(64) | `image/jpeg` |
| width_px | INT | Chiều rộng ảnh |
| height_px | INT | Chiều cao ảnh |
| sha256 | VARCHAR(64) | Hash SHA256 |
| captured_at | DATETIME | |

#### `gate_active_presence`
| Column | Type | Description |
|--------|------|-------------|
| presence_id | BIGINT PK | |
| site_id | BIGINT FK | |
| ticket_id | BIGINT FK | |
| spot_id | BIGINT FK | |
| session_id | BIGINT FK | |
| plate_canonical | VARCHAR(32) | |
| rfid_uid | VARCHAR(64) | |
| status | ENUM(ACTIVE, EXITED, CLEARED, BLOCKED) | |
| entered_at | DATETIME | |
| last_seen_at | DATETIME | |
| exit_session_id | BIGINT FK | |

#### `gate_incidents`
| Column | Type | Description |
|--------|------|-------------|
| incident_id | BIGINT PK | |
| site_id | BIGINT FK | |
| session_id | BIGINT FK | |
| spot_id | BIGINT FK | |
| incident_type | VARCHAR(64) | `VIP_WRONG_SPOT`, `RESERVED_SPOT_OCCUPIED_BY_OTHER`, `SENSOR_STALE`, `MISSING_GATE_PRESENCE`, `PLATE_UNAVAILABLE` |
| severity | ENUM(INFO, WARN, CRITICAL) | |
| status | ENUM(OPEN, ACKED, RESOLVED, IGNORED) | |
| source_key | VARCHAR(255) | Spot code hoặc source fingerprint |
| description | TEXT | |
| opened_at | DATETIME | |
| acknowledged_at | DATETIME | |
| acknowledged_by | BIGINT FK | |
| resolved_at | DATETIME | |
| resolved_by | BIGINT FK | |
| resolution_action | VARCHAR(64) | |

#### `gate_manual_reviews`
| Column | Type | Description |
|--------|------|-------------|
| review_id | BIGINT PK | |
| site_id | BIGINT FK | |
| session_id | BIGINT FK | |
| incident_id | BIGINT FK | |
| status | ENUM(OPEN, CLAIMED, RESOLVED, CANCELLED) | |
| claimed_by | BIGINT FK | |
| claimed_at | DATETIME | |
| resolved_by | BIGINT FK | |
| resolved_at | DATETIME | |
| resolution | VARCHAR(64) | `MANUAL_APPROVE`, `MANUAL_DENY`, `MANUAL_OPEN_BARRIER` |
| notes | TEXT | |

#### `device_heartbeats`
| Column | Type | Description |
|--------|------|-------------|
| heartbeat_id | BIGINT PK | |
| device_id | BIGINT FK | |
| status | ENUM(ONLINE, DEGRADED, OFFLINE) | |
| reported_at | DATETIME | Thời điểm thiết bị báo |
| received_at | DATETIME | Thời điểm server nhận |
| latency_ms | INT | Độ trễ |
| firmware_version | VARCHAR(64) | |
| ip_address | VARCHAR(45) | |

### 4.3 Ticketing & Payment

#### `tickets`
| Column | Type | Description |
|--------|------|-------------|
| ticket_id | BIGINT PK | |
| site_id | BIGINT FK | |
| ticket_code | VARCHAR(32) | Mã vé |
| vehicle_id | BIGINT FK | |
| credential_id | BIGINT FK | |
| entry_time | DATETIME | Thời điểm vào |
| exit_time | DATETIME | Thời điểm ra |
| status | ENUM(OPEN, CLOSED, CANCELLED) | |
| tariff_id | BIGINT FK | Bảng giá áp dụng |
| total_amount | DECIMAL(12,2) | Tổng tiền |

#### `payments`
| Column | Type | Description |
|--------|------|-------------|
| payment_id | BIGINT PK | |
| ticket_id | BIGINT FK | |
| site_id | BIGINT FK | |
| method | ENUM(CASH, CARD, EWALLET) | |
| amount | DECIMAL(12,2) | |
| status | ENUM(PAID, REFUNDED, VOID) | |
| transaction_ref | VARCHAR(64) | |
| paid_at | DATETIME | |

#### `credentials`
| Column | Type | Description |
|--------|------|-------------|
| credential_id | BIGINT PK | |
| site_id | BIGINT FK | |
| customer_id | BIGINT FK | |
| credential_type | VARCHAR(32) | `RFID`, `PLATE` |
| rfid_uid | VARCHAR(64) UNIQUE | Mã RFID thẻ |
| plate_canonical | VARCHAR(32) | Biển số đăng ký |
| status | ENUM(ACTIVE, BLOCKED, LOST) | |
| issued_at | DATETIME | |
| last_direction | ENUM(ENTRY, EXIT) | |

#### `customers`
| Column | Type | Description |
|--------|------|-------------|
| customer_id | BIGINT PK | |
| name | VARCHAR(255) | |
| phone | VARCHAR(32) | |
| email | VARCHAR(255) | |
| status | ENUM(ACTIVE, SUSPENDED) | |

### 4.4 Subscriptions

#### `subscriptions`
| Column | Type | Description |
|--------|------|-------------|
| subscription_id | BIGINT PK | |
| site_id | BIGINT FK | |
| customer_id | BIGINT FK | |
| plan_type | ENUM(MONTHLY, VIP) | |
| status | ENUM(ACTIVE, EXPIRED, CANCELLED, SUSPENDED) | |
| start_date | DATE | |
| end_date | DATE | |
| auto_renew | BOOLEAN | |
| created_at | DATETIME | |

#### `subscription_vehicles`
| Column | Type | Description |
|--------|------|-------------|
| vehicle_id | BIGINT PK | |
| subscription_id | BIGINT FK | |
| plate_canonical | VARCHAR(32) | |
| rfid_uid | VARCHAR(64) | |
| vehicle_type | ENUM(MOTORBIKE, CAR) | |
| is_primary | BOOLEAN | |
| status | ENUM(ACTIVE, SUSPENDED, REMOVED) | |

#### `subscription_spots`
| Column | Type | Description |
|--------|------|-------------|
| spot_id | BIGINT PK | |
| subscription_id | BIGINT FK | |
| spot_id | BIGINT FK | |
| assigned_mode | ENUM(ASSIGNED, PREFERRED) | |
| status | ENUM(ACTIVE, SUSPENDED, RELEASED) | |

### 4.5 Tariff & Pricing (V30 Enhanced)

#### `tariffs`
| Column | Type | Description |
|--------|------|-------------|
| tariff_id | BIGINT PK | |
| site_id | BIGINT FK | |
| name | VARCHAR(255) | Tên bảng giá |
| applies_to | ENUM(TICKET, SUBSCRIPTION) | Vãng lai / Thuê bao |
| vehicle_type | ENUM(MOTORBIKE, CAR) | |
| is_active | BOOLEAN | Default: `true` |
| zone_code | VARCHAR(32) | NULL = tất cả zones |
| short_code | VARCHAR(20) | `CAR_STD_2H`, `MOTO_DAY` |
| display_order | INT | |
| is_default | BOOLEAN | Bảng giá mặc định |
| requires_subscription | BOOLEAN | |
| grace_period_minutes | INT | Thời gian miễn phí (phút) |
| max_duration_hours | INT | Thời gian tối đa |
| valid_from | DATETIME | |
| valid_until | DATE | |
| metadata_json | TEXT | JSON bổ sung |

#### `tariff_rules`
| Column | Type | Description |
|--------|------|-------------|
| rule_id | BIGINT PK | |
| tariff_id | BIGINT FK | |
| rule_code | VARCHAR(64) | |
| rule_type | ENUM(FREE_MINUTES, HOURLY, DAILY_CAP, OVERNIGHT, FLAT_RATE, DURATION_BLOCK, PROGRESSION_RATE, OVERNIGHT_SURCHARGE, ZONE_SPECIFIC_RATE, SPECIAL_EVENT_RATE, LOST_CREDENTIAL_FEE, HOLIDAY_MULTIPLIER, TIME_OF_DAY_RATE, SUBSCRIPTION_UNLIMITED, SUBSCRIPTION_FIXED, SUBSCRIPTION_FLEXIBLE, SUBSCRIPTION_PRIORITY, SPOT_ASSIGNMENT_FIXED, SPOT_ASSIGNMENT_FLEXIBLE) | |
| zone_code | VARCHAR(32) | |
| time_range_json | TEXT | JSON khung giờ |
| vehicle_type_filter | VARCHAR(20) | |
| condition_json | TEXT | JSON điều kiện |
| action_json | TEXT | JSON hành động |
| param_json | JSON | Tham số rule |
| priority | INT | Thứ tự ưu tiên |
| is_compound | BOOLEAN | |
| compound_operator | VARCHAR(10) | AND, OR, AND_NOT, XOR |
| compound_rule_ids | TEXT | |
| effective_date | DATE | |
| expiration_date | DATE | |

#### `tariff_zone_configs`
| Column | Type | Description |
|--------|------|-------------|
| tariff_zone_id | BIGINT PK | |
| tariff_id | BIGINT FK | |
| zone_code | VARCHAR(32) | |
| zone_id | BIGINT FK | |
| is_primary | BOOLEAN | Zone chính |
| rate_multiplier | DECIMAL(4,2) | Hệ số nhân giá |
| flat_addition | DECIMAL(12,2) | Phụ thu cố định |
| max_spots | INT | Số chỗ tối đa |
| spot_assignment_mode | ENUM(FIXED, PREFERRED, FLOATING) | |
| priority | INT | |

#### `special_pricing_periods`
| Column | Type | Description |
|--------|------|-------------|
| period_id | BIGINT PK | |
| site_id | BIGINT FK | |
| tariff_id | BIGINT FK | NULL = áp dụng tất cả |
| period_name | VARCHAR(255) | `Giờ cao điểm`, `Cuối tuần` |
| period_type | ENUM(PEAK, OFF_PEAK, NIGHT, WEEKEND, SPECIAL, CUSTOM) | |
| start_date | DATE | |
| end_date | DATE | |
| start_time | TIME | |
| end_time | TIME | |
| days_of_week | VARCHAR(255) | `1,2,3,4,5,6,7` |
| rate_multiplier | DECIMAL(4,2) | |
| flat_surcharge | DECIMAL(12,2) | |
| absolute_rate | DECIMAL(12,2) | Giá tuyệt đối |
| priority | INT | |
| is_active | BOOLEAN | |
| is_recurring | BOOLEAN | |

#### `holiday_calendar`
| Column | Type | Description |
|--------|------|-------------|
| holiday_id | BIGINT PK | |
| site_id | BIGINT FK | NULL = tất cả sites |
| holiday_date | DATE | |
| holiday_name | VARCHAR(255) | `Tết Dương lịch`, `Tết Nguyên Đán` |
| holiday_type | ENUM(NATIONAL, REGIONAL, SPECIAL, CUSTOM) | |
| multiplier | DECIMAL(4,2) | Hệ số nhân (VD: 1.20 = +20%) |
| flat_surcharge | DECIMAL(12,2) | Phụ thu cố định (VND) |
| is_active | BOOLEAN | |
| apply_to_subscriptions | BOOLEAN | Áp dụng cho subscription không |
| description | TEXT | |

#### `lost_credential_fees`
| Column | Type | Description |
|--------|------|-------------|
| fee_id | BIGINT PK | |
| site_id | BIGINT FK | |
| vehicle_type | ENUM(MOTORBIKE, CAR, ALL) | |
| base_penalty | DECIMAL(12,2) | Tiền phạt cơ bản |
| include_parking_fee | BOOLEAN | Bao gồm tiền gửi xe |
| max_penalty | DECIMAL(12,2) | Tối đa |
| grace_period_hours | INT | Thời gian ân hạn |
| require_verification | BOOLEAN | |
| evidence_required | BOOLEAN | |

#### `compound_tariff_rules`
| Column | Type | Description |
|--------|------|-------------|
| compound_id | BIGINT PK | |
| tariff_id | BIGINT FK | |
| rule_name | VARCHAR(255) | |
| operator | ENUM(AND, OR, AND_NOT, XOR) | |
| min_rules_required | INT | |
| rule_conditions | TEXT | JSON điều kiện |
| result_action | ENUM(APPLY_RATE, SKIP_RULES, OVERRIDE_RATE, APPLY_DISCOUNT, REJECT) | |
| result_value | TEXT | |
| priority | INT | |
| is_active | BOOLEAN | |

#### `vehicle_type_overrides`
| Column | Type | Description |
|--------|------|-------------|
| override_id | BIGINT PK | |
| tariff_id | BIGINT FK | |
| vehicle_type | ENUM(MOTORBIKE, CAR) | |
| override_name | VARCHAR(255) | |
| rate_override | DECIMAL(12,2) | |
| multiplier_override | DECIMAL(4,2) | |
| max_duration_override | INT | |
| grace_period_override | INT | |
| conditions_json | VARCHAR(255) | |
| priority | INT | |
| is_active | BOOLEAN | |
| effective_from | DATE | |
| effective_until | DATE | |

#### `discount_rules`
| Column | Type | Description |
|--------|------|-------------|
| discount_id | BIGINT PK | |
| tariff_id | BIGINT FK | |
| site_id | BIGINT FK | |
| discount_code | VARCHAR(64) UNIQUE | Mã khuyến mãi |
| discount_name | VARCHAR(255) | |
| discount_type | ENUM(PERCENTAGE, FIXED_AMOUNT, FREE_MINUTES, FREE_HOURS, MULTIPLIER) | |
| discount_value | DECIMAL(12,2) | |
| min_parking_duration_minutes | INT | |
| max_discount | DECIMAL(12,2) | |
| applicable_hours_json | TEXT | |
| applicable_days_json | TEXT | |
| max_uses | INT | |
| current_uses | INT | |
| valid_from | DATETIME | |
| valid_until | DATETIME | |
| is_active | BOOLEAN | |
| require_promo_code | BOOLEAN | |
| stackable | BOOLEAN | |

#### `pricing_audit_log`
| Column | Type | Description |
|--------|------|-------------|
| audit_id | BIGINT PK | |
| ticket_id | BIGINT FK | |
| session_id | BIGINT FK | |
| calculation_type | ENUM(TRANSIENT, SUBSCRIPTION, CORRECTION, REFUND) | |
| input_data_json | TEXT | |
| applied_tariff_id | BIGINT | |
| applied_rules_json | TEXT | |
| calculated_amount | DECIMAL(12,2) | |
| final_amount | DECIMAL(12,2) | |
| discount_applied | DECIMAL(12,2) | |
| holiday_multiplier | DECIMAL(4,2) | |
| calculation_time_ms | INT | |
| calculation_version | VARCHAR(20) | |

### 4.6 Ops & Audit

#### `audit_logs`
| Column | Type | Description |
|--------|------|-------------|
| audit_id | BIGINT PK | |
| site_id | BIGINT FK | |
| actor_user_id | BIGINT | |
| action | VARCHAR(64) | |
| entity_table | VARCHAR(64) | |
| entity_id | VARCHAR(64) | |
| before_snapshot | JSON | |
| after_snapshot | JSON | |
| request_id | VARCHAR(64) | |
| correlation_id | VARCHAR(64) | |
| occurred_at | DATETIME | |

#### `spot_occupancy_projection`
| Column | Type | Description |
|--------|------|-------------|
| projection_id | BIGINT PK | |
| site_id | BIGINT FK | |
| zone_id | BIGINT FK | |
| spot_id | BIGINT FK | |
| occupancy_status | ENUM(EMPTY, OCCUPIED_MATCHED, OCCUPIED_UNKNOWN, OCCUPIED_VIOLATION, SENSOR_STALE) | |
| last_sensor_event_at | DATETIME | |
| projected_vacant_at | DATETIME | |

#### `shift_closures`
| Column | Type | Description |
|--------|------|-------------|
| closure_id | BIGINT PK | |
| site_id | BIGINT FK | |
| shift_code | VARCHAR(64) | |
| open_time | DATETIME | |
| close_time | DATETIME | |
| closed_by_user_id | BIGINT | |
| total_tickets | INT | |
| total_amount | DECIMAL(12,2) | |

#### `gate_event_outbox`
| Column | Type | Description |
|--------|------|-------------|
| outbox_id | BIGINT PK | |
| event_id | BIGINT | |
| site_id | BIGINT FK | |
| event_time | DATETIME | |
| status | ENUM(PENDING, SENT, FAILED) | |
| attempts | INT | |
| sent_at | DATETIME | |
| next_retry_at | DATETIME | |
| last_error | TEXT | |
| mongo_doc_id | VARCHAR(64) | |
| payload_json | JSON | |
| created_at | DATETIME | |

#### `gate_event_outbox_dlq`
| Column | Type | Description |
|--------|------|-------------|
| dlq_id | BIGINT PK | |
| outbox_id | BIGINT UNIQUE | |
| site_id | BIGINT FK | |
| event_id | BIGINT | |
| event_time | DATETIME | |
| final_status | ENUM(TERMINAL_FAILED, MAX_RETRIES, SYSTEM_ERROR, DLQ_MANUAL) | |
| failure_reason | TEXT | |
| attempts | INT | |
| moved_at | DATETIME | |
| moved_by_user_id | BIGINT | |

#### `internal_presence_events`
| Column | Type | Description |
|--------|------|-------------|
| event_id | BIGINT PK | |
| site_id | BIGINT FK | |
| status | ENUM(ACCEPTED, REJECTED) | |
| plate_canonical | VARCHAR(32) | |
| rfid_uid | VARCHAR(64) | |
| spot_id | BIGINT FK | |
| event_time | DATETIME | |
| raw_payload | JSON | |

#### `api_idempotency_keys`
| Column | Type | Description |
|--------|------|-------------|
| key_id | BIGINT PK | |
| scope | VARCHAR(255) | |
| idempotency_key | VARCHAR(255) UNIQUE | |
| status | ENUM(IN_PROGRESS, SUCCEEDED, FAILED) | |
| request_hash | VARCHAR(64) | |
| response_json | MEDIUMTEXT | |
| created_at | DATETIME(3) | |
| updated_at | DATETIME(3) | |

#### `gate_events` *(partitioned legacy event log)*
| Column | Type | Description |
|--------|------|-------------|
| event_id | BIGINT | Partition key + primary |
| event_time | DATETIME | Partition key |
| site_id | BIGINT FK | |
| mongo_collection | VARCHAR(255) | Maps to external Mongo collection |
| payload_json | JSON | Event payload |
| outbox_id | BIGINT | Related outbox record |

#### `gate_incident_history`
| Column | Type | Description |
|--------|------|-------------|
| history_id | BIGINT PK | |
| incident_id | BIGINT FK | |
| action | VARCHAR(64) | `OPENED`, `ACKNOWLEDGED`, `RESOLVED`, `IGNORED`, `REOPENED` |
| actor_user_id | BIGINT | |
| before_status | ENUM(OPEN, ACKED, RESOLVED, IGNORED) | |
| after_status | ENUM(OPEN, ACKED, RESOLVED, IGNORED) | |
| notes | TEXT | |
| occurred_at | DATETIME | |

---

## 5. API Endpoints

### 5.1 Envelope Contract

**Success:**
```json
{ "requestId": "uuid", "data": {} }
```

**Error:**
```json
{ "requestId": "uuid", "code": "BAD_REQUEST", "message": "...", "details": {} }
```

### 5.2 Full Route List

#### Health & Readiness
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/health` | — | Health breakdown tất cả components |
| GET | `/api/ready` | — | Readiness probe |
| GET | `/metrics` | — | Prometheus metrics endpoint |

#### Auth Module
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/auth/password-policy` | — | Lấy policy mật khẩu |
| POST | `/api/auth/login` | — | Login (username + password) |
| POST | `/api/auth/refresh` | — | Refresh access token |
| POST | `/api/auth/logout` | — | Logout (revoke session) |
| POST | `/api/auth/revoke-all` | USER | Revoke tất cả sessions |
| POST | `/api/auth/admin/users/:userId/revoke-all` | `SUPER_ADMIN` / `SITE_ADMIN` / `MANAGER` / `OPERATOR` | Admin revoke all sessions |
| POST | `/api/auth/admin/users/:userId/disable` | `SUPER_ADMIN` / `SITE_ADMIN` / `MANAGER` / `OPERATOR` | Disable user |
| POST | `/api/auth/admin/users/:userId/enable` | `SUPER_ADMIN` / `SITE_ADMIN` / `MANAGER` / `OPERATOR` | Enable user |
| GET | `/api/me` | USER | Legacy alias cá»§a `/api/auth/me`, deprecated trong 1 release vÃ  cÃ³ `Deprecation` header |
| GET | `/api/auth/me` | USER | Lấy thông tin principal hiện tại |

#### Master Data (Topology)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/sites` | GUARD+ | Danh sách sites |
| GET | `/api/gates?siteCode=` | GUARD+ | Danh sách gates + lanes |
| GET | `/api/lanes?siteCode=` | GUARD+ | Danh sách lanes |
| GET | `/api/devices` | GUARD+ | Danh sách devices + heartbeat |
| GET | `/api/topology?siteCode=` | GUARD+ | Full topology (site→gates→lanes→devices) |

#### Topology Admin (v10.0)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/admin/topology/sites` | `SUPER_ADMIN` | Tạo site mới |
| PATCH | `/api/admin/topology/sites/:siteId` | ADMIN_OPS | Cập nhật site |
| POST | `/api/admin/topology/devices` | ADMIN_OPS | Tạo device mới |
| PATCH | `/api/admin/topology/devices/:deviceId` | ADMIN_OPS | Cập nhật device |
| GET | `/api/admin/topology/devices/unassigned` | ADMIN_OPS | Liệt kê devices chưa gán lane |
| POST | `/api/admin/topology/lanes` | ADMIN_OPS | Tạo lane mới |
| PATCH | `/api/admin/topology/lanes/:laneId` | ADMIN_OPS | Cập nhật lane |
| PUT | `/api/admin/topology/lanes/:laneId/devices` | ADMIN_OPS | Sync toàn bộ devices cho lane |

#### Gate Capture Routes
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/gate-reads/alpr` | DEVICE_CAPTURE | Device gửi ALPR read |
| POST | `/api/gate-reads/rfid` | DEVICE_CAPTURE | Device gửi RFID read |
| POST | `/api/gate-reads/sensor` | DEVICE_CAPTURE | Device gửi sensor event |
| POST | `/api/devices/heartbeat` | DEVICE_CAPTURE | Device heartbeat |
| POST | `/api/lane-flow/submit` | GUARD+ | Submit lane flow (plate confirmed) |
| POST | `/api/device-control/heartbeat-pulse` | GUARD+ | Manual heartbeat pulse |

#### Gate Session Routes
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/gate-sessions/open` | DEVICE_CAPTURE | Mở session mới |
| POST | `/api/gate-sessions/resolve` | DEVICE_CAPTURE | Resolve session (exit) |
| GET | `/api/gate-sessions` | GUARD+ | List sessions (cursor pagination) |
| GET | `/api/gate-sessions/:sessionId` | GUARD+ | Chi tiết session |
| POST | `/api/gate-sessions/:sessionId/confirm-pass` | GUARD+ | Confirm xe đã qua |
| POST | `/api/gate-sessions/:sessionId/cancel` | GUARD+ | Cancel session |

#### Gate Ops Query Routes
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/gate-review-queue` | OPS+ | List all reviews (open/claimed) |
| POST | `/api/gate-review-queue/:reviewId/claim` | OPS+ | Claim a review ticket |
| POST | `/api/gate-sessions/:sessionId/manual-approve` | OPS+ | Manual approve (creates review record) |
| POST | `/api/gate-sessions/:sessionId/manual-reject` | OPS+ | Manual reject |
| POST | `/api/gate-sessions/:sessionId/manual-open-barrier` | OPS+ | Force-open barrier (OPS only) |
| GET | `/api/ops/lane-status` | OPS+ | Trạng thái lane realtime |
| GET | `/api/ops/device-health` | OPS+ | Health thiết bị |

> **Note (v9.1):** The SPEC v9 documented review routes under `/gate-sessions/:sessionId/review/*`. The actual implementation exposes reviews at `/gate-review-queue/:reviewId/claim` and manual session actions at `/gate-sessions/:sessionId/manual-*`. The `/review/*` paths are **not implemented**.

#### Internal Presence Routes (v9.1)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/internal/presence-events` | API_KEY (route-level) | Internal zone presence ingestion |

#### Edge Routes (v9.1)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/edge/health` | Internal only | Edge health probe (403 public IP in prod) |
| POST | `/api/edge/outbox/:eventType` | API_KEY | Edge outbox event ingestion |

#### ALPR / Plate Recognition
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/alpr/preview` | GUARD+ | Preview nhận diện plate |
| POST | `/api/alpr/recognize` | GUARD+ | Nhận diện plate (strict) |

#### Media
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/media/upload` | GUARD+ | Upload ảnh capture (JWT) |
| POST | `/api/media/device-upload` | DEVICE_SIGNATURE | Upload ảnh từ Camera Edge (HMAC) |

#### Mobile Capture (Pairing)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/mobile-capture?pairToken=` | Public | Web app mobile camera |
| GET | `/api/mobile-capture/session` | Public (pairToken) | Session info |
| POST | `/api/mobile-capture/pair` | GUARD+ | Tạo pairing token |
| POST | `/api/mobile-capture/revoke` | GUARD+ | Revoke pairing |
| POST | `/api/mobile-capture/upload` | Public (pairToken) | Upload từ mobile |
| POST | `/api/mobile-capture/heartbeat` | Public (pairToken) | Mobile heartbeat |
| POST | `/api/mobile-capture/alpr` | Public (pairToken) | Mobile ALPR capture |

#### Legacy Gate Events
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/gate-events` | GUARD+ | List legacy gate events |
| POST | `/api/gate-events` | GUARD+ | Write legacy gate event |

#### Incident Routes
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/ops/incidents` | OPS+ | List incidents |
| GET | `/api/ops/incidents/:incidentId` | OPS+ | Chi tiết incident |
| POST | `/api/ops/incidents/:incidentId/resolve` | OPS+ | Resolve incident |

#### Dashboard & Reporting
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/ops/dashboard/summary` | OPS+ | Tổng hợp dashboard |
| GET | `/api/ops/dashboard/sites/:siteCode/summary` | OPS+ | Dashboard theo site |
| GET | `/api/ops/dashboard/incidents/summary` | OPS+ | Incident summary |
| GET | `/api/ops/dashboard/occupancy/summary` | OPS+ | Occupancy summary |
| GET | `/api/ops/dashboard/lanes/summary` | OPS+ | Lane summary |
| GET | `/api/ops/dashboard/subscriptions/summary` | OPS+ | Subscription summary |
| GET | `/api/reports/summary` | OPS+ | Entry/exit report |
| GET | `/api/ops/spot-occupancy` | OPS+ | Spot occupancy projection |
| GET | `/api/ops/spot-occupancy/:spotCode` | OPS+ | Chi tiết spot |

#### Parking Live
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/ops/parking-live` | OPS+ | Parking live board |
| GET | `/api/ops/parking-live/summary` | OPS+ | Parking live summary |
| GET | `/api/ops/parking-live/spots/:spotCode` | OPS+ | Spot detail |

#### Subscription Admin
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/admin/subscriptions` | OPS+ | List subscriptions |
| GET | `/api/admin/subscriptions/:subscriptionId` | OPS+ | Chi tiết subscription |
| GET | `/api/admin/subscription-spots` | OPS+ | List subscription spots |
| GET | `/api/admin/subscription-spots/:spotId` | OPS+ | Spot detail |
| GET | `/api/admin/subscription-vehicles` | OPS+ | List subscription vehicles |
| GET | `/api/admin/subscription-vehicles/:vehicleId` | OPS+ | Vehicle detail |
| POST | `/api/admin/subscriptions/bulk-import` | OPS+ | Bulk import subscriptions (202 Accepted + jobId) |
| GET | `/api/admin/jobs/:jobId` | OPS+ | Trạng thái bulk import job |

#### Webhooks (B2B Integration)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/integrations/webhooks` | OPS+ | Tạo webhook endpoint |
| GET | `/api/integrations/webhooks` | OPS+ | List webhooks |
| GET | `/api/integrations/webhooks/:webhookId` | OPS+ | Chi tiết webhook |
| PATCH | `/api/integrations/webhooks/:webhookId` | OPS+ | Cập nhật webhook |
| DELETE | `/api/integrations/webhooks/:webhookId` | ADMIN | Xóa webhook |
| POST | `/api/integrations/webhooks/:webhookId/regenerate-secret` | ADMIN | Tạo lại secret key |
| GET | `/api/integrations/webhooks/:webhookId/deliveries` | OPS+ | Lịch sử delivery |
| POST | `/api/integrations/webhooks/:webhookId/test` | OPS+ | Gửi test event |

#### Audit
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/ops/audit` | OPS+ | List audit records |
| GET | `/api/ops/audit/:auditId` | OPS+ | Chi tiết audit record |

#### Outbox
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/outbox` | OPS+ | List outbox events |
| POST | `/api/outbox/drain` | WORKER+ | Drain outbox (sync) |
| POST | `/api/outbox/requeue` | OPS+ | Requeue failed events |

#### Metrics
| Method | Route | Auth | Description |
|--------|-------|------|-------------|


> **v9.2:** `/openapi.json` and `/docs` return 403 in `NODE_ENV=production`.
| GET | `/api/ops/metrics/summary` | OPS+ | Debug metrics summary |

### 5.3 SSE Streams (Realtime Delta)

#### Lane Status Stream — `/api/stream/lane-status`
| Event Name | Payload | Trigger |
|------------|---------|---------|
| `hello` | `{ requestId, sessionId, subscribedLanes[] }` | Initial connection |
| `lane_status_snapshot` | Full lane status object | On subscribe |
| `lane.status.upsert` | `{ laneId, status, barrierState, lastHeartbeat }` | Lane state change |
| `lane.status.remove` | `{ laneId }` | Lane removed |
| `lane.barrier.lifecycle` | `{ laneId, barrierState, reason }` | Barrier open/close |

#### Device Health Stream — `/api/stream/device-health`
| Event Name | Payload | Trigger |
|------------|---------|---------|
| `hello` | `{ requestId, sessionId }` | Initial connection |
| `device_health_snapshot` | Full device list | On subscribe |
| `device.health.upsert` | `{ deviceId, status, latencyMs, ipAddress }` | Health change |
| `device.health.remove` | `{ deviceId }` | Device removed |

#### Outbox Stream — `/api/stream/outbox`
| Event Name | Payload | Trigger |
|------------|---------|---------|
| `hello` | `{ requestId, sessionId }` | Initial connection |
| `outbox_snapshot` | All PENDING outbox items | On subscribe |
| `outbox.item.upsert` | `{ outboxId, status, eventType, attempts }` | Outbox item change |
| `outbox.item.remove` | `{ outboxId }` | Outbox item removed |
| `outbox.barrier.lifecycle` | `{ outboxId, barrierState }` | Barrier command lifecycle |

#### Parking Live Stream — `/api/stream/parking-live`
| Event Name | Payload | Trigger |
|------------|---------|---------|
| `hello` | `{ requestId, sessionId }` | Initial connection |
| `snapshot.ready` | Full snapshot `{ slots[], floorSummary[] }` | On subscribe |
| `slot.updated` | `{ spotCode, zoneId, status, plate?, occupancyStatus }` | Spot state change |
| `floor.summary.updated` | `{ zoneId, occupancyRate, freeSpots }` | Zone summary change |
| `stream.stale` | `{ reason, staleAt }` | Data staleness detected |

> **Note (v9.1):** The SPEC v9 documented generic event names (e.g., `lane_status`, `outbox_event`). The actual SSE implementation publishes granular delta events (`*.upsert`, `*.remove`, `*.lifecycle`) along with full snapshots on subscribe. The Parking Live stream uses `slot.updated` and `floor.summary.updated` instead of the generic `parking_live_delta` label.

---

## 6. ALPR / License Plate Recognition

### 6.1 Architecture

```
Camera Image
     │
     ▼
┌─────────────────┐     ┌─────────────────────────┐
│  HTTP Provider  │────▶│  YOLOv8 + PaddleOCR     │
│  (Primary)      │     │  GPU Microservice       │
│  ALPR_MODE=HTTP │     │  localhost:8765/predict │
└─────────────────┘     └─────────────────────────┘
     │
     ▼ (fallback)
┌─────────────────┐
│   Tesseract OCR  │
│   ALPR_MODE=TES │
│   (Local)        │
└─────────────────┘
```

### 6.2 Plate Canonicalization

Module `@parkly/gate-core` — hàm `buildPlateCanonical()`:

- **Normalization:** Loại bỏ dấu cách, chữ hoa
- **Family Detection:** Nhận diện loại biển (2 dòng, 1 dòng, quân đội, ngoại giao...)
- **Validity Scoring:** `STRICT_VALID`, `REVIEW`, `INVALID`, `UNKNOWN`
- **OCR Confidence:** Từ provider (0-1)
- **Suspicious Flags:** `MISMATCH`, `LOW_CONF`, `INVALID_FORMAT`, `SAME_AS_PREVIOUS`

### 6.3 ALPR Provider Order

1. **HTTP** (YOLOv8 + PaddleOCR GPU) — primary, production
2. **Tesseract** — local fallback, dev mode
3. **MOCK** — skip ALPR, no CPU cost (dev testing)

### 6.4 Preview Cache

- **Backend:** Redis
- **TTL:** 2 giây response, 3 giây dedupe
- **Key:** SHA256(surface + siteCode + laneCode + imageUrl + plateHint)
- **Debug Headers:** `x-alpr-preview-cache`, `x-alpr-preview-cache-key`

### 6.5 ALPR Confusion Map

- Redis-backed map tránh nhận diện sai cùng một plate trên cùng lane trong khoảng thời gian ngắn
- Hỗ trợ `ALPR_EXTERNAL_ESCALATION_THRESHOLD=86` (confidence threshold)

---

## 7. Gate & Lane Management

### 7.1 Device Types
- `RFID_READER` — Đọc thẻ từ
- `CAMERA_ALPR` — Camera nhận diện biển số
- `BARRIER` — Thiết bị điều khiển barrier
- `LOOP_SENSOR` — Cảm biến loop (phát hiện xe)

### 7.2 Lane Configuration
- Mỗi lane có 1 `gate_code` (e.g., `GATE_01`) và 1 `lane_code` (ENTRY/EXIT)
- Lane có nhiều thiết bị (`gate_lane_devices`):
  - `PRIMARY` — Thiết bị chính
  - `CAMERA` — Camera ALPR
  - `RFID` — Đầu đọc RFID
  - `LOOP_SENSOR` — Cảm biến loop
  - `BARRIER` — Barrier controller

### 7.3 Device Signature (Capture Auth)

```
HMAC-SHA256(secret, timestamp + method + path + body)
Header: X-Device-Signature: <hmac>
Header: X-Device-Timestamp: <unix_ms>
Header: X-Device-Code: <device_code>
```

- Secrets: per-device (`DEVICE_CAPTURE_SECRET_<CODE>`) hoặc default
- Max skew: 5 phút
- Secrets có thể rotate (ACTIVE + NEXT)

### 7.4 Topology Resolution

Backend tự động build full topology từ:
1. `parking_sites` → `gate_lanes` → `gate_lane_devices` → `gate_devices`
2. Fallback: synthetic topology từ `gate_devices` (không có lane table)
3. Heartbeat info: latest heartbeat per device

---

## 8. Decision Engine

### 8.1 Decision Flow

```
Device Capture (ALPR/RFID/Sensor)
    │
    ▼
┌─────────────────────┐
│ Capture Ingestion    │ → gate_read_events, gate_read_media
│ ingestAlprRead()     │ → idempotency check
│ ingestRfidRead()     │
│ ingestSensorRead()   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Session Orchestrator│ → open-session / resolve-session
│ openOrReuseSession  │ → anti-passback check
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Decision Engine     │ → evaluateSessionDecision()
│ evaluateGateDecision│ → rule evaluation
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
  APPROVE      REVIEW ──▶ Manual Review Queue
     │               ──▶ claim-review
     │               ──▶ manual-approve/reject
     ▼
Barrier Command
  OPEN / CLOSE
     │
     ▼
Outbox Event (async delivery to Mongo/external)
```

### 8.2 Decision Inputs

```typescript
{
  plateValidity: 'STRICT_VALID' | 'REVIEW' | 'INVALID' | 'UNKNOWN',
  ocrConfidence: number | null,
  rfidUid: string | null,
  laneDirection: 'ENTRY' | 'EXIT',
  presenceActive: boolean,
  openTicket: OpenTicketContext | null,
  activePresence: ActivePresenceContext | null,
  paymentStatus: PaymentStatus,
  deviceHealth: DeviceHealth,
  credentialStatus: CredentialStatus,
  plateTicketId: string | null,
  rfidTicketId: string | null,
}
```

### 8.3 Decision Thresholds (from ENV)

| Threshold | Default | Description |
|-----------|---------|-------------|
| `ocrApproveMin` | 0.85 | OCR confidence tối thiểu để auto-approve |
| `ocrReviewMin` | 0.60 | OCR confidence tối thiểu để review |
| `degradedHeartbeatAgeSeconds` | 90 | Ngưỡng degraded |
| `offlineHeartbeatAgeSeconds` | 300 | Ngưỡng offline |
| `antiPassbackStaleSeconds` | 3600 | Anti-passback timeout |
| `antiPassbackSameLaneDebounceSeconds` | 30 | Debounce cùng lane |

### 8.4 Decision Codes

**Base Codes:**

| Code | Description |
|------|-------------|
| `AUTO_APPROVED` | Auto open barrier |
| `REVIEW_REQUIRED` | Cần manual review |
| `AUTO_DENIED` | Auto deny (anti-passback, degraded device) |
| `PAYMENT_REQUIRED` | Yêu cầu thanh toán trước khi ra |
| `TICKET_NOT_FOUND` | Không tìm thấy ticket |
| `PLATE_RFID_MISMATCH` | Biển số không khớp RFID |
| `ANTI_PASSBACK_BLOCKED` | Vi phạm anti-passback |
| `DEVICE_DEGRADED` | Thiết bị degraded |
| `SUBSCRIPTION_AUTO_APPROVED` | Subscription hợp lệ tự động |
| `SUBSCRIPTION_EXIT_BYPASS_PAYMENT` | Subscription exit không cần trả tiền |
| `SUBSCRIPTION_REVIEW_REQUIRED` | Subscription cần review |

**Extended Codes (v9.1):**

| Code | Trigger | Reason Code |
|------|---------|-------------|
| `REVIEW_REQUIRED` | `presenceActive === false` | `PRESENCE_NOT_ACTIVE` |
| `DEVICE_DEGRADED` | Device heartbeat `OFFLINE` | `DEVICE_OFFLINE` |
| `DEVICE_DEGRADED` | Device heartbeat `DEGRADED` | `DEVICE_HEALTH_DEGRADED` |
| `AUTO_DENIED` | Credential `LOST` | `RFID_CREDENTIAL_LOST` |
| `AUTO_DENIED` | Credential `BLOCKED` | `RFID_CREDENTIAL_BLOCKED` |
| `AUTO_DENIED` | Plate validity `INVALID` | `PLATE_INVALID` |
| `REVIEW_REQUIRED` | OCR confidence < review min | `OCR_CONFIDENCE_TOO_LOW` |
| `REVIEW_REQUIRED` | Plate validity `REVIEW` | `PLATE_REVIEW_REQUIRED` |
| `REVIEW_REQUIRED` | OCR below approve min but above review min | `OCR_CONFIDENCE_REVIEW` |
| `AUTO_APPROVED` | EXIT + payment `WAIVED` | `EXIT_WAIVED` |
| `AUTO_APPROVED` | EXIT + payment `SUBSCRIPTION_COVERED` | `EXIT_SUBSCRIPTION_COVERED` |
| `REVIEW_REQUIRED` | EXIT + payment status `UNKNOWN` | `PAYMENT_STATUS_UNKNOWN` |

### 8.5 Anti-Passback Logic

- Entry: tạo `gate_active_presence` record
- Exit: kiểm tra presence hợp lệ, xóa presence record
- **Softening:** Nếu OCR confidence thấp + anti-passback triggered → chuyển sang REVIEW thay vì DENY

### 8.6 Payment Status Resolution (v9.1)

The exit flow resolves payment status via `paymentStatusResolver.resolve()`:

| Status | Description |
|--------|-------------|
| `PAID` | Ticket has a PAID payment record |
| `WAIVED` | Exit waived (manual override, zero-fee tariff) |
| `SUBSCRIPTION_COVERED` | Active subscription covers this exit |
| `REFUNDED` | Payment was refunded |
| `NOT_APPLICABLE` | No payment required (e.g., free grace period) |
| `PENDING` | Awaiting payment |
| `UNKNOWN` | Unable to determine payment status — triggers REVIEW |

Threshold: `EXIT_UNKNOWN_PAYMENT_REVIEW_SECONDS=120` — if resolution takes longer than this, falls back to `UNKNOWN`.

---

## 9. Session Orchestration

### 9.1 Session Lifecycle

```
OPEN → WAITING_READ → WAITING_DECISION → APPROVED → PASSED
                                    ↓
                               WAITING_PAYMENT → APPROVED → PASSED
                                    ↓
                                  DENIED → CANCELLED
                                    ↓
                                  TIMEOUT
```

### 9.2 Entry Flow (process-entry.ts)
1. Receive ALPR/RFID read
2. Check anti-passback (no existing active presence)
3. Find or create ticket (credential lookup for subscription)
4. Check subscription eligibility
5. Open session + issue decision
6. Send barrier command (if APPROVED)
7. Create active presence record

### 9.3 Exit Flow (process-exit.ts)
1. Receive ALPR/RFID read
2. Find active presence + ticket
3. Verify payment status
4. Calculate parking fee (if transient)
5. Decision: APPROVE (free) / PAYMENT_HOLD / DENY
6. Close session + update presence
7. Send barrier command

### 9.4 Session Resolution
- `resolve-session.ts` — `openOrReuseSessionAndResolve()`
- Idempotency key: prevents duplicate session creation
- Anti-passback: prevents same vehicle entering twice without exit

---

## 10. Subscription Management

### 10.1 Subscription Flow

```
Vehicle arrives (ALPR)
    │
    ▼
findCredentialByRfid() / plate lookup
    │
    ▼
resolveSubscriptionDecisionContext()
    │
    ├── Subscription FOUND + ACTIVE
    │   ├── Eligible entry → SUBSCRIPTION_AUTO_APPROVED
    │   └── Ineligible → SUBSCRIPTION_REVIEW_REQUIRED
    │
    └── Subscription NOT FOUND
        └── Proceed as TRANSIENT (ticket-based)
```

### 10.2 Subscription Spot Assignment

- `ASSIGNED` — Spot cố định
- `PREFERRED` — Ưu tiên nhưng có thể thay đổi
- Subscription vehicles có thể đăng ký nhiều biển số + RFID

### 10.3 Admin Routes

- Full CRUD cho subscriptions
- Subscription spots management (assign/release spots)
- Subscription vehicles management (add/remove vehicles)
- Expiry tracking + dashboard summary

---

## 11. Tariff & Pricing System

### 11.1 Pricing Models

**Vãng lai (Transient/TICKET):**
- Free minutes (grace period)
- Hourly rate (progression)
- Daily cap
- Overnight surcharge
- Holiday multiplier

**Thuê bao (Subscription):**
- Fixed monthly fee
- Unlimited entry/exit within validity
- Priority access
- Spot assignment

### 11.2 Pricing Rules (tariff_rules)

Rule types hỗ trợ:
- `FREE_MINUTES` — Miễn phí X phút đầu
- `HOURLY` — Tính theo giờ
- `DAILY_CAP` — Giới hạn ngày
- `OVERNIGHT` — Phụ thu qua đêm
- `FLAT_RATE` — Giá cố định
- `DURATION_BLOCK` — Tính theo block thời gian
- `PROGRESSION_RATE` — Bậc thang giá
- `ZONE_SPECIFIC_RATE` — Giá theo zone
- `SPECIAL_EVENT_RATE` — Giá sự kiện đặc biệt
- `LOST_CREDENTIAL_FEE` — Phí mất thẻ
- `HOLIDAY_MULTIPLIER` — Hệ số ngày lễ
- `TIME_OF_DAY_RATE` — Giá theo khung giờ
- `SUBSCRIPTION_*` — Các loại subscription

### 11.3 Compound Rules

Kết hợp nhiều rule với operators:
- `AND` — Tất cả rule phải match
- `OR` — Ít nhất 1 rule match
- `AND_NOT` — Loại trừ
- `XOR` — Chính xác 1 rule match

### 11.4 Special Pricing Periods

| Type | Description |
|------|-------------|
| `PEAK` | Giờ cao điểm (7h-9h, 17h-19h) |
| `OFF_PEAK` | Giờ thấp điểm |
| `NIGHT` | Ban đêm (22h-6h) |
| `WEEKEND` | Cuối tuần |
| `SPECIAL` | Sự kiện đặc biệt |
| `CUSTOM` | Tùy chỉnh |

### 11.5 Holiday Pricing

- Ngày lễ quốc gia: multiplier configurable
- Regional holidays: per-site
- Flat surcharge (VD: +20,000 VND)
- Áp dụng hoặc không cho subscriptions

### 11.6 Discount Rules

- `PERCENTAGE` — Giảm % giá
- `FIXED_AMOUNT` — Giảm số tiền cố định
- `FREE_MINUTES` — Miễn phí X phút
- `FREE_HOURS` — Miễn phí X giờ
- `MULTIPLIER` — Nhân hệ số
- Stackable options
- Promo code support
- Usage limits

---

## 12. Incident Management

### 12.1 Incident Types

| Type | Severity | Description |
|------|----------|-------------|
| `VIP_WRONG_SPOT` | WARN | VIP đỗ sai chỗ |
| `RESERVED_SPOT_OCCUPIED_BY_OTHER` | WARN | Chỗ reserved bị chiếm |
| `SENSOR_STALE` | INFO | Sensor không hoạt động |
| `MISSING_GATE_PRESENCE` | INFO | Không có presence signal |
| `PLATE_UNAVAILABLE` | INFO | Không đọc được biển số |

### 12.2 Noise Control Policy

- **Grace thresholds:** Tránh flood ghost incidents
- **Cooldown:** Signal lặp lại refresh `lastSignalAt`, không emit SSE mới
- **Reopen policy:** Incident resolved có thể reopen nếu cùng source quay lại trong window
- **Deduplication:** Group by `sourceKey` (spot code)

### 12.3 Incident SSE Events

- `incident.opened`
- `incident.updated`
- `incident.reopened`
- `incident.resolved`

---

## 13. Dashboard & Reporting

### 13.1 Dashboard Summary

`GET /api/ops/dashboard/summary` trả:

```json
{
  "generatedAt": "2026-03-21T00:00:00Z",
  "scope": { "siteCodes": ["SITE_HCM_01"] },
  "filters": { "sinceHours": 24 },
  "overview": {
    "totalEntry": 142,
    "totalExit": 138,
    "openIncidents": 3,
    "activeSessions": 8,
    "occupiedSpots": 234,
    "totalSpots": 500,
    "occupancyRate": 46.8
  },
  "incidents": { "total": 12, "critical": 0, "warn": 3, "info": 9 },
  "occupancy": { "byZone": [...] },
  "lanes": { "byStatus": { "ACTIVE": 8, "MAINTENANCE": 1 } },
  "subscriptions": { "active": 89, "expiringIn7Days": 5 },
  "sites": [...]
}
```

### 13.2 Reports

- Entry/exit counts by date range
- Revenue summary
- Occupancy by zone
- Subscription expiry tracking
- Incident trends

---

## 14. Audit & Observability

### 14.1 Audit Coverage

Audit records cho các mutate paths:
- Auth (login/refresh/logout/revoke)
- Incident (open/resolve/reopen)
- Review (claim/approve/reject/barrier)
- Subscription (CRUD/spot assignment/vehicle assignment)
- Shift closure

### 14.2 Audit Record Shape

```json
{
  "auditId": "1",
  "siteId": "1",
  "siteCode": "SITE_HCM_01",
  "actorUserId": "3",
  "actor": { "userId": 3, "username": "guard01", "role": "GUARD" },
  "action": "REVIEW_CLAIM",
  "entityTable": "gate_manual_reviews",
  "entityId": "42",
  "beforeSnapshot": null,
  "afterSnapshot": { "status": "CLAIMED", "claimedBy": 3 },
  "requestId": "uuid",
  "correlationId": "uuid",
  "occurredAt": "2026-03-21T00:00:00Z",
  "createdAt": "2026-03-21T00:00:00Z"
}
```

### 14.3 Prometheus Metrics

Endpoint: `GET /metrics` (text format, Prometheus scrape)

Custom metrics:
- `parkly_requests_total` — Total requests by surface, action, status
- `parkly_request_duration_ms` — Latency histogram
- `parkly_incidents_total` — Incidents by type, status
- `parkly_outbox_backlog_size` — Outbox queue size by site, status
- `parkly_device_offline_count` — Offline devices by site
- `parkly_review_queue_size` — Review queue by site
- `parkly_tariff_calculation_duration_ms` — Tariff calculation latency histogram (RC3)
- `parkly_decision_engine_outcomes_total` — Decision engine outcomes counter by decision_code (RC3)
- `parkly_active_sse_connections` — Active SSE connection gauge (RC3)
- `parkly_lane_lock_wait_time_ms` — Lane lock acquisition latency histogram (RC3)

### 14.4 Health Breakdown

`GET /api/health` trả:
- `components.db` — MySQL connectivity
- `components.redis` — Redis connectivity
- `components.mediaStorage` — MinIO/S3 connectivity
- `components.intakeSigning` — Device capture signing config
- `components.backgroundJobs.authSessionCleanup` — Background job status

Status values: `READY`, `DEGRADED`, `NOT_READY`, `MISCONFIGURED`

---

## 15. Authentication & Authorization

### 15.1 Auth Modes

| Mode | Description |
|------|-------------|
| `ON` | Full JWT auth, all routes protected |
| `OFF` | No auth (**dev only** — throws 401 in production) |

> **v9.2:** `AUTH_MODE=OFF` is guarded by `NODE_ENV !== 'production'`. Setting this in production throws `UNAUTHENTICATED`.

### 15.2 JWT Structure

**Access Token (15 min):**
```json
{
  "sub": "user:3",
  "type": "ACCESS",
  "role": "OPERATOR",
  "siteScopes": ["SITE_HCM_01"],
  "sessionId": "sess_xxx",
  "iat": 1711000000,
  "exp": 1711000900
}
```

**Refresh Token (7 days):**
```json
{
  "sub": "user:3",
  "type": "REFRESH",
  "iat": 1711000000,
  "exp": 1711600000
}
```

### 15.3 Roles

Canonical user roles (source of truth cho API + web):

| Role | Description | Permissions |
|------|-------------|-------------|
| `SUPER_ADMIN` | Quáº£n trá»‹ toÃ n há»‡ thá»‘ng | Global access, bypass role checks, all active sites by default |
| `SITE_ADMIN` | Quáº£n trá»‹ site | Admin shell + scoped site administration |
| `MANAGER` | Quáº£n lÃ½ váº­n hÃ nh | Admin shell + dashboard / subscriptions / reports trong site Ä‘Æ°á»£c gÃ¡n |
| `OPERATOR` | NhÃ¢n viÃªn váº­n hÃ nh | Ops shell + run lane / review / monitoring trong site Ä‘Æ°á»£c gÃ¡n |
| `GUARD` | Báº£o vá»‡ | Gate read, media upload, review queue trong site Ä‘Æ°á»£c gÃ¡n |
| `CASHIER` | Thu ngÃ¢n | Reports / payments / settings trong site Ä‘Æ°á»£c gÃ¡n |
| `VIEWER` | Quan sÃ¡t viÃªn | Read-only: overview, session history, lane monitor, device health, reports, parking live, settings |
| `WORKER` | System worker | Internal service calls, outbox processing, background jobs |

> **v9.2:** `WORKER` added to `ALL_CANONICAL_USER_ROLES`. Was missing — caused 403 on `/auth/me` and `/auth/revoke-all` for WORKER-only users.

### 15.4 Role Groups (auth-policies.ts)

All route files import role groups from `src/server/auth-policies.ts` — no local duplicate definitions:

```
ALL_CANONICAL_USER_ROLES[]               -- SUPER_ADMIN, SITE_ADMIN, MANAGER, CASHIER, GUARD, OPERATOR, VIEWER, WORKER
OPS_CONSOLE_ROLES[]                     -- SITE_ADMIN, MANAGER, OPERATOR
GUARD_CONSOLE_ROLES[]                   -- GUARD
CASHIER_CONSOLE_ROLES[]                 -- CASHIER
VIEWER_CONSOLE_ROLES[]                  -- VIEWER
ADMIN_OPS_ROLES[]                       -- SITE_ADMIN, MANAGER, OPERATOR
ADMIN_OPS_GUARD_ROLES[]                 -- ADMIN_OPS_ROLES + GUARD
ADMIN_OPS_WORKER_ROLES[]              -- ADMIN_OPS_ROLES
ADMIN_OPS_GUARD_WORKER_ROLES[]        -- ADMIN_OPS_GUARD_ROLES
ADMIN_OPS_GUARD_CASHIER_WORKER_ROLES[] -- ADMIN_OPS_GUARD_ROLES + CASHIER
ADMIN_OPS_CASHIER_ROLES[]               -- ADMIN_OPS_ROLES + CASHIER
DASHBOARD_READ_ROLES[]                  -- ADMIN_OPS_GUARD_CASHIER_WORKER_ROLES + WORKER + VIEWER
SESSION_READ_ROLES[]                    -- ADMIN_OPS_GUARD_WORKER_ROLES + VIEWER
GATE_MONITOR_READ_ROLES[]            -- ADMIN_OPS_GUARD_WORKER_ROLES + VIEWER
PARKING_LIVE_READ_ROLES[]             -- ADMIN_OPS_GUARD_ROLES + VIEWER
```

> **v9.2:** Local role array duplicates removed from all 9 route files (register-gate-session-routes, register-media-routes, register-incident-stream, register-gate-incident-routes, register-audit-routes, register-webhook-routes, register-subscription-admin-routes, register-bulk-import-routes, register-spot-occupancy-routes). Legacy `OPS`/`ADMIN` strings eliminated.

---

### 15.4 Site Scope Enforcement


Canonical site-scope rules:
- `SUPER_ADMIN` cÃ³ global scope máº·c Ä‘á»‹nh trÃªn toÃ n bá»™ active sites, ngay cáº£ khi khÃ´ng cÃ³ `user_site_scopes`
- `SITE_ADMIN`, `MANAGER`, `OPERATOR`, `GUARD`, `CASHIER`, `VIEWER` chá»‰ truy cáº­p Ä‘Æ°á»£c cÃ¡c site Ä‘Ã£ Ä‘Æ°á»£c gÃ¡n
- `SERVICE` principal giá»¯ nguyÃªn bypass semantics cho internal flow
- `/api/auth/me` lÃ  canonical bootstrap endpoint; `/api/me` lÃ  alias deprecated trong 1 release
The legacy shorthand bullets below are retained for backward context only and are superseded by the canonical rules above.

- `user_site_scopes` table: principal → site mapping
- Non-ADMIN/OPS accounts bị giới hạn site scope
- Backend không cho cross-site join lậu

### 15.5 Session Hygiene

- **Login failure tracking:** Bucket `USERNAME` và `USERNAME_IP`
- **Progressive delay:** Tăng delay sau mỗi lần fail
- **Lockout:** 5 failures → 120s lockout
- **Session limit:** Max 5 sessions per user
- **Cleanup script:** `pnpm auth:sessions:cleanup`

### 15.6 Password Policy

- Min 10 characters
- Require uppercase, lowercase, digit, special character
- Policy endpoint: `GET /api/auth/password-policy`

---

## 16. Mobile Capture (Pairing)

### 16.1 Pairing Flow

```
Admin creates pairing:
POST /api/mobile-capture/pair
  { siteCode, laneCode, deviceCode, direction }

Returns: { pairToken, expiresAt, mobileUrl, qrUrl }

Security Guard scans QR → opens /mobile-capture?pairToken=xxx
Mobile renders camera capture web app
Mobile sends ALPR captures directly to API
```

### 16.2 Mobile Capture Security

| Feature | Detail |
|---------|--------|
| Pair token format | UUID v4 — unguessable |
| Pair token TTL | Configurable (default 8 hours) |
| Rate limit | 20 req/IP/60s on all pair-token endpoints |
| API key validation | `x-internal-api-key` header validated at route level |
| Replay guard | Redis nonce per token+operation |

> **v9.2:** All public mobile capture endpoints (GET /mobile-capture, GET /mobile-capture/session, POST /mobile-capture/upload, POST /mobile-capture/heartbeat, POST /mobile-capture/alpr) now have IP-based rate limiting. Prevents brute-force enumeration of pair tokens.

### 16.3 Mobile Capture Features (formerly 16.2)

- Camera capture via browser (`capture="environment"`)
- Tesseract OCR on-device (fallback)
- Plate hint manual input
- Heartbeat pulse
- Media upload
- Pairing TTL: configurable
- Session auto-refresh (60s)

### 16.3 Mobile Pairing Secrets

Uses device capture auth:
- HMAC signature with pair token
- No static device secret needed on mobile
- Pair token rotation supported

---

## 17. Media Storage Pipeline

### 17.1 Storage Providers

| Provider | Config | Use Case |
|----------|--------|----------|
| `MINIO` | S3_ENDPOINT, S3_BUCKET_MEDIA | Production (local S3) |
| `LOCAL` | UPLOAD_DIR | Dev / fallback |

### 17.2 Upload Flow

```
Client uploads image:
POST /api/media/upload (multipart)
  ↓
Validate mime type (JPEG, PNG, WEBP)
  ↓
Calculate SHA256 hash
  ↓
Store to MinIO (object key: `gate-media/{siteCode}/{date}/{sha256}.{ext}`)
  ↓
Return: { imageUrl, viewUrl, sha256, dimensions }
```

### 17.3 Presigned URLs

- Generate presigned URL for third-party access
- TTL: 5 minutes (configurable)
- MinIO handles all S3-compatible storage

### 17.4 Image Dimensions

- Extracted via Sharp (if available) or image-size
- Stored in `gate_read_media.width_px`, `height_px`

---

## 18. Outbox & Event Delivery

### 18.1 Outbox Pattern

```
Barrier command issued
    │
    ▼
gate_event_outbox record created (status: PENDING)
    │
    ▼
Outbox Worker picks up (BullMQ)
    │
    ▼
Attempt delivery to external system (Mongo / webhook)
    │
    ├── SUCCESS → status: SENT
    │
    └── FAILURE
        ├── Retry with exponential backoff (5s → 300s)
        ├── Max 8 attempts
        └── After max → DLQ
```

### 18.2 DLQ Processing

- `gate_event_outbox_dlq` — Dead letter queue
- Manual requeue via `POST /api/outbox/requeue`
- `final_status`: `TERMINAL_FAILED`, `MAX_RETRIES`, `SYSTEM_ERROR`, `DLQ_MANUAL`

### 18.3 Inline Sync Mode

- `OUTBOX_INLINE_SYNC=false` (default): async via BullMQ
- `OUTBOX_INLINE_SYNC=true`: synchronous delivery (no queue)

---

## 19. Background Workers

### 19.1 Outbox Worker (BullMQ)

```typescript
// apps/api/src/worker/index.ts
Worker("parkly:development:outbox", async (job) => {
  await processOutboxEvent(job.data)
})
```

- **Queue:** `parkly:development:outbox`
- **Concurrency:** 4 (configurable via `OUTBOX_QUEUE_CONCURRENCY`)
- **Batch size:** 100 records per scan
- **Scan interval:** 5s (configurable via `OUTBOX_WORKER_INTERVAL_MS`)
- **Retry:** Exponential backoff with jitter (configurable via `OUTBOX_BACKOFF_JITTER`)
- **DLQ Worker:** Separate worker (`runtime.dlq`), concurrency 1 — `apps/api/src/worker/processors/outbox-deadletter.processor.ts`

### 19.2 Background Jobs

| Job | Description | Schedule |
|-----|-------------|----------|
| `authSessionCleanup` | Xóa expired/revoked sessions | Periodic via script |
| `retentionCleanup` | Xóa old audit/incident logs | Periodic via script |
| `shiftClosure` | Đóng ca làm việc | Manual trigger |
| `bulk-import` | Bulk subscription CSV import | BullMQ queue `parkly:admin:bulk-import`, `202 + jobId` |
| `ghost-presence-purge` | Clear stale `gate_active_presence` records (ACTIVE > 24h) | BullMQ repeatable cron `0 2 * * *` (02:00 AM daily) |
| `ghost-presence-purge` (polling) | Purge stale presence via Redis `lpop` polling | Poll loop every `GHOST_PURGE_POLL_INTERVAL_MS=5000`, batch 200 |

### 19.3 Ghost Presence Purge (v9.1)

**Purpose:** Vehicles might tailgate and leave without triggering the exit camera, leaving a "Ghost Presence" in `gate_active_presence`. The purge worker clears stale records after 24 hours to prevent false Anti-Passback blocks.

**Queue:** `parkly:ghost-presence-purge`
**Cron:** `0 2 * * *` (daily 02:00 AM, configurable)
**Polling:** `ghostPurgePollLoop()` in `apps/api/src/worker/index.ts` — polls Redis every `GHOST_PURGE_POLL_INTERVAL_MS`, batch 200 records, writes `SYSTEM_AUTO_PURGE_GHOST_PRESENCE` audit logs.

**Audit:** Each purge operation writes an audit log with `action = SYSTEM_AUTO_PURGE_GHOST_PRESENCE`, `entity_table = gate_active_presence`, `entity_id = presence_id`, `before_snapshot = { status: "ACTIVE" }`, `after_snapshot = null`.

### 19.4 Metrics Loop (v9.1)

**File:** `apps/api/src/worker/index.ts` — `metricsLoop()`
- Logs BullMQ queue telemetry every `OUTBOX_QUEUE_METRICS_INTERVAL_MS=10000`
- Reports: `outbox_backlog_size`, `outbox_failed_count`, `dlq_size`, `active_worker_count`

---

## 20. Frontend (Web App)

### 20.1 Project Structure (apps/web)

```
apps/web/
├── src/
│   ├── pages/           # Route pages
│   ├── components/      # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── services/        # API client layer
│   ├── stores/          # Zustand state stores
│   ├── utils/           # Utilities
│   ├── types/           # TypeScript types
│   └── App.tsx          # Root component
├── public/              # Static assets
├── package.json
├── vite.config.ts
└── .cursorrules         # AI coding standards
```

### 20.2 Key Pages

- **Dashboard** — Overview với cards: Occupancy, Incidents, Sessions, Subscriptions
- **Gate Monitor** — Realtime gate sessions + review queue
- **Topology** — Site → Gate → Lane → Device visualization with React Flow (interactive graph, xem §41)
- **Incidents** — Incident list + detail
- **Subscriptions** — Subscription CRUD + management
- **Reports** — Entry/exit reports, revenue
- **Settings** — User management, site config
- **Run Lane** — Lane flow camera operation
- **Parking Live** — Realtime spot occupancy board
- **Session History** — Paginated session log
- **Outbox Monitor** — Outbox event queue management
- **Audit Viewer** — Full audit trail browser
- **Capture Debug** — ALPR capture debugging tool
- **Device Health** — Device health monitoring

### 20.3 State Management

- **TanStack Query** — Server state (API data, caching, background refetch)
- **Zustand** — Client state (UI state, filters, selections)

### 20.4 API Client

- Axios instance với interceptors
- Automatic `Authorization: Bearer <token>` header
- `x-request-id` và `x-correlation-id` propagation
- Error handling theo envelope contract

---

## 21. Deployment & Infrastructure

### 21.1 Docker Compose Services

```yaml
services:
  mysql:       # MySQL 8.x - Database
  redis:       # Redis 7.x - Cache + Queue
  minio:       # MinIO - Object Storage
  api:         # Parkly API (Node.js)
  worker:      # BullMQ Worker
  web:         # React frontend (optional)
```

### 21.2 Environment Profiles

| Profile | Description |
|---------|-------------|
| `MVP` | Minimal viable product, local dev |
| `DEMO` | Demo mode, rich seed data |
| `RELEASE_CANDIDATE` | RC testing, full features |

### 21.3 Secret Rotation

- Device capture secrets: ACTIVE + NEXT support
- Internal service token: ACTIVE + NEXT support
- Rotation script: `pnpm auth:secrets:rotate`

---

## 22. Scripts & Automation

### 22.1 Key Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Start API (predev: prisma generate) |
| `pnpm worker:dev` | Start BullMQ worker |
| `pnpm db:migrate` | Run SQL migrations |
| `pnpm db:seed:min` | Minimal seed |
| `pnpm db:seed:comprehensive` | Full seed |
| `pnpm db:reset` | Reset database |
| `pnpm auth:sessions:cleanup` | Cleanup expired sessions |
| `pnpm smoke:bundle` | Full smoke test bundle |
| `pnpm deployment:verify` | Verify all services |
| `pnpm deployment:bootstrap` | Bootstrap environment |
| `pnpm backup:create` | Create backup |

### 22.2 Smoke Test Coverage

```
smoke:bundle → smoke:auth → smoke:gate-entry → smoke:gate-exit
            → smoke:alpr → smoke:media → smoke:incident
            → smoke:reconciliation → smoke:outbox-drain
            → smoke:dashboard → smoke:audit
```

---

## 23. Environment Configuration

### 23.1 Core Configuration Keys

#### API
```
NODE_ENV=development
API_HOST=0.0.0.0
API_PORT=3000
API_PREFIX=/api
API_AUTH_MODE=ON|OFF
API_LEGACY_ROLE_TOKENS=OFF  # DEPRECATED v9.2 — static token backdoor removed
```

#### Auth
```
API_AUTH_ACCESS_TTL_MINUTES=15
API_AUTH_REFRESH_TTL_DAYS=7
API_AUTH_SESSION_LIMIT_PER_USER=5
API_AUTH_PASSWORD_MIN_LENGTH=10
API_AUTH_LOGIN_THROTTLE_WINDOW_SECONDS=300
API_AUTH_LOGIN_FAILURE_LOCKOUT_THRESHOLD=5
API_AUTH_LOGIN_LOCKOUT_SECONDS=120
API_AUTH_LOGIN_PROGRESSIVE_DELAY_MS=250
API_AUTH_LOGIN_PROGRESSIVE_DELAY_MAX_MS=1500
API_AUTH_SESSION_CLEANUP_EXPIRED_RETENTION_DAYS=3
API_AUTH_SESSION_CLEANUP_REVOKED_RETENTION_DAYS=30
API_AUTH_SESSION_CLEANUP_BATCH_LIMIT=500
API_AUTH_BOOTSTRAP_PROFILE=DEMO|MVP|RELEASE_CANDIDATE
API_AUTH_DEMO_SEED_CREDENTIALS=ON|OFF
API_AUTH_PASSWORD_REQUIRE_UPPERCASE=ON|OFF
API_AUTH_PASSWORD_REQUIRE_LOWERCASE=ON|OFF
API_AUTH_PASSWORD_REQUIRE_DIGIT=ON|OFF
API_AUTH_PASSWORD_REQUIRE_SPECIAL=ON|OFF
API_ADMIN_ACTOR_USER_ID=1
API_OPS_ACTOR_USER_ID=2
API_GUARD_ACTOR_USER_ID=3
API_WORKER_ACTOR_USER_ID=4
API_CASHIER_ACTOR_USER_ID=5
```

#### Database
```
DATABASE_URL=mysql://parking_app:...@127.0.0.1:3306/parking_mgmt
DATABASE_URL_ADMIN=mysql://parking_root:...@127.0.0.1:3306/parking_mgmt
DB_POOL_LIMIT=5
```

#### Redis
```
REDIS_URL=redis://127.0.0.1:6379
REDIS_REQUIRED=ON
```

#### ALPR
```
ALPR_MODE=TESSERACT|HTTP|MOCK|DISABLED
ALPR_PROVIDER_ORDER=HTTP
ALPR_HTTP_PROVIDER_URL=http://localhost:8765/predict/
PREVIEW_CACHE_DEBUG_HEADERS=OFF
```

#### Object Storage
```
S3_ENDPOINT=http://127.0.0.1:9000
S3_BUCKET_MEDIA=parkly-media
MEDIA_STORAGE_DRIVER=MINIO|LOCAL
```

#### Outbox
```
OUTBOX_WORKER_INTERVAL_MS=5000
OUTBOX_MAX_ATTEMPTS=8
OUTBOX_BACKOFF_MAX_MS=300000
OUTBOX_BACKOFF_JITTER=true
OUTBOX_INLINE_SYNC=false
OUTBOX_QUEUE_CONCURRENCY=4
OUTBOX_ENQUEUE_BATCH_SIZE=100
OUTBOX_QUEUE_METRICS_INTERVAL_MS=10000
```

#### Parking Live & SSE (v9.1)
```
PARKING_LIVE_STREAM_POLL_MS=5000
```

#### Ghost Presence Purge (v9.1)
```
GHOST_PURGE_POLL_INTERVAL_MS=5000
```

#### Device Capture Secrets (v9.1)
```
DEVICE_CAPTURE_SECRET_ACTIVE=<secret>
DEVICE_CAPTURE_SECRET_NEXT=<secret>
```

#### Internal Service Token (v9.1)
```
API_INTERNAL_SERVICE_TOKEN_ACTIVE=<token>
API_INTERNAL_SERVICE_TOKEN_NEXT=<token>
```

#### Edge Node (v9.1)
```
API_EDGE_SYNC_KEY=<key>
```

#### Internal Presence Ingestion (v9.1)
```
INTERNAL_PRESENCE_API_KEY=<key>
INTERNAL_PRESENCE_HMAC_SECRET=<secret>
INTERNAL_PRESENCE_SCHEMA_VERSION=zone.presence.v1
INTERNAL_PRESENCE_MAX_SKEW_SECONDS=300
INTERNAL_PRESENCE_STREAM_KEY=parkly:development:internal-presence-events
```

#### Decision Engine (v9.1)
```
DECISION_ENABLE_SUBSCRIPTIONS=ON|OFF
```

#### Reconciliation (v9.1)
```
RECONCILIATION_SENSOR_STALE_SECONDS=180
```

#### Exit Payment Resolution (v9.1)
```
EXIT_UNKNOWN_PAYMENT_REVIEW_SECONDS=120
```

#### Logging (v9.1)
```
LOG_LEVEL=info
LOG_FORMAT=dev
LOG_REDACT_IP=OFF
```

#### Rate Limiting (v9.1)
```
API_RATE_LIMIT_BACKEND=REDIS
API_RATE_LIMIT_PREFIX=parkly:api:rate-limit
```

#### Observability / Health (v9.1)
```
PILOT_HARDENING_ENABLED=OFF
OBSERVABILITY_BUDGET_ENABLED=OFF
```

#### Deployment Profiles (v9.1)
```
RC_GATE_ENABLED=OFF
PILOT_HARDENING_GUARD_2FA_ENABLED=OFF
DEPLOYMENT_PROFILE=MVP|DEMO|RELEASE_CANDIDATE
```

#### Retention & Cleanup (v9.1)
```
RETENTION_AUDIT_LOG_DAYS=90
RETENTION_INCIDENT_LOG_DAYS=90
RETENTION_OUTBOX_DLQ_DAYS=365
RETENTION_CLEANUP_BATCH_LIMIT=500
```

#### Backup (v9.1)
```
BACKUP_ENABLED=OFF
BACKUP_RETENTION_DAYS=7
BACKUP_SCHEDULE=0 2 * * *
```

#### Smoketest (v9.1)
```
SMOKETEST_GATE_SESSION_TTL_MS=60000
SMOKETEST_GATE_SESSION_OPEN_TTL_MS=30000
SMOKETEST_SUBSCRIPTION_LANE=ENTRY
SMOKETEST_TARIFF_CODE=CAR_STD_2H
SMOKETEST_TIMEOUT_MS=120000
```

#### SMTP (v9.1)
```
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@parkly.local
```

#### Session Management
```
API_SESSION_COOKIE_NAME=parkly_session
API_SESSION_COOKIE_DOMAIN=
API_SESSION_COOKIE_SECURE=OFF
API_SESSION_COOKIE_SAME_SITE=lax
```

---

## 24. Migration History

| Migration | Description |
|-----------|-------------|
| V1 | Initial schema (users, parking_sites, zones, spots) |
| V2 | Core tables (tariffs, tariff_rules, credentials, tickets, payments) |
| V3 | Audit logs + API idempotency |
| V4 | Gate infrastructure (devices, lanes, barriers) |
| V5 | Session + decision engine |
| V6 | Media storage + presigned URLs |
| V7 | Mobile capture + device pairing |
| V8 | Incident management + review queue |
| V9 | Shift closures + billing |
| V10 | API idempotency + anti-passback |
| V11 | Redis preview cache |
| V12 | SSE streams + observability |
| V13 | MinIO media pipeline |
| V14 | MongoDB event outbox |
| V15 | Dashboard read models |
| V16 | Subscription spots + vehicles |
| V17 | Internal presence intake |
| V18 | Reconciliation engine |
| V19 | Auth + RBAC hardening |
| V20 | Contract freeze + validation |
| V21 | Secret rotation support |
| V22 | DLQ processing |
| V23 | Audit hardening |
| V24 | Incident noise control |
| V25 | Release hardening |
| V26 | Security layer 2 (session hygiene) |
| V27 | Retention cleanup automation |
| V28 | Deployment profiles |
| V29 | Enhanced schema optimizations + views |
| V30 | Enhanced tariff pricing system (holidays, compound rules, lost fees) |
| V31 | Media Auth Split, Idempotency Middleware, Bulk Import Jobs, Webhook Management |
| V32 | RC1: Security hardening (backdoor elimination, memory leak fix, SSE hardening, rate limiting), Ghost Presence Purge Worker, Incident Noise Control, Site Scope Read Model |

---

## 25. Enums Reference

Full list of enums in schema.prisma:

| Enum | Values |
|------|--------|
| `tariffs_applies_to` | TICKET, SUBSCRIPTION |
| `tariffs_vehicle_type` | MOTORBIKE, CAR |
| `tariff_rules_rule_type` | FREE_MINUTES, HOURLY, DAILY_CAP, OVERNIGHT, FLAT_RATE, DURATION_BLOCK, PROGRESSION_RATE, OVERNIGHT_SURCHARGE, ZONE_SPECIFIC_RATE, SPECIAL_EVENT_RATE, LOST_CREDENTIAL_FEE, HOLIDAY_MULTIPLIER, TIME_OF_DAY_RATE, SUBSCRIPTION_UNLIMITED, SUBSCRIPTION_FIXED, SUBSCRIPTION_FLEXIBLE, SUBSCRIPTION_PRIORITY, SPOT_ASSIGNMENT_FIXED, SPOT_ASSIGNMENT_FLEXIBLE |
| `gate_devices_device_type` | RFID_READER, CAMERA_ALPR, BARRIER, LOOP_SENSOR |
| `gate_devices_direction` | ENTRY, EXIT |
| `gate_lanes_direction` | ENTRY, EXIT |
| `gate_lanes_status` | ACTIVE, INACTIVE, MAINTENANCE |
| `gate_lane_devices_device_role` | PRIMARY, CAMERA, RFID, LOOP_SENSOR, BARRIER |
| `gate_passage_sessions_direction` | ENTRY, EXIT |
| `gate_passage_sessions_status` | OPEN, WAITING_READ, WAITING_DECISION, APPROVED, WAITING_PAYMENT, DENIED, PASSED, TIMEOUT, CANCELLED, ERROR |
| `gate_read_events_read_type` | ALPR, RFID, SENSOR |
| `gate_read_events_direction` | ENTRY, EXIT |
| `gate_read_events_sensor_state` | PRESENT, CLEARED, TRIGGERED |
| `gate_active_presence_status` | ACTIVE, EXITED, CLEARED, BLOCKED |
| `gate_decisions_final_action` | APPROVE, REVIEW, DENY, PAYMENT_HOLD |
| `gate_decisions_decision_code` | AUTO_APPROVED, REVIEW_REQUIRED, AUTO_DENIED, PAYMENT_REQUIRED, TICKET_NOT_FOUND, PLATE_RFID_MISMATCH, ANTI_PASSBACK_BLOCKED, DEVICE_DEGRADED, SUBSCRIPTION_AUTO_APPROVED, SUBSCRIPTION_EXIT_BYPASS_PAYMENT, SUBSCRIPTION_REVIEW_REQUIRED |
| `gate_barrier_commands_command_type` | OPEN, CLOSE, HOLD_OPEN, LOCK |
| `gate_barrier_commands_status` | PENDING, SENT, ACKED, NACKED, TIMEOUT, CANCELLED |
| `gate_manual_reviews_status` | OPEN, CLAIMED, RESOLVED, CANCELLED |
| `gate_incidents_severity` | INFO, WARN, CRITICAL |
| `gate_incidents_status` | OPEN, ACKED, RESOLVED, IGNORED |
| `gate_event_outbox_status` | PENDING, SENT, FAILED |
| `gate_event_outbox_dlq_final_status` | TERMINAL_FAILED, MAX_RETRIES, SYSTEM_ERROR, DLQ_MANUAL |
| `device_heartbeats_status` | ONLINE, DEGRADED, OFFLINE |
| `gate_read_media_storage_kind` | UPLOAD, URL, INLINE, MOCK, UNKNOWN |
| `credentials_status` | ACTIVE, BLOCKED, LOST |
| `credentials_last_direction` | ENTRY, EXIT |
| `tickets_status` | OPEN, CLOSED, CANCELLED |
| `payments_method` | CASH, CARD, EWALLET |
| `payments_status` | PAID, REFUNDED, VOID |
| `customers_status` | ACTIVE, SUSPENDED |
| `subscriptions_status` | ACTIVE, EXPIRED, CANCELLED, SUSPENDED |
| `subscriptions_plan_type` | MONTHLY, VIP |
| `subscription_spots_assigned_mode` | ASSIGNED, PREFERRED |
| `subscription_spots_status` | ACTIVE, SUSPENDED, RELEASED |
| `subscription_vehicles_status` | ACTIVE, SUSPENDED, REMOVED |
| `spots_status` | FREE, OCCUPIED, OUT_OF_SERVICE |
| `users_status` | ACTIVE, DISABLED |
| `user_site_scopes_scope_level` | ADMIN, MANAGER, CASHIER, GUARD |
| `auth_login_attempts_bucket_kind` | USERNAME, USERNAME_IP |
| `api_idempotency_status` | IN_PROGRESS, SUCCEEDED, FAILED |
| `internal_presence_events_status` | ACCEPTED, REJECTED |
| `zones_vehicle_type` | MOTORBIKE, CAR |
| `vehicles_vehicle_type` | MOTORBIKE, CAR |
| `spot_occupancy_projection_occupancy_status` | EMPTY, OCCUPIED_MATCHED, OCCUPIED_UNKNOWN, OCCUPIED_VIOLATION, SENSOR_STALE |
| `shift_closure_breakdowns_method` | CASH, CARD, EWALLET |
| `holiday_calendar_holiday_type` | NATIONAL, REGIONAL, SPECIAL, CUSTOM |
| `tariff_zone_spot_mode` | FIXED, PREFERRED, FLOATING |
| `special_period_type` | PEAK, OFF_PEAK, NIGHT, WEEKEND, SPECIAL, CUSTOM |
| `lost_fee_vehicle_type` | MOTORBIKE, CAR, ALL |
| `compound_operator` | AND, OR, AND_NOT, XOR |
| `compound_result_action` | APPLY_RATE, SKIP_RULES, OVERRIDE_RATE, APPLY_DISCOUNT, REJECT |
| `discount_type` | PERCENTAGE, FIXED_AMOUNT, FREE_MINUTES, FREE_HOURS, MULTIPLIER |
| `pricing_calculation_type` | TRANSIENT, SUBSCRIPTION, CORRECTION, REFUND |
| `gate_incident_history_action` | OPENED, ACKNOWLEDGED, RESOLVED, IGNORED, REOPENED | *(v9.1)* |
| `gate_passage_sessions_open_flag` | TRUE, FALSE | *(v9.1)* |
| `gate_incidents_open_flag` | TRUE, FALSE | *(v9.1)* |
| `internal_presence_events_schema_version` | zone.presence.v1 | *(v9.1)* |
| `internal_presence_events_intake_status` | INTAKE_ACCEPTED, INTAKE_REJECTED | *(v9.1)* |
| `shift_closures_status` | OPEN, CLOSED | *(v9.1)* |
| `shift_closures_type` | SHIFT, OVERNIGHT_SHIFT | *(v9.1)* |
| `shift_closure_breakdowns_status` | OPEN, CLOSED | *(v9.1)* |
| `bulk_import_jobs_status` | QUEUED, PROCESSING, SUCCEEDED, FAILED, CANCELLED | *(V31)* |
| `webhooks_status` | ACTIVE, INACTIVE, SUSPENDED | *(V31)* |
| `webhook_deliveries_status` | PENDING, SUCCESS, FAILED, RETRYING | *(V31)* |
| `webhook_event_type` | GATE_SESSION_OPENED, GATE_SESSION_PASSED, GATE_SESSION_DENIED, GATE_SESSION_REVIEW, GATE_SESSION_CANCELLED, GATE_SESSION_TIMEOUT, GATE_SESSION_VIOLATED, TICKET_CREATED, TICKET_CLOSED, TARIFF_APPLIED, PAYMENT_COMPLETED, SUBSCRIPTION_CREATED, SUBSCRIPTION_UPDATED, SUBSCRIPTION_EXPIRED, SUBSCRIPTION_IMPORT_COMPLETED, INCIDENT_OPENED, INCIDENT_RESOLVED, SHIFT_CLOSED | *(V31 + v9.1)* |
| `gate_manual_reviews_resolution` | MANUAL_APPROVE, MANUAL_DENY, MANUAL_OPEN_BARRIER | *(v9.1)* |
| `gate_events_mongo_collection` | gate_passage_sessions, gate_incidents, gate_read_events | *(v9.1)* |
| `gate_read_media_source` | DEVICE, MOBILE, API | *(v9.1)* |

---

## 26. Redis Distributed Lock — Race Condition Prevention

### 26.1 Problem Statement

Tại lane_code `ENTRY`, khi xe tiến vào, Loop Sensor kích hoạt Camera chụp biển số. Cùng mili-giây đó, tài xế thò tay quẹt thẻ RFID. Hệ thống nhận 2 API request song song:

```
POST /api/gate-reads/alpr   → Camera ALPR
POST /api/gate-reads/rfid   → RFID Reader
```

Nếu không có cơ chế serialization, Prisma transaction không đủ để serialize 2 request MySQL đồng thời — cả hai có thể SELECT thấy empty state rồi INSERT 2 sessions riêng biệt cho cùng một xe.

### 26.2 Solution: Redis Distributed Lock

**Lock Key Pattern:**
```
locks:gate:lane:{siteCode}:{laneCode}
```

**Lock Parameters (Env Vars):**

| Env Var | Default | Mô tả |
|---------|---------|--------|
| `GATE_LANE_LOCK_TTL_MS` | 3000 | TTL của lock — đủ cho 1 chu trình Capture → Decision Engine |
| `GATE_LANE_LOCK_RETRY_COUNT` | 3 | Số lần retry nếu lock đang bị giữ |
| `GATE_LANE_LOCK_RETRY_DELAY_MS` | 200 | Base delay giữa các lần retry |
| `GATE_LANE_LOCK_RETRY_JITTER_MS` | 50 | Random jitter để tránh thundering herd |

**Lock Algorithm (SET NX EX):**

```typescript
// SET key value NX PX milliseconds
// NX: only set if not exists
// PX: expiry in milliseconds
const result = await redis.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
```

**Lua Script cho safe release (ownership check):**

```lua
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])  -- chỉ unlock nếu value match
else
  return 0
end
```

### 26.3 Integration Flow

```
Request ALPR ──┐
               ├──► Lane Lock (SET NX EX, 3s TTL) ──► resolveOrCreateSession ──► Decision Engine
Request RFID ──┘         │
                  │ Lock busy? Retry 3× │ Lock fail? → 409 CONFLICT "LANE_BUSY"
                  └─► finally: Lua release
```

**Trong route handler (`register-gate-capture-routes.ts`):**

```typescript
const data = await withLaneLock(
  { siteCode, laneCode, traceId: rid },
  async () => {
    // Inside lock: idempotency re-check + ingest
    const recheck = await claimOrReplay({ scope, ... });
    if (recheck.replay) return recheck.responseJson; // exact replay

    const result = await ingestAlprRead({ ... });
    await markIdempotencySucceeded({ ... });
    return result;
  },
);
```

**Two-level idempotency:**
1. **Fast-path** (outside lock): Redis claim → replay nếu đã xử lý
2. **Inside lock**: Re-check claim → đảm bảo không miss trong thời gian chờ lock

### 26.4 Failure Modes

| Scenario | Behavior |
|----------|----------|
| RFID request đến trong khi ALPR đang giữ lock | RFID chờ (retry 3 lần × 200ms = 600ms), rồi được serialize đúng thứ tự |
| Lock TTL expire (3s mà chưa xong) | Lock tự release, request tiếp theo acquire được → Prisma transaction rollback |
| Redis down | `LOCK_BUSY` → `CONFLICT 409` → device retry với idempotency key → exact replay |
| Device retry khi đã có session | `resolveOrCreateSession` sẽ reuse session đang OPEN |

### 26.5 Files

| File | Purpose |
|------|---------|
| `src/lib/lane-lock.ts` | Distributed lock service: acquire, release, extend, withLaneLock wrapper |
| `src/modules/gate/interfaces/http/register-gate-capture-routes.ts` | Tích hợp lock vào ALPR, RFID, Sensor routes |

---

## 27. Parkly Edge Node — Local Survivability

### 27.1 Motivation

Mô hình **Cloud-Centralized** (mọi thứ gọi về API trung tâm) quản lý tập trung nhưng mong manh với môi trường vật lý tại bãi xe. **Parkly Edge Node** đảm bảo hệ thống tiếp tục hoạt động khi Internet đứt cáp.

### 27.2 Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Internet                           │
└──────────┬──────────────────────────────────▲──────┘
           │          Cloud Parkly API          │
           │   (subscriptions, tariffs, audit) │
           │                                     │
           │   POST /api/edge/sessions/bulk-sync │
           │   GET  /api/edge/health             │
           │   GET  /api/admin/subscriptions     │
└──────────┴──────────────────────────────────┘
           ▲
           │  Periodic sync (5 min)
           │  Store-and-Forward on reconnect
           │
┌──────────┴──────────────────────────────────────────┐
│              Parkly Edge Node (Mini PC/RPi)        │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  SQLite Local DB                             │   │
│  │  • Subscriptions whitelist                  │   │
│  │  • Active tariffs                           │   │
│  │  • Offline sessions                         │   │
│  │  • Outbox (PENDING events)                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Express Server (:8080)                      │   │
│  │  POST /api/gate-reads/alpr   (local)        │   │
│  │  POST /api/gate-reads/rfid   (local)        │   │
│  │  POST /api/gate-reads/sensor (local)        │   │
│  │  GET  /api/edge/health                       │   │
│  │  POST /api/edge/sync (manual)                 │   │
│  │  GET  /api/edge/subscriptions                │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  SyncService (BullMQ-like background loop)  │   │
│  │  • Pull: subscriptions + tariffs (5 min)    │   │
│  │  • Push: offline sessions + outbox (1 min)  │   │
│  │  • Connectivity health check (30s)          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Decision Engine (Local)                      │   │
│  │  • Subscriber check → OPEN_BARRIER          │   │
│  │  • Guest vehicle → ISSUE_TICKET            │   │
│  │  • Unknown → REJECT (manual review)         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  BarrierController (HTTP)                    │   │
│  │  POST {command: "OPEN"} → Barrier hardware   │   │
│  │  Retry 3×, exponential backoff               │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
           │
           │  LAN (Local Network)
           │
    ┌──────┴──────────────────────────────────┐
    │              Physical Devices            │
    │  Camera (ALPR) ─ RFID Reader ─ Loop ─ Barrier
    └──────────────────────────────────────────┘
```

### 27.3 Topology Comparison

| Aspect | Cloud-Centralized | With Edge Node |
|--------|------------------|----------------|
| Internet dependency | 100% | Only for sync (not for gate control) |
| Offline entry | FAIL | SUBSCRIBER → OPEN, GUEST → TICKET |
| Session storage | Cloud DB only | Cloud DB + local SQLite |
| Data recovery | N/A | Store-and-Forward (outbox pattern) |

### 27.4 Data Flow: Online → Offline → Online

**Online phase:**
```
Edge pulls subscriptions + tariffs from Cloud every 5 minutes
→ Stored in local SQLite
```

**Offline phase:**
```
Vehicle arrives → Device sends ALPR/RFID to Edge Node (LAN)
→ Edge checks whitelist in SQLite
→ Decision: SUBSCRIBER → OPEN, GUEST → REVIEW (ticket)
→ Barrier opens (HTTP to barrier hardware)
→ Session + events → SQLite outbox (PENDING)
```

**Recovery phase (Internet restored):**
```
Edge detects connectivity (health check every 30s)
→ Pushes offline sessions to Cloud: POST /api/edge/sessions/bulk-sync
→ Cloud inserts into gate_passage_sessions + gate_read_events
→ Marks sessions as SYNCED in SQLite
→ Pulls fresh subscriptions + tariffs
```

### 27.5 Decision Engine (Offline)

```typescript
// Pseudo-logic
function decideOffline(plate, rfid) {
  // Priority 1: Active subscriber
  if (plate && findSubscription(siteCode, plate)) return OPEN;
  if (rfid  && findSubscription(siteCode, rfid))  return OPEN;

  // Priority 2: Guest (pay-and-park)
  if (plate) return REVIEW;  // Issue ticket, barrier needs manual override

  // Priority 3: No identity
  return REJECT;  // Manual verification required
}
```

### 27.6 Bulk-Sync API (Cloud Side)

**Endpoint:** `POST /api/edge/sessions/bulk-sync`

**Request:**
```json
{
  "edgeNodeId": "edge-hcm01",
  "siteCode": "SITE_HCM_01",
  "sessions": [
    {
      "localSessionId": "uuid-from-edge",
      "siteCode": "SITE_HCM_01",
      "laneCode": "ENTRY",
      "direction": "ENTRY",
      "vehiclePlate": "30A-12345",
      "plateCompact": "30A12345",
      "rfidUid": null,
      "deviceCode": "CAM-ENTRY-01",
      "readType": "ALPR",
      "status": "COMPLETED",
      "openedAt": "2026-03-21T08:00:00Z",
      "closedAt": "2026-03-21T10:30:00Z",
      "barrierDecision": "OPEN",
      "decisionReason": "SUBSCRIPTION_ACTIVE",
      "ticketNumber": null,
      "tariffApplied": null,
      "amountCharged": null
    }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "edgeNodeId": "edge-hcm01",
    "syncedCount": 1,
    "alreadyExists": 0,
    "duplicates": 0,
    "errors": 0,
    "results": [...]
  }
}
```

### 27.7 Edge Node Package

| File | Purpose |
|------|---------|
| `packages/edge-node/src/index.ts` | Entry point, graceful shutdown |
| `packages/edge-node/src/types.ts` | Zod schemas + TypeScript types |
| `packages/edge-node/src/local-db.ts` | SQLite database (subscriptions, tariffs, sessions, outbox) |
| `packages/edge-node/src/sync-service.ts` | Cloud sync: pull/push, connectivity monitoring |
| `packages/edge-node/src/decision-engine.ts` | Offline decision logic |
| `packages/edge-node/src/barrier-controller.ts` | HTTP barrier hardware control |
| `packages/edge-node/src/edge-server.ts` | Express server (same capture API surface) |
| `packages/edge-node/.env.example` | Env var template |
| `apps/api/src/modules/edge/interfaces/http/register-edge-routes.ts` | Cloud bulk-sync endpoint |

### 27.8 Environment Variables (Edge Node)

| Env Var | Default | Mô tả |
|---------|---------|--------|
| `EDGE_NODE_ID` | — | Unique node ID (required) |
| `EDGE_SITE_CODE` | — | Site code to operate on (required) |
| `EDGE_CLOUD_API_URL` | `http://localhost:3000` | Parkly Cloud API URL |
| `EDGE_CLOUD_API_KEY` | — | API key for edge sync (required) |
| `EDGE_SYNC_INTERVAL_MS` | `300000` | Pull interval (5 min) |
| `EDGE_SQLITE_PATH` | `./parkly-edge.db` | SQLite database file |
| `EDGE_PORT` | `8080` | HTTP server port |
| `EDGE_BARRIER_ENDPOINT` | `http://192.168.1.100:9090` | Barrier hardware HTTP endpoint |
| `EDGE_MIN_HEALTHY_SUBSCRIPTIONS` | `5` | Alert threshold for subscription count |

### 27.9 Cloud-Side Config

| Config Key | Type | Purpose |
|-----------|------|---------|
| `API_EDGE_SYNC_KEY` | `string \| undefined` | API key for Edge → Cloud authentication |

---

## 28. Media Auth Split

| Field | Value |
|-------|-------|
| Controller | `src/modules/media/application/media.controller.ts` |
| Routes | `src/modules/media/interfaces/http/register-media-routes.ts` |
| Device HMAC Middleware | `src/server/middlewares/device-signature.middleware.ts` |

#### Route → Auth Matrix

| Route | Auth Method | Actor Type |
|-------|-------------|------------|
| `POST /api/media/upload` | JWT (`requireAuth`) | `USER` |
| `POST /api/media/device-upload` | HMAC (`verifyDeviceSignatureMiddleware`) | `DEVICE` |

#### Device HMAC Signature Headers

| Header | Description |
|--------|-------------|
| `X-Device-Id` | Device ID (bigint) |
| `X-Timestamp` | Unix timestamp in milliseconds, max 5-minute drift allowed |
| `X-Signature` | `HMAC-SHA256(deviceSecret, method + path + timestamp + bodySha256)` |

#### Upload Pipeline
1. Multer intercepts `multipart/form-data`, field name `file`, max 10 MB
2. Zod validates `UploadMetadataBody` schema
3. Compute SHA256 of raw buffer
4. `mediaStorageService.storeUploadedMedia()` → MinIO (S3) or local filesystem fallback
5. Resolve `laneId` from `metadata.laneExternalId` via `gate-lanes` lookup
6. Create `gate_read_media` record linked to lane and optional gate session
7. Create `media_upload_audit` record (actor, IP, file hash, size, MIME)
8. Return `{ requestId, data: { mediaId, fileUrl, sha256 } }`

#### Idempotency Applied Routes

| Route | Idempotency |
|-------|-------------|
| `/api/media/upload` | `requireIdempotency()` |
| `/api/media/device-upload` | `requireIdempotency()` |

---

## 29. Idempotency Middleware
> **v9.2 Frontend:** All `postJson`/`putJson`/`patchJson` client methods now auto-generate `x-idempotency-key` (UUID v4) on every mutation request. Callers can override with an explicit key. Backwards-compatible.

| Field | Value |
|-------|-------|
| File | `src/middlewares/idempotency.middleware.ts` |
| Redis lock | `SETNX idemp:{key} IN_PROGRESS`, TTL 30s (configurable per route) |
| DB persistence | `api_idempotency_keys` — replay cached response if `status = SUCCEEDED` |
| Response interception | Overrides `res.json` → upsert `response_json` + `status`, then `DEL` lock |

#### Flow
```
Request + x-idempotency-key
  → Check DB: status == SUCCEEDED → replay 200 with cached body
  → Redis SETNX idemp:{key} IN_PROGRESS
      → 0 (already locked) → 409 CONFLICT
      → 1 (acquired) → set TTL, proceed to controller
          → Controller runs → res.json() fires
          → Upsert DB record with response body
          → Redis DEL lock
```

#### Error Responses

| Scenario | Status | Code |
|----------|--------|------|
| Missing header | 400 | `BAD_REQUEST` |
| Lock held (in-progress) | 409 | `IDEMPOTENCY_CONFLICT` |
| Past success (replay) | 200 | — (cached envelope) |

---

## 30. Bulk Import Subscriptions (BullMQ)

| Field | Value |
|-------|-------|
| Job Queue | `parkly:admin:bulk-import` |
| Service | `src/modules/bulk-import/application/bulk-import.service.ts` |
| Routes | `src/modules/bulk-import/interfaces/http/register-bulk-import-routes.ts` |
| Worker | `src/worker/jobs/bulk-import.worker.ts` |
| DB Table | `bulk_import_jobs` |

#### Enqueue API

```
POST /api/admin/subscriptions/bulk-import
Auth: OPS+
Body: { fileUrl: string, totalRecords?: number }
Response: 202 { jobId, status: "QUEUED" }
```

#### Status Polling API

```
GET /api/admin/jobs/:jobId
Response: 200 { jobId, status, progress, totalRecords, processedRecords, result?, errorMessage? }
```

#### CSV Column Format

`licensePlate,vehicleType,startDate,endDate,spotCode,planName,notes`

#### Worker Processing Rules
- Parse CSV via `csv-parser` stream
- Batch 100 records per `prisma.$transaction([...], { timeout: 30_000 })`
- Call `job.updateProgress(Math.round((processed / total) * 100))` after each batch
- On `SUCCEEDED`: `enqueueWebhookOutboxJob(SUBSCRIPTION_IMPORT_COMPLETED)` — fires B2B webhooks
- On `FAILED`: write `errorMessage` to `bulk_import_jobs`
- On `CANCELLED`: mark `status = CANCELLED` (cancellation checked via `job.data._cancelled`)

#### Job Statuses

| Status | Meaning |
|--------|---------|
| `QUEUED` | Job enqueued, not yet started |
| `PROCESSING` | Worker is processing |
| `SUCCEEDED` | All records imported |
| `FAILED` | Fatal error (bad file, DB constraint, etc.) |
| `CANCELLED` | Client requested cancellation mid-process |

---

## 31. Webhook Management & Delivery

| Field | Value |
|-------|-------|
| Service | `src/modules/webhooks/application/webhook.service.ts` |
| Routes | `src/modules/webhooks/interfaces/http/register-webhook-routes.ts` |
| Outbox Bridge | `src/server/services/webhook-outbox.service.ts` |
| DB Tables | `webhooks`, `webhook_deliveries` |
| Enums | `webhook_status`, `webhook_delivery_status`, `webhook_event_type` |

#### Supported Event Types
```
GATE_SESSION_OPENED
GATE_SESSION_PASSED
GATE_SESSION_VIOLATED
TARIFF_APPLIED
PAYMENT_COMPLETED
SUBSCRIPTION_CREATED
SUBSCRIPTION_UPDATED
SUBSCRIPTION_EXPIRED
SUBSCRIPTION_IMPORT_COMPLETED
```

#### Webhook CRUD Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/integrations/webhooks` | Create webhook (auto-generate 64-char secret) |
| GET | `/api/integrations/webhooks` | List webhooks (site-scoped) |
| GET | `/api/integrations/webhooks/:webhookId` | Webhook detail |
| PATCH | `/api/integrations/webhooks/:webhookId` | Update URL, events, status, name |
| DELETE | `/api/integrations/webhooks/:webhookId` | Hard delete (ADMIN only) |
| POST | `/api/integrations/webhooks/:webhookId/regenerate-secret` | Rotate secret key |
| GET | `/api/integrations/webhooks/:webhookId/deliveries` | Paginated delivery log |
| POST | `/api/integrations/webhooks/:webhookId/test` | Fire test event immediately |

#### Delivery Flow (Outbox Integration)
1. Outbox worker claims event → `webhook-outbox.service.mapOutboxEventToWebhookEvent()` maps `mongoCollection` to `WebhookEventType`
2. Query active `webhooks` where `siteId` matches and `subscribed_events` includes event type
3. For each matching webhook: `webhook.service.deliverWebhookEvent()`
4. Build JSON payload → compute `X-Parkly-Signature: HMAC-SHA256(secretKey, payload)`
5. `axios.post(url, payload, { timeout: 5_000, headers: { 'Content-Type': 'application/json', 'X-Parkly-Signature' } })`
6. Write result to `webhook_deliveries`
7. **Non-blocking**: delivery failures do NOT cause outbox event retry or DLQ

#### Signature Header Format
```
X-Parkly-Signature: sha256=<hex_digest>
```

#### Webhook Payload Shape
```json
{
  "id": "<uuid>",
  "type": "GATE_SESSION_PASSED",
  "timestamp": "<ISO8601>",
  "siteId": 123,
  "data": { /* event-specific payload */ }
}
```

---

## 32. Database Schema Changes (Migration V31)

#### Table: `bulk_import_jobs`
```sql
CREATE TABLE bulk_import_jobs (
  job_id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_uuid            CHAR(36) NOT NULL UNIQUE,
  site_id             BIGINT UNSIGNED NOT NULL,
  status              ENUM('QUEUED','PROCESSING','SUCCEEDED','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
  total_records       INT UNSIGNED NOT NULL DEFAULT 0,
  processed_records   INT UNSIGNED NOT NULL DEFAULT 0,
  result_json         TEXT,
  error_message       TEXT,
  created_by          BIGINT UNSIGNED NOT NULL,
  created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (site_id)  REFERENCES sites(site_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id)
);
```

#### Table: `webhooks`
```sql
CREATE TABLE webhooks (
  webhook_id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  webhook_uuid        CHAR(36) NOT NULL UNIQUE,
  site_id             BIGINT UNSIGNED NOT NULL,
  name                VARCHAR(255) NOT NULL,
  endpoint_url        VARCHAR(2048) NOT NULL,
  secret_key          CHAR(64) NOT NULL,
  subscribed_events   JSON NOT NULL,
  status              ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  description         TEXT,
  created_by          BIGINT UNSIGNED NOT NULL,
  created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (site_id)  REFERENCES sites(site_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id)
);
```

#### Table: `webhook_deliveries`
```sql
CREATE TABLE webhook_deliveries (
  delivery_id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  delivery_uuid       CHAR(36) NOT NULL UNIQUE,
  webhook_id          BIGINT UNSIGNED NOT NULL,
  event_type          VARCHAR(100) NOT NULL,
  event_id            CHAR(36),
  request_payload     JSON NOT NULL,
  response_status     INT UNSIGNED,
  response_body       TEXT,
  attempt_number      TINYINT UNSIGNED NOT NULL DEFAULT 1,
  delivered_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (webhook_id) REFERENCES webhooks(webhook_id)
);
```

#### Table: `api_idempotency_keys` (replaces legacy `api_idempotency`)
```sql
CREATE TABLE api_idempotency_keys (
  key_id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  idempotency_key     VARCHAR(255) NOT NULL,
  scope               VARCHAR(255) NOT NULL,
  status              ENUM('IN_PROGRESS','SUCCEEDED','FAILED') NOT NULL,
  request_hash        VARCHAR(64) NOT NULL,
  response_json       MEDIUMTEXT,
  created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_idempotency_key (idempotency_key)
);
```

#### Table: `media_upload_audit`
```sql
CREATE TABLE media_upload_audit (
  audit_id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  media_id            BIGINT UNSIGNED NOT NULL,
  uploaded_by         BIGINT UNSIGNED,
  device_id           BIGINT UNSIGNED,
  client_ip           VARCHAR(45),
  user_agent          VARCHAR(512),
  file_size           INT UNSIGNED NOT NULL,
  mime_type           VARCHAR(100) NOT NULL,
  sha256              VARCHAR(64) NOT NULL,
  created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (media_id)    REFERENCES gate_read_media(media_id),
  FOREIGN KEY (uploaded_by) REFERENCES users(user_id),
  FOREIGN KEY (device_id)  REFERENCES gate_devices(device_id)
);
```

---

## 33. New Enums (V31 + v9.1 Extended)

#### `bulk_import_job_status`
```
QUEUED | PROCESSING | SUCCEEDED | FAILED | CANCELLED
```

#### `webhook_status`
```
ACTIVE | INACTIVE | SUSPENDED
```

#### `webhook_delivery_status`
```
PENDING | SUCCESS | FAILED | RETRYING
```

#### `webhook_event_type` *(extended in v9.1)*
```
GATE_SESSION_OPENED | GATE_SESSION_PASSED | GATE_SESSION_DENIED
GATE_SESSION_REVIEW | GATE_SESSION_CANCELLED | GATE_SESSION_TIMEOUT | GATE_SESSION_VIOLATED
TICKET_CREATED | TICKET_CLOSED
TARIFF_APPLIED | PAYMENT_COMPLETED
SUBSCRIPTION_CREATED | SUBSCRIPTION_UPDATED | SUBSCRIPTION_EXPIRED
SUBSCRIPTION_IMPORT_COMPLETED
INCIDENT_OPENED | INCIDENT_RESOLVED
SHIFT_CLOSED
```

---

## 34. New Module Map (v9.1)

| Module | Path | Responsibility |
|--------|------|----------------|
| `gate` | `src/modules/gate/` | Gate capture, sessions, decisions, reviews |
| `auth` | `src/modules/auth/` | Auth service, password hash, security |
| `dashboard` | `src/modules/dashboard/` | Dashboard summaries |
| `incidents` | `src/modules/incidents/` | Incident management |
| `reconciliation` | `src/modules/reconciliation/` | Spot occupancy reconciliation |
| `parking-live` | `src/modules/parking-live/` | Realtime parking board |
| `presence` | `src/modules/presence/` | Zone presence ingestion |
| `subscriptions` | `src/modules/subscriptions/` | Subscription admin |
| `audit` | `src/modules/audit/` | Audit read service |
| `edge` | `src/modules/edge/` | Edge Node bulk-sync endpoints (Cloud side) |
| `media` | `src/modules/media/` | Media upload pipeline with auth split |
| `bulk-import` | `src/modules/bulk-import/` | Bulk subscription CSV import (BullMQ) |
| `webhooks` | `src/modules/webhooks/` | Webhook CRUD + delivery |
| `topology` | `src/modules/topology/` | Topology admin CRUD (sites, devices, lanes, lane-device sync) |
| `gate-core` | `packages/gate-core/` | Shared decision logic |
| `contracts` | `packages/contracts/` | Zod schemas + TypeScript types |
| `edge-node` | `packages/edge-node/` | Edge Node offline survivability controller |
| `middlewares` | `src/middlewares/` | Shared middleware (idempotency) |
| `server/middlewares` | `src/server/middlewares/` | Server-level middleware (device signature) |
| `server/services` | `src/server/services/` | Server services (see §38) |
| `worker/jobs` | `src/worker/jobs/` | Background job workers (bulk-import) |

---

## 35. Ghost Presence Purge Worker (v10.0)

**See Section 19.3** for full documentation. Summary:

| Field | Value |
|-------|-------|
| Queue | `parkly:ghost-presence-purge` |
| Cron | `0 2 * * *` (02:00 AM daily) |
| Polling Loop | `ghostPurgePollLoop()` every `GHOST_PURGE_POLL_INTERVAL_MS=5000`, batch 200 |
| Audit Log | `SYSTEM_AUTO_PURGE_GHOST_PRESENCE` written to `audit_logs` |
| Threshold | Records with `entered_at < NOW() - 24h` and `status = ACTIVE` |

---

## 36. SSE Stream Event Reference (v10.0)

**See Section 5.3** for the full SSE stream event taxonomy. Summary of granular event names:

| Stream | Generic Name (v9) | Granular Events (v9.1) |
|--------|-------------------|----------------------|
| Lane Status | `lane_status` | `lane.status.upsert`, `lane.status.remove`, `lane.barrier.lifecycle` |
| Device Health | `device_health` | `device.health.upsert`, `device.health.remove` |
| Outbox | `outbox_event` | `outbox.item.upsert`, `outbox.item.remove`, `outbox.barrier.lifecycle` |
| Parking Live | `parking_live_delta` | `slot.updated`, `floor.summary.updated` |

---

## 37. Extended Decision Engine Codes (v10.0)

**See Section 8.6** for the full extended decision code table and payment status resolver.

**Key additions (v9.1) not in v9 spec:**
- `PRESENCE_NOT_ACTIVE` → `REVIEW_REQUIRED`
- `DEVICE_OFFLINE` / `DEVICE_HEALTH_DEGRADED` → `DEVICE_DEGRADED`
- `RFID_CREDENTIAL_LOST` / `RFID_CREDENTIAL_BLOCKED` → `AUTO_DENIED`
- `PLATE_INVALID` → `AUTO_DENIED`
- `EXIT_WAIVED` / `EXIT_SUBSCRIPTION_COVERED` → `AUTO_APPROVED`
- `PAYMENT_STATUS_UNKNOWN` → `REVIEW_REQUIRED`
- `GatePaymentStatus` enum: `WAIVED`, `SUBSCRIPTION_COVERED`, `NOT_APPLICABLE`, `UNKNOWN`

**Decision thresholds (v9.1 env vars):**
- `EXIT_UNKNOWN_PAYMENT_REVIEW_SECONDS=120` — timeout for payment status resolution
- `DECISION_ENABLE_SUBSCRIPTIONS=ON|OFF` — toggle subscription decision path

---

## 38. New Server Services (v10.0)

This section documents all server-level services in the codebase that power the Parkly system.

### 38.1 Core Services
| Service | Path | Responsibility |
|---------|------|---------------|
| webhook-outbox.service.ts | src/server/services/ | Maps outbox events to webhook deliveries |
| presence-service.ts | src/server/services/ | Internal presence zone service |
| subscription-occupancy.service.ts | src/server/services/ | Subscription-spot occupancy tracking |
| shift.service.ts | src/server/services/ | Shift closure logic |
| udit-service.ts | src/server/services/ | Audit log write orchestration |
| uth-revocation.service.ts | src/server/services/ | JWT token revocation |
| with-actor.ts | src/server/services/ | Actor context injection helper |

### 38.2 Read Models
| Service | Path | Responsibility |
|---------|------|---------------|
| site-scope.ts | src/server/services/read-models/ | Site scope read model |
| dashboard-summary.read-model.ts | src/server/services/read-models/ | Dashboard read model aggregation |
| dashboard-summary.ts | src/modules/dashboard/application/ | Dashboard summary composer |
| dashboard-summary-composer.ts | src/modules/dashboard/application/ | Dashboard summary data composer |

### 38.3 Gate Realtime
| Service | Path | Responsibility |
|---------|------|---------------|
| gate-realtime.service.ts | src/server/services/ | Gate session realtime state management |

### 38.4 ALPR Pipeline
| Service | Path | Responsibility |
|---------|------|---------------|
| lpr-confusion-map.ts | src/server/services/ | Redis-backed ALPR confusion avoidance map |
| lpr-candidate-ranker.ts | src/server/services/ | ALPR candidate ranking/scoring |
| lpr-error-normalizer.ts | src/server/services/ | Normalizes ALPR provider errors |
| lpr-provider-http.ts | src/server/services/ | HTTP ALPR provider (YOLOv8/PaddleOCR) |
| lpr-provider-orchestrator.ts | src/server/services/ | Orchestrates multiple ALPR providers |
| local-alpr.service.ts | src/server/services/ | Tesseract-based local ALPR |

### 38.5 Gate & Session
| Service | Path | Responsibility |
|---------|------|---------------|
| lane-flow-authority.ts | src/server/services/ | Lane flow authorization rules |
| plate-authority.ts | src/server/services/ | Plate canonicalization authority |
| payment-status-resolver.ts | src/server/services/ | Resolves ticket payment status at exit |

### 38.6 Observability & Runtime
| Service | Path | Responsibility |
|---------|------|---------------|
| observability-runtime.ts | src/server/ | Observability runtime (metrics, tracing) |
| 
ate-limit-store.ts | src/server/ | Redis-backed rate limiting store |
| metrics.ts | src/server/ | Prometheus metrics definitions |
| logger.ts | src/server/ | Structured logger (Pino-like) |
| openapi.ts | src/server/ | OpenAPI spec generation |
| health.ts | src/server/ | Health check endpoint handlers |
| alidation.ts | src/server/ | Shared validation helpers |
| utils.ts | src/server/ | General utility functions |

### 38.7 Retention & Cleanup Jobs
| Job | Path | Responsibility |
|-----|------|---------------|
| 
etention-cleanup.ts | src/server/jobs/ | Retention policy evaluation + cleanup |
| 
etention-policy.ts | src/server/jobs/ | Retention policy rules (audit, incidents, DLQ) |

---

## 39. Security Hardening Summary (v10.0)

This section documents all security issues identified and resolved in v10.0 (PR #23, #24, #26).

### 39.1 Critical - Backdoor Elimination

#### Legacy Token Backdoor (FIXED)
- **File:** src/modules/auth/application/auth-service.ts
- **Issue:** API_LEGACY_ROLE_TOKENS=ON allowed static tokens (API_OPS_TOKEN, API_ADMIN_TOKEN) to obtain SUPER_ADMIN without password
- **Fix:** llowLegacyRoleTokens config and entire code path removed
- **Config:** API_LEGACY_ROLE_TOKENS deprecated - has no effect

#### AUTH_MODE=OFF Production Bypass (FIXED)
- **File:** src/modules/auth/application/auth-service.ts
- **Issue:** AUTH_MODE=OFF gave everyone SUPER_ADMIN - catastrophic in production
- **Fix:** Guarded with NODE_ENV !== 'production' - throws 401 in production

### 39.2 Critical - Memory Leak

#### SSE Manager Listener Leak (FIXED)
- **File:** src/lib/http/sse-manager.ts
- **Issue:** window.addEventListener for auth-changed and storage events added inside subscribeToSse but **never removed** in unsubscribeFromSse/stopConnection
- **Impact:** 2 persistent listeners added per subscribe/unsubscribe cycle -> memory grows indefinitely
- **Fix:** Listener refs stored on ConnectionEntry.pendingAuthListeners; stopConnection removes them. Added sseManager.unsubscribeAll() for logout

### 39.3 High - Missing Auth Middleware

#### /internal/presence-events Public (FIXED)
- **File:** src/modules/presence/interfaces/http/register-zone-presence-routes.ts
- **Issue:** Route had no 
equireAuth - relied entirely on handler-level API key check
- **Fix:** Added 
equireInternalApiKey middleware at route level - validates x-internal-api-key before handler runs. Returns 401/503/403 for missing/wrong key

#### OpenAPI Docs Public (FIXED)
- **File:** src/server/app.ts
- **Issue:** GET /openapi.json and /docs were publicly accessible in all environments
- **Fix:** Both return 403 when NODE_ENV=production

#### Token in URL Query String (FIXED)
- **File:** src/server/auth.ts, src/server/config.ts
- **Issue:** API_ALLOW_QUERY_TOKEN=ON allowed tokens in URL ?token=xxx - leaked in logs/history/CDN/Referer
- **Fix:** llowQueryToken config removed; extractQueryToken function removed

#### SSE Not Aborted on Logout (FIXED)
- **File:** src/features/auth/auth-context.tsx, src/lib/http/sse-manager.ts
- **Issue:** logout() called clearAuthTokens but SSE connections kept running until server 401
- **Fix:** logout() calls sseManager.unsubscribeAll() immediately after clearing tokens

### 39.4 High - Token Handling

#### Refresh Failure Wiping Valid Access Token (FIXED)
- **File:** src/lib/http/client.ts
- **Issue:** .catch() in 
efreshAccessToken called clearAuthTokens for **any error** including network errors (502, 503, timeout)
- **Impact:** Transient server errors caused logout even though access token was still valid
- **Fix:** Only invalidateAuthSession called when response is status === 401 (refresh token expired). Network errors propagate without clearing tokens

### 39.5 Medium - Duplicate Code

#### Local Role Arrays in 9 Route Files (FIXED)
- **Files:** 9 route files each defining local OPS_ROLES, ADMIN_OPS, ADMIN_OPS_GUARD etc.
- **Issue:** DRY violation. All included legacy OPS/ADMIN strings that were never canonical. Dead code with subtle risk
- **Fix:** Removed all local definitions. All 9 files now import from src/server/auth-policies.ts canonical exports

### 39.6 Medium - Rate Limiting

#### Mobile Capture Pair Token Brute-Force (FIXED)
- **File:** src/server/app.ts
- **Issue:** Pair tokens (UUID v4) used without rate limiting on public endpoints - enumerable by brute-force in theory
- **Fix:** Added mobileCaptureRateLimiter - 20 req/IP/60s on all pair-token endpoints (GET /mobile-capture, /mobile-capture/session, POST /upload, /heartbeat, /alpr)

### 39.7 Medium - Edge Security

#### /edge/health Public in Production (FIXED)
- **File:** src/modules/edge/interfaces/http/register-edge-routes.ts
- **Issue:** Endpoint returned internal service info to any public IP
- **Fix:** Returns 403 for non-private IPs when NODE_ENV=production. Private IPs (127.*, 10.*, 172.16-31.*, 192.168.*, IPv6 link-local) always allowed

### 39.8 Medium - Frontend Idempotency

#### Missing Idempotency Keys in Client (FIXED)
- **File:** src/lib/http/client.ts
- **Issue:** postJson/putJson/patchJson did not attach x-idempotency-key header
- **Fix:** All methods auto-generate UUID v4 idempotency key. Backwards-compatible - callers can pass explicit key as 4th parameter

### 39.9 Removed Config Keys (v10.0)

| Config Key | Status |
|-----------|--------|
| API_ALLOW_QUERY_TOKEN | **Removed** - token-in-URL backdoor eliminated |
| API_LEGACY_ROLE_TOKENS | **Deprecated** - static token backdoor eliminated (has no effect) |
| config.allowLegacyRoleTokens | **Removed** from config.ts |
| config.allowQueryToken | **Removed** from config.ts |

---

## 40. Topology Admin Module (v10.0)

### 40.1 Overview

Module `topology` cung cấp full CRUD API cho việc quản trị cấu hình topology bãi xe: tạo/sửa Sites, Devices, Lanes, và đồng bộ device assignments cho lanes.

### 40.2 Module Structure

```
src/modules/topology/
├── interfaces/
│   ├── topology-admin.routes.ts      # Express route definitions
│   └── topology-admin.schemas.ts     # Zod validation schemas
└── application/
    └── topology-admin.service.ts      # Business logic (Prisma queries)
```

### 40.3 API Routes

| Method | Route | Auth | Status Code | Description |
|--------|-------|------|-------------|-------------|
| POST | `/api/admin/topology/sites` | `SUPER_ADMIN` only | 201 | Tạo site mới (`siteCode`, `name`, `timezone`) |
| PATCH | `/api/admin/topology/sites/:siteId` | `ADMIN_OPS_ROLES` | 200 | Cập nhật site (`name`, `timezone`) |
| POST | `/api/admin/topology/devices` | `ADMIN_OPS_ROLES` | 201 | Tạo device mới (`deviceCode`, `deviceType`, `direction`, `ipAddress`, `locationHint`) |
| PATCH | `/api/admin/topology/devices/:deviceId` | `ADMIN_OPS_ROLES` | 200 | Cập nhật device properties |
| GET | `/api/admin/topology/devices/unassigned` | `ADMIN_OPS_ROLES` | 200 | Liệt kê devices chưa được gán vào lane nào (query: `siteCode`) |
| POST | `/api/admin/topology/lanes` | `ADMIN_OPS_ROLES` | 201 | Tạo lane mới (`gateCode`, `laneCode`, `name`, `direction`, `sortOrder`) |
| PATCH | `/api/admin/topology/lanes/:laneId` | `ADMIN_OPS_ROLES` | 200 | Cập nhật lane (`gateCode`, `name`, `direction`, `status`, `sortOrder`) |
| PUT | `/api/admin/topology/lanes/:laneId/devices` | `ADMIN_OPS_ROLES` | 200 | Sync toàn bộ devices cho lane — replace all `gate_lane_devices` |

### 40.4 Gate Derivation Model

Backend **không có** bảng `gates` riêng. Gates được **derive** từ `gate_lanes.gate_code`:

```typescript
// buildGateRowsFromLanes() in app.ts
// Groups lanes by gateCode → produces virtual Gate objects
const gates = lanes.reduce((acc, lane) => {
  const gateCode = lane.gateCode
  if (!acc[gateCode]) acc[gateCode] = { gateCode, label: gateCode, lanes: [] }
  acc[gateCode].lanes.push(lane)
  return acc
}, {})
```

Khi user "tạo Gate", thực tế là tạo 1 lane mới với `gateCode` mới → Gate tự xuất hiện. Khi không còn lane nào thuộc `gateCode` → Gate tự biến mất.

### 40.5 Lane Device Sync (The Killer Endpoint)

`PUT /api/admin/topology/lanes/:laneId/devices` thực hiện **full replace** — xóa tất cả `gate_lane_devices` hiện tại của lane, rồi insert lại danh sách mới.

**Request Body:**
```json
{
  "devices": [
    {
      "deviceId": "1",
      "deviceRole": "PRIMARY",
      "isPrimary": true,
      "isRequired": true,
      "sortOrder": 0
    },
    {
      "deviceId": "2",
      "deviceRole": "CAMERA",
      "isPrimary": false,
      "isRequired": false,
      "sortOrder": 1
    }
  ]
}
```

**Device Roles:** `PRIMARY`, `CAMERA`, `RFID`, `LOOP_SENSOR`, `BARRIER`

### 40.6 Validation Schemas

| Schema | Fields |
|--------|--------|
| `CreateSiteBodySchema` | `siteCode` (string), `name` (string), `timezone?` (string) |
| `UpdateSiteBodySchema` | `name?` (string), `timezone?` (string) |
| `CreateDeviceBodySchema` | `siteId` (string), `deviceCode` (string), `deviceType` (string), `direction` (string), `ipAddress?`, `locationHint?` |
| `UpdateDeviceBodySchema` | Partial device fields |
| `CreateLaneBodySchema` | `siteId` (string), `gateCode` (string), `laneCode` (string), `name` (string), `direction` (string), `sortOrder?` (number) |
| `UpdateLaneBodySchema` | `gateCode?`, `name?`, `direction?`, `status?`, `sortOrder?` |
| `SyncLaneDevicesBodySchema` | `devices[]` — array of `{ deviceId, deviceRole, isPrimary, isRequired?, sortOrder? }` |
| `UnassignedDevicesQuerySchema` | `siteCode` (string) |

### 40.7 Authorization

- **Site creation:** `SUPER_ADMIN` only (empty role array → only SUPER_ADMIN passes `requireAuth`)
- **All other operations:** `ADMIN_OPS_ROLES` (SITE_ADMIN, MANAGER, OPERATOR)
- Site scope enforcement applied — users can only manage topology for sites trong scope của mình

---

## 41. Enhanced Frontend Topology Dashboard (v10.0)

### 41.1 Overview

Topology page được nâng cấp từ static list → interactive graph visualization powered by **React Flow** (`@xyflow/react`).

### 41.2 Component Architecture

```
apps/web/src/
├── pages/
│   └── TopologyPage.tsx                    # Main page, state management, dialog coordination
└── features/topology-admin/
    ├── TopologyVisualizer.tsx               # React Flow graph (Gate → Lane → Device nodes)
    ├── DeviceConfigDrawer.tsx               # Slide-out drawer for device configuration
    ├── DevicePool.tsx                       # Unassigned device pool (drag source)
    ├── CreateGateDialog.tsx                 # Modal: create gate (= create first lane with new gateCode)
    ├── CreateLaneDialog.tsx                 # Modal: create lane under existing gate
    ├── EditLaneDialog.tsx                   # Modal: edit lane (direction, status, gate reassignment)
    ├── topology-admin-store.ts              # Zustand store for topology admin UI state
    └── useTopologyAdmin.ts                  # React Query hooks (useTopologyData, useCreateLane, useUpdateLane, useSyncLaneDevices)
```

### 41.3 React Flow Graph Structure

**Node Types:**

| Type | Component | Data | Description |
|------|-----------|------|-------------|
| `gate` | `GateNode` | `{ label, laneCount }` | Top-level gate container, dark theme with hover glow |
| `lane` | `LaneNode` | `{ lane, onEdit }` | Lane node showing direction badge (ENTRY amber / EXIT blue), status, edit button |
| `device` | `DeviceNode` | `{ device, laneId }` | Device node with heartbeat indicator (green/red glow), primary badge |

**Edge Styling:**

| Connection | Type | Color | Style |
|------------|------|-------|-------|
| Gate → Lane | `smoothstep` | `#6b7280` (gray-500) | Dashed (`strokeDasharray: '6 4'`), animated if ACTIVE |
| Lane → Device | `smoothstep` | `#f59e0b` (amber-500) | Solid, `strokeWidth: 2` |

**Dark Theme:**
- Background: `#0b0c0f`
- Node surfaces: `#151518` / `#1a1b1e` / `#1c1d22` with `backdrop-blur-md`
- colorMode: `dark` on ReactFlow component

### 41.4 Interactive Features

| Feature | Trigger | Action |
|---------|---------|--------|
| Add Gate | Button click trên TopologyPage | Opens `CreateGateDialog` → calls `POST /admin/topology/lanes` with new `gateCode` |
| Add Lane | Button click trên TopologyPage | Opens `CreateLaneDialog` → calls `POST /admin/topology/lanes` |
| Edit Lane | Click edit icon (hover-visible) trên LaneNode | Emits `CustomEvent('edit-lane')` → TopologyPage opens `EditLaneDialog` → calls `PATCH /admin/topology/lanes/:laneId` |
| Configure Device | Click DeviceNode | Opens `DeviceConfigDrawer` via Zustand store |
| Drag-to-assign | Drag device from DevicePool onto graph | Prompts lane code → calls `PUT /admin/topology/lanes/:laneId/devices` |

### 41.5 State Management

**Zustand Store (`topology-admin-store.ts`):**
- `siteCode` — current selected site
- `drawerOpen`, `selectedDeviceCode`, `selectedLaneId` — device drawer state
- `draggedDeviceId` — drag-and-drop tracking

**React Query Hooks (`useTopologyAdmin.ts`):**
- `useTopologyData(siteCode)` — fetches full topology (`GET /api/topology?siteCode=`)
- `useUnassignedDevices(siteCode)` — fetches unassigned devices
- `useCreateLane()` — mutation hook for lane creation
- `useUpdateLane()` — mutation hook for lane updates
- `useSyncLaneDevices()` — mutation hook for lane-device sync

### 41.6 Frontend API Client (`topology-admin.ts`)

| Function | Method | Endpoint |
|----------|--------|----------|
| `createSite()` | POST | `/api/admin/topology/sites` |
| `updateSite()` | PATCH | `/api/admin/topology/sites/:siteId` |
| `createDevice()` | POST | `/api/admin/topology/devices` |
| `updateDevice()` | PATCH | `/api/admin/topology/devices/:deviceId` |
| `getUnassignedDevices()` | GET | `/api/admin/topology/devices/unassigned?siteCode=` |
| `createLane()` | POST | `/api/admin/topology/lanes` |
| `updateLane()` | PATCH | `/api/admin/topology/lanes/:laneId` |
| `syncLaneDevices()` | PUT | `/api/admin/topology/lanes/:laneId/devices` |

---

## 42. Error Hierarchy & Global Error Handler (v10.0)

### 42.1 Overview

Centralized error handling system replacing ad-hoc `throw new ApiError()` calls with domain-specific error subclasses. All errors go through `globalErrorHandler` middleware.

### 42.2 Error Subclasses

| Class | HTTP | Code | Example |
|-------|------|------|---------|
| `BadRequestError` | 400 | `BAD_REQUEST` | Invalid plate format |
| `UnauthorizedError` | 401 | `UNAUTHENTICATED` | Missing/expired token |
| `ForbiddenError` | 403 | `FORBIDDEN` | Insufficient role |
| `NotFoundError` | 404 | `NOT_FOUND` | Session not found |
| `ConflictError` | 409 | `CONFLICT` | Lane lock busy |
| `UnprocessableEntityError` | 422 | `UNPROCESSABLE_ENTITY` | Invalid tariff rule |
| `ServiceUnavailableError` | 503 | `SERVICE_UNAVAILABLE` | Redis down |

### 42.3 Global Error Handler

**File:** `src/server/middlewares/error-handler.ts`

Catches and maps errors to standard envelope:
- `ApiError` subclasses → direct mapping
- `ZodError` → 400 with field-level validation details
- `PrismaClientKnownRequestError` → 409 for unique constraint; 404 for record not found
- Unhandled → 500 with correlation ID

### 42.4 Error Code Catalog

**File:** `src/server/errors.ts`

```typescript
export const ERROR_CATALOG = {
  LANE_BUSY:            new ConflictError('Lane is busy, retry'),
  SESSION_NOT_FOUND:    new NotFoundError('Session not found'),
  DEVICE_OFFLINE:       new ServiceUnavailableError('Device offline'),
  SUBSCRIPTION_EXPIRED: new UnprocessableEntityError('Subscription expired'),
  ANTI_PASSBACK:        new ConflictError('Anti-passback violation'),
  PAYMENT_REQUIRED:     new UnprocessableEntityError('Payment required'),
  INVALID_PLATE:        new BadRequestError('Invalid plate format'),
  RATE_LIMITED:         new ServiceUnavailableError('Rate limit exceeded'),
  SITE_ACCESS_DENIED:   new ForbiddenError('No access to this site'),
  ABSENT_SCOPE:         new ForbiddenError('Site scope required'),
  AUTH_EXPIRED:         new UnauthorizedError('Token expired'),
}
```

---

## 43. Domain Events Bus (v10.0)

### 43.1 Overview

In-process, typed event bus for decoupling service-to-service communication. All events are validated by Zod schemas at publish time.

**File:** `src/lib/domain-events.ts`

### 43.2 Event Types

| Event | Payload | Emitter |
|-------|---------|---------|
| `SessionOpened` | `{ sessionId, siteCode, laneCode, direction, plate }` | Session orchestrator |
| `SessionPassed` | `{ sessionId, siteCode, direction }` | Session confirm-pass |
| `SessionDenied` | `{ sessionId, siteCode, reasonCode }` | Decision engine |
| `DecisionMade` | `{ sessionId, decisionCode, finalAction, reasonCode }` | Decision engine |
| `BarrierCommand` | `{ commandId, sessionId, commandType, deviceId }` | Barrier controller |
| `IncidentOpened` | `{ incidentId, siteCode, incidentType, severity }` | Reconciliation |
| `IncidentResolved` | `{ incidentId, resolvedBy, resolutionAction }` | Incident resolve |
| `ReviewClaimed` | `{ reviewId, claimedBy, sessionId }` | Review queue |

### 43.3 API

```typescript
import { domainEvents } from '@/lib/domain-events'

// Subscribe
domainEvents.on('SessionOpened', async (payload) => {
  // payload is fully typed via Zod inference
  await auditService.log(payload.sessionId, 'SESSION_OPENED')
})

// Publish (validates via Zod schema)
domainEvents.emit('SessionOpened', {
  sessionId: 42n,
  siteCode: 'SITE_HCM_01',
  laneCode: 'ENTRY',
  direction: 'ENTRY',
  plate: '30A-12345',
})
```

---

## 44. Multi-Tenancy Middleware (v10.0)

### 44.1 Overview

Site-scope enforcement at middleware and query levels to ensure strict data isolation between sites.

### 44.2 Middleware: `enforceSiteScope`

**File:** `src/server/middlewares/site-scope.ts`

Extracts `siteScopes` from authenticated JWT principal and injects `req.siteScope` with:
- `siteIds: bigint[]` — allowed site IDs
- `siteCodes: string[]` — allowed site codes
- `isGlobal: boolean` — true for `SUPER_ADMIN`

Routes protected by `enforceSiteScope` automatically restrict queries to the user's assigned sites.

### 44.3 Query Guard: `assertSiteAccess`

```typescript
function assertSiteAccess(siteScope: SiteScope, targetSiteId: bigint): void {
  if (siteScope.isGlobal) return
  if (!siteScope.siteIds.includes(targetSiteId)) {
    throw new ForbiddenError('No access to this site')
  }
}
```

### 44.4 Redis Cache Isolation

```typescript
function tenantCacheKey(siteCode: string, entity: string, id: string): string {
  return `tenant:${siteCode}:${entity}:${id}`
}
```

Ensures Redis keys are partitioned by site to prevent cross-tenant data leaks.

---

## 45. CI/CD Pipeline (v10.0)

### 45.1 GitHub Actions Workflow

**File:** `.github/workflows/ci.yml`

Triggers on push/PR to `main` and `develop`.

### 45.2 Pipeline Jobs

| Job | Dependencies | Actions |
|-----|-------------|---------|
| **quality** | — | `pnpm install` → Prisma generate → typecheck API → typecheck Web |
| **test-unit** | quality | Vitest (55+ tests: decision engine, errors, domain events) + node:test (plate core) |
| **build** | test-unit | `pnpm --dir apps/web build` → upload artifacts |
| **migrations** | quality | MySQL 8 service → Flyway migrate → Flyway validate |
| **security** | — | `pnpm audit --audit-level=high` |

### 45.3 Migration Verification

Uses GitHub Actions `services.mysql` to spin up a fresh MySQL 8 instance, applies all 32 migrations via Flyway, and validates schema integrity on every PR.

---

## 46. Production Readiness (v10.0)

### 46.1 Security Headers

**File:** `src/server/middlewares/security-headers.ts`

OWASP-compliant HTTP security headers:

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; frame-ancestors 'none'` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `X-Powered-By` | Removed |

### 46.2 Rate Limiting

**File:** `src/server/middlewares/rate-limiter.ts`

Sliding window rate limiter with configurable key extraction (user ID > IP).

| Profile | Max Requests | Window | Use Case |
|---------|-------------|--------|----------|
| `auth` | 10 | 60s | Login, brute-force protection |
| `mutation` | 30 | 60s | Write endpoints |
| `query` | 120 | 60s | Read endpoints |
| `capture` | 600 | 60s | Device ALPR/RFID (high-frequency) |
| `upload` | 10 | 60s | File uploads |

Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` (on 429).

### 46.3 Testing Infrastructure

| Tool | Coverage | Tests |
|------|----------|-------|
| Vitest | Decision engine | 31 test cases (happy path, edge cases, anti-passback, subscription) |
| Vitest | Error hierarchy | 10 test cases (all 7 subclasses, catalog, Zod/Prisma mapping) |
| Vitest | Domain events + tenancy | 14 test cases (event validation, site scope, cache isolation) |
| node:test | Plate parser | 10+ plates (1 dòng, 2 dòng, quân đội, ngoại giao, invalid) |

### 46.4 Documentation Suite

| Document | Content |
|----------|---------|
| `CONTRIBUTING.md` | Developer setup guide (< 15 min), architecture diagram, commit conventions |
| `docs/ADR.md` | 4 Architecture Decision Records (outbox, Redis locks, derived gates, BIGINT PKs) |
| `docs/RUNBOOK.md` | 8 operational procedures (queue backlog, device offline, ghost presence, DR) |
| `docs/ERROR_CODES.md` | 11 error codes with response examples |
| `docs/ARCHITECTURE.md` | Mermaid module dependency diagram + vehicle entry sequence diagram |

---

*Document generated: 2026-03-25 | Parkly Technical Specification v10.0 — RC3 Enterprise Hardened Snapshot*

---

*End of Specification v10.0*
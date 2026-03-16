-- V2: Core tables theo SPEC CHCSDL v1 (tối thiểu để vận hành + bám multi-site)
-- Lưu ý: MySQL partitioning có hạn chế với foreign key trên bảng partitioned.

-- ============ Zones / Spots ============
CREATE TABLE IF NOT EXISTS zones (
  zone_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  vehicle_type ENUM('MOTORBIKE','CAR') NULL,
  CONSTRAINT fk_zones_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  UNIQUE KEY uq_zone_code (site_id, code),
  KEY ix_zones_site (site_id),
  KEY ix_zones_site_vehicle (site_id, vehicle_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS spots (
  spot_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  zone_id BIGINT NOT NULL,
  code VARCHAR(32) NOT NULL,
  status ENUM('FREE','OCCUPIED','OUT_OF_SERVICE') NOT NULL DEFAULT 'FREE',
  last_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_spots_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_spots_zone FOREIGN KEY (zone_id) REFERENCES zones(zone_id),
  UNIQUE KEY uq_spot_code (site_id, code),
  KEY ix_spots_site (site_id),
  KEY ix_spots_zone (zone_id),
  KEY ix_spots_site_status (site_id, status)
) ENGINE=InnoDB;

-- ============ Customers / Vehicles ============
CREATE TABLE IF NOT EXISTS customers (
  customer_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(255) NULL,
  status ENUM('ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_phone (phone),
  UNIQUE KEY uq_customer_email (email),
  KEY ix_customers_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  license_plate VARCHAR(20) NOT NULL,
  vehicle_type ENUM('MOTORBIKE','CAR') NOT NULL,
  owner_customer_id BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vehicles_owner FOREIGN KEY (owner_customer_id) REFERENCES customers(customer_id),
  UNIQUE KEY uq_vehicles_plate (license_plate),
  KEY ix_vehicles_plate (license_plate),
  KEY ix_vehicles_type (vehicle_type),
  KEY ix_vehicles_owner (owner_customer_id)
) ENGINE=InnoDB;

-- ============ Subscriptions / Credentials (RFID) ============
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  plan_type ENUM('MONTHLY','VIP') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('ACTIVE','EXPIRED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT fk_subscriptions_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_subscriptions_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  KEY ix_sub_site (site_id),
  KEY ix_sub_customer (customer_id),
  KEY ix_sub_site_plan (site_id, plan_type),
  KEY ix_sub_site_start (site_id, start_date),
  KEY ix_sub_site_end (site_id, end_date),
  KEY ix_sub_site_status (site_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS credentials (
  credential_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  subscription_id BIGINT NULL,
  rfid_uid VARCHAR(64) NOT NULL,
  status ENUM('ACTIVE','BLOCKED','LOST') NOT NULL DEFAULT 'ACTIVE',
  last_direction ENUM('ENTRY','EXIT') NULL,
  last_event_time DATETIME NULL,
  CONSTRAINT fk_credentials_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_credentials_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id),
  UNIQUE KEY uq_credential_uid (site_id, rfid_uid),
  KEY ix_cred_site (site_id),
  KEY ix_cred_sub (subscription_id),
  KEY ix_cred_site_status (site_id, status),
  KEY ix_cred_site_lastdir (site_id, last_direction)
) ENGINE=InnoDB;

-- ============ Gate Devices ============
CREATE TABLE IF NOT EXISTS gate_devices (
  device_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  device_code VARCHAR(32) NOT NULL,
  device_type ENUM('RFID_READER','CAMERA_ALPR','BARRIER') NOT NULL,
  direction ENUM('ENTRY','EXIT') NOT NULL,
  location_hint VARCHAR(255) NULL,
  CONSTRAINT fk_devices_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  UNIQUE KEY uq_device_code (site_id, device_code),
  KEY ix_devices_site (site_id),
  KEY ix_devices_site_type (site_id, device_type),
  KEY ix_devices_site_dir (site_id, direction)
) ENGINE=InnoDB;

-- ============ Tickets / Payments ============
CREATE TABLE IF NOT EXISTS tickets (
  ticket_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  ticket_code VARCHAR(32) NOT NULL,
  vehicle_id BIGINT NOT NULL,
  credential_id BIGINT NULL,
  entry_time DATETIME NOT NULL,
  exit_time DATETIME NULL,
  status ENUM('OPEN','CLOSED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  -- Generated column để đảm bảo 1 xe chỉ có 1 vé OPEN/site
  open_flag TINYINT GENERATED ALWAYS AS (CASE WHEN status = 'OPEN' THEN 1 ELSE NULL END) STORED,
  CONSTRAINT fk_tickets_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_tickets_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
  CONSTRAINT fk_tickets_credential FOREIGN KEY (credential_id) REFERENCES credentials(credential_id),
  UNIQUE KEY uq_ticket_code (site_id, ticket_code),
  UNIQUE KEY uq_ticket_open (site_id, vehicle_id, open_flag),
  KEY ix_tickets_site_status (site_id, status),
  KEY ix_tickets_site_vehicle (site_id, vehicle_id),
  KEY ix_tickets_site_cred (site_id, credential_id),
  KEY ix_tickets_site_entry (site_id, entry_time),
  KEY ix_tickets_site_exit (site_id, exit_time)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  ticket_id BIGINT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method ENUM('CASH','CARD','EWALLET') NOT NULL,
  status ENUM('PAID','REFUNDED','VOID') NOT NULL DEFAULT 'PAID',
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_payments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id),
  KEY ix_payments_site_paidat (site_id, paid_at),
  KEY ix_payments_ticket (ticket_id),
  KEY ix_payments_site_method (site_id, method),
  KEY ix_payments_site_status (site_id, status)
) ENGINE=InnoDB;

-- ============ Tariffs / Rules ============
CREATE TABLE IF NOT EXISTS tariffs (
  tariff_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  applies_to ENUM('TICKET','SUBSCRIPTION') NOT NULL,
  vehicle_type ENUM('MOTORBIKE','CAR') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  valid_from DATETIME NOT NULL,
  CONSTRAINT fk_tariffs_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  KEY ix_tariffs_site_active (site_id, is_active),
  KEY ix_tariffs_site_apply (site_id, applies_to),
  KEY ix_tariffs_site_vehicle (site_id, vehicle_type),
  KEY ix_tariffs_site_validfrom (site_id, valid_from)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tariff_rules (
  rule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tariff_id BIGINT NOT NULL,
  rule_type ENUM('FREE_MINUTES','HOURLY','DAILY_CAP','OVERNIGHT') NOT NULL,
  param_json JSON NOT NULL,
  priority INT NOT NULL,
  CONSTRAINT fk_rules_tariff FOREIGN KEY (tariff_id) REFERENCES tariffs(tariff_id),
  KEY ix_rules_tariff (tariff_id),
  KEY ix_rules_type (rule_type),
  KEY ix_rules_tariff_priority (tariff_id, priority)
) ENGINE=InnoDB;

-- ============ Audit logs (append-only) ============
CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NULL,
  actor_user_id BIGINT NOT NULL,
  action VARCHAR(64) NOT NULL,
  entity_table VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_audit_site_created (site_id, created_at),
  KEY ix_audit_actor_created (actor_user_id, created_at),
  KEY ix_audit_action_created (action, created_at),
  KEY ix_audit_entity (entity_table, entity_id),
  KEY ix_audit_created (created_at)
) ENGINE=InnoDB;

-- ============ RBAC tables (đủ để demo site-scoped RBAC) ============
CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS roles (
  role_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  role_code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  UNIQUE KEY uq_roles_code (role_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(role_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_site_scopes (
  user_id BIGINT NOT NULL,
  site_id BIGINT NOT NULL,
  scope_level ENUM('ADMIN','MANAGER','CASHIER','GUARD') NOT NULL,
  PRIMARY KEY (user_id, site_id),
  CONSTRAINT fk_scope_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_scope_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  KEY ix_scope_site (site_id, scope_level)
) ENGINE=InnoDB;

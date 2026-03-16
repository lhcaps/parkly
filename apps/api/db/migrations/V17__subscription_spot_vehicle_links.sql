-- PR08 - Subscription spot / vehicle links for VIP and assigned bay semantics

ALTER TABLE subscriptions
  MODIFY COLUMN status ENUM('ACTIVE','EXPIRED','CANCELLED','SUSPENDED') NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE IF NOT EXISTS subscription_spots (
  subscription_spot_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  subscription_id BIGINT NOT NULL,
  site_id BIGINT NOT NULL,
  spot_id BIGINT NOT NULL,
  assigned_mode ENUM('ASSIGNED','PREFERRED') NOT NULL DEFAULT 'ASSIGNED',
  status ENUM('ACTIVE','SUSPENDED','RELEASED') NOT NULL DEFAULT 'ACTIVE',
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  assigned_from DATE NULL,
  assigned_until DATE NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscription_spots_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id),
  CONSTRAINT fk_subscription_spots_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_subscription_spots_spot FOREIGN KEY (spot_id) REFERENCES spots(spot_id),
  UNIQUE KEY uq_subscription_spot_link (subscription_id, spot_id),
  KEY ix_subscription_spots_subscription_status (subscription_id, status),
  KEY ix_subscription_spots_site_status (site_id, status),
  KEY ix_subscription_spots_spot_status (spot_id, status),
  KEY ix_subscription_spots_site_spot_status (site_id, spot_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subscription_vehicles (
  subscription_vehicle_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  subscription_id BIGINT NOT NULL,
  site_id BIGINT NOT NULL,
  vehicle_id BIGINT NOT NULL,
  plate_compact VARCHAR(20) NOT NULL,
  status ENUM('ACTIVE','SUSPENDED','REMOVED') NOT NULL DEFAULT 'ACTIVE',
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  valid_from DATE NULL,
  valid_to DATE NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscription_vehicles_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id),
  CONSTRAINT fk_subscription_vehicles_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  CONSTRAINT fk_subscription_vehicles_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
  UNIQUE KEY uq_subscription_vehicle_link (subscription_id, vehicle_id),
  KEY ix_subscription_vehicles_subscription_status (subscription_id, status),
  KEY ix_subscription_vehicles_site_status (site_id, status),
  KEY ix_subscription_vehicles_vehicle_status (vehicle_id, status),
  KEY ix_subscription_vehicles_site_plate_status (site_id, plate_compact, status)
) ENGINE=InnoDB;

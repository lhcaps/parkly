-- ============================================================
-- V29: Enhanced Schema - Additional Indices & Optimizations
-- ============================================================
-- Add performance indexes for better query performance
-- Add new computed columns documentation

-- ============================================================
-- Enhanced Indexes for parking_sites
-- ============================================================
ALTER TABLE parking_sites
  ADD INDEX ix_parking_sites_active_code (is_active, site_code);

-- ============================================================
-- Enhanced Indexes for zones
-- ============================================================
ALTER TABLE zones
  ADD INDEX ix_zones_site_vehicle_status (site_id, vehicle_type, zone_id);

-- ============================================================
-- Enhanced Indexes for spots
-- ============================================================
ALTER TABLE spots
  ADD INDEX ix_spots_site_zone_status (site_id, zone_id, status),
  ADD INDEX ix_spots_site_floor_status (site_id, floor_key, status);

-- ============================================================
-- Enhanced Indexes for gate_devices
-- ============================================================
ALTER TABLE gate_devices
  ADD INDEX ix_gate_devices_site_type_dir (site_id, device_type, direction);

-- ============================================================
-- Enhanced Indexes for customers
-- ============================================================
ALTER TABLE customers
  ADD INDEX ix_customers_status_created (status, created_at);

-- ============================================================
-- Enhanced Indexes for vehicles
-- ============================================================
ALTER TABLE vehicles
  ADD INDEX ix_vehicles_customer_type (owner_customer_id, vehicle_type);

-- ============================================================
-- Enhanced Indexes for subscriptions
-- ============================================================
ALTER TABLE subscriptions
  ADD INDEX ix_subscriptions_customer_status (customer_id, status),
  ADD INDEX ix_subscriptions_expiry (site_id, end_date, status);

-- ============================================================
-- Enhanced Indexes for credentials
-- ============================================================
ALTER TABLE credentials
  ADD INDEX ix_credentials_rfid_site_active (site_id, rfid_uid, status);

-- ============================================================
-- Enhanced Indexes for tickets
-- ============================================================
ALTER TABLE tickets
  ADD INDEX ix_tickets_site_date_status (site_id, entry_time, status),
  ADD INDEX ix_tickets_open_vehicle (site_id, vehicle_id, status);

-- ============================================================
-- Enhanced Indexes for payments
-- ============================================================
ALTER TABLE payments
  ADD INDEX ix_payments_date_method (site_id, paid_date, method);

-- ============================================================
-- Enhanced Indexes for gate_passage_sessions
-- ============================================================
ALTER TABLE gate_passage_sessions
  ADD INDEX ix_sessions_site_lane_time (site_id, lane_id, opened_at),
  ADD INDEX ix_sessions_plate_status (site_id, plate_compact, status);

-- ============================================================
-- Enhanced Indexes for gate_read_events
-- ============================================================
ALTER TABLE gate_read_events
  ADD INDEX ix_reads_plate_time (site_id, plate_compact, occurred_at);

-- ============================================================
-- Enhanced Indexes for gate_active_presence
-- ============================================================
ALTER TABLE gate_active_presence
  ADD INDEX ix_presence_site_status_time (site_id, status, last_seen_at);

-- ============================================================
-- Enhanced Indexes for spot_occupancy_projection
-- ============================================================
ALTER TABLE spot_occupancy_projection
  ADD INDEX ix_occupancy_stale (site_id, occupancy_status, stale_at);

-- ============================================================
-- Create summary views for common queries
-- ============================================================

-- View: Site Summary
CREATE OR REPLACE VIEW v_site_summary AS
SELECT
  ps.site_id,
  ps.site_code,
  ps.name AS site_name,
  ps.is_active,
  COUNT(DISTINCT z.zone_id) AS total_zones,
  COUNT(DISTINCT s.spot_id) AS total_spots,
  COUNT(DISTINCT CASE WHEN s.status = 'FREE' THEN s.spot_id END) AS available_spots,
  COUNT(DISTINCT CASE WHEN s.status = 'OCCUPIED' THEN s.spot_id END) AS occupied_spots,
  COUNT(DISTINCT gd.device_id) AS total_devices,
  COUNT(DISTINCT gl.lane_id) AS total_lanes
FROM parking_sites ps
LEFT JOIN zones z ON z.site_id = ps.site_id
LEFT JOIN spots s ON s.site_id = ps.site_id
LEFT JOIN gate_devices gd ON gd.site_id = ps.site_id
LEFT JOIN gate_lanes gl ON gl.site_id = ps.site_id
GROUP BY ps.site_id, ps.site_code, ps.name, ps.is_active;

-- View: Zone Occupancy
CREATE OR REPLACE VIEW v_zone_occupancy AS
SELECT
  ps.site_code,
  z.zone_id,
  z.code AS zone_code,
  z.name AS zone_name,
  z.vehicle_type,
  COUNT(s.spot_id) AS total_spots,
  COUNT(CASE WHEN s.status = 'FREE' THEN 1 END) AS free_spots,
  COUNT(CASE WHEN s.status = 'OCCUPIED' THEN 1 END) AS occupied_spots,
  ROUND(COUNT(CASE WHEN s.status = 'OCCUPIED' THEN 1 END) * 100.0 / NULLIF(COUNT(s.spot_id), 0), 2) AS occupancy_rate
FROM parking_sites ps
JOIN zones z ON z.site_id = ps.site_id
LEFT JOIN spots s ON s.site_id = z.site_id AND s.zone_id = z.zone_id
GROUP BY ps.site_code, z.zone_id, z.code, z.name, z.vehicle_type;

-- View: Active Subscriptions Summary
CREATE OR REPLACE VIEW v_active_subscriptions AS
SELECT
  ps.site_code,
  s.subscription_id,
  s.plan_type,
  s.start_date,
  s.end_date,
  c.full_name AS customer_name,
  c.phone,
  COUNT(sv.vehicle_id) AS linked_vehicles,
  COUNT(ssp.spot_id) AS assigned_spots
FROM subscriptions s
JOIN parking_sites ps ON ps.site_id = s.site_id
JOIN customers c ON c.customer_id = s.customer_id
LEFT JOIN subscription_vehicles sv ON sv.subscription_id = s.subscription_id AND sv.status = 'ACTIVE'
LEFT JOIN subscription_spots ssp ON ssp.subscription_id = s.subscription_id AND ssp.status = 'ACTIVE'
WHERE s.status = 'ACTIVE'
GROUP BY ps.site_code, s.subscription_id, s.plan_type, s.start_date, s.end_date, c.full_name, c.phone;

-- View: Device Health Status
CREATE OR REPLACE VIEW v_device_health AS
SELECT
  ps.site_code,
  gl.gate_code,
  gl.lane_code,
  gd.device_code,
  gd.device_type,
  gd.direction,
  dh.status AS health_status,
  dh.reported_at AS last_heartbeat,
  dh.latency_ms
FROM gate_devices gd
JOIN parking_sites ps ON ps.site_id = gd.site_id
JOIN gate_lanes gl ON gl.site_id = gd.site_id
LEFT JOIN (
  SELECT device_id, status, reported_at, latency_ms
  FROM device_heartbeats
  WHERE (device_id, reported_at) IN (
    SELECT device_id, MAX(reported_at)
    FROM device_heartbeats
    GROUP BY device_id
  )
) dh ON dh.device_id = gd.device_id;

-- View: Daily Revenue Summary
CREATE OR REPLACE VIEW v_daily_revenue AS
SELECT
  ps.site_code,
  DATE(p.paid_at) AS payment_date,
  p.method AS payment_method,
  COUNT(p.payment_id) AS transaction_count,
  SUM(p.amount) AS total_amount
FROM payments p
JOIN parking_sites ps ON ps.site_id = p.site_id
WHERE p.status = 'PAID'
GROUP BY ps.site_code, DATE(p.paid_at), p.method;

-- ============================================================
-- Add comments for documentation
-- ============================================================
ALTER TABLE parking_sites COMMENT = 'Core parking site/location master data';
ALTER TABLE zones COMMENT = 'Parking zones within a site (VIP, Regular, Motorbike, etc.)';
ALTER TABLE spots COMMENT = 'Individual parking spots within zones';
ALTER TABLE customers COMMENT = 'Customer information for subscriptions';
ALTER TABLE vehicles COMMENT = 'Vehicle records with license plates';
ALTER TABLE subscriptions COMMENT = 'Parking subscription plans (Monthly, VIP)';
ALTER TABLE credentials COMMENT = 'RFID cards/credentials linked to subscriptions';
ALTER TABLE gate_devices COMMENT = 'Gate hardware devices (cameras, RFID readers, barriers)';
ALTER TABLE gate_lanes COMMENT = 'Gate lane configurations combining multiple devices';
ALTER TABLE gate_passage_sessions COMMENT = 'Vehicle passage session records';
ALTER TABLE gate_read_events COMMENT = 'ALPR/RFID/Sensor read events';
ALTER TABLE payments COMMENT = 'Payment records for parking tickets';

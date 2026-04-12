-- Run this file using a real MySQL system admin account (for example root@localhost).
-- Purpose:
--  1) allow trigger creators on servers with binary logging enabled
--  2) create the missing V34 trigger that parking_root could not create automatically

SET GLOBAL log_bin_trust_function_creators = 1;

USE parking_mgmt;

DELIMITER $$

DROP TRIGGER IF EXISTS trg_vehicles_sync_subscription_plate $$
CREATE TRIGGER trg_vehicles_sync_subscription_plate
AFTER UPDATE ON vehicles
FOR EACH ROW
BEGIN
  IF COALESCE(OLD.license_plate, '') <> COALESCE(NEW.license_plate, '') THEN
    UPDATE subscription_vehicles
    SET plate_compact = UPPER(REGEXP_REPLACE(COALESCE(NEW.license_plate, ''), '[^A-Za-z0-9]', '')),
        updated_at = CURRENT_TIMESTAMP
    WHERE vehicle_id = NEW.vehicle_id;
  END IF;
END $$

DELIMITER ;

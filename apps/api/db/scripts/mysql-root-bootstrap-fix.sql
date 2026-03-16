-- Run this file using a real MySQL system admin account (e.g. root@localhost), not parking_root.
-- Purpose: ensure host-scoped accounts exist and parking_root can grant app privileges.

CREATE DATABASE IF NOT EXISTS parking_mgmt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'parking_root'@'localhost' IDENTIFIED BY 'RootPassword@123';
CREATE USER IF NOT EXISTS 'parking_root'@'127.0.0.1' IDENTIFIED BY 'RootPassword@123';
CREATE USER IF NOT EXISTS 'parking_root'@'::1' IDENTIFIED BY 'RootPassword@123';

CREATE USER IF NOT EXISTS 'parking_app'@'localhost' IDENTIFIED BY 'AppPassword@123';
CREATE USER IF NOT EXISTS 'parking_app'@'127.0.0.1' IDENTIFIED BY 'AppPassword@123';
CREATE USER IF NOT EXISTS 'parking_app'@'::1' IDENTIFIED BY 'AppPassword@123';

GRANT ALL PRIVILEGES ON parking_mgmt.* TO 'parking_root'@'localhost' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON parking_mgmt.* TO 'parking_root'@'127.0.0.1' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON parking_mgmt.* TO 'parking_root'@'::1' WITH GRANT OPTION;

FLUSH PRIVILEGES;

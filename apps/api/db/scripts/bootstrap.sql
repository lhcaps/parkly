-- Parkly — Bootstrap DB (MySQL 8)
-- Mục tiêu: máy sạch chạy 1 file là tạo DB + user theo mô hình ROOT vs APP (least-privilege).
--
-- Cách chạy:
--  - Mở DBeaver / MySQL CLI bằng user MySQL system admin (vd: root)
--  - Run toàn bộ script này
--
-- Sau đó:
--  1) Cấu hình .env theo .env.example
--  2) Chạy pnpm db:migrate (Flyway chạy bằng parking_root)
--  3) Chạy pnpm db:grant:app (GRANT runtime quyền cho parking_app)
--
-- Quan trọng: Bật MySQL Event Scheduler (cần cho V27 partition maintenance SPs & Events)
SET GLOBAL event_scheduler = ON;
-- Hoặc thêm vào my.cnf/my.ini: event_scheduler = ON
--
-- Lưu ý:
--  - Script này tạo account cho localhost + 127.0.0.1 + ::1 để tránh mismatch host trên Windows.
--  - parking_root là schema admin, có WITH GRANT OPTION trên parking_mgmt.*

CREATE DATABASE IF NOT EXISTS parking_mgmt
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- parking_root accounts
CREATE USER IF NOT EXISTS 'parking_root'@'localhost' IDENTIFIED BY 'RootPassword@123';
ALTER USER 'parking_root'@'localhost' IDENTIFIED BY 'RootPassword@123';
CREATE USER IF NOT EXISTS 'parking_root'@'127.0.0.1' IDENTIFIED BY 'RootPassword@123';
ALTER USER 'parking_root'@'127.0.0.1' IDENTIFIED BY 'RootPassword@123';
CREATE USER IF NOT EXISTS 'parking_root'@'::1' IDENTIFIED BY 'RootPassword@123';
ALTER USER 'parking_root'@'::1' IDENTIFIED BY 'RootPassword@123';

-- parking_app accounts
CREATE USER IF NOT EXISTS 'parking_app'@'localhost' IDENTIFIED BY 'AppPassword@123';
ALTER USER 'parking_app'@'localhost' IDENTIFIED BY 'AppPassword@123';
CREATE USER IF NOT EXISTS 'parking_app'@'127.0.0.1' IDENTIFIED BY 'AppPassword@123';
ALTER USER 'parking_app'@'127.0.0.1' IDENTIFIED BY 'AppPassword@123';
CREATE USER IF NOT EXISTS 'parking_app'@'::1' IDENTIFIED BY 'AppPassword@123';
ALTER USER 'parking_app'@'::1' IDENTIFIED BY 'AppPassword@123';

-- reset + grant schema admin rights for parking_root
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'parking_root'@'localhost';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'parking_root'@'127.0.0.1';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'parking_root'@'::1';

GRANT ALL PRIVILEGES ON parking_mgmt.* TO 'parking_root'@'localhost' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON parking_mgmt.* TO 'parking_root'@'127.0.0.1' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON parking_mgmt.* TO 'parking_root'@'::1' WITH GRANT OPTION;

-- app remains least-privilege until grants_parking_app*.sql runs
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'parking_app'@'localhost';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'parking_app'@'127.0.0.1';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'parking_app'@'::1';

FLUSH PRIVILEGES;

SHOW GRANTS FOR 'parking_root'@'localhost';
SHOW GRANTS FOR 'parking_root'@'127.0.0.1';
SHOW GRANTS FOR 'parking_root'@'::1';
SHOW GRANTS FOR 'parking_app'@'localhost';
SHOW GRANTS FOR 'parking_app'@'127.0.0.1';
SHOW GRANTS FOR 'parking_app'@'::1';

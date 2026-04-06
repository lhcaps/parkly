-- Kill sessions for parking_app (MySQL 8+)
-- NOTE: Use performance_schema.processlist (not INFORMATION_SCHEMA.PROCESSLIST).
-- INFORMATION_SCHEMA.PROCESSLIST is deprecated and may be incomplete under certain MySQL configurations.
SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE
FROM performance_schema.processlist
WHERE USER = 'parking_app';

-- Generate kill statements (run as root/admin):
SELECT CONCAT('KILL ', ID, ';') AS kill_cmd
FROM performance_schema.processlist
WHERE USER = 'parking_app';

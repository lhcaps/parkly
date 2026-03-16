-- Kill sessions for parking_app (MySQL 8+)
-- NOTE: INFORMATION_SCHEMA.PROCESSLIST is deprecated; use performance_schema.processlist.
-- Run as root/admin.
SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE
FROM performance_schema.processlist
WHERE USER = 'parking_app';

-- Generate kill statements:
SELECT CONCAT('KILL ', ID, ';') AS kill_cmd
FROM performance_schema.processlist
WHERE USER = 'parking_app';

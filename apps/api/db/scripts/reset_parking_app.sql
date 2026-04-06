-- Reset parking_app privileges for all local host variants. Run as MySQL system admin or a user with privilege admin rights.
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'parking_app'@'localhost';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'parking_app'@'127.0.0.1';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'parking_app'@'::1';
FLUSH PRIVILEGES;
SHOW GRANTS FOR 'parking_app'@'localhost';
SHOW GRANTS FOR 'parking_app'@'127.0.0.1';
SHOW GRANTS FOR 'parking_app'@'::1';

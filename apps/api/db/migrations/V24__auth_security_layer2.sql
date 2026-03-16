-- PR26 / BE-PR-20 - auth security layer 2: login throttle buckets and session hygiene helpers

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  attempt_key VARCHAR(191) NOT NULL PRIMARY KEY,
  bucket_kind ENUM('USERNAME','USERNAME_IP') NOT NULL,
  username VARCHAR(64) NOT NULL,
  ip_address VARCHAR(64) NULL,
  failure_count INT NOT NULL DEFAULT 0,
  first_failure_at DATETIME NULL,
  last_failure_at DATETIME NULL,
  lockout_until DATETIME NULL,
  last_delay_ms INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_auth_login_attempts_username (username, updated_at),
  KEY ix_auth_login_attempts_lockout (lockout_until, updated_at),
  KEY ix_auth_login_attempts_ip (ip_address, updated_at)
) ENGINE=InnoDB;

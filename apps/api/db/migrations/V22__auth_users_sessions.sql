-- PR13 - human-user auth sessions, refresh rotation and revoke support

CREATE TABLE IF NOT EXISTS auth_user_sessions (
  session_id CHAR(36) NOT NULL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  role_code VARCHAR(32) NOT NULL,
  access_token_hash CHAR(64) NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL,
  access_expires_at DATETIME NOT NULL,
  refresh_expires_at DATETIME NOT NULL,
  last_seen_at DATETIME NULL,
  last_refreshed_at DATETIME NULL,
  revoked_at DATETIME NULL,
  revoke_reason VARCHAR(255) NULL,
  last_ip_address VARCHAR(64) NULL,
  last_user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_auth_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  UNIQUE KEY uq_auth_user_sessions_access_hash (access_token_hash),
  UNIQUE KEY uq_auth_user_sessions_refresh_hash (refresh_token_hash),
  KEY ix_auth_user_sessions_user_created (user_id, created_at),
  KEY ix_auth_user_sessions_role_revoked (role_code, revoked_at),
  KEY ix_auth_user_sessions_access_expiry (access_expires_at),
  KEY ix_auth_user_sessions_refresh_expiry (refresh_expires_at)
) ENGINE=InnoDB;

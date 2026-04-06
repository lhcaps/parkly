-- ============================================================================
-- V32: Security hardening — gate incident history, API key management
-- ============================================================================

-- Gate incident history (audit trail of state transitions)
CREATE TABLE IF NOT EXISTS gate_incident_history (
  id              BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  incident_id     CHAR(36)      NOT NULL,
  previous_status VARCHAR(32)   NULL,
  new_status      VARCHAR(32)   NOT NULL,
  changed_by      VARCHAR(120)  NOT NULL,
  change_reason   TEXT          NULL,
  metadata        JSON          NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_incident_history_incident (incident_id, created_at),
  INDEX idx_incident_history_by (changed_by, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API key management for external integrations
CREATE TABLE IF NOT EXISTS api_keys (
  id              BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  key_id          CHAR(36)      NOT NULL,
  site_code       VARCHAR(32)   NOT NULL,
  key_hash        CHAR(64)      NOT NULL COMMENT 'SHA-256 hash of the API key',
  key_prefix      VARCHAR(8)    NOT NULL COMMENT 'First 8 chars for identification',
  label           VARCHAR(256)  NOT NULL,
  scopes          JSON          NOT NULL COMMENT '["webhooks:read","topology:write"]',
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  last_used_at    DATETIME(3)  NULL,
  expires_at      DATETIME(3)  NULL,
  created_by      VARCHAR(120)  NOT NULL,
  revoked_by      VARCHAR(120)  NULL,
  revoked_at      DATETIME(3)  NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_api_key_id (key_id),
  UNIQUE KEY uq_api_key_hash (key_hash),
  INDEX idx_api_key_site (site_code, is_active),
  INDEX idx_api_key_prefix (key_prefix)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate limit enforcement ledger (per API key / per IP)
CREATE TABLE IF NOT EXISTS rate_limit_ledger (
  id              BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  identifier      VARCHAR(256)  NOT NULL COMMENT 'API key ID or IP address',
  identifier_type ENUM('API_KEY','IP','USER') NOT NULL,
  window_start    DATETIME(3)   NOT NULL,
  window_size_ms  INT           NOT NULL DEFAULT 60000,
  request_count   INT           NOT NULL DEFAULT 1,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_rate_limit_window (identifier, identifier_type, window_start),
  INDEX idx_rate_limit_cleanup (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- V10: API-level idempotency table (used by HTTP endpoints)
-- Mục tiêu: tránh double-submit (đặc biệt Shift Close), có thể phát hiện conflict nếu cùng key nhưng payload khác.

CREATE TABLE IF NOT EXISTS api_idempotency (
  scope VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(64) NOT NULL,
  request_hash VARCHAR(64) NULL,
  status ENUM('IN_PROGRESS','SUCCEEDED','FAILED') NOT NULL DEFAULT 'IN_PROGRESS',
  response_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (scope, idempotency_key),
  KEY ix_api_idem_created (created_at)
) ENGINE=InnoDB;

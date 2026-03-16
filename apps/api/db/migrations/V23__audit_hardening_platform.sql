-- V23: Audit hardening for platform-wide action history
-- Mục tiêu:
-- - chuẩn hoá audit records cho auth / incidents / review / subscription CRUD
-- - persist actor snapshot, request/correlation id, occurredAt nhất quán
-- - mở đường cho ops audit review API

ALTER TABLE audit_logs
  MODIFY COLUMN actor_user_id BIGINT NULL,
  ADD COLUMN actor_json JSON NULL AFTER after_json,
  ADD COLUMN request_id VARCHAR(64) NULL AFTER actor_json,
  ADD COLUMN correlation_id VARCHAR(64) NULL AFTER request_id,
  ADD COLUMN occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER correlation_id;

UPDATE audit_logs
SET occurred_at = created_at
WHERE occurred_at IS NULL;

CREATE INDEX ix_audit_request_id ON audit_logs(request_id);
CREATE INDEX ix_audit_correlation_id ON audit_logs(correlation_id);
CREATE INDEX ix_audit_occurred_id ON audit_logs(occurred_at, audit_id);

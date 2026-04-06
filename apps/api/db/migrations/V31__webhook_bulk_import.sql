-- ============================================================================
-- V31: Webhook delivery, bulk import jobs, and media upload audit
-- ============================================================================

-- Webhook endpoint registrations
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id            BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  endpoint_id   CHAR(36)      NOT NULL,
  site_code     VARCHAR(32)   NOT NULL,
  url           VARCHAR(2048) NOT NULL,
  secret        VARCHAR(256)  NOT NULL COMMENT 'HMAC-SHA256 signing secret',
  event_types   JSON          NOT NULL COMMENT '["session.completed","incident.created"]',
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_by    VARCHAR(120)  NOT NULL,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_webhook_endpoint_id (endpoint_id),
  INDEX idx_webhook_site (site_code, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Webhook delivery log (append-only)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_id     CHAR(36)      NOT NULL,
  endpoint_id     CHAR(36)      NOT NULL,
  event_type      VARCHAR(64)   NOT NULL,
  payload         JSON          NOT NULL,
  attempt         INT           NOT NULL DEFAULT 1,
  status          ENUM('PENDING','DELIVERED','FAILED','EXHAUSTED') NOT NULL DEFAULT 'PENDING',
  http_status     INT           NULL,
  response_body   TEXT          NULL,
  error_message   TEXT          NULL,
  next_retry_at   DATETIME(3)  NULL COMMENT 'Exponential backoff: 30s, 2m, 15m, 1h, 4h',
  delivered_at    DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_webhook_delivery_id (delivery_id),
  INDEX idx_webhook_delivery_endpoint (endpoint_id, status),
  INDEX idx_webhook_delivery_retry (status, next_retry_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bulk import jobs
CREATE TABLE IF NOT EXISTS bulk_import_jobs (
  id              BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_id          CHAR(36)      NOT NULL,
  site_code       VARCHAR(32)   NOT NULL,
  import_type     ENUM('SUBSCRIPTION','VEHICLE','CREDENTIAL') NOT NULL,
  status          ENUM('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  file_name       VARCHAR(512)  NOT NULL,
  file_size_bytes BIGINT        NOT NULL DEFAULT 0,
  total_rows      INT           NOT NULL DEFAULT 0,
  processed_rows  INT           NOT NULL DEFAULT 0,
  success_count   INT           NOT NULL DEFAULT 0,
  error_count     INT           NOT NULL DEFAULT 0,
  error_details   JSON          NULL COMMENT '[{row:5, field:"plate", message:"invalid"}]',
  created_by      VARCHAR(120)  NOT NULL,
  started_at      DATETIME(3)  NULL,
  completed_at    DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_bulk_import_job_id (job_id),
  INDEX idx_bulk_import_site_status (site_code, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Media upload audit trail
CREATE TABLE IF NOT EXISTS media_upload_audit (
  id              BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  upload_id       CHAR(36)      NOT NULL,
  site_code       VARCHAR(32)   NOT NULL,
  entity_type     VARCHAR(64)   NOT NULL COMMENT 'session|incident|vehicle',
  entity_id       VARCHAR(64)   NOT NULL,
  file_name       VARCHAR(512)  NOT NULL,
  content_type    VARCHAR(128)  NOT NULL,
  file_size_bytes BIGINT        NOT NULL DEFAULT 0,
  storage_key     VARCHAR(1024) NOT NULL COMMENT 'S3/MinIO object key',
  storage_bucket  VARCHAR(128)  NOT NULL,
  checksum_sha256 CHAR(64)      NULL,
  uploaded_by     VARCHAR(120)  NOT NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_media_upload_id (upload_id),
  INDEX idx_media_upload_entity (entity_type, entity_id),
  INDEX idx_media_upload_site (site_code, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

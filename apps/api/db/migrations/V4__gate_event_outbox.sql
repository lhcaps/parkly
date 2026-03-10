-- V4: Outbox để đồng bộ MySQL -> MongoDB (tránh mất log khi Mongo down)
-- Pattern: ghi gate_events + outbox trong cùng transaction MySQL, worker sẽ drain outbox sang Mongo.

CREATE TABLE IF NOT EXISTS gate_event_outbox (
  outbox_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  event_id BIGINT NOT NULL,
  event_time DATETIME NOT NULL,
  mongo_collection VARCHAR(64) NOT NULL DEFAULT 'device_events',
  payload_json JSON NOT NULL,
  status ENUM('PENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  mongo_doc_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  next_retry_at DATETIME NULL,

  UNIQUE KEY uq_outbox_event (site_id, event_id, event_time),
  KEY ix_outbox_status_created (status, created_at),
  KEY ix_outbox_next_retry (status, next_retry_at)
) ENGINE=InnoDB;

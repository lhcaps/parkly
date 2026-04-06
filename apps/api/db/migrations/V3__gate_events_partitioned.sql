-- V3: gate_events (append-only) + partitioning theo tháng
-- Bám SPEC CHCSDL v1: event log lớn, idempotency, index theo (site_id, time), không lưu ảnh trong DB (chỉ lưu URL).
-- Ghi chú kỹ thuật MySQL:
--  - Bảng partitioned yêu cầu mọi UNIQUE index phải chứa cột partition key (event_time).
--  - Vì vậy unique idempotency triển khai dưới dạng (site_id, idempotency_key, event_time).

CREATE TABLE IF NOT EXISTS gate_events (
  event_id BIGINT NOT NULL AUTO_INCREMENT,
  site_id BIGINT NOT NULL,
  device_id BIGINT NOT NULL,
  direction ENUM('ENTRY','EXIT') NOT NULL,
  event_time DATETIME NOT NULL,
  rfid_uid VARCHAR(64) NULL,
  license_plate_raw VARCHAR(32) NULL,
  image_url VARCHAR(1024) NULL,
  ticket_id BIGINT NULL,
  idempotency_key VARCHAR(64) NOT NULL,

  -- Partitioning yêu cầu PK/UNIQUE chứa event_time
  PRIMARY KEY (event_id, event_time),
  UNIQUE KEY uq_gate_events_idem (site_id, idempotency_key, event_time),

  KEY ix_gate_events_site_time (site_id, event_time),
  KEY ix_gate_events_site_dir_time (site_id, direction, event_time),
  KEY ix_gate_events_site_rfid_time (site_id, rfid_uid, event_time),
  KEY ix_gate_events_site_plate_time (site_id, license_plate_raw, event_time),
  KEY ix_gate_events_ticket (ticket_id)
) ENGINE=InnoDB
PARTITION BY RANGE COLUMNS(event_time) (
  PARTITION p2026_01 VALUES LESS THAN ('2026-02-01'),
  PARTITION p2026_02 VALUES LESS THAN ('2026-03-01'),
  PARTITION p2026_03 VALUES LESS THAN ('2026-04-01'),
  PARTITION p_future VALUES LESS THAN (MAXVALUE)
);

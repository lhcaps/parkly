-- PR12 - Incident workflow, resolution actions, history and audit

ALTER TABLE gate_incidents
  ADD COLUMN source_key VARCHAR(191) NULL AFTER detail,
  ADD COLUMN resolution_action VARCHAR(64) NULL AFTER resolved_at,
  ADD COLUMN resolved_by_user_id BIGINT NULL AFTER resolution_action,
  ADD COLUMN resolved_by_role VARCHAR(32) NULL AFTER resolved_by_user_id,
  ADD COLUMN evidence_media_id BIGINT NULL AFTER resolved_by_role,
  ADD COLUMN last_signal_at DATETIME NULL AFTER evidence_media_id,
  ADD KEY ix_gate_incidents_source_key (source_key),
  ADD KEY ix_gate_incidents_status_updated (status, updated_at),
  ADD KEY ix_gate_incidents_site_status_created (site_id, status, created_at),
  ADD KEY ix_gate_incidents_resolved_by_user (resolved_by_user_id);

CREATE TABLE IF NOT EXISTS gate_incident_history (
  history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  incident_id BIGINT NOT NULL,
  action_code VARCHAR(64) NOT NULL,
  previous_status ENUM('OPEN','ACKED','RESOLVED','IGNORED') NULL,
  next_status ENUM('OPEN','ACKED','RESOLVED','IGNORED') NULL,
  actor_role VARCHAR(32) NULL,
  actor_user_id BIGINT NULL,
  note TEXT NULL,
  evidence_media_id BIGINT NULL,
  snapshot_before_json JSON NULL,
  snapshot_after_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gate_incident_history_incident FOREIGN KEY (incident_id) REFERENCES gate_incidents(incident_id),
  KEY ix_gate_incident_history_incident (incident_id, created_at),
  KEY ix_gate_incident_history_action (action_code, created_at),
  KEY ix_gate_incident_history_actor (actor_user_id, created_at)
) ENGINE=InnoDB;

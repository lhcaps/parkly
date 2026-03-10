-- V14: add WAITING_READ to gate_passage_sessions.status
-- Mục tiêu: sensor PRESENT/TRIGGERED đưa session sang WAITING_READ trước khi có ALPR/RFID.

ALTER TABLE gate_passage_sessions
  MODIFY COLUMN status ENUM(
    'OPEN',
    'WAITING_READ',
    'WAITING_DECISION',
    'APPROVED',
    'WAITING_PAYMENT',
    'DENIED',
    'PASSED',
    'TIMEOUT',
    'CANCELLED',
    'ERROR'
  ) NOT NULL DEFAULT 'OPEN';

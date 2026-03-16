-- V5: Enforce append-only cho gate_events và audit_logs (đúng tinh thần event log/audit bất biến)

DELIMITER $$

DROP TRIGGER IF EXISTS trg_gate_events_no_update $$
CREATE TRIGGER trg_gate_events_no_update
BEFORE UPDATE ON gate_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'gate_events is append-only: UPDATE is not allowed';
END $$

DROP TRIGGER IF EXISTS trg_gate_events_no_delete $$
CREATE TRIGGER trg_gate_events_no_delete
BEFORE DELETE ON gate_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'gate_events is append-only: DELETE is not allowed';
END $$

DROP TRIGGER IF EXISTS trg_audit_logs_no_update $$
CREATE TRIGGER trg_audit_logs_no_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only: UPDATE is not allowed';
END $$

DROP TRIGGER IF EXISTS trg_audit_logs_no_delete $$
CREATE TRIGGER trg_audit_logs_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only: DELETE is not allowed';
END $$

DELIMITER ;

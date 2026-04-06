-- V6: Chốt ca (end-of-shift) bằng Stored Procedure + ledger append-only
-- Bám SPEC CHCSDL v1: đóng sổ doanh thu theo khoảng thời gian, snapshot số liệu, hạn chế sửa lại.

-- ============ Shift closures (snapshot) ============
CREATE TABLE IF NOT EXISTS shift_closures (
  closure_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  shift_code VARCHAR(32) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  closed_by_user_id BIGINT NOT NULL,
  total_tickets INT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_shift_site FOREIGN KEY (site_id) REFERENCES parking_sites(site_id),
  UNIQUE KEY uq_shift_code (site_id, shift_code),
  KEY ix_shift_site_start (site_id, start_time),
  KEY ix_shift_site_created (site_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shift_closure_breakdowns (
  closure_id BIGINT NOT NULL,
  method ENUM('CASH','CARD','EWALLET') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  txn_count INT NOT NULL,
  PRIMARY KEY (closure_id, method),
  CONSTRAINT fk_shift_break_closure FOREIGN KEY (closure_id) REFERENCES shift_closures(closure_id)
) ENGINE=InnoDB;

-- ============ Append-only enforcement (ledger) ============
DELIMITER $$

DROP TRIGGER IF EXISTS trg_shift_closures_no_update $$
CREATE TRIGGER trg_shift_closures_no_update
BEFORE UPDATE ON shift_closures
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'shift_closures is append-only: UPDATE is not allowed';
END $$

DROP TRIGGER IF EXISTS trg_shift_closures_no_delete $$
CREATE TRIGGER trg_shift_closures_no_delete
BEFORE DELETE ON shift_closures
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'shift_closures is append-only: DELETE is not allowed';
END $$

DROP TRIGGER IF EXISTS trg_shift_breakdowns_no_update $$
CREATE TRIGGER trg_shift_breakdowns_no_update
BEFORE UPDATE ON shift_closure_breakdowns
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'shift_closure_breakdowns is append-only: UPDATE is not allowed';
END $$

DROP TRIGGER IF EXISTS trg_shift_breakdowns_no_delete $$
CREATE TRIGGER trg_shift_breakdowns_no_delete
BEFORE DELETE ON shift_closure_breakdowns
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'shift_closure_breakdowns is append-only: DELETE is not allowed';
END $$

-- ============ Stored procedure: close shift ============
-- Input:
--  p_site_id, p_shift_code: định danh ca trong site
--  p_start, p_end: khoảng thời gian cần chốt (paid_at trong payments)
--  p_closed_by_user_id: user chốt ca
-- Behavior:
--  - chặn chốt trùng ca
--  - chặn nếu còn vé OPEN trong khoảng thời gian (có thể điều chỉnh policy)
--  - snapshot tổng tiền + breakdown theo method

DROP PROCEDURE IF EXISTS sp_close_shift $$
CREATE PROCEDURE sp_close_shift(
  IN p_site_id BIGINT,
  IN p_shift_code VARCHAR(32),
  IN p_start DATETIME,
  IN p_end DATETIME,
  IN p_closed_by_user_id BIGINT
)
BEGIN
  DECLARE v_open_cnt INT DEFAULT 0;
  DECLARE v_total_tickets INT DEFAULT 0;
  DECLARE v_total_amount DECIMAL(12,2) DEFAULT 0;
  DECLARE v_closure_id BIGINT DEFAULT 0;

  IF p_end <= p_start THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid time range: end_time must be greater than start_time';
  END IF;

  -- prevent duplicate closures
  IF EXISTS (
    SELECT 1
    FROM shift_closures
    WHERE site_id = p_site_id AND shift_code = p_shift_code
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shift already closed (duplicate shift_code)';
  END IF;

  START TRANSACTION;

  -- Policy: không cho chốt ca nếu còn ticket OPEN trong khoảng thời gian
  SELECT COUNT(*) INTO v_open_cnt
  FROM tickets
  WHERE site_id = p_site_id
    AND status = 'OPEN'
    AND entry_time < p_end
    AND (exit_time IS NULL OR exit_time >= p_start);

  IF v_open_cnt > 0 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot close shift: there are OPEN tickets in the time range';
  END IF;

  -- Lock payments trong range để snapshot ổn định (giảm rủi ro concurrent changes)
  SELECT payment_id
  FROM payments
  WHERE site_id = p_site_id
    AND paid_at >= p_start AND paid_at < p_end
  FOR UPDATE;

  -- Snapshot totals (chỉ tính PAID)
  SELECT
    COUNT(DISTINCT ticket_id),
    COALESCE(SUM(amount), 0)
  INTO v_total_tickets, v_total_amount
  FROM payments
  WHERE site_id = p_site_id
    AND status = 'PAID'
    AND paid_at >= p_start AND paid_at < p_end;

  INSERT INTO shift_closures(
    site_id, shift_code, start_time, end_time,
    closed_by_user_id, total_tickets, total_amount
  ) VALUES (
    p_site_id, p_shift_code, p_start, p_end,
    p_closed_by_user_id, v_total_tickets, v_total_amount
  );

  SET v_closure_id = LAST_INSERT_ID();

  -- Breakdown by method
  INSERT INTO shift_closure_breakdowns(closure_id, method, amount, txn_count)
  SELECT
    v_closure_id,
    method,
    COALESCE(SUM(amount), 0) AS amount,
    COUNT(*) AS txn_count
  FROM payments
  WHERE site_id = p_site_id
    AND status = 'PAID'
    AND paid_at >= p_start AND paid_at < p_end
  GROUP BY method;

  COMMIT;

  -- output (optional): SELECT để demo nhanh
  SELECT v_closure_id AS closure_id, v_total_tickets AS total_tickets, v_total_amount AS total_amount;
END $$

DELIMITER ;

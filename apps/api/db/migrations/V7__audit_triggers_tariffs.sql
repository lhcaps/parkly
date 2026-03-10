-- V7: Audit triggers cho tariffs và tariff_rules
-- Mục tiêu: chứng minh SQL nâng cao + audit trail bất biến.
-- Lưu ý enterprise:
--  - Trigger không tự biết "ai" là người thao tác.
--  - App nên set session var trước khi thao tác: SET @actor_user_id = ?; SET @actor_site_id = ? (optional)
--  - Nếu không set, actor_user_id fallback = 0 (SYSTEM).

DELIMITER $$

-- ==================== helpers ====================
-- Fallback actor id: 0

-- ==================== tariffs ====================
DROP TRIGGER IF EXISTS trg_tariffs_ai $$
CREATE TRIGGER trg_tariffs_ai
AFTER INSERT ON tariffs
FOR EACH ROW
BEGIN
  INSERT INTO audit_logs(site_id, actor_user_id, action, entity_table, entity_id, before_json, after_json)
  VALUES(
    NEW.site_id,
    COALESCE(@actor_user_id, 0),
    'INSERT_TARIFF',
    'tariffs',
    CAST(NEW.tariff_id AS CHAR),
    NULL,
    JSON_OBJECT(
      'tariff_id', NEW.tariff_id,
      'site_id', NEW.site_id,
      'name', NEW.name,
      'applies_to', NEW.applies_to,
      'vehicle_type', NEW.vehicle_type,
      'is_active', NEW.is_active,
      'valid_from', DATE_FORMAT(NEW.valid_from, '%Y-%m-%d %H:%i:%s')
    )
  );
END $$

DROP TRIGGER IF EXISTS trg_tariffs_au $$
CREATE TRIGGER trg_tariffs_au
AFTER UPDATE ON tariffs
FOR EACH ROW
BEGIN
  INSERT INTO audit_logs(site_id, actor_user_id, action, entity_table, entity_id, before_json, after_json)
  VALUES(
    NEW.site_id,
    COALESCE(@actor_user_id, 0),
    'UPDATE_TARIFF',
    'tariffs',
    CAST(NEW.tariff_id AS CHAR),
    JSON_OBJECT(
      'tariff_id', OLD.tariff_id,
      'site_id', OLD.site_id,
      'name', OLD.name,
      'applies_to', OLD.applies_to,
      'vehicle_type', OLD.vehicle_type,
      'is_active', OLD.is_active,
      'valid_from', DATE_FORMAT(OLD.valid_from, '%Y-%m-%d %H:%i:%s')
    ),
    JSON_OBJECT(
      'tariff_id', NEW.tariff_id,
      'site_id', NEW.site_id,
      'name', NEW.name,
      'applies_to', NEW.applies_to,
      'vehicle_type', NEW.vehicle_type,
      'is_active', NEW.is_active,
      'valid_from', DATE_FORMAT(NEW.valid_from, '%Y-%m-%d %H:%i:%s')
    )
  );
END $$

DROP TRIGGER IF EXISTS trg_tariffs_ad $$
CREATE TRIGGER trg_tariffs_ad
AFTER DELETE ON tariffs
FOR EACH ROW
BEGIN
  INSERT INTO audit_logs(site_id, actor_user_id, action, entity_table, entity_id, before_json, after_json)
  VALUES(
    OLD.site_id,
    COALESCE(@actor_user_id, 0),
    'DELETE_TARIFF',
    'tariffs',
    CAST(OLD.tariff_id AS CHAR),
    JSON_OBJECT(
      'tariff_id', OLD.tariff_id,
      'site_id', OLD.site_id,
      'name', OLD.name,
      'applies_to', OLD.applies_to,
      'vehicle_type', OLD.vehicle_type,
      'is_active', OLD.is_active,
      'valid_from', DATE_FORMAT(OLD.valid_from, '%Y-%m-%d %H:%i:%s')
    ),
    NULL
  );
END $$

-- ==================== tariff_rules ====================
DROP TRIGGER IF EXISTS trg_tariff_rules_ai $$
CREATE TRIGGER trg_tariff_rules_ai
AFTER INSERT ON tariff_rules
FOR EACH ROW
BEGIN
  DECLARE v_site_id BIGINT;
  SELECT site_id INTO v_site_id FROM tariffs WHERE tariff_id = NEW.tariff_id;

  INSERT INTO audit_logs(site_id, actor_user_id, action, entity_table, entity_id, before_json, after_json)
  VALUES(
    v_site_id,
    COALESCE(@actor_user_id, 0),
    'INSERT_TARIFF_RULE',
    'tariff_rules',
    CAST(NEW.rule_id AS CHAR),
    NULL,
    JSON_OBJECT(
      'rule_id', NEW.rule_id,
      'tariff_id', NEW.tariff_id,
      'rule_type', NEW.rule_type,
      'param_json', NEW.param_json,
      'priority', NEW.priority
    )
  );
END $$

DROP TRIGGER IF EXISTS trg_tariff_rules_au $$
CREATE TRIGGER trg_tariff_rules_au
AFTER UPDATE ON tariff_rules
FOR EACH ROW
BEGIN
  DECLARE v_site_id BIGINT;
  SELECT site_id INTO v_site_id FROM tariffs WHERE tariff_id = NEW.tariff_id;

  INSERT INTO audit_logs(site_id, actor_user_id, action, entity_table, entity_id, before_json, after_json)
  VALUES(
    v_site_id,
    COALESCE(@actor_user_id, 0),
    'UPDATE_TARIFF_RULE',
    'tariff_rules',
    CAST(NEW.rule_id AS CHAR),
    JSON_OBJECT(
      'rule_id', OLD.rule_id,
      'tariff_id', OLD.tariff_id,
      'rule_type', OLD.rule_type,
      'param_json', OLD.param_json,
      'priority', OLD.priority
    ),
    JSON_OBJECT(
      'rule_id', NEW.rule_id,
      'tariff_id', NEW.tariff_id,
      'rule_type', NEW.rule_type,
      'param_json', NEW.param_json,
      'priority', NEW.priority
    )
  );
END $$

DROP TRIGGER IF EXISTS trg_tariff_rules_ad $$
CREATE TRIGGER trg_tariff_rules_ad
AFTER DELETE ON tariff_rules
FOR EACH ROW
BEGIN
  DECLARE v_site_id BIGINT;
  SELECT site_id INTO v_site_id FROM tariffs WHERE tariff_id = OLD.tariff_id;

  INSERT INTO audit_logs(site_id, actor_user_id, action, entity_table, entity_id, before_json, after_json)
  VALUES(
    v_site_id,
    COALESCE(@actor_user_id, 0),
    'DELETE_TARIFF_RULE',
    'tariff_rules',
    CAST(OLD.rule_id AS CHAR),
    JSON_OBJECT(
      'rule_id', OLD.rule_id,
      'tariff_id', OLD.tariff_id,
      'rule_type', OLD.rule_type,
      'param_json', OLD.param_json,
      'priority', OLD.priority
    ),
    NULL
  );
END $$

DELIMITER ;

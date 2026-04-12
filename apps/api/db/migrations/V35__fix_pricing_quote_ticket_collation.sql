-- V35: Fix collation mismatch in pkg_pricing_quote_ticket for MySQL local/runtime

DELIMITER $$

DROP PROCEDURE IF EXISTS pkg_pricing_quote_ticket $$
CREATE PROCEDURE pkg_pricing_quote_ticket(
  IN p_site_id BIGINT,
  IN p_vehicle_type VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_entry_time DATETIME,
  IN p_exit_time DATETIME
)
BEGIN
  DECLARE v_minutes INT DEFAULT 0;
  DECLARE v_tariff_id BIGINT DEFAULT NULL;
  DECLARE v_free_minutes INT DEFAULT 0;
  DECLARE v_per_hour DECIMAL(12, 2) DEFAULT 0;
  DECLARE v_daily_cap DECIMAL(12, 2) DEFAULT NULL;
  DECLARE v_billable_minutes INT DEFAULT 0;
  DECLARE v_hours INT DEFAULT 0;
  DECLARE v_subtotal DECIMAL(12, 2) DEFAULT 0;
  DECLARE v_total DECIMAL(12, 2) DEFAULT 0;

  SET v_minutes = GREATEST(TIMESTAMPDIFF(MINUTE, p_entry_time, p_exit_time), 0);

  SELECT t.tariff_id
  INTO v_tariff_id
  FROM tariffs t
  WHERE t.site_id = p_site_id
    AND CONVERT(t.applies_to USING utf8mb4) COLLATE utf8mb4_unicode_ci = _utf8mb4'TICKET' COLLATE utf8mb4_unicode_ci
    AND CONVERT(t.vehicle_type USING utf8mb4) COLLATE utf8mb4_unicode_ci = p_vehicle_type
    AND t.is_active = 1
    AND t.valid_from <= p_entry_time
    AND (t.valid_until IS NULL OR t.valid_until >= DATE(p_entry_time))
  ORDER BY t.valid_from DESC, t.tariff_id DESC
  LIMIT 1;

  IF v_tariff_id IS NULL THEN
    SELECT
      NULL AS tariff_id,
      v_minutes AS minutes,
      0 AS free_minutes,
      0 AS per_hour,
      NULL AS daily_cap,
      0 AS subtotal,
      0 AS total;
  ELSE
    SELECT
      COALESCE(MAX(CASE
        WHEN CONVERT(tr.rule_type USING utf8mb4) COLLATE utf8mb4_unicode_ci = _utf8mb4'FREE_MINUTES' COLLATE utf8mb4_unicode_ci
        THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(tr.param_json, '$.minutes')) AS UNSIGNED)
      END), 0),
      COALESCE(MAX(CASE
        WHEN CONVERT(tr.rule_type USING utf8mb4) COLLATE utf8mb4_unicode_ci = _utf8mb4'HOURLY' COLLATE utf8mb4_unicode_ci
        THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(tr.param_json, '$.perHour')) AS DECIMAL(12, 2))
      END), 0),
      MAX(CASE
        WHEN CONVERT(tr.rule_type USING utf8mb4) COLLATE utf8mb4_unicode_ci = _utf8mb4'DAILY_CAP' COLLATE utf8mb4_unicode_ci
        THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(tr.param_json, '$.capAmount')) AS DECIMAL(12, 2))
      END)
    INTO
      v_free_minutes,
      v_per_hour,
      v_daily_cap
    FROM tariff_rules tr
    WHERE tr.tariff_id = v_tariff_id
      AND COALESCE(tr.is_active, 1) = 1
      AND (tr.effective_date IS NULL OR tr.effective_date <= DATE(p_entry_time))
      AND (tr.expiration_date IS NULL OR tr.expiration_date >= DATE(p_entry_time));

    SET v_billable_minutes = GREATEST(v_minutes - v_free_minutes, 0);
    SET v_hours = CASE
      WHEN v_billable_minutes <= 0 THEN 0
      ELSE CEIL(v_billable_minutes / 60)
    END;
    SET v_subtotal = v_hours * v_per_hour;
    SET v_total = CASE
      WHEN v_daily_cap IS NULL THEN v_subtotal
      ELSE LEAST(v_subtotal, v_daily_cap)
    END;

    SELECT
      v_tariff_id AS tariff_id,
      v_minutes AS minutes,
      v_free_minutes AS free_minutes,
      v_per_hour AS per_hour,
      v_daily_cap AS daily_cap,
      v_subtotal AS subtotal,
      v_total AS total;
  END IF;
END $$

DELIMITER ;

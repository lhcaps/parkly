-- Reset dữ liệu SEED_* (DEV/DEMO ONLY)
-- Dùng khi muốn chạy seed_big.sql lại.

-- 1) Outbox seeded
DELETE FROM gate_event_outbox
WHERE JSON_EXTRACT(payload_json, '$.seed') = true;

-- 2) gate_events seeded
-- gate_events là append-only (V5) => DELETE bị chặn bởi trigger.
-- Seed BIG tạo data trong 02/2026 => truncate partition p2026_02 (V3).
-- Idempotent: chỉ truncate nếu partition tồn tại.
SET @p_exists := (
  SELECT COUNT(*)
  FROM information_schema.partitions
  WHERE table_schema = DATABASE()
    AND table_name = 'gate_events'
    AND partition_name = 'p2026_02'
);
SET @sql_truncate := IF(
  @p_exists > 0,
  'ALTER TABLE gate_events TRUNCATE PARTITION p2026_02',
  'SELECT ''Partition p2026_02 does not exist — skipping'' AS result'
);
PREPARE stmt_truncate FROM @sql_truncate;
EXECUTE stmt_truncate;
DEALLOCATE PREPARE stmt_truncate;

-- 3) Payments -> Tickets -> Vehicles -> Customers
DELETE p
FROM payments p
JOIN tickets t ON t.ticket_id = p.ticket_id
WHERE t.ticket_code LIKE 'SEED_T%';

DELETE FROM tickets
WHERE ticket_code LIKE 'SEED_T%';

DELETE FROM vehicles
WHERE license_plate LIKE 'SEED_PLATE_%';

DELETE FROM customers
WHERE email LIKE 'seed_%@example.com';

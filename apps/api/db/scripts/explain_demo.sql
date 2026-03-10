-- EXPLAIN demo (bám SPEC): chứng minh index/partition có tác dụng
-- Lưu ý: gate_events là partitioned -> query có điều kiện event_time sẽ được partition pruning.

-- Tip:
-- - Nếu bạn muốn "before/after" rõ ràng, chạy cả 2 phiên bản:
--   A) Query bình thường (dùng index)
--   B) Query IGNORE INDEX (giả lập tình huống thiếu index -> full scan)

-- 1) Truy vấn log theo site + time range (realtime dashboard)
EXPLAIN
SELECT event_id, site_id, device_id, direction, event_time
FROM gate_events
WHERE site_id = 1
  AND event_time >= '2026-02-01'
  AND event_time <  '2026-03-01'
ORDER BY event_time DESC
LIMIT 50;

-- 1B) Giả lập "thiếu index" (IGNORE index)
EXPLAIN
SELECT event_id, site_id, device_id, direction, event_time
FROM gate_events IGNORE INDEX (ix_gate_events_site_time)
WHERE site_id = 1
  AND event_time >= '2026-02-01'
  AND event_time <  '2026-03-01'
ORDER BY event_time DESC
LIMIT 50;

-- 2) Truy vấn last event theo RFID (anti-passback check)
EXPLAIN
SELECT event_id, direction, event_time
FROM gate_events
WHERE site_id = 1
  AND rfid_uid = 'TEST_001'
ORDER BY event_time DESC
LIMIT 1;

-- 2B) IGNORE index (giả lập thiếu index theo RFID)
EXPLAIN
SELECT event_id, direction, event_time
FROM gate_events IGNORE INDEX (ix_gate_events_site_rfid_time)
WHERE site_id = 1
  AND rfid_uid = 'TEST_001'
ORDER BY event_time DESC
LIMIT 1;

-- 3) Doanh thu theo ngày (report)
EXPLAIN
SELECT DATE(paid_at) AS d, site_id, SUM(amount) AS revenue
FROM payments
WHERE site_id = 1
  AND status = 'PAID'
  AND paid_at >= '2026-02-01'
  AND paid_at <  '2026-03-01'
GROUP BY d, site_id
ORDER BY d;

-- 3B) IGNORE index (giả lập thiếu index theo (site_id, paid_at))
-- NOTE: index hiện tại của payments là ix_payments_site_paidat (theo V2)
EXPLAIN
SELECT DATE(paid_at) AS d, site_id, SUM(amount) AS revenue
FROM payments IGNORE INDEX (ix_payments_site_paidat)
WHERE site_id = 1
  AND status = 'PAID'
  AND paid_at >= '2026-02-01'
  AND paid_at <  '2026-03-01'
GROUP BY d, site_id
ORDER BY d;

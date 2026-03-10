-- V9: Optimize revenue-by-day report
-- Add STORED generated column for day-level grouping + composite index

ALTER TABLE payments
  ADD COLUMN paid_date DATE
    GENERATED ALWAYS AS (DATE(paid_at)) STORED,
  ADD INDEX ix_payments_site_status_paiddate (site_id, status, paid_date);

ANALYZE TABLE payments;
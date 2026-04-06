-- PR PL-02: Spot layout metadata for Parking Live board
-- Adds floor_key, layout_row, layout_col, layout_order, slot_kind, is_blocked, is_reserved
-- to the spots table so the board can render a proper grid without FE hardcoding.
-- Existing spots without layout data will derive position from spot_code at read time
-- (handled in parking-live-mappers.ts resolveFloorKey/resolveLayoutOrder).

ALTER TABLE spots
  ADD COLUMN floor_key     VARCHAR(32)  NULL AFTER status,
  ADD COLUMN layout_row    SMALLINT     NULL AFTER floor_key,
  ADD COLUMN layout_col    SMALLINT     NULL AFTER layout_row,
  ADD COLUMN layout_order  INT          NULL AFTER layout_col,
  ADD COLUMN slot_kind     VARCHAR(16)  NULL AFTER layout_order,
  ADD COLUMN is_blocked    TINYINT(1)   NOT NULL DEFAULT 0 AFTER slot_kind,
  ADD COLUMN is_reserved   TINYINT(1)   NOT NULL DEFAULT 0 AFTER is_blocked,
  ADD COLUMN display_label VARCHAR(32)  NULL AFTER is_reserved,
  ADD COLUMN bay_code      VARCHAR(16)  NULL AFTER display_label;

-- Index to support floor-grouped board queries
CREATE INDEX ix_spots_site_floor ON spots (site_id, floor_key);
CREATE INDEX ix_spots_site_floor_order ON spots (site_id, floor_key, layout_order);

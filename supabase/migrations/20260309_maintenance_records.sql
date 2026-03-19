-- =============================================================================
-- QRSTKR — Maintenance Records
-- Migration: 2026-03-09
-- Purpose: Track service history, repairs, and upgrades for items
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. MAINTENANCE RECORDS TABLE
-- Tracks individual service events for an item
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Record classification
  record_type     VARCHAR(30) NOT NULL DEFAULT 'service'
    CHECK (record_type IN ('service', 'repair', 'upgrade', 'inspection', 'diagnostic', 'other')),

  -- Core fields
  title           VARCHAR(200) NOT NULL,        -- "Oil Change", "New Impeller", etc.
  description     TEXT,                          -- Detailed notes about what was done
  service_date    DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Optional tracking
  cost_cents      INTEGER,                       -- Cost in cents (null = not recorded)
  mileage         INTEGER,                       -- Odometer / hour meter reading
  provider        VARCHAR(200),                  -- Who did the work ("Self", shop name, etc.)

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_maintenance_item_id ON maintenance_records(item_id);
CREATE INDEX idx_maintenance_service_date ON maintenance_records(item_id, service_date DESC);
CREATE INDEX idx_maintenance_created_by ON maintenance_records(created_by);

-- Auto-update updated_at (reuse existing trigger function from orders migration)
CREATE TRIGGER maintenance_records_updated_at
  BEFORE UPDATE ON maintenance_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

-- Anyone can READ maintenance records for any item (they're part of the public history)
-- This is the whole point — scanners see the service history
CREATE POLICY "Anyone can view maintenance records"
  ON maintenance_records FOR SELECT
  USING (true);

-- Item owners can INSERT maintenance records for their own items
CREATE POLICY "Item owners can add maintenance records"
  ON maintenance_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM items WHERE items.id = maintenance_records.item_id AND items.owner_id = auth.uid()
    )
  );

-- Only the person who created the record can UPDATE it
CREATE POLICY "Record creators can update their records"
  ON maintenance_records FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Only the person who created the record (or item owner) can DELETE it
CREATE POLICY "Record creators or item owners can delete records"
  ON maintenance_records FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM items WHERE items.id = maintenance_records.item_id AND items.owner_id = auth.uid()
    )
  );

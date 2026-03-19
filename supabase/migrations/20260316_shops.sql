-- =============================================================================
-- QRSTKR — Shop System
-- Migration: 2026-03-16
-- Purpose: Shop accounts, employee management, and shop-related maintenance
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SHOPS TABLE
-- Business profiles for repair shops, marinas, mechanics, etc.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shops (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    VARCHAR(200) NOT NULL,
  address                 VARCHAR(300) NOT NULL,
  city                    VARCHAR(100) NOT NULL,
  state                   VARCHAR(2) NOT NULL,
  phone                   VARCHAR(20) NOT NULL,
  website                 VARCHAR(300),
  categories_serviced     JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Array of strings: cars, trucks, boats, motorcycles, lawnmowers,
    -- trailers, RVs, ATVs, jet_skis, generators, heavy_equipment, other

  -- Verification
  verified                BOOLEAN NOT NULL DEFAULT false,
  verified_at             TIMESTAMPTZ,
  verified_method         VARCHAR(30)
    CHECK (verified_method IN ('google_business', 'manual_review')),
  verification_requested  BOOLEAN NOT NULL DEFAULT false,
  verification_docs       JSONB,                       -- Array of { filename, url } for manual review uploads

  -- Ownership
  created_by              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Timestamps
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookups
CREATE INDEX idx_shops_created_by ON shops(created_by);

-- Auto-update updated_at
CREATE TRIGGER shops_updated_at
  BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. SHOP EMPLOYEES TABLE
-- Links user accounts to shops with role-based access
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Null until invite is accepted (pending invites only have email)
  email           VARCHAR(300) NOT NULL,               -- Invite email (always populated)
  role            VARCHAR(20) NOT NULL DEFAULT 'technician'
    CHECK (role IN ('admin', 'technician')),
  invited_by      UUID NOT NULL REFERENCES auth.users(id),
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at     TIMESTAMPTZ,                         -- Null until account created/linked
  removed_at      TIMESTAMPTZ,                         -- Soft delete (null = active)

  -- Prevent duplicate active employees
  UNIQUE (shop_id, email)
);

-- Indexes
CREATE INDEX idx_shop_employees_shop_id ON shop_employees(shop_id);
CREATE INDEX idx_shop_employees_user_id ON shop_employees(user_id);
CREATE INDEX idx_shop_employees_email ON shop_employees(email);

-- -----------------------------------------------------------------------------
-- 3. NOTIFICATIONS TABLE
-- In-app notifications for item owners (new shop submissions, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                VARCHAR(50) NOT NULL
    CHECK (type IN ('new_shop_submission', 'dispute_filed')),
  title               VARCHAR(200) NOT NULL,
  body                TEXT,
  related_item_id     UUID REFERENCES items(id) ON DELETE SET NULL,
  related_record_id   UUID REFERENCES maintenance_records(id) ON DELETE SET NULL,
  read_at             TIMESTAMPTZ,                     -- Null = unread
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user notification queries
CREATE INDEX idx_notifications_user_id ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- 4. ALTER MAINTENANCE RECORDS — Add shop-related fields
-- -----------------------------------------------------------------------------

-- Visit grouping (multiple line items from one shop visit share a visit_id)
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS
  visit_id            UUID;

-- Odometer/hours at time of shop visit (distinct from existing mileage column)
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS
  mileage_at_service  INTEGER;

-- Which shop submitted this record (null for owner-submitted)
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS
  performed_by_shop   UUID REFERENCES shops(id) ON DELETE SET NULL;

-- Which specific employee entered it (null for owner-submitted)
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS
  submitted_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Who created the record: owner or shop
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS
  source              VARCHAR(20) NOT NULL DEFAULT 'owner_reported'
    CHECK (source IN ('owner_reported', 'shop_submitted'));

-- Dispute fields
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS
  disputed            BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS
  disputed_at         TIMESTAMPTZ;

ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS
  dispute_reason      TEXT;

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS idx_maintenance_visit_id ON maintenance_records(visit_id) WHERE visit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_shop ON maintenance_records(performed_by_shop) WHERE performed_by_shop IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_disputed ON maintenance_records(item_id) WHERE disputed = true;

-- Backfill: mark all existing records as owner_reported
-- (source column defaults to 'owner_reported' so this is a safety net)
UPDATE maintenance_records SET source = 'owner_reported' WHERE source IS NULL;

-- -----------------------------------------------------------------------------
-- 5. ALTER STICKERS — Add shop_managed status
-- (For Phase 2.5 shop-initiated registration, but adding enum value now)
-- -----------------------------------------------------------------------------
-- Note: Supabase uses VARCHAR with CHECK constraints, not native enums.
-- The stickers table uses a status column — we need to check if it has a
-- constraint and update it. If it's a plain VARCHAR, this is a no-op for now
-- and the app code will handle validation.

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY — Shops
-- -----------------------------------------------------------------------------
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Anyone can read basic shop info (name, verified status, categories)
-- Used when displaying "Submitted by: Shop Name ✅" on maintenance records
CREATE POLICY "Anyone can view shop profiles"
  ON shops FOR SELECT
  USING (true);

-- Only the shop admin (created_by) can update their shop
CREATE POLICY "Shop admin can update their shop"
  ON shops FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Any authenticated user can register a shop (INSERT)
CREATE POLICY "Authenticated users can register shops"
  ON shops FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Shop admin can delete their shop
CREATE POLICY "Shop admin can delete their shop"
  ON shops FOR DELETE
  USING (created_by = auth.uid());

-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY — Shop Employees
-- -----------------------------------------------------------------------------
ALTER TABLE shop_employees ENABLE ROW LEVEL SECURITY;

-- Employees can view their own row; shop owner can see all employees.
-- NOTE: Cannot self-reference shop_employees here (causes infinite recursion
-- error 42P17). Instead, use shops.created_by to check ownership.
CREATE POLICY "Employees can view their shop's employees"
  ON shop_employees FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = shop_employees.shop_id
        AND shops.created_by = auth.uid()
    )
  );

CREATE POLICY "Shop admin can add employees"
  ON shop_employees FOR INSERT
  WITH CHECK (
    -- Shop owner (created_by) can add employees.
    -- Avoids self-referencing shop_employees which causes infinite recursion.
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = shop_employees.shop_id
        AND shops.created_by = auth.uid()
    )
  );

CREATE POLICY "Shop admin can update employees"
  ON shop_employees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = shop_employees.shop_id
        AND shops.created_by = auth.uid()
    )
  );

-- No DELETE policy — employees are soft-deleted via removed_at

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY — Notifications
-- -----------------------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can mark their own notifications as read
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System inserts notifications (via API routes with service role)
-- No INSERT policy for regular users — notifications are created server-side

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 9. UPDATE MAINTENANCE RECORDS RLS — Shop submission support + auth requirement
-- -----------------------------------------------------------------------------

-- DROP the old public SELECT policy (anyone could read without auth)
DROP POLICY IF EXISTS "Anyone can view maintenance records" ON maintenance_records;

-- NEW: Only authenticated users can read maintenance records, excluding disputed ones
CREATE POLICY "Authenticated users can view non-disputed maintenance records"
  ON maintenance_records FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND disputed = false
  );

-- Item owners can still see their own disputed records (for dispute management)
CREATE POLICY "Item owners can view their own disputed records"
  ON maintenance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM items WHERE items.id = maintenance_records.item_id AND items.owner_id = auth.uid()
    )
    AND disputed = true
  );

-- NEW: Shop employees can INSERT records for any item (source must be shop_submitted)
CREATE POLICY "Shop employees can add maintenance records"
  ON maintenance_records FOR INSERT
  WITH CHECK (
    source = 'shop_submitted'
    AND performed_by_shop IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM shop_employees AS se
      WHERE se.shop_id = maintenance_records.performed_by_shop
        AND se.user_id = auth.uid()
        AND se.removed_at IS NULL
    )
  );

-- Shop employees can view records their shop submitted (for shop history/disputes view)
CREATE POLICY "Shop employees can view their shop submissions"
  ON maintenance_records FOR SELECT
  USING (
    performed_by_shop IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM shop_employees AS se
      WHERE se.shop_id = maintenance_records.performed_by_shop
        AND se.user_id = auth.uid()
        AND se.removed_at IS NULL
    )
  );

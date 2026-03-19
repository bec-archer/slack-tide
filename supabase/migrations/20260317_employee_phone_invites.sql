-- Add phone column to shop_employees for phone-based invites
-- Employees can now be invited by phone number OR email

-- Add nullable phone column
ALTER TABLE shop_employees
ADD COLUMN phone VARCHAR(20);

-- Make email nullable (invites can be phone-only)
ALTER TABLE shop_employees
ALTER COLUMN email DROP NOT NULL;

-- Drop the old unique constraint (was on shop_id + email)
ALTER TABLE shop_employees
DROP CONSTRAINT IF EXISTS shop_employees_shop_id_email_key;

-- Add new unique constraints — prevent duplicate active invites by email OR phone
-- Using partial unique indexes (only for non-removed employees)
CREATE UNIQUE INDEX idx_shop_employees_unique_email
  ON shop_employees (shop_id, email)
  WHERE email IS NOT NULL AND removed_at IS NULL;

CREATE UNIQUE INDEX idx_shop_employees_unique_phone
  ON shop_employees (shop_id, phone)
  WHERE phone IS NOT NULL AND removed_at IS NULL;

-- Index for phone lookups during invite acceptance
CREATE INDEX idx_shop_employees_phone ON shop_employees(phone);

-- Add check constraint: must have at least email OR phone
ALTER TABLE shop_employees
ADD CONSTRAINT shop_employees_contact_required
  CHECK (email IS NOT NULL OR phone IS NOT NULL);

-- Add account_type to profiles to distinguish personal vs business accounts
-- Personal accounts: can register items, cannot register shops
-- Business accounts: can register shops, cannot register items

ALTER TABLE profiles
ADD COLUMN account_type VARCHAR(20) NOT NULL DEFAULT 'personal'
CHECK (account_type IN ('personal', 'business'));

-- Set existing shop owners/employees to 'business'
UPDATE profiles
SET account_type = 'business'
WHERE id IN (
  SELECT DISTINCT user_id
  FROM shop_employees
  WHERE user_id IS NOT NULL
    AND removed_at IS NULL
);

-- =============================================================================
-- QRSTKR — Orders, Order Items, and Coupons
-- Migration: 2026-03-03
-- Purpose: Support sticker ordering pipeline (customizer → payment → generation → print)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ORDERS TABLE
-- Tracks each sticker order from submission to print
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Order status lifecycle:
  --   pending_payment → paid → generating → generated → printing → shipped → completed
  --   At any point: → failed, → cancelled, → refunded
  status          VARCHAR(30) NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment', 'paid', 'generating', 'generated',
      'printing', 'shipped', 'completed',
      'failed', 'cancelled', 'refunded'
    )),

  -- Payment
  payment_method   VARCHAR(30),            -- 'square', 'coupon', 'free_test'
  payment_ref      VARCHAR(255),           -- Square transaction ID or coupon code
  amount_cents     INTEGER NOT NULL DEFAULT 0,  -- Total in cents (0 for coupon/test orders)
  currency         VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Shipping (nullable — in-house printing may not need shipping)
  shipping_name    VARCHAR(200),
  shipping_address TEXT,
  shipping_city    VARCHAR(100),
  shipping_state   VARCHAR(2),
  shipping_zip     VARCHAR(10),

  -- Admin notes
  admin_notes      TEXT,

  -- Timestamps
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at          TIMESTAMPTZ,
  generated_at     TIMESTAMPTZ,
  printed_at       TIMESTAMPTZ,
  shipped_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user lookups and admin queue
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. ORDER ITEMS TABLE
-- Individual stickers within an order (1 per order for single, N for batch)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sticker_id      UUID REFERENCES stickers(id) ON DELETE SET NULL,  -- Linked after generation

  -- Sticker configuration (captured from customizer)
  state_template   VARCHAR(50) NOT NULL,      -- 'florida', 'georgia', 'texas', etc.

  -- QR position within the sticker (from drag-to-position in customizer)
  -- Coordinates are in the 1000×1000 SVG viewBox space
  qr_position_x    FLOAT NOT NULL DEFAULT 500,
  qr_position_y    FLOAT NOT NULL DEFAULT 500,
  qr_size          FLOAT NOT NULL DEFAULT 160,  -- QR size in viewBox units

  -- Colors (hex values from customizer)
  color_bg         VARCHAR(9) NOT NULL DEFAULT '#ffffff',   -- Background
  color_stroke     VARCHAR(9) DEFAULT '#000000',            -- State outline stroke
  color_fill       VARCHAR(9),                              -- State fill (null = no fill)
  color_qr         VARCHAR(9) NOT NULL DEFAULT '#000000',   -- QR code color
  color_halo       VARCHAR(9) NOT NULL DEFAULT '#000000',   -- Halo dots color

  -- Stroke & gradient settings
  stroke_weight    FLOAT DEFAULT 250,          -- Stroke weight percentage
  has_fill         BOOLEAN NOT NULL DEFAULT false,
  has_stroke       BOOLEAN NOT NULL DEFAULT true,
  gradient_enabled BOOLEAN NOT NULL DEFAULT false,
  gradient_color1  VARCHAR(9),
  gradient_color2  VARCHAR(9),
  gradient_angle   FLOAT DEFAULT 180,

  -- Generation output
  status           VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'generated', 'failed')),
  output_file_url  TEXT,                       -- Supabase Storage URL for generated print file
  output_format    VARCHAR(10) DEFAULT 'png',  -- 'png', 'svg', 'pdf'
  error_message    TEXT,                       -- If generation failed

  -- The URL encoded in the QR code
  qr_url           TEXT,                       -- e.g., 'https://qrstkr.com/i/abCD1234'
  short_code       VARCHAR(8),                 -- The allocated short_code

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_at     TIMESTAMPTZ
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_status ON order_items(status);

-- -----------------------------------------------------------------------------
-- 3. COUPONS TABLE
-- For testing and promotional use (bypass payment)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(50) NOT NULL UNIQUE,       -- e.g., 'TESTBETA2026', 'FRIEND50'

  -- Discount type
  discount_type    VARCHAR(20) NOT NULL DEFAULT 'full'
    CHECK (discount_type IN ('full', 'percent', 'fixed_cents')),
  discount_value   INTEGER DEFAULT 0,                 -- % for 'percent', cents for 'fixed_cents'

  -- Usage limits
  max_uses         INTEGER,                           -- null = unlimited
  current_uses     INTEGER NOT NULL DEFAULT 0,

  -- Validity
  is_active        BOOLEAN NOT NULL DEFAULT true,
  valid_from       TIMESTAMPTZ DEFAULT now(),
  valid_until      TIMESTAMPTZ,                       -- null = no expiry

  -- Metadata
  description      TEXT,                              -- Internal note about what this coupon is for
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_coupons_code ON coupons(code);

-- Insert some test coupons for development
INSERT INTO coupons (code, discount_type, description) VALUES
  ('TESTBETA', 'full', 'Development/testing — full bypass, unlimited uses'),
  ('BOSSDEMO', 'full', 'Boss demo coupon — full bypass, unlimited uses');

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

-- Enable RLS on all new tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- ORDERS: Users can see their own orders, admins can see all
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the server (service role) or admin should update order status
-- For now, allow users to cancel their own pending orders
CREATE POLICY "Users can cancel own pending orders"
  ON orders FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending_payment')
  WITH CHECK (status = 'cancelled');

-- ORDER ITEMS: Users can see items in their own orders
CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert order items for own orders"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  );

-- COUPONS: Anyone can read active coupons (to validate), only admin creates
CREATE POLICY "Anyone can read active coupons"
  ON coupons FOR SELECT
  USING (is_active = true);

-- -----------------------------------------------------------------------------
-- 5. HELPER FUNCTION: Validate and apply coupon
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_coupon(coupon_code TEXT)
RETURNS TABLE(
  valid BOOLEAN,
  coupon_id UUID,
  discount_type VARCHAR,
  discount_value INTEGER,
  reason TEXT
) AS $$
DECLARE
  c RECORD;
BEGIN
  SELECT * INTO c FROM coupons
    WHERE code = coupon_code AND is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::VARCHAR, NULL::INTEGER, 'Invalid coupon code'::TEXT;
    RETURN;
  END IF;

  IF c.valid_until IS NOT NULL AND c.valid_until < now() THEN
    RETURN QUERY SELECT false, c.id, c.discount_type, c.discount_value::INTEGER, 'Coupon has expired'::TEXT;
    RETURN;
  END IF;

  IF c.valid_from IS NOT NULL AND c.valid_from > now() THEN
    RETURN QUERY SELECT false, c.id, c.discount_type, c.discount_value::INTEGER, 'Coupon is not yet valid'::TEXT;
    RETURN;
  END IF;

  IF c.max_uses IS NOT NULL AND c.current_uses >= c.max_uses THEN
    RETURN QUERY SELECT false, c.id, c.discount_type, c.discount_value::INTEGER, 'Coupon usage limit reached'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, c.id, c.discount_type, c.discount_value::INTEGER, 'Valid'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to redeem a coupon (increment usage count)
CREATE OR REPLACE FUNCTION redeem_coupon(coupon_code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE coupons
    SET current_uses = current_uses + 1
    WHERE code = coupon_code
      AND is_active = true
      AND (max_uses IS NULL OR current_uses < max_uses)
      AND (valid_until IS NULL OR valid_until >= now())
      AND (valid_from IS NULL OR valid_from <= now());

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to allocate a short_code for a new sticker
CREATE OR REPLACE FUNCTION allocate_short_code()
RETURNS VARCHAR(8) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  new_code VARCHAR(8);
  attempts INTEGER := 0;
BEGIN
  LOOP
    new_code := '';
    FOR i IN 1..8 LOOP
      new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    -- Check it doesn't already exist in stickers table
    IF NOT EXISTS (SELECT 1 FROM stickers WHERE short_code = new_code) THEN
      RETURN new_code;
    END IF;

    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Failed to generate unique short_code after 100 attempts';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

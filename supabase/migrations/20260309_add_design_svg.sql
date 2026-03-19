-- Add design_svg column to order_items
-- Stores the full SVG of the customer's sticker design as rendered in the customizer.
-- This is the "what you see is what you get" capture — the admin downloads this SVG,
-- swaps the demo QR for the real one (with the customer's allocated short_code), and prints.

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS design_svg TEXT;

COMMENT ON COLUMN order_items.design_svg IS 'Full SVG markup of the customer sticker design, captured from the customizer at order time';

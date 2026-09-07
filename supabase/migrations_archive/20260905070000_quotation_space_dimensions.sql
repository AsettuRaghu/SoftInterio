-- Room dimensions on a quotation space.
--
-- quotation_components already carries width/height/depth, so a wardrobe's size
-- has somewhere to live. A room's did not - quotation_spaces held only a name
-- and a subtotal - so generating a quotation from the Spaces tab would have
-- dropped the measurement the seller took at the site.
--
-- Mirrors property_scope_items (length, width, height) rather than the
-- component shape, because a room is measured as a floor plan while a
-- component is measured as a face.

ALTER TABLE "public"."quotation_spaces"
  ADD COLUMN IF NOT EXISTS "length" numeric,
  ADD COLUMN IF NOT EXISTS "width" numeric,
  ADD COLUMN IF NOT EXISTS "height" numeric,
  ADD COLUMN IF NOT EXISTS "measurement_unit" text
    CHECK ("measurement_unit" IS NULL OR
           "measurement_unit" IN ('mm', 'cm', 'inch', 'ft', 'm'));

COMMENT ON COLUMN "public"."quotation_spaces"."measurement_unit" IS
  'Unit the length/width/height are expressed in. Copied from the property '
  'scope row this space was generated from; null when entered directly.';

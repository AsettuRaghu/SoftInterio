-- Components within a scope space.
--
-- A scope row is now either a space (Master Bedroom) or a component inside one
-- (Wardrobe, Walk-in Wardrobe, TV Unit). Two levels, matching the quotation's
-- own Space -> Component structure, so generating a quotation from scope is a
-- straight mapping rather than a flattening exercise.
--
-- A walk-in wardrobe is deliberately a component and not a nested space: it
-- has its own size, its own cost items and its own rate, which is everything
-- that is actually needed from it. Treating it as a space would add a nesting
-- level and force the seller to decide, mid-conversation, whether something is
-- a room or a piece of furniture.

ALTER TABLE "public"."property_scope_items"
  ADD COLUMN IF NOT EXISTS "component_type_id" uuid
    REFERENCES "public"."component_types"("id") ON DELETE SET NULL;

-- Quality tier is a sales conversation - "premium wardrobe in the master
-- bedroom" - and it moves the price materially, so it is captured where the
-- decision is made rather than rediscovered during pricing.
ALTER TABLE "public"."property_scope_items"
  ADD COLUMN IF NOT EXISTS "quality_tier" text
    CHECK ("quality_tier" IS NULL OR "quality_tier" IN
      ('budget', 'standard', 'premium', 'luxury'));

-- A row is one thing or the other, never both.
ALTER TABLE "public"."property_scope_items"
  DROP CONSTRAINT IF EXISTS "property_scope_items_space_xor_component";
ALTER TABLE "public"."property_scope_items"
  ADD CONSTRAINT "property_scope_items_space_xor_component"
  CHECK (NOT ("space_type_id" IS NOT NULL AND "component_type_id" IS NOT NULL));

-- A component has to live somewhere. Without this a component could sit at the
-- root of the property, which has no meaning and would break generation.
ALTER TABLE "public"."property_scope_items"
  DROP CONSTRAINT IF EXISTS "property_scope_items_component_needs_parent";
ALTER TABLE "public"."property_scope_items"
  ADD CONSTRAINT "property_scope_items_component_needs_parent"
  CHECK ("component_type_id" IS NULL OR "parent_id" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "idx_psi_component_type"
  ON "public"."property_scope_items" ("component_type_id");

COMMENT ON COLUMN "public"."property_scope_items"."component_type_id" IS
  'Set when this row is a component inside a space. Mutually exclusive with '
  'space_type_id; a component always has a parent.';

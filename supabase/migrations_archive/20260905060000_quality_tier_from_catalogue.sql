-- Let scope use whatever quality tiers the catalogue actually uses.
--
-- property_scope_items.quality_tier was constrained to budget / standard /
-- premium / luxury, which was a guess. quotation_cost_items - the thing the
-- tier has to line up with when a quotation is generated - actually carries
-- standard, premium, basic, classic, signature and complex. So "luxury"
-- matched nothing and "signature" could not be recorded at all.
--
-- The catalogue is the source of truth about what a business sells, so the
-- constraint is removed and the UI offers the tiers that exist in it. A fixed
-- list here would only guarantee the two drift again.

ALTER TABLE "public"."property_scope_items"
  DROP CONSTRAINT IF EXISTS "property_scope_items_quality_tier_check";

COMMENT ON COLUMN "public"."property_scope_items"."quality_tier" IS
  'Specification level for this component, matching quotation_cost_items.'
  'quality_tier. Deliberately unconstrained: the catalogue defines which tiers '
  'exist, and a hard-coded list here would drift from it.';

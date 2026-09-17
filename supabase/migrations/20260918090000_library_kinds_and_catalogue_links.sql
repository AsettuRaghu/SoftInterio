-- The Design Library grows from "pictures" to the visual side of what the
-- business knows: what a picture IS (its kind) and what it is ABOUT (links
-- into the catalogue and the plan).
--
-- Kinds now: our_work, drawing (a layout, 2D, 3D or detail we produced -
-- "this is what you will get"), material (what we build with and how the
-- grades differ - the educational one), product, process (how the business
-- works - a stage, a site visit, a handover), inspiration.
--
-- Links, each optional: space type (already), component type, cost item and
-- its category, quality tier, project (already), and the playbook stage a
-- process picture belongs to - by step_key, which survives revisions.

ALTER TABLE "public"."library_entries" DROP CONSTRAINT IF EXISTS "library_entries_kind_check";
ALTER TABLE "public"."library_entries"
  ADD CONSTRAINT "library_entries_kind_check"
  CHECK ("kind" IN ('our_work', 'drawing', 'material', 'product', 'process', 'inspiration'));

ALTER TABLE "public"."library_entries"
  ADD COLUMN IF NOT EXISTS "component_type_id" uuid REFERENCES "public"."component_types"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "cost_category_id"  uuid REFERENCES "public"."quotation_cost_item_categories"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "quality_tier"      text,
  ADD COLUMN IF NOT EXISTS "stage_key"         uuid;

-- cost_item_id existed without a constraint; it points at the catalogue.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'library_entries_cost_item_id_fkey') THEN
    ALTER TABLE "public"."library_entries"
      ADD CONSTRAINT "library_entries_cost_item_id_fkey" FOREIGN KEY ("cost_item_id")
      REFERENCES "public"."quotation_cost_items"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_library_entries_component" ON "public"."library_entries" ("component_type_id") WHERE "component_type_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_library_entries_cost_item" ON "public"."library_entries" ("cost_item_id") WHERE "cost_item_id" IS NOT NULL;

COMMENT ON COLUMN "public"."library_entries"."stage_key" IS 'For a process picture: the playbook stage it shows, by step_key so it survives revisions.';

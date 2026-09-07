-- Templates at a level other than the whole quotation.
--
-- Today a template is always a complete quotation - spaces, components and
-- line items - and applying one replaces whatever the builder already held.
-- That is useful once, at the start, and useless afterwards. The unit people
-- actually reuse is a component: "my standard 8ft sliding wardrobe" recurs on
-- every project, while a whole 3BHK rarely repeats exactly.
--
-- No new tables are needed. quotation_template_line_items already carries both
-- space_type_id and component_type_id on every row, so the hierarchy is
-- already denormalised - a component template is simply one with no
-- template_spaces and a single component_type_id across its lines. This column
-- records which of those shapes a template is, so the UI can offer the right
-- depth when creating and the right insertion point when applying.

ALTER TABLE "public"."quotation_templates"
  ADD COLUMN IF NOT EXISTS "level" text NOT NULL DEFAULT 'quotation'
    CHECK ("level" IN ('quotation', 'space', 'component', 'cost_items'));

COMMENT ON COLUMN "public"."quotation_templates"."level" IS
  'What this template is a template of. quotation = spaces + components + '
  'items (the original behaviour); space = one room and its contents; '
  'component = one component and its cost items; cost_items = a bundle of cost '
  'items with no component of its own.';

-- Existing templates are whole quotations, which the default already records.
CREATE INDEX IF NOT EXISTS "idx_quotation_templates_level"
  ON "public"."quotation_templates" ("tenant_id", "level");

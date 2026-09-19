-- Drawers and shelves are counts on the wardrobe rule again, and the kind
-- of drawer is a decision (2026-09-19, after the second walk-through):
--
--   Shelves: 5     -> Shelf prices itself from the count (the only item
--                     that follows `shelves`, so nothing to tap - "auto").
--   Drawers: 4     -> Drawer type is one decision, ① / ② among Wooden
--                     Drawer and Tandem Box, both priced per `drawers`:
--                     four of whichever is ①.
--
-- Pull-outs, trays, hampers stay counted extras - additions to the four,
-- not a kind of them. Applies to Wardrobe - Openable and Wardrobe With
-- Loft - Openable; the menus and the rule move together.

DO $$
DECLARE
  t record;
  v_ct uuid;
  v_tpl uuid;
BEGIN
FOR t IN SELECT DISTINCT tenant_id FROM public.component_types LOOP
  FOR v_ct, v_tpl IN
    SELECT ct.id, tpl.id FROM public.component_types ct
    LEFT JOIN public.quotation_templates tpl ON tpl.tenant_id = ct.tenant_id AND tpl.level = 'component' AND tpl.name = ct.name || ' - Options Menu'
    WHERE ct.tenant_id = t.tenant_id AND ct.slug IN ('wardrobe---openable', 'wardrobe-with-loft---openable')
  LOOP
    UPDATE public.component_types SET config_schema = jsonb_set(jsonb_set(config_schema,
      '{fields}', (SELECT COALESCE(jsonb_agg(f), '[]'::jsonb) FROM jsonb_array_elements(config_schema->'fields') f WHERE f->>'key' NOT IN ('shelves','drawers'))
                  || '[{"key":"shelves","label":"Shelves","kind":"count"},
                       {"key":"drawers","label":"Drawers","kind":"count","hint":"How many; pick the kind under Options"}]'::jsonb),
      '{quantities}', (SELECT COALESCE(jsonb_agg(q), '[]'::jsonb) FROM jsonb_array_elements(config_schema->'quantities') q WHERE q->>'key' NOT IN ('shelves','drawers'))
                  || '[{"key":"shelves","label":"Shelves","unit_code":"nos","formula":"shelves"},
                       {"key":"drawers","label":"Drawers","unit_code":"nos","formula":"drawers"}]'::jsonb)
    WHERE id = v_ct AND config_schema ? 'fields';

    IF v_tpl IS NULL THEN CONTINUE; END IF;
    UPDATE public.quotation_template_line_items li SET quantity_key = CASE ci.slug WHEN 'internal-shelf' THEN 'shelves' ELSE 'drawers' END
    FROM public.quotation_cost_items ci
    WHERE li.template_id = v_tpl AND li.cost_item_id = ci.id AND ci.slug IN ('internal-shelf', 'internal-wooden-drawer', 'internal-tandem-box');
  END LOOP;
END LOOP;
END $$;

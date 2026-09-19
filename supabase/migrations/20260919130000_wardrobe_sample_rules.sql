-- Two worked wardrobe samples to play the whole calculation on
-- (2026-09-19, asked for by the user): Wardrobe - Openable (no loft) and
-- Wardrobe With Loft - Openable. Each rule counts what the measurement
-- decides - shutter area, hinges by door height, handles, exposed sides -
-- and takes shelves and drawers as plain counts, so every line of a
-- wardrobe quotation is visible in the calculator's "Try it" box. Their
-- Options Menus are pruned to what the calculation prices: carcass,
-- shutter by finish, hinges, handles, shelf, drawers by type, exposed side,
-- installation. Accessories (mirror, glass, rods, lighting) are left off on
-- purpose; the graded Shutters and Drawer Systems ladders are left off too
-- so a menu never offers both ways of pricing the same thing.
--
-- Hinges follow door height: max(2, ceil(height / 2)) per door - 7 ft -> 4,
-- 10 ft -> 5, a 2 ft loft door -> 2. Change the 2 to match the hinge
-- maker's table. With a loft, wardrobe and loft hinges are computed apart
-- and summed into `hinges`; price a cheaper item per `loft_hinges` if the
-- loft takes a plain hinge.
--
-- Replaces the rule and menu lines on those two types for every tenant -
-- development data, agreed.

DO $$
DECLARE
  t record;
  v_ct uuid;
  v_tpl uuid;
  v_item uuid;
  line record;
  n int;
BEGIN
FOR t IN SELECT DISTINCT tenant_id FROM public.component_types LOOP

  ---------------------------------------------------------------- Wardrobe - Openable (no loft)
  SELECT id INTO v_ct FROM public.component_types WHERE tenant_id = t.tenant_id AND slug = 'wardrobe---openable';
  IF v_ct IS NOT NULL THEN
    UPDATE public.component_types SET config_schema = '{
      "fields": [
        {"key": "width",         "label": "Width",          "kind": "length"},
        {"key": "height",        "label": "Height",         "kind": "length", "hint": "Floor to top of the wardrobe"},
        {"key": "depth",         "label": "Depth",          "kind": "length", "hint": "Usually 2 ft"},
        {"key": "shutters",      "label": "Shutters",       "kind": "count"},
        {"key": "shelves",       "label": "Shelves",        "kind": "count"},
        {"key": "drawers",       "label": "Drawers",        "kind": "count",  "hint": "Plain drawers; pick tandem or trouser pull-outs as options"},
        {"key": "exposed_sides", "label": "Exposed sides",  "kind": "count",  "hint": "Ends visible from the room: 0, 1 or 2"}
      ],
      "quantities": [
        {"key": "shutter_sqft",      "label": "Front area (shutters and carcass)", "unit_code": "sqft", "formula": "width * height"},
        {"key": "hinges_per_door",   "label": "Hinges per door",                  "unit_code": "nos",  "formula": "max(2, ceil(height / 2))"},
        {"key": "hinges",            "label": "Hinges",                           "unit_code": "nos",  "formula": "shutters * hinges_per_door"},
        {"key": "handles",           "label": "Handles",                          "unit_code": "nos",  "formula": "shutters"},
        {"key": "shelves",           "label": "Shelves",                          "unit_code": "nos",  "formula": "shelves"},
        {"key": "drawers",           "label": "Drawers",                          "unit_code": "nos",  "formula": "drawers"},
        {"key": "exposed_side_sqft", "label": "Exposed side area",                "unit_code": "sqft", "formula": "exposed_sides * depth * height"}
      ]
    }'::jsonb WHERE id = v_ct;

    SELECT id INTO v_tpl FROM public.quotation_templates WHERE tenant_id = t.tenant_id AND level = 'component' AND name = 'Wardrobe - Openable - Options Menu';
    IF v_tpl IS NOT NULL THEN
      DELETE FROM public.quotation_template_line_items WHERE template_id = v_tpl;
      n := 0;
      FOR line IN SELECT * FROM (VALUES
        ('carcass-basic','shutter_sqft'), ('carcass-standard','shutter_sqft'), ('carcass-premium','shutter_sqft'), ('carcass-luxury','shutter_sqft'),
        ('shutter-membrane','shutter_sqft'), ('shutter-laminate','shutter_sqft'), ('shutter-acrylic','shutter_sqft'), ('shutter-pu','shutter_sqft'), ('shutter-veneer','shutter_sqft'),
        ('hinges-basic','hinges'), ('hinges-standard','hinges'), ('hinges-premium','hinges'), ('hinges-luxury','hinges'),
        ('handles-basic','handles'), ('handles-standard','handles'), ('handles-premium','handles'), ('handles-luxury','handles'),
        ('internal-shelf','shelves'),
        ('internal-wooden-drawer','drawers'), ('internal-tandem-box',NULL), ('internal-trouser-pullout',NULL),
        ('exposed-side-finish','exposed_side_sqft'),
        ('installation-labour-standard','shutter_sqft')
      ) AS v(slug, qkey) LOOP
        SELECT id INTO v_item FROM public.quotation_cost_items WHERE tenant_id = t.tenant_id AND slug = line.slug;
        IF v_item IS NULL THEN CONTINUE; END IF;
        n := n + 1;
        INSERT INTO public.quotation_template_line_items (template_id, component_type_id, cost_item_id, display_order, measurement_unit, quantity_key)
        VALUES (v_tpl, v_ct, v_item, n, 'ft', line.qkey);
      END LOOP;
    END IF;
  END IF;

  ---------------------------------------------------------------- Wardrobe With Loft - Openable
  SELECT id INTO v_ct FROM public.component_types WHERE tenant_id = t.tenant_id AND slug = 'wardrobe-with-loft---openable';
  IF v_ct IS NOT NULL THEN
    UPDATE public.component_types SET config_schema = '{
      "fields": [
        {"key": "width",         "label": "Width",           "kind": "length"},
        {"key": "height",        "label": "Wardrobe height", "kind": "length", "hint": "Floor to top of the wardrobe, without the loft"},
        {"key": "loft_height",   "label": "Loft height",     "kind": "length", "hint": "Top of the wardrobe to the ceiling"},
        {"key": "depth",         "label": "Depth",           "kind": "length", "hint": "Usually 2 ft"},
        {"key": "shutters",      "label": "Wardrobe shutters", "kind": "count"},
        {"key": "loft_shutters", "label": "Loft shutters",   "kind": "count",  "hint": "Often fewer, wider doors"},
        {"key": "shelves",       "label": "Shelves",         "kind": "count"},
        {"key": "drawers",       "label": "Drawers",         "kind": "count",  "hint": "Plain drawers; pick tandem or trouser pull-outs as options"},
        {"key": "exposed_sides", "label": "Exposed sides",   "kind": "count",  "hint": "Ends visible from the room: 0, 1 or 2"}
      ],
      "quantities": [
        {"key": "shutter_sqft",      "label": "Wardrobe front area",     "unit_code": "sqft", "formula": "width * height"},
        {"key": "loft_sqft",         "label": "Loft front area",         "unit_code": "sqft", "formula": "width * loft_height"},
        {"key": "total_sqft",        "label": "Total front area",        "unit_code": "sqft", "formula": "shutter_sqft + loft_sqft"},
        {"key": "wardrobe_hinges",   "label": "Wardrobe hinges",         "unit_code": "nos",  "formula": "shutters * max(2, ceil(height / 2))"},
        {"key": "loft_hinges",       "label": "Loft hinges",             "unit_code": "nos",  "formula": "loft_shutters * max(2, ceil(loft_height / 2))"},
        {"key": "hinges",            "label": "Hinges (all)",            "unit_code": "nos",  "formula": "wardrobe_hinges + loft_hinges"},
        {"key": "handles",           "label": "Handles",                 "unit_code": "nos",  "formula": "shutters + loft_shutters"},
        {"key": "shelves",           "label": "Shelves",                 "unit_code": "nos",  "formula": "shelves"},
        {"key": "drawers",           "label": "Drawers",                 "unit_code": "nos",  "formula": "drawers"},
        {"key": "exposed_side_sqft", "label": "Exposed side area",       "unit_code": "sqft", "formula": "exposed_sides * depth * (height + loft_height)"}
      ]
    }'::jsonb WHERE id = v_ct;

    SELECT id INTO v_tpl FROM public.quotation_templates WHERE tenant_id = t.tenant_id AND level = 'component' AND name = 'Wardrobe With Loft - Openable - Options Menu';
    IF v_tpl IS NOT NULL THEN
      DELETE FROM public.quotation_template_line_items WHERE template_id = v_tpl;
      n := 0;
      FOR line IN SELECT * FROM (VALUES
        ('carcass-basic','total_sqft'), ('carcass-standard','total_sqft'), ('carcass-premium','total_sqft'), ('carcass-luxury','total_sqft'),
        ('shutter-membrane','total_sqft'), ('shutter-laminate','total_sqft'), ('shutter-acrylic','total_sqft'), ('shutter-pu','total_sqft'), ('shutter-veneer','total_sqft'),
        ('hinges-basic','hinges'), ('hinges-standard','hinges'), ('hinges-premium','hinges'), ('hinges-luxury','hinges'),
        ('handles-basic','handles'), ('handles-standard','handles'), ('handles-premium','handles'), ('handles-luxury','handles'),
        ('internal-shelf','shelves'),
        ('internal-wooden-drawer','drawers'), ('internal-tandem-box',NULL), ('internal-trouser-pullout',NULL),
        ('exposed-side-finish','exposed_side_sqft'),
        ('installation-labour-standard','total_sqft')
      ) AS v(slug, qkey) LOOP
        SELECT id INTO v_item FROM public.quotation_cost_items WHERE tenant_id = t.tenant_id AND slug = line.slug;
        IF v_item IS NULL THEN CONTINUE; END IF;
        n := n + 1;
        INSERT INTO public.quotation_template_line_items (template_id, component_type_id, cost_item_id, display_order, measurement_unit, quantity_key)
        VALUES (v_tpl, v_ct, v_item, n, 'ft', line.qkey);
      END LOOP;
    END IF;
  END IF;

END LOOP;
END $$;

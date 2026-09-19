-- Exposed sides (2026-09-19). Where a kitchen run ends against nothing, or
-- a wardrobe's end faces the room, that side of the carcass is visible and
-- is finished to match the shutters - at a shutter-grade rate on a
-- carcass-sized panel. It is a classic forgotten line, so the seeded
-- Kitchen, Wardrobe and Loft costing rules now ask "how many sides are
-- exposed" and derive the area, and one cost item follows that quantity.
--
--   Wardrobe : exposed_side_sqft = exposed_sides * depth * (height + loft_height)
--   Loft     : exposed_side_sqft = exposed_sides * depth * loft_height
--   Kitchen  : exposed_side_sqft = exposed_sides * depth * base_height
--                                + wall_exposed_sides * (depth / 2) * wall_height
--              (wall units are taken as half the base depth; edit if not)
--
-- Only rules that do not already know `exposed_sides` are touched, so a
-- tenant who has written their own version keeps it. Idempotent.

DO $$
DECLARE
  t record;
  v_cat uuid;
  v_item uuid;
  ct record;
  v_tpl uuid;
  v_next int;
  v_fields jsonb;
  v_quantities jsonb;
  v_kind text;
BEGIN
FOR t IN SELECT DISTINCT tenant_id FROM public.component_types LOOP

  ---------------------------------------------------------------- the cost item
  SELECT id INTO v_cat FROM public.quotation_cost_item_categories WHERE tenant_id = t.tenant_id AND slug = 'shutter-finishes';
  IF v_cat IS NULL THEN CONTINUE; END IF;
  INSERT INTO public.quotation_cost_items (tenant_id, category_id, name, slug, unit_code, default_rate, quality_tier, description, is_active)
  VALUES (t.tenant_id, v_cat, 'Exposed Side Finish', 'exposed-side-finish', 'sqft', 900, NULL,
          'Starting rate - edit. A visible end of a run or wardrobe, finished to match the shutters. Priced per exposed side area from the costing rule.', true)
  ON CONFLICT (tenant_id, slug) DO NOTHING;
  SELECT id INTO v_item FROM public.quotation_cost_items WHERE tenant_id = t.tenant_id AND slug = 'exposed-side-finish';

  ---------------------------------------------------------------- the rules
  FOR ct IN
    SELECT id, slug, name, config_schema FROM public.component_types
    WHERE tenant_id = t.tenant_id
      AND config_schema IS NOT NULL AND config_schema ? 'fields'
      AND (slug ILIKE '%kitchen%' OR slug ILIKE '%wardrobe%' OR slug = 'loft')
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(config_schema->'fields') f WHERE f->>'key' = 'exposed_sides')
  LOOP
    v_kind := CASE WHEN ct.slug = 'loft' THEN 'loft' WHEN ct.slug ILIKE '%kitchen%' THEN 'kitchen' ELSE 'wardrobe' END;
    v_fields := ct.config_schema->'fields';
    v_quantities := COALESCE(ct.config_schema->'quantities', '[]'::jsonb);

    -- The rule has to carry the fields the formula names; skip a rule that
    -- has been reshaped away from the seeded keys rather than break it.
    IF v_kind = 'wardrobe' AND NOT (v_fields @> '[{"key":"height"}]' AND v_fields @> '[{"key":"loft_height"}]') THEN CONTINUE; END IF;
    IF v_kind = 'loft'     AND NOT (v_fields @> '[{"key":"loft_height"}]') THEN CONTINUE; END IF;
    IF v_kind = 'kitchen'  AND NOT (v_fields @> '[{"key":"base_height"}]' AND v_fields @> '[{"key":"wall_height"}]') THEN CONTINUE; END IF;

    IF NOT v_fields @> '[{"key":"depth"}]' THEN
      v_fields := v_fields || jsonb_build_array(jsonb_build_object(
        'key', 'depth', 'label', CASE WHEN v_kind = 'kitchen' THEN 'Base unit depth' ELSE 'Depth' END,
        'kind', 'length',
        'hint', CASE WHEN v_kind = 'kitchen' THEN 'Usually 2 ft; wall units taken as half' ELSE 'Usually 2 ft' END));
    END IF;
    v_fields := v_fields || jsonb_build_array(jsonb_build_object(
      'key', 'exposed_sides',
      'label', CASE WHEN v_kind = 'kitchen' THEN 'Exposed sides (base)' ELSE 'Exposed sides' END,
      'kind', 'count',
      'hint', CASE WHEN v_kind = 'kitchen' THEN 'Ends of the base run visible from the room' ELSE 'Ends visible from the room: 0, 1 or 2' END));
    IF v_kind = 'kitchen' THEN
      v_fields := v_fields || jsonb_build_array(jsonb_build_object(
        'key', 'wall_exposed_sides', 'label', 'Exposed sides (wall)', 'kind', 'count',
        'hint', 'Ends of the wall units visible from the room'));
    END IF;

    v_quantities := v_quantities || jsonb_build_array(jsonb_build_object(
      'key', 'exposed_side_sqft', 'label', 'Exposed side area', 'unit_code', 'sqft',
      'formula', CASE v_kind
        WHEN 'wardrobe' THEN 'exposed_sides * depth * (height + loft_height)'
        WHEN 'loft'     THEN 'exposed_sides * depth * loft_height'
        ELSE                 'exposed_sides * depth * base_height + wall_exposed_sides * (depth / 2) * wall_height'
      END));

    UPDATE public.component_types
    SET config_schema = jsonb_set(jsonb_set(config_schema, '{fields}', v_fields), '{quantities}', v_quantities)
    WHERE id = ct.id;

    ---------------------------------------------------------------- the menu line
    IF v_item IS NULL THEN CONTINUE; END IF;
    SELECT id INTO v_tpl FROM public.quotation_templates
      WHERE tenant_id = t.tenant_id AND level = 'component' AND name = ct.name || ' - Options Menu';
    IF v_tpl IS NULL THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.quotation_template_line_items WHERE template_id = v_tpl AND cost_item_id = v_item) THEN
      UPDATE public.quotation_template_line_items SET quantity_key = 'exposed_side_sqft'
      WHERE template_id = v_tpl AND cost_item_id = v_item AND quantity_key IS NULL;
      CONTINUE;
    END IF;
    SELECT COALESCE(MAX(display_order), 0) + 1 INTO v_next FROM public.quotation_template_line_items WHERE template_id = v_tpl;
    INSERT INTO public.quotation_template_line_items (template_id, component_type_id, cost_item_id, display_order, measurement_unit, quantity_key)
    VALUES (v_tpl, ct.id, v_item, v_next, 'ft', 'exposed_side_sqft');
  END LOOP;

END LOOP;
END $$;

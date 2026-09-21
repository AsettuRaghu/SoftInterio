-- Lighting, placed where the light goes (2026-09-21). "Is the customer
-- interested in lighting?" is answered by an item being picked or not - but
-- a light inside a wardrobe, under the wall units and in the ceiling are
-- three different items on three different components, and the seeded
-- Profile Lighting ladder was placed on none of them by location. One
-- untiered Lighting category, four items, each offered where it belongs:
--   Wardrobe Sensor Light   per piece, one per hanging section - wardrobes
--   Under-cabinet Light     per rft along the counter run - kitchen wall unit
--   Spot Light              per piece - false ceiling
--   Cove Light              per rft of ceiling edge - false ceiling
DO $$
DECLARE
  t record; v_cat uuid; v_item uuid; v_ct uuid; r record; n int;
BEGIN
FOR t IN SELECT DISTINCT tenant_id FROM public.component_types LOOP
  INSERT INTO public.quotation_cost_item_categories (tenant_id, name, slug, description, display_order, is_active, is_charge)
  VALUES (t.tenant_id, 'Lighting', 'lighting', 'Lights placed where they go: inside a wardrobe, under the wall units, in the ceiling.', 108, true, false)
  ON CONFLICT (tenant_id, slug) DO NOTHING;
  SELECT id INTO v_cat FROM public.quotation_cost_item_categories WHERE tenant_id = t.tenant_id AND slug = 'lighting';

  FOR r IN SELECT * FROM (VALUES
    ('light-wardrobe-sensor', 'Wardrobe Sensor Light', 'nos', 2200, 'Starting rate - edit. LED strip with door sensor, one per hanging section.'),
    ('light-under-cabinet',   'Under-cabinet Light',   'rft',  350, 'Starting rate - edit. LED profile under the wall units, along the counter run.'),
    ('light-spot',            'Spot Light',            'nos',  650, 'Starting rate - edit. Recessed spot in a false ceiling, fitted and wired.'),
    ('light-cove',            'Cove Light',            'rft',  220, 'Starting rate - edit. LED strip in the ceiling cove, per running foot.')
  ) AS i(slug, name, unit_code, rate, description) LOOP
    INSERT INTO public.quotation_cost_items (tenant_id, category_id, name, slug, unit_code, default_rate, quality_tier, description, is_active)
    VALUES (t.tenant_id, v_cat, r.name, r.slug, r.unit_code, r.rate, NULL, r.description, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
  END LOOP;

  -- Where each is offered. The under-cabinet light follows the kitchen
  -- rule's counter length where that rule exists.
  FOR r IN SELECT * FROM (VALUES
    ('wardrobe---openable',            'light-wardrobe-sensor', NULL),
    ('wardrobe-with-loft---openable',  'light-wardrobe-sensor', NULL),
    ('wardrobe---sliding',             'light-wardrobe-sensor', NULL),
    ('modular-wardrobe-with-loft---sliding', 'light-wardrobe-sensor', NULL),
    ('kitchen-wall-unit',              'light-under-cabinet',   'counter_rft'),
    ('false-ceiling',                  'light-spot',            NULL),
    ('false-ceiling',                  'light-cove',            NULL)
  ) AS m(comp_slug, item_slug, qkey) LOOP
    SELECT id INTO v_ct FROM public.component_types WHERE tenant_id = t.tenant_id AND slug = r.comp_slug;
    SELECT id INTO v_item FROM public.quotation_cost_items WHERE tenant_id = t.tenant_id AND slug = r.item_slug;
    IF v_ct IS NULL OR v_item IS NULL THEN CONTINUE; END IF;
    SELECT COALESCE(MAX(display_order), 0) + 1 INTO n FROM public.component_type_offers WHERE component_type_id = v_ct;
    INSERT INTO public.component_type_offers (tenant_id, component_type_id, cost_item_id, quantity_key, display_order)
    VALUES (t.tenant_id, v_ct, v_item,
            CASE WHEN r.qkey IS NOT NULL AND EXISTS (SELECT 1 FROM public.component_types ct WHERE ct.id = v_ct AND ct.config_schema->'quantities' @> jsonb_build_array(jsonb_build_object('key', r.qkey))) THEN r.qkey ELSE NULL END,
            n)
    ON CONFLICT (component_type_id, cost_item_id) DO NOTHING;
  END LOOP;
END LOOP;
END $$;

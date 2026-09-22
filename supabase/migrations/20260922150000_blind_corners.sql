-- Blind corners (2026-09-22, the user: "did we ever take the blind corners
-- into consideration?"). Only half: the run hint said "corners counted
-- once", and a single Corner Carousel sat under Accessories on the base
-- unit. A corner is where a kitchen's money goes - the corner solution is
-- often the dearest item in the run, and a wall run turns as often as a
-- base run.
--
--   corners            a count on the kitchen base and wall unit rules
--   corner solutions   Magic Corner, Blind Corner Pull-out, Corner Carousel
--                      (moved to Internals) - alternatives, one per corner
--   Corner Filler Panel  Accessories, per corner, automatic - a corner
--                      always needs one, and the count can be 0
DO $$
DECLARE t record; v_int uuid; v_acc uuid; v_ct uuid; v_item uuid; r record; n int;
BEGIN
FOR t IN SELECT DISTINCT tenant_id FROM public.component_types LOOP
  SELECT id INTO v_int FROM public.quotation_cost_item_categories WHERE tenant_id = t.tenant_id AND slug = 'internals';
  SELECT id INTO v_acc FROM public.quotation_cost_item_categories WHERE tenant_id = t.tenant_id AND slug = 'accessories';
  IF v_int IS NULL OR v_acc IS NULL THEN CONTINUE; END IF;

  -- The carousel belongs with the other corner solutions.
  UPDATE public.quotation_cost_items SET category_id = v_int, description = 'Starting rate - edit. Rotating shelves in a blind corner.'
  WHERE tenant_id = t.tenant_id AND slug = 'corner-carousel';

  FOR r IN SELECT * FROM (VALUES
    ('internal-magic-corner',      'Magic Corner',         18000, 'Starting rate - edit. Pull-out that swings the blind section out of the corner.'),
    ('internal-blind-corner-pullout','Blind Corner Pull-out', 16000, 'Starting rate - edit. Sliding basket set for a blind corner.'),
    ('internal-corner-drawer',     'Corner Drawer',         12000, 'Starting rate - edit. L-shaped drawer across the corner.')
  ) AS i(slug, name, rate, description) LOOP
    INSERT INTO public.quotation_cost_items (tenant_id, category_id, name, slug, unit_code, default_rate, quality_tier, description, is_active)
    VALUES (t.tenant_id, v_int, r.name, r.slug, 'nos', r.rate, NULL, r.description, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
  END LOOP;
  INSERT INTO public.quotation_cost_items (tenant_id, category_id, name, slug, unit_code, default_rate, quality_tier, description, is_active)
  VALUES (t.tenant_id, v_acc, 'Corner Filler Panel', 'corner-filler-panel', 'nos', 1200, NULL, 'Starting rate - edit. The strip that lets the two runs meet and the doors clear each other.', true)
  ON CONFLICT (tenant_id, slug) DO NOTHING;

  -- the count, and the quantity the corner items follow
  FOR r IN SELECT * FROM (VALUES
    ('kitchen-base-unit', 'Blind corners in this run - where two runs meet'),
    ('kitchen-wall-unit', 'Blind corners in this run - where two runs meet')
  ) AS k(slug, hint) LOOP
    SELECT id INTO v_ct FROM public.component_types WHERE tenant_id = t.tenant_id AND slug = r.slug;
    IF v_ct IS NULL THEN CONTINUE; END IF;
    UPDATE public.component_types SET config_schema = jsonb_set(jsonb_set(config_schema,
      '{fields}', (SELECT COALESCE(jsonb_agg(f), '[]'::jsonb) FROM jsonb_array_elements(config_schema->'fields') f WHERE f->>'key' <> 'corners')
                  || jsonb_build_array(jsonb_build_object('key','corners','label','Blind corners','kind','count','hint', r.hint))),
      '{quantities}', (SELECT COALESCE(jsonb_agg(q), '[]'::jsonb) FROM jsonb_array_elements(config_schema->'quantities') q WHERE q->>'key' <> 'corners')
                  || '[{"key":"corners","label":"Blind corners","unit_code":"nos","formula":"corners"}]'::jsonb)
    WHERE id = v_ct AND config_schema ? 'fields';

    SELECT COALESCE(MAX(display_order), 0) INTO n FROM public.component_type_offers WHERE component_type_id = v_ct;
    FOR v_item IN
      SELECT id FROM public.quotation_cost_items
      WHERE tenant_id = t.tenant_id AND slug IN ('internal-magic-corner','internal-blind-corner-pullout','internal-corner-drawer','corner-carousel','corner-filler-panel')
    LOOP
      n := n + 1;
      INSERT INTO public.component_type_offers (tenant_id, component_type_id, cost_item_id, quantity_key, auto, display_order)
      VALUES (t.tenant_id, v_ct, v_item, 'corners',
              (SELECT slug = 'corner-filler-panel' FROM public.quotation_cost_items WHERE id = v_item), n)
      ON CONFLICT (component_type_id, cost_item_id) DO UPDATE
        SET quantity_key = 'corners',
            auto = (SELECT slug = 'corner-filler-panel' FROM public.quotation_cost_items WHERE id = EXCLUDED.cost_item_id);
    END LOOP;
  END LOOP;
END LOOP;
END $$;

-- From the first walk through the wardrobe sample (2026-09-19):
--
-- 1. A component's options come from its Options Menu, not from every
--    template that happens to name the type. The room sheet was showing
--    "Drawer Systems - Standard" on a wardrobe whose menu had been pruned,
--    because two older component templates still listed it. A template
--    can now be flagged `is_options_menu`; the options route reads only
--    flagged templates for a type and falls back to every active template
--    when a type has none, so nothing goes blank.
--
-- 2. Shelves and drawers are counted options, not rule fields. Having a
--    "Shelves" blank in Measurements AND a "Shelf" option that had to be
--    ticked to be priced was two entries for one fact. A number decided
--    with the customer is a count on the option (× n); the rule keeps only
--    what the measurement decides: size, depth, shutters, exposed sides.
--
-- 3. The wardrobe menus carry the whole internals list - rods, trays,
--    hampers, pull-outs - each a counted option; six new items for what a
--    wardrobe is actually fitted with.

ALTER TABLE public.quotation_templates
  ADD COLUMN IF NOT EXISTS is_options_menu boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.quotation_templates.is_options_menu IS
  'This template is the list of options the Scope room sheet offers for its component type(s). A type with no flagged template falls back to every active template naming it.';
UPDATE public.quotation_templates SET is_options_menu = true WHERE name LIKE '% - Options Menu';

DO $$
DECLARE
  t record;
  v_cat uuid;
  v_ct uuid;
  v_tpl uuid;
  v_item uuid;
  item_row record;
  slug_row record;
  n int;
BEGIN
FOR t IN SELECT DISTINCT tenant_id FROM public.component_types LOOP

  ---------------------------------------------------------------- new internals
  SELECT id INTO v_cat FROM public.quotation_cost_item_categories WHERE tenant_id = t.tenant_id AND slug = 'internals';
  IF v_cat IS NOT NULL THEN
    FOR item_row IN SELECT * FROM (VALUES
      ('internal-jewellery-tray',   'Jewellery Tray',          'nos', 2400, 'Starting rate - edit. Felt-lined tray insert in a drawer.'),
      ('internal-pull-down-hanger', 'Pull-down Hanger',        'nos', 6500, 'Starting rate - edit. Hanging rod that pulls down from a high section.'),
      ('internal-saree-pullout',    'Saree Pull-out',          'nos', 5500, 'Starting rate - edit.'),
      ('internal-laundry-hamper',   'Laundry Hamper Pull-out', 'nos', 4800, 'Starting rate - edit.'),
      ('internal-shoe-rack-insert', 'Shoe Rack Insert',        'nos', 3200, 'Starting rate - edit. Sloped shoe shelves inside a wardrobe section.'),
      ('internal-ironing-board',    'Ironing Board Pull-out',  'nos', 7500, 'Starting rate - edit.')
    ) AS i(slug, name, unit_code, rate, description) LOOP
      INSERT INTO public.quotation_cost_items (tenant_id, category_id, name, slug, unit_code, default_rate, quality_tier, description, is_active)
      VALUES (t.tenant_id, v_cat, item_row.name, item_row.slug, item_row.unit_code, item_row.rate, NULL, item_row.description, true)
      ON CONFLICT (tenant_id, slug) DO NOTHING;
    END LOOP;
  END IF;

  ---------------------------------------------------------------- the two wardrobe rules and menus
  FOR v_ct, v_tpl IN
    SELECT ct.id, tpl.id FROM public.component_types ct
    LEFT JOIN public.quotation_templates tpl ON tpl.tenant_id = ct.tenant_id AND tpl.level = 'component' AND tpl.name = ct.name || ' - Options Menu'
    WHERE ct.tenant_id = t.tenant_id AND ct.slug IN ('wardrobe---openable', 'wardrobe-with-loft---openable')
  LOOP
    -- shelves and drawers out of the rule
    UPDATE public.component_types SET config_schema = jsonb_set(jsonb_set(config_schema,
      '{fields}',     (SELECT COALESCE(jsonb_agg(f), '[]'::jsonb) FROM jsonb_array_elements(config_schema->'fields') f WHERE f->>'key' NOT IN ('shelves','drawers'))),
      '{quantities}', (SELECT COALESCE(jsonb_agg(q), '[]'::jsonb) FROM jsonb_array_elements(config_schema->'quantities') q WHERE q->>'key' NOT IN ('shelves','drawers')))
    WHERE id = v_ct AND config_schema ? 'fields';

    IF v_tpl IS NULL THEN CONTINUE; END IF;
    -- Shelf and Wooden Drawer become counted options
    UPDATE public.quotation_template_line_items li SET quantity_key = NULL
    FROM public.quotation_cost_items ci
    WHERE li.template_id = v_tpl AND li.cost_item_id = ci.id AND ci.slug IN ('internal-shelf', 'internal-wooden-drawer');

    -- the rest of the internals onto the menu, counted
    SELECT COALESCE(MAX(display_order), 0) INTO n FROM public.quotation_template_line_items WHERE template_id = v_tpl;
    FOR slug_row IN SELECT * FROM (VALUES
      ('internal-hanging-rod'), ('internal-tie-belt-rack'), ('internal-wicker-basket'), ('internal-jewellery-tray'),
      ('internal-pull-down-hanger'), ('internal-saree-pullout'), ('internal-laundry-hamper'), ('internal-shoe-rack-insert'),
      ('internal-ironing-board'), ('internal-mirror')
    ) AS s(slug) LOOP
      SELECT id INTO v_item FROM public.quotation_cost_items WHERE tenant_id = t.tenant_id AND slug = slug_row.slug;
      IF v_item IS NULL OR EXISTS (SELECT 1 FROM public.quotation_template_line_items WHERE template_id = v_tpl AND cost_item_id = v_item) THEN CONTINUE; END IF;
      n := n + 1;
      INSERT INTO public.quotation_template_line_items (template_id, component_type_id, cost_item_id, display_order, measurement_unit, quantity_key)
      VALUES (v_tpl, v_ct, v_item, n, 'ft', NULL);
    END LOOP;
  END LOOP;

END LOOP;
END $$;

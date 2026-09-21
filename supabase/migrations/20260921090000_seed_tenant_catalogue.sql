-- A new tenant starts with a catalogue (2026-09-21).
--
-- Signup created the tenant, its settings and the owner - and nothing to
-- sell with: no space types, no component types, no cost items, no
-- presets, no offers. The first Scope tab and the first quotation were
-- blank, and the seed script only ever ran against tenants that already
-- had items. Found while reviewing the scope-to-quotation architecture,
-- before any second subscriber met it.
--
-- seed_tenant_catalogue(target, source) copies one tenant's catalogue into
-- another, remapping every id: space types, component types (with their
-- costing rules and applicable spaces), categories, cost items (rates as
-- starting values; vendor links and purchase history left behind), what
-- each component type offers, and the scope presets. It refuses to touch a
-- tenant that already has component types, so it is safe to call twice.
-- The source is the platform's starter catalogue - a tenant kept for that
-- purpose, named by STARTER_CATALOGUE_TENANT_ID at signup. Shipped rows
-- with tenant_id NULL (the roles / playbooks pattern) would be the fuller
-- answer; six tables' RLS and copy-on-edit is more than this needs today.

CREATE OR REPLACE FUNCTION public.seed_tenant_catalogue(p_target uuid, p_source uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  space_map jsonb := '{}'::jsonb;
  type_map  jsonb := '{}'::jsonb;
  cat_map   jsonb := '{}'::jsonb;
  item_map  jsonb := '{}'::jsonb;
  r record;
  new_id uuid;
  n_spaces int := 0; n_types int := 0; n_cats int := 0; n_items int := 0; n_offers int := 0; n_presets int := 0;
  mapped uuid[];
  u uuid;
  items jsonb;
  entry jsonb;
  cts jsonb;
  ct uuid;
BEGIN
  IF p_target IS NULL OR p_source IS NULL OR p_target = p_source THEN
    RETURN jsonb_build_object('seeded', false, 'reason', 'bad arguments');
  END IF;
  IF EXISTS (SELECT 1 FROM public.component_types WHERE tenant_id = p_target) THEN
    RETURN jsonb_build_object('seeded', false, 'reason', 'target already has a catalogue');
  END IF;

  FOR r IN SELECT * FROM public.space_types WHERE tenant_id = p_source AND is_active ORDER BY display_order LOOP
    INSERT INTO public.space_types (tenant_id, name, slug, description, icon, display_order, is_active, is_system, is_container)
    VALUES (p_target, r.name, r.slug, r.description, r.icon, r.display_order, true, r.is_system, r.is_container)
    RETURNING id INTO new_id;
    space_map := space_map || jsonb_build_object(r.id::text, new_id::text);
    n_spaces := n_spaces + 1;
  END LOOP;

  FOR r IN SELECT * FROM public.component_types WHERE tenant_id = p_source AND is_active ORDER BY display_order LOOP
    mapped := NULL;
    IF r.applicable_space_types IS NOT NULL THEN
      FOREACH u IN ARRAY r.applicable_space_types LOOP
        IF space_map ? u::text THEN mapped := array_append(mapped, (space_map->>u::text)::uuid); END IF;
      END LOOP;
    END IF;
    INSERT INTO public.component_types (tenant_id, name, slug, description, icon, default_width, default_height, default_depth, applicable_space_types, config_schema, display_order, is_active, is_system)
    VALUES (p_target, r.name, r.slug, r.description, r.icon, r.default_width, r.default_height, r.default_depth, mapped, r.config_schema, r.display_order, true, r.is_system)
    RETURNING id INTO new_id;
    type_map := type_map || jsonb_build_object(r.id::text, new_id::text);
    n_types := n_types + 1;
  END LOOP;

  FOR r IN SELECT * FROM public.quotation_cost_item_categories WHERE tenant_id = p_source AND is_active ORDER BY display_order LOOP
    INSERT INTO public.quotation_cost_item_categories (tenant_id, name, slug, description, icon, color, display_order, is_active, is_system, is_charge)
    VALUES (p_target, r.name, r.slug, r.description, r.icon, r.color, r.display_order, true, r.is_system, r.is_charge)
    RETURNING id INTO new_id;
    cat_map := cat_map || jsonb_build_object(r.id::text, new_id::text);
    n_cats := n_cats + 1;
  END LOOP;

  FOR r IN SELECT * FROM public.quotation_cost_items WHERE tenant_id = p_source AND is_active ORDER BY display_order, name LOOP
    IF NOT (cat_map ? r.category_id::text) THEN CONTINUE; END IF;
    INSERT INTO public.quotation_cost_items (tenant_id, category_id, name, slug, description, unit_code, default_rate, specifications, quality_tier, display_order, is_active, is_system, is_stockable, vendor_cost, company_cost, retail_price, margin_percent)
    VALUES (p_target, (cat_map->>r.category_id::text)::uuid, r.name, r.slug, r.description, r.unit_code, r.default_rate, r.specifications, r.quality_tier, r.display_order, true, r.is_system, r.is_stockable, r.vendor_cost, r.company_cost, r.retail_price, r.margin_percent)
    RETURNING id INTO new_id;
    item_map := item_map || jsonb_build_object(r.id::text, new_id::text);
    n_items := n_items + 1;
  END LOOP;

  FOR r IN SELECT o.* FROM public.component_type_offers o WHERE o.tenant_id = p_source ORDER BY o.display_order LOOP
    IF NOT (type_map ? r.component_type_id::text) OR NOT (item_map ? r.cost_item_id::text) THEN CONTINUE; END IF;
    INSERT INTO public.component_type_offers (tenant_id, component_type_id, cost_item_id, quantity_key, display_order)
    VALUES (p_target, (type_map->>r.component_type_id::text)::uuid, (item_map->>r.cost_item_id::text)::uuid, r.quantity_key, r.display_order)
    ON CONFLICT (component_type_id, cost_item_id) DO NOTHING;
    n_offers := n_offers + 1;
  END LOOP;

  FOR r IN SELECT * FROM public.scope_presets WHERE tenant_id = p_source AND is_active ORDER BY display_order LOOP
    items := '[]'::jsonb;
    FOR entry IN SELECT * FROM jsonb_array_elements(COALESCE(r.items, '[]'::jsonb)) LOOP
      IF NOT (space_map ? (entry->>'space_type_id')) THEN CONTINUE; END IF;
      cts := NULL;
      IF entry->'component_type_ids' IS NOT NULL AND jsonb_typeof(entry->'component_type_ids') = 'array' THEN
        cts := '[]'::jsonb;
        FOR ct IN SELECT (x #>> '{}')::uuid FROM jsonb_array_elements(entry->'component_type_ids') x LOOP
          IF type_map ? ct::text THEN cts := cts || to_jsonb(type_map->>ct::text); END IF;
        END LOOP;
      END IF;
      items := items || jsonb_build_array(jsonb_build_object(
        'space_type_id', space_map->>(entry->>'space_type_id'),
        'count', COALESCE(entry->'count', '1'::jsonb),
        'component_type_ids', cts));
    END LOOP;
    INSERT INTO public.scope_presets (tenant_id, name, description, items, display_order, is_active)
    VALUES (p_target, r.name, r.description, items, r.display_order, true);
    n_presets := n_presets + 1;
  END LOOP;

  RETURN jsonb_build_object('seeded', true, 'space_types', n_spaces, 'component_types', n_types, 'categories', n_cats, 'cost_items', n_items, 'offers', n_offers, 'presets', n_presets);
END $$;

REVOKE ALL ON FUNCTION public.seed_tenant_catalogue(uuid, uuid) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.seed_tenant_catalogue(uuid, uuid) IS
  'Copies the source tenant''s catalogue (space types, component types with rules, categories, cost items, offers, presets) into a tenant that has none. Service role only; called at signup with the starter catalogue tenant.';

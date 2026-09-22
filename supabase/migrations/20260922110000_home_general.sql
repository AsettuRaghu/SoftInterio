-- Home General, seeded properly (2026-09-22, the user: "look at the
-- components that come underneath it and then further to the level of
-- cost items and their categories").
--
-- Home General is the space for work that spans the whole home rather than
-- one room. It existed with nothing declaring it; the five unrestricted
-- components (Painting, Electrical Work, Civil & Plumbing Work, False
-- Ceiling, Wall Paneling) had no rules, so their sqft/rft items priced on a
-- "face" a whole-home job does not have, and Cove Light existed twice.
--
--   Painting               paintable area (sqft)      -> every paint item per it
--   Electrical Work        wiring run (rft)           -> wiring per it; points, boards counted
--   Civil & Plumbing Work  plumbing run, demolition   -> each per its own; core cutting counted
--   False Ceiling          ceiling area, cove length  -> gypsum per area; cove, cove light,
--                                                        profile lighting per length; spots counted
--   Wall Paneling          width × height             -> paneling per area; profile lighting per width
--   Site Services (new)    floor / wall protection    -> per their areas; delivery, cleanup fixed
--
-- The whole-home ones declare Home General (and False Ceiling also Full
-- Ceiling), so the add dialog offers them there first; they stay offered
-- everywhere, as before. Cove Light under Lighting is retired in favour of
-- the one under False Ceiling.

DO $$
DECLARE t record; v_home uuid; v_ceiling uuid; v_ct uuid; v_cat uuid; v_item uuid; r record; n int;
BEGIN
FOR t IN SELECT DISTINCT tenant_id FROM public.component_types LOOP
  SELECT id INTO v_home FROM public.space_types WHERE tenant_id = t.tenant_id AND slug = 'home-general';
  SELECT id INTO v_ceiling FROM public.space_types WHERE tenant_id = t.tenant_id AND slug = 'full-ceiling';
  IF v_home IS NOT NULL THEN
    UPDATE public.space_types SET description = 'Work that spans the whole home rather than one room: painting, electrical, civil, site services.' WHERE id = v_home;
  END IF;

  -- the duplicate cove light
  DELETE FROM public.quotation_cost_items WHERE tenant_id = t.tenant_id AND slug = 'light-cove';

  -- Site Services: the charges, as a component of the home
  INSERT INTO public.component_types (tenant_id, name, slug, description, applicable_space_types, display_order, is_active)
  SELECT t.tenant_id, 'Site Services', 'site-services', 'Delivery, site clean-up, floor and wall protection - the charges that go with the work.', CASE WHEN v_home IS NULL THEN NULL ELSE ARRAY[v_home] END, 400, true
  WHERE NOT EXISTS (SELECT 1 FROM public.component_types WHERE tenant_id = t.tenant_id AND slug = 'site-services');

  -- rules
  FOR r IN SELECT * FROM (VALUES
    ('painting', '{
      "fields": [{"key": "wall_sqft", "label": "Paintable area (sqft)", "kind": "number", "hint": "Walls and ceilings - roughly 3.5 × the carpet area"}],
      "quantities": [{"key": "paint_sqft", "label": "Paint area", "unit_code": "sqft", "formula": "wall_sqft"}]}'),
    ('electrical-work', '{
      "fields": [{"key": "wiring_run", "label": "Wiring run (ft)", "kind": "length", "hint": "New wiring only; points and boards are counted"}],
      "quantities": [{"key": "wiring_rft", "label": "Wiring length", "unit_code": "rft", "formula": "wiring_run"}]}'),
    ('civil-work', '{
      "fields": [
        {"key": "plumbing_run", "label": "Plumbing run (ft)", "kind": "length"},
        {"key": "demolition_area", "label": "Demolition area (sqft)", "kind": "number"}],
      "quantities": [
        {"key": "plumbing_rft", "label": "Plumbing length", "unit_code": "rft", "formula": "plumbing_run"},
        {"key": "demolition_sqft", "label": "Demolition area", "unit_code": "sqft", "formula": "demolition_area"}]}'),
    ('false-ceiling', '{
      "fields": [
        {"key": "area", "label": "Ceiling area (sqft)", "kind": "number", "hint": "The part being done, not the whole room if only a border"},
        {"key": "perimeter", "label": "Cove length (ft)", "kind": "length", "hint": "The run of the cove or the lit edge; 0 if none"}],
      "quantities": [
        {"key": "ceiling_sqft", "label": "Ceiling area", "unit_code": "sqft", "formula": "area"},
        {"key": "cove_rft", "label": "Cove length", "unit_code": "rft", "formula": "perimeter"}]}'),
    ('wall-paneling', '{
      "fields": [
        {"key": "width", "label": "Width", "kind": "length"},
        {"key": "height", "label": "Height", "kind": "length"}],
      "quantities": [
        {"key": "panel_sqft", "label": "Panel area", "unit_code": "sqft", "formula": "width * height"},
        {"key": "strip_rft", "label": "Strip length", "unit_code": "rft", "formula": "width"}]}'),
    ('site-services', '{
      "fields": [
        {"key": "floor_area", "label": "Floor to protect (sqft)", "kind": "number"},
        {"key": "wall_area", "label": "Walls to protect (sqft)", "kind": "number"}],
      "quantities": [
        {"key": "floor_sqft", "label": "Floor protection", "unit_code": "sqft", "formula": "floor_area"},
        {"key": "wall_sqft", "label": "Wall protection", "unit_code": "sqft", "formula": "wall_area"}]}')
  ) AS k(slug, schema) LOOP
    UPDATE public.component_types SET config_schema = r.schema::jsonb WHERE tenant_id = t.tenant_id AND slug = r.slug;
  END LOOP;

  -- Home General declared by the whole-home components (Full Ceiling too, for the ceiling)
  IF v_home IS NOT NULL THEN
    UPDATE public.component_types SET applicable_space_types = array_append(COALESCE(applicable_space_types, '{}'), v_home)
    WHERE tenant_id = t.tenant_id AND slug IN ('painting','electrical-work','civil-work','false-ceiling','curtains-blinds','site-services')
      AND NOT (v_home = ANY (COALESCE(applicable_space_types, '{}')));
  END IF;
  IF v_ceiling IS NOT NULL THEN
    UPDATE public.component_types SET applicable_space_types = array_append(COALESCE(applicable_space_types, '{}'), v_ceiling)
    WHERE tenant_id = t.tenant_id AND slug = 'false-ceiling' AND NOT (v_ceiling = ANY (COALESCE(applicable_space_types, '{}')));
  END IF;

  -- offers: site services get the charges; the rest are re-keyed
  SELECT id INTO v_ct FROM public.component_types WHERE tenant_id = t.tenant_id AND slug = 'site-services';
  IF v_ct IS NOT NULL THEN
    n := 0;
    FOR r IN SELECT * FROM (VALUES ('delivery-charges', NULL), ('site-cleanup-per-visit', NULL), ('floor-protector-heavy-duty', 'floor_sqft'), ('wall-protection-per-wall', 'wall_sqft')) AS s(slug, qkey) LOOP
      SELECT id INTO v_item FROM public.quotation_cost_items WHERE tenant_id = t.tenant_id AND slug = r.slug;
      IF v_item IS NULL THEN CONTINUE; END IF;
      n := n + 1;
      INSERT INTO public.component_type_offers (tenant_id, component_type_id, cost_item_id, quantity_key, display_order)
      VALUES (t.tenant_id, v_ct, v_item, r.qkey, n) ON CONFLICT (component_type_id, cost_item_id) DO NOTHING;
    END LOOP;
  END IF;

  FOR r IN SELECT * FROM (VALUES
    ('painting',        'painting',         'paint_sqft'),
    ('electrical-work', 'electrical',       'wiring_rft'),
    ('civil-work',      'civil-plumbing',   NULL),
    ('false-ceiling',   'false-ceiling',    NULL),
    ('false-ceiling',   'profile-lighting', 'cove_rft'),
    ('wall-paneling',   'wall-paneling',    'panel_sqft'),
    ('wall-paneling',   'profile-lighting', 'strip_rft')
  ) AS m(type_slug, cat_slug, qkey) LOOP
    SELECT id INTO v_ct FROM public.component_types WHERE tenant_id = t.tenant_id AND slug = r.type_slug;
    IF v_ct IS NULL THEN CONTINUE; END IF;
    UPDATE public.component_type_offers o SET quantity_key = CASE
        WHEN r.qkey IS NOT NULL THEN r.qkey
        WHEN ci.slug = 'civil-plumbing-line' THEN 'plumbing_rft'
        WHEN ci.slug = 'civil-demolition' THEN 'demolition_sqft'
        WHEN ci.slug = 'ceiling-gypsum' THEN 'ceiling_sqft'
        WHEN ci.slug IN ('ceiling-pop-cove', 'ceiling-cove-light') THEN 'cove_rft'
        ELSE o.quantity_key END
    FROM public.quotation_cost_items ci JOIN public.quotation_cost_item_categories cat ON cat.id = ci.category_id
    WHERE o.component_type_id = v_ct AND o.cost_item_id = ci.id AND cat.slug = r.cat_slug AND lower(ci.unit_code) IN ('sqft', 'rft');
  END LOOP;
END LOOP;
END $$;

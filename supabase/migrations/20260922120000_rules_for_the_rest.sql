-- A rule for every component type that had none (2026-09-22, the user:
-- "come up with some presets so that we have some logic and no empty
-- values"). Thirteen types priced everything on the component's face
-- because nothing said otherwise. Four shapes cover them:
--
--   cabinet   width × height, depth, shutters, exposed sides
--             -> front area, hinges by door height, handles, exposed side, strip length
--             pooja unit, shoe rack, TV unit, crockery unit, bar unit
--   shelving  the cabinet without doors            bookshelf
--   counter   the cabinet plus a counter length     utility unit, vanity, breakfast counter
--   table     width × height, depth, exposed sides -> front area, top area, strip length
--             study table, console table, dressing table
--   bed       width × length × headboard height     -> headboard area, storage base area
--
-- Offers are re-keyed by category where the rule has the quantity; a
-- per-piece item stays counted. Starting points, as every seeded rule is.

DO $$
DECLARE t record; v_ct uuid; r record;
  cabinet constant text := '{
    "fields": [
      {"key": "width",         "label": "Width",         "kind": "length"},
      {"key": "height",        "label": "Height",        "kind": "length"},
      {"key": "depth",         "label": "Depth",         "kind": "length", "hint": "Usually 450-600 mm"},
      {"key": "shutters",      "label": "Shutters",      "kind": "count",  "hint": "Doors; drawers are counted as options"},
      {"key": "exposed_sides", "label": "Exposed sides", "kind": "count",  "hint": "Sides visible from the room: 0, 1 or 2"}],
    "quantities": [
      {"key": "shutter_sqft",      "label": "Front area",        "unit_code": "sqft", "formula": "width * height"},
      {"key": "hinges",            "label": "Hinges",            "unit_code": "nos",  "formula": "shutters * max(2, ceil(height / 2))"},
      {"key": "handles",           "label": "Handles",           "unit_code": "nos",  "formula": "shutters"},
      {"key": "exposed_side_sqft", "label": "Exposed side area", "unit_code": "sqft", "formula": "exposed_sides * depth * height"},
      {"key": "strip_rft",         "label": "Strip length",      "unit_code": "rft",  "formula": "width"}]}';
  shelving constant text := '{
    "fields": [
      {"key": "width",         "label": "Width",         "kind": "length"},
      {"key": "height",        "label": "Height",        "kind": "length"},
      {"key": "depth",         "label": "Depth",         "kind": "length", "hint": "Usually 300-400 mm"},
      {"key": "exposed_sides", "label": "Exposed sides", "kind": "count",  "hint": "Sides visible from the room: 0, 1 or 2"}],
    "quantities": [
      {"key": "shutter_sqft",      "label": "Front area",        "unit_code": "sqft", "formula": "width * height"},
      {"key": "exposed_side_sqft", "label": "Exposed side area", "unit_code": "sqft", "formula": "exposed_sides * depth * height"},
      {"key": "strip_rft",         "label": "Strip length",      "unit_code": "rft",  "formula": "width"}]}';
  counter constant text := '{
    "fields": [
      {"key": "width",         "label": "Width",         "kind": "length", "hint": "Along the counter"},
      {"key": "height",        "label": "Height",        "kind": "length", "hint": "Floor to counter top, usually 850 mm"},
      {"key": "depth",         "label": "Depth",         "kind": "length", "hint": "Usually 500-600 mm"},
      {"key": "shutters",      "label": "Shutters",      "kind": "count",  "hint": "Doors; drawers are counted as options"},
      {"key": "exposed_sides", "label": "Exposed sides", "kind": "count",  "hint": "Ends visible from the room: 0, 1 or 2"}],
    "quantities": [
      {"key": "shutter_sqft",      "label": "Front area",        "unit_code": "sqft", "formula": "width * height"},
      {"key": "counter_rft",       "label": "Counter length",    "unit_code": "rft",  "formula": "width"},
      {"key": "hinges",            "label": "Hinges",            "unit_code": "nos",  "formula": "shutters * 2"},
      {"key": "handles",           "label": "Handles",           "unit_code": "nos",  "formula": "shutters"},
      {"key": "exposed_side_sqft", "label": "Exposed side area", "unit_code": "sqft", "formula": "exposed_sides * depth * height"}]}';
  tbl constant text := '{
    "fields": [
      {"key": "width",         "label": "Width",         "kind": "length"},
      {"key": "height",        "label": "Height",        "kind": "length", "hint": "Floor to the top, usually 750 mm"},
      {"key": "depth",         "label": "Depth",         "kind": "length", "hint": "Usually 450-600 mm"},
      {"key": "exposed_sides", "label": "Exposed sides", "kind": "count",  "hint": "Sides visible from the room"}],
    "quantities": [
      {"key": "shutter_sqft",      "label": "Front area",        "unit_code": "sqft", "formula": "width * height"},
      {"key": "top_sqft",          "label": "Top area",          "unit_code": "sqft", "formula": "width * depth"},
      {"key": "exposed_side_sqft", "label": "Exposed side area", "unit_code": "sqft", "formula": "exposed_sides * depth * height"},
      {"key": "strip_rft",         "label": "Strip length",      "unit_code": "rft",  "formula": "width"}]}';
  bed constant text := '{
    "fields": [
      {"key": "width",  "label": "Width",           "kind": "length", "hint": "Across the bed, usually 1500-1800 mm"},
      {"key": "length", "label": "Length",          "kind": "length", "hint": "Usually 1900-2000 mm"},
      {"key": "height", "label": "Headboard height", "kind": "length", "hint": "0 if no headboard"}],
    "quantities": [
      {"key": "headboard_sqft", "label": "Headboard area",    "unit_code": "sqft", "formula": "width * height"},
      {"key": "base_sqft",      "label": "Storage base area", "unit_code": "sqft", "formula": "width * length"}]}';
BEGIN
FOR t IN SELECT DISTINCT tenant_id FROM public.component_types LOOP
  FOR r IN SELECT * FROM (VALUES
    ('pooja-unit', cabinet), ('shoe-rack', cabinet), ('tv-unit', cabinet), ('crockery-unit', cabinet), ('bar-unit', cabinet),
    ('bookshelf', shelving),
    ('utility-unit', counter), ('vanity', counter), ('breakfast-counter', counter),
    ('study-table', tbl), ('console-table', tbl), ('dressing-table', tbl),
    ('bed', bed)
  ) AS k(slug, schema) LOOP
    SELECT id INTO v_ct FROM public.component_types WHERE tenant_id = t.tenant_id AND slug = r.slug
      AND (config_schema IS NULL OR NOT (config_schema ? 'fields') OR jsonb_array_length(config_schema->'fields') = 0);
    IF v_ct IS NULL THEN CONTINUE; END IF;
    UPDATE public.component_types SET config_schema = r.schema::jsonb WHERE id = v_ct;

    UPDATE public.component_type_offers o SET quantity_key = CASE
        WHEN r.slug = 'bed' AND cat.slug = 'carcass' THEN 'base_sqft'
        WHEN r.slug = 'bed' AND cat.slug IN ('shutter-finishes', 'shutters') THEN 'headboard_sqft'
        WHEN cat.slug IN ('carcass', 'shutters', 'shutter-finishes') THEN 'shutter_sqft'
        WHEN cat.slug = 'countertop' THEN 'counter_rft'
        WHEN cat.slug = 'hinges' THEN 'hinges'
        WHEN cat.slug = 'handles' AND lower(ci.unit_code) = 'nos' THEN 'handles'
        WHEN cat.slug = 'profile-lighting' THEN 'strip_rft'
        WHEN ci.slug = 'exposed-side-finish' THEN 'exposed_side_sqft'
        ELSE o.quantity_key END
    FROM public.quotation_cost_items ci JOIN public.quotation_cost_item_categories cat ON cat.id = ci.category_id
    WHERE o.component_type_id = v_ct AND o.cost_item_id = ci.id
      AND (lower(ci.unit_code) IN ('sqft', 'rft') OR cat.slug IN ('hinges', 'handles'));
    -- only quantities the rule actually has
    UPDATE public.component_type_offers o SET quantity_key = NULL
    WHERE o.component_type_id = v_ct AND o.quantity_key IS NOT NULL
      AND NOT (r.schema::jsonb->'quantities' @> jsonb_build_array(jsonb_build_object('key', o.quantity_key)));
  END LOOP;
END LOOP;
END $$;

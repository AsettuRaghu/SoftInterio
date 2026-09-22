-- The kitchen components are measured as themselves (2026-09-22).
--
-- The sample kitchen rule seeded on the 19th was a WHOLE-kitchen rule -
-- counter run, base height, wall height, tall units - applied to every
-- type whose name contained "kitchen". So a Base Unit asked for the wall
-- unit's height, and none of the four had a `width` or `height` field, so
-- the size typed on the Scope list had nothing to bind to and the room
-- sheet ignored it. The scope already lists a kitchen as separate
-- components, so each is measured as itself, like a wardrobe: width (its
-- run along the counter, corners once), height, depth, shutters, exposed
-- sides. What follows: front area (carcass, shutters), counter length
-- (countertop, profiles, dado, under-cabinet light), hinges, exposed side.
-- Replaces the rule on the five kitchen types and re-points their offers.

DO $$
DECLARE t record; v_ct uuid; r record;
BEGIN
FOR t IN SELECT DISTINCT tenant_id FROM public.component_types LOOP
  FOR r IN SELECT * FROM (VALUES
    ('kitchen-base-unit', '{
      "fields": [
        {"key": "width",         "label": "Run (width)",    "kind": "length", "hint": "Along the counter, corners counted once"},
        {"key": "height",        "label": "Height",         "kind": "length", "hint": "Floor to counter top, usually 850 mm"},
        {"key": "depth",         "label": "Depth",          "kind": "length", "hint": "Usually 600 mm"},
        {"key": "shutters",      "label": "Shutters",       "kind": "count",  "hint": "Doors; drawers are counted as options"},
        {"key": "exposed_sides", "label": "Exposed sides",  "kind": "count",  "hint": "Ends of the run visible from the room: 0, 1 or 2"}
      ],
      "quantities": [
        {"key": "shutter_sqft",      "label": "Front area",        "unit_code": "sqft", "formula": "width * height"},
        {"key": "counter_rft",       "label": "Counter length",    "unit_code": "rft",  "formula": "width"},
        {"key": "hinges",            "label": "Hinges",            "unit_code": "nos",  "formula": "shutters * 2"},
        {"key": "exposed_side_sqft", "label": "Exposed side area", "unit_code": "sqft", "formula": "exposed_sides * depth * height"}
      ]}'),
    ('kitchen-island', '{
      "fields": [
        {"key": "width",         "label": "Length",         "kind": "length"},
        {"key": "height",        "label": "Height",         "kind": "length", "hint": "Floor to counter top, usually 850 mm"},
        {"key": "depth",         "label": "Depth",          "kind": "length", "hint": "Usually 900 mm"},
        {"key": "shutters",      "label": "Shutters",       "kind": "count"},
        {"key": "exposed_sides", "label": "Exposed sides",  "kind": "count",  "hint": "An island is seen from all round - usually 2 or 3"}
      ],
      "quantities": [
        {"key": "shutter_sqft",      "label": "Front area",        "unit_code": "sqft", "formula": "width * height"},
        {"key": "counter_rft",       "label": "Counter length",    "unit_code": "rft",  "formula": "width"},
        {"key": "hinges",            "label": "Hinges",            "unit_code": "nos",  "formula": "shutters * 2"},
        {"key": "exposed_side_sqft", "label": "Exposed side area", "unit_code": "sqft", "formula": "exposed_sides * depth * height"}
      ]}'),
    ('kitchen-wall-unit', '{
      "fields": [
        {"key": "width",         "label": "Run (width)",    "kind": "length", "hint": "Along the wall, corners counted once"},
        {"key": "height",        "label": "Height",         "kind": "length", "hint": "Usually 750 mm"},
        {"key": "depth",         "label": "Depth",          "kind": "length", "hint": "Usually 300 mm"},
        {"key": "shutters",      "label": "Shutters",       "kind": "count"},
        {"key": "exposed_sides", "label": "Exposed sides",  "kind": "count",  "hint": "Ends visible from the room: 0, 1 or 2"}
      ],
      "quantities": [
        {"key": "shutter_sqft",      "label": "Front area",        "unit_code": "sqft", "formula": "width * height"},
        {"key": "counter_rft",       "label": "Run length",        "unit_code": "rft",  "formula": "width"},
        {"key": "hinges",            "label": "Hinges",            "unit_code": "nos",  "formula": "shutters * 2"},
        {"key": "exposed_side_sqft", "label": "Exposed side area", "unit_code": "sqft", "formula": "exposed_sides * depth * height"}
      ]}'),
    ('kitchen-tall-unit', '{
      "fields": [
        {"key": "width",         "label": "Width",          "kind": "length"},
        {"key": "height",        "label": "Height",         "kind": "length", "hint": "Floor to the top of the unit"},
        {"key": "depth",         "label": "Depth",          "kind": "length", "hint": "Usually 600 mm"},
        {"key": "shutters",      "label": "Shutters",       "kind": "count"},
        {"key": "exposed_sides", "label": "Exposed sides",  "kind": "count",  "hint": "Sides visible from the room: 0, 1 or 2"}
      ],
      "quantities": [
        {"key": "shutter_sqft",      "label": "Front area",        "unit_code": "sqft", "formula": "width * height"},
        {"key": "hinges",            "label": "Hinges",            "unit_code": "nos",  "formula": "shutters * max(2, ceil(height / 2))"},
        {"key": "exposed_side_sqft", "label": "Exposed side area", "unit_code": "sqft", "formula": "exposed_sides * depth * height"}
      ]}'),
    ('kitchen-loft-unit', '{
      "fields": [
        {"key": "width",    "label": "Run (width)", "kind": "length"},
        {"key": "height",   "label": "Height",      "kind": "length", "hint": "Top of the wall units to the ceiling"},
        {"key": "shutters", "label": "Shutters",    "kind": "count"}
      ],
      "quantities": [
        {"key": "shutter_sqft", "label": "Front area", "unit_code": "sqft", "formula": "width * height"},
        {"key": "hinges",       "label": "Hinges",     "unit_code": "nos",  "formula": "shutters * 2"}
      ]}')
  ) AS k(slug, schema) LOOP
    SELECT id INTO v_ct FROM public.component_types WHERE tenant_id = t.tenant_id AND slug = r.slug;
    IF v_ct IS NULL THEN CONTINUE; END IF;
    UPDATE public.component_types SET config_schema = r.schema::jsonb WHERE id = v_ct;
    -- Re-point the offers: old keys to the new, by category.
    UPDATE public.component_type_offers o SET quantity_key = CASE
        WHEN cat.slug IN ('carcass','shutters','shutter-finishes') THEN 'shutter_sqft'
        WHEN cat.slug IN ('profiles','countertop','dado-backsplash') AND r.schema::jsonb->'quantities' @> '[{"key":"counter_rft"}]' THEN 'counter_rft'
        WHEN cat.slug = 'lighting' AND ci.slug = 'light-under-cabinet' AND r.schema::jsonb->'quantities' @> '[{"key":"counter_rft"}]' THEN 'counter_rft'
        WHEN cat.slug = 'hinges' THEN 'hinges'
        WHEN ci.slug = 'exposed-side-finish' AND r.schema::jsonb->'quantities' @> '[{"key":"exposed_side_sqft"}]' THEN 'exposed_side_sqft'
        WHEN o.quantity_key IN ('base_sqft','wall_sqft','tall_units') THEN NULL
        ELSE o.quantity_key END
    FROM public.quotation_cost_items ci JOIN public.quotation_cost_item_categories cat ON cat.id = ci.category_id
    WHERE o.component_type_id = v_ct AND o.cost_item_id = ci.id AND lower(ci.unit_code) IN ('sqft','rft','nos');
    -- A quantity the new rule does not have cannot be followed.
    UPDATE public.component_type_offers o SET quantity_key = NULL
    WHERE o.component_type_id = v_ct AND o.quantity_key IS NOT NULL
      AND NOT (r.schema::jsonb->'quantities' @> jsonb_build_array(jsonb_build_object('key', o.quantity_key)));
    -- Hinges sit on the base unit's offer only where the kitchen carries them; an item per piece with a key is rule-priced, so only the hinge ladder takes `hinges`.
  END LOOP;
END LOOP;
END $$;

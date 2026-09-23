-- A Loft component's height IS its height (2026-09-23). The Loft type kept
-- the field name `loft_height` from when it was a section of a wardrobe, so
-- the height typed on the Scope list had nothing to bind to; and once every
-- loft_height defaulted to 0 - right for "a wardrobe with no loft" - a Loft
-- of its own priced at nothing. Its area is width × height like every other
-- component, and the loft height of a wardrobe stays 0 until stated.
UPDATE public.component_types SET config_schema = '{
  "fields": [
    {"key": "width",  "label": "Width",  "kind": "length"},
    {"key": "height", "label": "Height", "kind": "length", "hint": "Wall-unit or wardrobe top to the ceiling"},
    {"key": "depth",  "label": "Depth",  "kind": "length", "default": 600},
    {"key": "shutters", "label": "Shutters", "kind": "count", "default": "ceil(width / 2)", "hint": "Doors. Left blank we take one per two feet of width."},
    {"key": "exposed_sides", "label": "Exposed sides", "kind": "count", "default": 0, "hint": "Ends you can see from the room. A run between two walls is 0; one open end is 1."}
  ],
  "quantities": [
    {"key": "shutter_sqft", "label": "Front area", "unit_code": "sqft", "formula": "width * height"},
    {"key": "hinges", "label": "Hinges", "unit_code": "nos", "formula": "shutters * 2"},
    {"key": "exposed_side_sqft", "label": "Exposed side area", "unit_code": "sqft", "formula": "exposed_sides * depth * height"}
  ]}'::jsonb
WHERE slug = 'loft';

UPDATE public.component_type_offers o SET quantity_key = 'shutter_sqft'
FROM public.component_types ct
WHERE o.component_type_id = ct.id AND ct.slug = 'loft' AND o.quantity_key = 'loft_sqft';

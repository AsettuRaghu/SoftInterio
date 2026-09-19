-- Tenant-configured costing (2026-09-19). The platform holds no rule of its
-- own: how a component is measured and how each cost line follows from that
-- measurement are the tenant's words, kept in the catalogue.
--
--   component_types.config_schema           { fields: [...], quantities: [...] }
--                                           (the column existed, unused)
--   quotation_template_line_items.quantity_key  which quantity this line is
--                                           priced per; null = per piece /
--                                           per the component's one face, as
--                                           before
--   property_scope_items.measures           the component's field values,
--                                           typed on the Scope tab
--
-- Quotation components keep theirs in metadata.measures and lines keep
-- metadata.quantity_key, beside the provenance already there.

ALTER TABLE public.quotation_template_line_items
  ADD COLUMN IF NOT EXISTS quantity_key text;
ALTER TABLE public.property_scope_items
  ADD COLUMN IF NOT EXISTS measures jsonb;

COMMENT ON COLUMN public.component_types.config_schema IS
  'The tenant''s costing rule: { fields: [{key,label,kind}], quantities: [{key,label,unit_code,formula}] }. See src/lib/costing.';
COMMENT ON COLUMN public.quotation_template_line_items.quantity_key IS
  'Which of the component type''s quantities this line is priced per; null = as before (per piece or per the one face).';

-- A sample rule on any Kitchen and Wardrobe component type the tenant has,
-- so the first sight of the screen is not an empty one. Only where nothing
-- is configured yet; the tenant edits or replaces it.
UPDATE public.component_types SET config_schema = '{
  "fields": [
    {"key": "run_length", "label": "Counter run (total)", "kind": "length", "hint": "All runs added up, corners counted once"},
    {"key": "base_height", "label": "Base unit height", "kind": "length"},
    {"key": "wall_height", "label": "Wall unit height", "kind": "length", "hint": "0 if no wall units"},
    {"key": "tall_units", "label": "Tall units", "kind": "count"}
  ],
  "quantities": [
    {"key": "base_sqft", "label": "Base shutter area", "unit_code": "sqft", "formula": "run_length * base_height"},
    {"key": "wall_sqft", "label": "Wall shutter area", "unit_code": "sqft", "formula": "run_length * wall_height"},
    {"key": "shutter_sqft", "label": "Shutter area (all)", "unit_code": "sqft", "formula": "base_sqft + wall_sqft"},
    {"key": "counter_rft", "label": "Counter length", "unit_code": "rft", "formula": "run_length"},
    {"key": "tall_units", "label": "Tall units", "unit_code": "nos", "formula": "tall_units"}
  ]
}'::jsonb
WHERE (config_schema IS NULL OR config_schema = '{}'::jsonb) AND slug ILIKE '%kitchen%';

UPDATE public.component_types SET config_schema = '{
  "fields": [
    {"key": "width", "label": "Width", "kind": "length"},
    {"key": "height", "label": "Height", "kind": "length", "hint": "Without the loft"},
    {"key": "loft_height", "label": "Loft height", "kind": "length", "hint": "0 if no loft"},
    {"key": "shutters", "label": "Shutters", "kind": "count"}
  ],
  "quantities": [
    {"key": "shutter_sqft", "label": "Shutter area", "unit_code": "sqft", "formula": "width * height"},
    {"key": "loft_sqft", "label": "Loft area", "unit_code": "sqft", "formula": "width * loft_height"},
    {"key": "total_sqft", "label": "Total area", "unit_code": "sqft", "formula": "shutter_sqft + loft_sqft"},
    {"key": "hinges", "label": "Hinges", "unit_code": "nos", "formula": "shutters * 3"}
  ]
}'::jsonb
WHERE (config_schema IS NULL OR config_schema = '{}'::jsonb) AND slug ILIKE '%wardrobe%';

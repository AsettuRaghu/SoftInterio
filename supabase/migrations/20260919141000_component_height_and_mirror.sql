-- A component's size is width × height on the Scope list now (a wardrobe is
-- not length × width); rows typed before this carried the height in
-- `length`. Move it across once. And an internal mirror is a per-door
-- decision, not square feet of the whole wardrobe front - which is what a
-- sqft item with no rule quantity would have been priced on.
UPDATE public.property_scope_items
SET height = length, length = NULL
WHERE component_type_id IS NOT NULL AND cost_item_id IS NULL AND height IS NULL AND length IS NOT NULL;

UPDATE public.quotation_cost_items
SET unit_code = 'nos', default_rate = 2500, description = 'Starting rate - edit. Per door, fitted inside.'
WHERE slug = 'internal-mirror' AND unit_code = 'sqft';

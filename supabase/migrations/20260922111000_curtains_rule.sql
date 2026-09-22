-- Curtains & Blinds measured as width × height (2026-09-22), so the size on
-- the Scope list binds and blinds and wallpaper follow the area; stitching
-- stays counted per panel.
UPDATE public.component_types SET config_schema = '{
  "fields": [{"key": "width", "label": "Width", "kind": "length"}, {"key": "height", "label": "Height", "kind": "length"}],
  "quantities": [{"key": "area_sqft", "label": "Area", "unit_code": "sqft", "formula": "width * height"}]
}'::jsonb WHERE slug = 'curtains-blinds';
UPDATE public.component_type_offers o SET quantity_key = 'area_sqft'
FROM public.component_types ct, public.quotation_cost_items ci
WHERE o.component_type_id = ct.id AND ct.slug = 'curtains-blinds' AND o.cost_item_id = ci.id AND lower(ci.unit_code) = 'sqft';

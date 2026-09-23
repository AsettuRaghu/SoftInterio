-- Handles are a question on a kitchen too (2026-09-23). The kitchen rules
-- had no `handles` quantity, so the four handle grades showed as four
-- optional things to add rather than one "which handles?" - the wardrobe
-- asked properly and the kitchen did not.
UPDATE public.component_types
SET config_schema = jsonb_set(config_schema, '{quantities}',
  (config_schema->'quantities') || '[{"key":"handles","label":"Handles","unit_code":"nos","formula":"shutters"}]'::jsonb)
WHERE slug IN ('kitchen-base-unit','kitchen-wall-unit','kitchen-tall-unit','kitchen-loft-unit','kitchen-island','utility-unit','vanity','breakfast-counter')
  AND config_schema->'fields' @> '[{"key":"shutters"}]'
  AND NOT (config_schema->'quantities' @> '[{"key":"handles"}]');

UPDATE public.component_type_offers o SET quantity_key = 'handles'
FROM public.component_types ct, public.quotation_cost_items ci, public.quotation_cost_item_categories cat
WHERE o.component_type_id = ct.id AND o.cost_item_id = ci.id AND ci.category_id = cat.id
  AND cat.slug = 'handles' AND lower(ci.unit_code) = 'nos' AND o.quantity_key IS NULL
  AND ct.config_schema->'quantities' @> '[{"key":"handles"}]';

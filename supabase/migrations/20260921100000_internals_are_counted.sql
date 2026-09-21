-- Internals are accessories, counted - never a preference (2026-09-21,
-- the user, from the walk-through). The drawers blank comes off the
-- wardrobe rules and every drawer type is added and counted like a tray:
-- two wooden drawers, one tandem box, one trouser pull-out are three rows
-- with their own counts. Shelves keep their count in Measurements and
-- Shelf keeps pricing itself from it - that is automatic, not a choice.
UPDATE public.component_types
SET config_schema = jsonb_set(jsonb_set(config_schema,
  '{fields}',     (SELECT COALESCE(jsonb_agg(f), '[]'::jsonb) FROM jsonb_array_elements(config_schema->'fields') f WHERE f->>'key' <> 'drawers')),
  '{quantities}', (SELECT COALESCE(jsonb_agg(q), '[]'::jsonb) FROM jsonb_array_elements(config_schema->'quantities') q WHERE q->>'key' <> 'drawers'))
WHERE slug IN ('wardrobe---openable', 'wardrobe-with-loft---openable') AND config_schema ? 'fields';

UPDATE public.component_type_offers o SET quantity_key = NULL
FROM public.quotation_cost_items ci
WHERE o.cost_item_id = ci.id AND o.quantity_key = 'drawers';

-- A glass-profile shutter is a real wardrobe finish (2026-09-23, the user's
-- own example: two glass doors among four leather). Lacquered Glass was in
-- the catalogue but on no wardrobe's offer, so the two could not be
-- alternatives - and a split needs them in one group.
INSERT INTO public.component_type_offers (tenant_id, component_type_id, cost_item_id, quantity_key, display_order)
SELECT ct.tenant_id, ct.id, ci.id,
       (SELECT o.quantity_key FROM public.component_type_offers o
        JOIN public.quotation_cost_items c2 ON c2.id = o.cost_item_id
        WHERE o.component_type_id = ct.id AND c2.slug = 'shutter-veneer' LIMIT 1),
       (SELECT COALESCE(MAX(display_order), 0) + 1 FROM public.component_type_offers WHERE component_type_id = ct.id)
FROM public.component_types ct
JOIN public.quotation_cost_items ci ON ci.tenant_id = ct.tenant_id AND ci.slug = 'shutter-lacquered-glass'
WHERE ct.slug LIKE '%wardrobe%'
  AND EXISTS (SELECT 1 FROM public.component_type_offers o JOIN public.quotation_cost_items c2 ON c2.id = o.cost_item_id
              WHERE o.component_type_id = ct.id AND c2.slug = 'shutter-veneer')
ON CONFLICT (component_type_id, cost_item_id) DO NOTHING;

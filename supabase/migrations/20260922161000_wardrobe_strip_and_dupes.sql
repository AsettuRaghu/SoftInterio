-- Three leftovers from the same review (2026-09-22):
--
-- 1. A wardrobe rule had no length quantity, so its profile lighting and a
--    sliding track were priced on the whole front. `strip_rft = width`.
-- 2. "Shelf - per area" sat beside "Shelf" on the wardrobe menus - two ways
--    to price one thing, and the per-area one had nothing to follow, so it
--    priced on the front. Off the menus; it stays in the catalogue for a
--    business that prices shelves by board area.
-- 3. A component offering BOTH the graded Shutters ladder and Shutters by
--    Finish let a seller pick one of each, and the first real quotation
--    charged both - 90,820 for "Shutters - Premium" beside 93,000 for
--    "Shutter - Acrylic" on one wall unit. They are two ways of pricing the
--    same shutter but sit in different categories, so the one-of-these rule
--    cannot see them as alternatives. The finish set is what a customer
--    chooses, so the graded ladder comes off every menu that has finishes;
--    it stays in the catalogue, where Reprice still knows it.

UPDATE public.component_types
SET config_schema = jsonb_set(config_schema, '{quantities}',
  (config_schema->'quantities') || '[{"key":"strip_rft","label":"Strip length","unit_code":"rft","formula":"width"}]'::jsonb)
WHERE slug LIKE '%wardrobe%' AND config_schema ? 'quantities'
  AND NOT (config_schema->'quantities' @> '[{"key":"strip_rft"}]')
  AND config_schema->'fields' @> '[{"key":"width"}]';

UPDATE public.component_type_offers o SET quantity_key = 'strip_rft'
FROM public.component_types ct, public.quotation_cost_items ci, public.quotation_cost_item_categories cat
WHERE o.component_type_id = ct.id AND o.cost_item_id = ci.id AND ci.category_id = cat.id
  AND o.quantity_key IS NULL AND lower(ci.unit_code) = 'rft'
  AND cat.slug IN ('profile-lighting', 'sliding-systems')
  AND ct.config_schema->'quantities' @> '[{"key":"strip_rft"}]';

DELETE FROM public.component_type_offers o
USING public.quotation_cost_items ci
WHERE o.cost_item_id = ci.id AND ci.slug = 'internal-shelf-area'
  AND EXISTS (
    SELECT 1 FROM public.component_type_offers o2 JOIN public.quotation_cost_items ci2 ON ci2.id = o2.cost_item_id
    WHERE o2.component_type_id = o.component_type_id AND ci2.slug = 'internal-shelf');

DELETE FROM public.component_type_offers o
USING public.quotation_cost_items ci, public.quotation_cost_item_categories cat
WHERE o.cost_item_id = ci.id AND ci.category_id = cat.id AND cat.slug = 'shutters'
  AND EXISTS (
    SELECT 1 FROM public.component_type_offers o2
    JOIN public.quotation_cost_items ci2 ON ci2.id = o2.cost_item_id
    JOIN public.quotation_cost_item_categories cat2 ON cat2.id = ci2.category_id
    WHERE o2.component_type_id = o.component_type_id AND cat2.slug = 'shutter-finishes');

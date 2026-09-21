-- A hanging rod is counted, not measured (2026-09-21): "why does the rod
-- have no count?" - because it was per running foot, so the sheet priced
-- one rod across the wardrobe's width and offered a tick. Nobody buys 14.7
-- feet of rod; they fit one per hanging section. Per piece, like the other
-- internals. A business that prices rods by length puts a hanging_rft
-- quantity on its rule and prices the item per that.
UPDATE public.quotation_cost_items
SET unit_code = 'nos', default_rate = 1200, description = 'Starting rate - edit. Per rod, one per hanging section.'
WHERE slug = 'internal-hanging-rod' AND unit_code = 'rft';

-- "Automatic" is a choice on the offer, not a guess (2026-09-22).
--
-- The room sheet priced the only item following a rule quantity without a
-- tap. Right for Shelf (follows a count the seller types, 0 if none) and
-- Exposed Side Finish; wrong for Under-cabinet Light, which followed the
-- wall unit's width - never zero - so every wall unit was lit whether the
-- customer wanted it or not. Lighting is the customer's choice; the price
-- difference between with and without is the point of asking.
--
-- `component_type_offers.auto` says an item prices itself from the
-- measurement with nothing to tap. Set here only where the quantity comes
-- from something typed that can be 0 - never from the component's size.
ALTER TABLE public.component_type_offers ADD COLUMN IF NOT EXISTS auto boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.component_type_offers.auto IS
  'Prices itself from the measurement with nothing to tap (Shelf per shelves, Exposed Side per exposed sides). Only for a quantity that can be 0; an optional extra that follows the size is a tap.';

WITH sized AS (
  SELECT unnest(ARRAY['shutter_sqft','counter_rft','strip_rft','top_sqft','base_sqft','headboard_sqft','panel_sqft','area_sqft','hinges','handles','loft_sqft','total_sqft','wardrobe_hinges','loft_hinges']) AS k
), lone AS (
  SELECT o.id
  FROM public.component_type_offers o
  JOIN public.quotation_cost_items ci ON ci.id = o.cost_item_id
  WHERE o.quantity_key IS NOT NULL
    AND o.quantity_key NOT IN (SELECT k FROM sized)
    AND NOT EXISTS (
      SELECT 1 FROM public.component_type_offers o2 JOIN public.quotation_cost_items ci2 ON ci2.id = o2.cost_item_id
      WHERE o2.component_type_id = o.component_type_id AND o2.id <> o.id
        AND ci2.category_id = ci.category_id AND o2.quantity_key = o.quantity_key)
)
UPDATE public.component_type_offers SET auto = true WHERE id IN (SELECT id FROM lone);

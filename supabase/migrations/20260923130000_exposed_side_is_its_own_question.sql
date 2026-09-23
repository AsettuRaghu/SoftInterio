-- The exposed side finish is its own decision (2026-09-23). It lives in the
-- Shutters by Finish category, so the sweep that keyed that whole category
-- to the front area swept it up too - and on a kitchen it then appeared as
-- a seventh shutter finish to choose between. It follows the exposed side
-- area, and it is automatic: a visible end always needs finishing, and the
-- count is 0 until somebody says otherwise.
UPDATE public.component_type_offers o SET quantity_key = 'exposed_side_sqft', auto = true
FROM public.component_types ct, public.quotation_cost_items ci
WHERE o.component_type_id = ct.id AND o.cost_item_id = ci.id
  AND ci.slug = 'exposed-side-finish'
  AND ct.config_schema->'quantities' @> '[{"key":"exposed_side_sqft"}]';

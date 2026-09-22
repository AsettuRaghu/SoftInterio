-- A rate in one unit multiplied by a quantity in another (2026-09-22,
-- found auditing every offer's priced-per against the item's own unit).
--
--   countertop (sqft) × counter_rft   a granite top came out at ₹3,690 for
--                                     a 14.8 ft run that should be ~₹7,400
--   dado (sqft)       × counter_rft   the same, for the backsplash
--   cut-outs, end caps (nos) × rft    a per-piece charge multiplied by feet
--
-- So: a counter area (run × depth) and a dado area (run × its own height,
-- 600 mm by default - counter to the underside of the wall units), and the
-- per-piece items go back to being counted.
DO $$
DECLARE r record;
BEGIN
  -- counter_sqft on every type that has a counter run and a depth
  UPDATE public.component_types ct
  SET config_schema = jsonb_set(config_schema, '{quantities}',
    (config_schema->'quantities') || '[{"key":"counter_sqft","label":"Counter area","unit_code":"sqft","formula":"width * depth"}]'::jsonb)
  WHERE config_schema->'quantities' @> '[{"key":"counter_rft"}]'
    AND config_schema->'fields' @> '[{"key":"depth"}]'
    AND NOT (config_schema->'quantities' @> '[{"key":"counter_sqft"}]');

  -- the dado is its own height, and only the kitchen base unit has one
  UPDATE public.component_types ct
  SET config_schema = jsonb_set(jsonb_set(config_schema,
    '{fields}', (config_schema->'fields') || '[{"key":"dado_height","label":"Dado height","kind":"length","hint":"Counter to the underside of the wall units","default":600}]'::jsonb),
    '{quantities}', (config_schema->'quantities') || '[{"key":"dado_sqft","label":"Dado area","unit_code":"sqft","formula":"width * dado_height"}]'::jsonb)
  WHERE slug = 'kitchen-base-unit'
    AND NOT (config_schema->'quantities' @> '[{"key":"dado_sqft"}]');

  UPDATE public.component_type_offers o SET quantity_key = 'counter_sqft'
  FROM public.quotation_cost_items ci, public.quotation_cost_item_categories cat, public.component_types ct
  WHERE o.cost_item_id = ci.id AND ci.category_id = cat.id AND o.component_type_id = ct.id
    AND cat.slug = 'countertop' AND lower(ci.unit_code) = 'sqft' AND o.quantity_key = 'counter_rft'
    AND ct.config_schema->'quantities' @> '[{"key":"counter_sqft"}]';

  UPDATE public.component_type_offers o SET quantity_key = 'dado_sqft'
  FROM public.quotation_cost_items ci, public.quotation_cost_item_categories cat, public.component_types ct
  WHERE o.cost_item_id = ci.id AND ci.category_id = cat.id AND o.component_type_id = ct.id
    AND cat.slug = 'dado-backsplash' AND lower(ci.unit_code) = 'sqft'
    AND ct.config_schema->'quantities' @> '[{"key":"dado_sqft"}]';

  -- anything still priced per a quantity in the wrong unit goes back to counted
  FOR r IN
    SELECT o.id FROM public.component_type_offers o
    JOIN public.quotation_cost_items ci ON ci.id = o.cost_item_id
    JOIN public.component_types ct ON ct.id = o.component_type_id
    JOIN LATERAL jsonb_array_elements(ct.config_schema->'quantities') q ON q->>'key' = o.quantity_key
    WHERE o.quantity_key IS NOT NULL AND lower(ci.unit_code) <> lower(q->>'unit_code')
  LOOP
    UPDATE public.component_type_offers SET quantity_key = NULL, auto = false WHERE id = r.id;
  END LOOP;
END $$;

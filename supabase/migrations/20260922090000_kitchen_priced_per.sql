-- The kitchen offers follow the kitchen rule (2026-09-22). The wardrobe
-- offers were curated by hand on the 19th; the kitchen ones never were, so
-- every kitchen item priced "per face" (the component's width × height)
-- rather than per the rule's quantities - found when a third profile came
-- in and none of them followed the counter run. Only rows with no
-- priced-per are touched, and only where the type's rule has the quantity.
--
--   base unit / island : carcass, shutters, shutter finishes -> base_sqft
--                         profiles, countertop, dado           -> counter_rft
--   wall unit          : carcass, shutters, shutter finishes -> wall_sqft
--                         profiles                             -> counter_rft
--   tall unit / loft   : carcass, shutters, shutter finishes -> shutter_sqft
UPDATE public.component_type_offers o
SET quantity_key = m.qkey
FROM public.component_types ct, public.quotation_cost_items ci, public.quotation_cost_item_categories cat,
     (VALUES
       ('kitchen-base-unit', 'carcass',          'base_sqft'),
       ('kitchen-base-unit', 'shutters',         'base_sqft'),
       ('kitchen-base-unit', 'shutter-finishes', 'base_sqft'),
       ('kitchen-base-unit', 'profiles',         'counter_rft'),
       ('kitchen-base-unit', 'countertop',       'counter_rft'),
       ('kitchen-base-unit', 'dado-backsplash',  'counter_rft'),
       ('kitchen-island',    'carcass',          'base_sqft'),
       ('kitchen-island',    'shutters',         'base_sqft'),
       ('kitchen-island',    'shutter-finishes', 'base_sqft'),
       ('kitchen-island',    'profiles',         'counter_rft'),
       ('kitchen-island',    'countertop',       'counter_rft'),
       ('kitchen-wall-unit', 'carcass',          'wall_sqft'),
       ('kitchen-wall-unit', 'shutters',         'wall_sqft'),
       ('kitchen-wall-unit', 'shutter-finishes', 'wall_sqft'),
       ('kitchen-wall-unit', 'profiles',         'counter_rft'),
       ('kitchen-tall-unit', 'carcass',          'shutter_sqft'),
       ('kitchen-tall-unit', 'shutters',         'shutter_sqft'),
       ('kitchen-tall-unit', 'shutter-finishes', 'shutter_sqft'),
       ('kitchen-loft-unit', 'carcass',          'shutter_sqft'),
       ('kitchen-loft-unit', 'shutters',         'shutter_sqft'),
       ('kitchen-loft-unit', 'shutter-finishes', 'shutter_sqft')
     ) AS m(type_slug, cat_slug, qkey)
WHERE o.component_type_id = ct.id AND ct.slug = m.type_slug
  AND o.cost_item_id = ci.id AND ci.category_id = cat.id AND cat.slug = m.cat_slug
  AND lower(ci.unit_code) IN ('sqft', 'rft')
  AND o.quantity_key IS NULL
  AND ct.config_schema->'quantities' @> jsonb_build_array(jsonb_build_object('key', m.qkey));

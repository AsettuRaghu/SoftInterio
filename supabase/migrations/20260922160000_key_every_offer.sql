-- Every offer follows the rule, wherever the rule has the quantity
-- (2026-09-22, found reviewing the first real quotation: a sliding
-- wardrobe's carcass, a loft's shutters and the kitchen's profile
-- lighting were all priced on the component's face - width × height -
-- because their offers were never keyed. Only the types touched by the
-- 19th and 22nd's migrations had been).
--
-- Generic: per component type, the rule's area quantity (the first of
-- total_sqft, shutter_sqft, panel_sqft, area_sqft, ceiling_sqft,
-- paint_sqft, loft_sqft, base_sqft it has) and its length quantity
-- (counter_rft, strip_rft, cove_rft, wiring_rft, plumbing_rft), then:
--   carcass, shutters, shutter finishes, wall paneling -> area
--   profiles, profile lighting, countertop, dado       -> length
--   hinges -> hinges, handles -> handles
-- Glass & mirror is deliberately left unkeyed: a mirror is its own size,
-- not the component's front, and which is right differs by component.
WITH rule AS (
  SELECT ct.id,
         (SELECT k FROM unnest(ARRAY['total_sqft','shutter_sqft','panel_sqft','area_sqft','ceiling_sqft','paint_sqft','loft_sqft','base_sqft']) k
           WHERE ct.config_schema->'quantities' @> jsonb_build_array(jsonb_build_object('key', k)) LIMIT 1) AS area_key,
         (SELECT k FROM unnest(ARRAY['counter_rft','strip_rft','cove_rft','wiring_rft','plumbing_rft']) k
           WHERE ct.config_schema->'quantities' @> jsonb_build_array(jsonb_build_object('key', k)) LIMIT 1) AS len_key,
         ct.config_schema->'quantities' AS qs
  FROM public.component_types ct
  WHERE ct.config_schema ? 'quantities'
)
UPDATE public.component_type_offers o
SET quantity_key = CASE
      WHEN cat.slug IN ('carcass','shutters','shutter-finishes','wall-paneling') THEN r.area_key
      WHEN cat.slug IN ('profiles','profile-lighting','countertop','dado-backsplash') THEN r.len_key
      WHEN cat.slug = 'hinges' AND r.qs @> '[{"key":"hinges"}]' THEN 'hinges'
      WHEN cat.slug = 'handles' AND r.qs @> '[{"key":"handles"}]' THEN 'handles'
    END
FROM rule r, public.quotation_cost_items ci, public.quotation_cost_item_categories cat
WHERE o.component_type_id = r.id AND o.cost_item_id = ci.id AND ci.category_id = cat.id
  AND o.quantity_key IS NULL
  AND lower(ci.unit_code) IN ('sqft','rft','nos')
  AND CASE
        WHEN cat.slug IN ('carcass','shutters','shutter-finishes','wall-paneling') THEN r.area_key
        WHEN cat.slug IN ('profiles','profile-lighting','countertop','dado-backsplash') THEN r.len_key
        WHEN cat.slug = 'hinges' AND r.qs @> '[{"key":"hinges"}]' THEN 'hinges'
        WHEN cat.slug = 'handles' AND r.qs @> '[{"key":"handles"}]' THEN 'handles'
      END IS NOT NULL;

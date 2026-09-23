-- The database's grouping follows the decision too (2026-09-23). Handles
-- and profiles now answer one question - "how do the doors open?" - so a
-- profile chosen must demote a handle, and the one-①-per-decision trigger
-- has to see them as one group exactly as the room sheet does.
CREATE OR REPLACE FUNCTION public.scope_item_group_key(p_type uuid, p_item uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
           WHEN lower(ci.unit_code) IN ('nos','set','kg','ltr','pcs') AND o.quantity_key IS NULL THEN NULL
           WHEN cat.decision IS NOT NULL THEN 'd:' || cat.decision
           ELSE ci.category_id::text || ':' || coalesce(o.quantity_key, 'face')
         END
  FROM public.quotation_cost_items ci
  LEFT JOIN public.quotation_cost_item_categories cat ON cat.id = ci.category_id
  LEFT JOIN public.component_type_offers o ON o.component_type_id = p_type AND o.cost_item_id = ci.id
  WHERE ci.id = p_item;
$$;

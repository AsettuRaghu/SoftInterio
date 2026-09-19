-- One ① and one ② among alternatives, kept by the database (2026-09-19).
--
-- Within one category, cost items priced per the SAME quantity on a
-- component type (two carcass grades, both per front area; four hinge
-- grades, all per hinges) are ways of pricing one thing, so a component
-- carries at most one first and one second preference among them.
-- Choosing a new ① moves the old ① to ② (and drops the ② that was there);
-- a new ② replaces the old ②. Counted items (drawers, trays - per piece
-- and not quantified by the rule) are independent.
--
-- It lives in a trigger rather than the options route because two taps a
-- second apart are two concurrent requests, and a rule that reads then
-- writes from the application loses that race. The first attempt was in
-- the route and left two ①s standing on the first real wardrobe.

CREATE OR REPLACE FUNCTION public.scope_item_group_key(p_type uuid, p_item uuid, p_menu boolean)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- NULL for a counted item; otherwise "<category>:<quantity key or face>".
  SELECT CASE
           WHEN lower(ci.unit_code) IN ('nos','set','kg','ltr','pcs') AND k.quantity_key IS NULL THEN NULL
           ELSE ci.category_id::text || ':' || coalesce(k.quantity_key, 'face')
         END
  FROM public.quotation_cost_items ci
  LEFT JOIN LATERAL (
    SELECT li.quantity_key
    FROM public.quotation_template_line_items li
    JOIN public.quotation_templates t ON t.id = li.template_id
    WHERE li.component_type_id = p_type AND li.cost_item_id = ci.id
      AND t.is_active AND (NOT p_menu OR t.is_options_menu)
    ORDER BY li.quantity_key NULLS LAST
    LIMIT 1
  ) k ON true
  WHERE ci.id = p_item;
$$;

CREATE OR REPLACE FUNCTION public.scope_choice_alternatives()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type uuid;
  v_menu boolean;
  v_key text;
  v_old_p1 uuid;
  v_old_p2 uuid;
BEGIN
  IF NEW.cost_item_id IS NULL OR NEW.choice_status IS NULL THEN RETURN NEW; END IF;
  SELECT component_type_id INTO v_type FROM public.property_scope_items WHERE id = NEW.parent_id;
  IF v_type IS NULL THEN RETURN NEW; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.quotation_template_line_items li JOIN public.quotation_templates t ON t.id = li.template_id
    WHERE li.component_type_id = v_type AND t.is_active AND t.is_options_menu
  ) INTO v_menu;
  v_key := public.scope_item_group_key(v_type, NEW.cost_item_id, v_menu);
  IF v_key IS NULL THEN RETURN NEW; END IF;

  SELECT s.id INTO v_old_p1 FROM public.property_scope_items s
  WHERE s.parent_id = NEW.parent_id AND s.id <> NEW.id AND s.cost_item_id IS NOT NULL AND s.choice_status = 'p1'
    AND public.scope_item_group_key(v_type, s.cost_item_id, v_menu) = v_key
  LIMIT 1;
  SELECT s.id INTO v_old_p2 FROM public.property_scope_items s
  WHERE s.parent_id = NEW.parent_id AND s.id <> NEW.id AND s.cost_item_id IS NOT NULL AND s.choice_status = 'p2'
    AND public.scope_item_group_key(v_type, s.cost_item_id, v_menu) = v_key
  LIMIT 1;

  IF NEW.choice_status = 'p1' THEN
    IF v_old_p1 IS NOT NULL AND v_old_p2 IS NOT NULL THEN
      DELETE FROM public.property_scope_items WHERE id = v_old_p2;
    END IF;
    IF v_old_p1 IS NOT NULL THEN
      UPDATE public.property_scope_items SET choice_status = 'p2' WHERE id = v_old_p1;
    END IF;
  ELSIF v_old_p2 IS NOT NULL THEN
    DELETE FROM public.property_scope_items WHERE id = v_old_p2;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_scope_choice_alternatives ON public.property_scope_items;
CREATE TRIGGER trg_scope_choice_alternatives
  AFTER INSERT OR UPDATE OF choice_status ON public.property_scope_items
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0 AND NEW.cost_item_id IS NOT NULL AND NEW.choice_status IS NOT NULL)
  EXECUTE FUNCTION public.scope_choice_alternatives();

-- The rows the route's version left behind: every component with two ①s
-- in one group keeps the newest and demotes the rest to ② (dropping any ②
-- already there), so the data agrees with the rule before the first tap.
DO $$
DECLARE r record; keep uuid;
BEGIN
  FOR r IN
    SELECT s.parent_id, p.component_type_id AS type_id,
           public.scope_item_group_key(p.component_type_id, s.cost_item_id, true) AS gk,
           array_agg(s.id ORDER BY s.created_at DESC) AS ids
    FROM public.property_scope_items s JOIN public.property_scope_items p ON p.id = s.parent_id
    WHERE s.cost_item_id IS NOT NULL AND s.choice_status = 'p1'
    GROUP BY 1, 2, 3
    HAVING public.scope_item_group_key(p.component_type_id, s.cost_item_id, true) IS NOT NULL AND count(*) > 1
  LOOP
    keep := r.ids[1];
    DELETE FROM public.property_scope_items s
    WHERE s.parent_id = r.parent_id AND s.choice_status = 'p2' AND s.cost_item_id IS NOT NULL
      AND public.scope_item_group_key(r.type_id, s.cost_item_id, true) = r.gk;
    UPDATE public.property_scope_items SET choice_status = 'p2' WHERE id = r.ids[2];
    DELETE FROM public.property_scope_items WHERE id = ANY (r.ids[3:]);
  END LOOP;
END $$;

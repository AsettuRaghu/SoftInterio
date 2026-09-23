-- A decision can be split across the doors (2026-09-23, the user: "in a
-- wardrobe of 6 doors, 2 glass profile shutters and 4 leather").
--
-- One component, two finishes. The alternatives rule held one ① and one ②
-- per decision, so the sheet could not say it and the seller had to split
-- the wardrobe into two components the customer sees as one.
--
-- Now: a first preference may carry a SHARE (`choice_quantity` on an
-- exclusive row - the same column a counted item uses for "how many").
-- Two ① in one group with shares 2 and 4 mean two glass doors and four
-- leather, and the copy splits the quantity pro rata - 2/6 and 4/6 of the
-- front area. The rule that remains: **at most one ① without a share**.
-- Tapping an item is still "this is the choice" and still demotes the
-- previous one; giving an item a share is the deliberate act that says
-- "part of it", and only then can a second ① stand beside it.
CREATE OR REPLACE FUNCTION public.scope_choice_alternatives()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_type uuid;
  v_key text;
  v_old_p1 uuid;
  v_old_p2 uuid;
BEGIN
  IF NEW.cost_item_id IS NULL OR NEW.choice_status IS NULL THEN RETURN NEW; END IF;
  SELECT component_type_id INTO v_type FROM public.property_scope_items WHERE id = NEW.parent_id;
  IF v_type IS NULL THEN RETURN NEW; END IF;
  v_key := public.scope_item_group_key(v_type, NEW.cost_item_id);
  IF v_key IS NULL THEN RETURN NEW; END IF;

  -- A share says "part of this component", so it stands beside the others.
  IF NEW.choice_quantity IS NOT NULL AND NEW.choice_status = 'p1' THEN RETURN NEW; END IF;

  SELECT s.id INTO v_old_p1 FROM public.property_scope_items s
  WHERE s.parent_id = NEW.parent_id AND s.id <> NEW.id AND s.cost_item_id IS NOT NULL AND s.choice_status = 'p1'
    AND s.choice_quantity IS NULL
    AND public.scope_item_group_key(v_type, s.cost_item_id) = v_key
  LIMIT 1;
  SELECT s.id INTO v_old_p2 FROM public.property_scope_items s
  WHERE s.parent_id = NEW.parent_id AND s.id <> NEW.id AND s.cost_item_id IS NOT NULL AND s.choice_status = 'p2'
    AND public.scope_item_group_key(v_type, s.cost_item_id) = v_key
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
END $fn$;

DROP TRIGGER IF EXISTS trg_scope_choice_alternatives ON public.property_scope_items;
CREATE TRIGGER trg_scope_choice_alternatives
  AFTER INSERT OR UPDATE OF choice_status, choice_quantity ON public.property_scope_items
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0 AND NEW.cost_item_id IS NOT NULL AND NEW.choice_status IS NOT NULL)
  EXECUTE FUNCTION public.scope_choice_alternatives();

COMMENT ON COLUMN public.property_scope_items.choice_quantity IS
  'How many. On a counted item (a tray, a drawer) it is the count. On one of several alternatives it is a SHARE - how many of the component''s doors take this finish - and the quotation splits the quantity pro rata.';

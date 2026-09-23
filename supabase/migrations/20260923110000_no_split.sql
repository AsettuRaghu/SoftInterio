-- One first preference per decision, full stop (2026-09-23).
--
-- Splitting a decision across the doors - two glass, four leather - was
-- built the day before and taken out the day after: "the shutter split
-- concept is looking complex at the moment, let us keep it simple and make
-- the tenant adopt without that complexity". A rare case should not shape
-- the everyday screen. A component with two finishes is now two components,
-- or a line added in the builder.
--
-- `choice_quantity` keeps its other job: how many of a counted item.
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

  SELECT s.id INTO v_old_p1 FROM public.property_scope_items s
  WHERE s.parent_id = NEW.parent_id AND s.id <> NEW.id AND s.cost_item_id IS NOT NULL AND s.choice_status = 'p1'
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

-- Any share already recorded stops meaning anything on an exclusive row.
UPDATE public.property_scope_items s SET choice_quantity = NULL
WHERE s.cost_item_id IS NOT NULL AND s.choice_quantity IS NOT NULL
  AND public.scope_item_group_key((SELECT component_type_id FROM public.property_scope_items p WHERE p.id = s.parent_id), s.cost_item_id) IS NOT NULL;

COMMENT ON COLUMN public.property_scope_items.choice_quantity IS
  'How many, on a counted item (two wooden drawers, one tandem box). An item that is one of several alternatives carries none - there is one first preference per decision.';

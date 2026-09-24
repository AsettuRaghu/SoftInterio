-- One answer per question. The second preference is gone.
--
-- A chip with three states - tap for ①, tap again and it slides to ②, tap
-- again to clear - is a concept a seller has to be taught, and most of the
-- people this is for will never be taught anything. It bought one thing:
-- "Option 2", a second quotation priced from the alternatives. **Duplicate +
-- Reprice already does that**, on a document that exists, by whoever is
-- pricing - and Reprice swaps any item for any other in its category, not
-- only a tier, so it covers the by-kind cases too.
--
-- So the ② goes and the tap becomes what anyone would expect: choose, or
-- choose again, or clear. Decided 2026-09-24: "I want to build a tool that is
-- simple to understand and reduce as much confusion as possible ... most
-- users would be in the unorganised sector and they might hate the complexity".
--
-- What does NOT change, and is the reason this is safe: **one first
-- preference per question still holds**, by the same trigger. Only the
-- demotion goes - an answer that is replaced is now removed rather than kept
-- as an alternative.

CREATE OR REPLACE FUNCTION public.scope_choice_alternatives()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_type uuid;
  v_key text;
  v_old uuid;
BEGIN
  IF NEW.cost_item_id IS NULL OR NEW.choice_status IS NULL THEN RETURN NEW; END IF;
  SELECT component_type_id INTO v_type FROM public.property_scope_items WHERE id = NEW.parent_id;
  IF v_type IS NULL THEN RETURN NEW; END IF;
  v_key := public.scope_item_group_key(v_type, NEW.cost_item_id);
  IF v_key IS NULL THEN RETURN NEW; END IF;

  -- Whatever else answered this question makes way. It is deleted rather than
  -- demoted: there is no second place any more.
  DELETE FROM public.property_scope_items s
  WHERE s.parent_id = NEW.parent_id AND s.id <> NEW.id AND s.cost_item_id IS NOT NULL
    AND s.choice_status IS NOT NULL
    AND public.scope_item_group_key(v_type, s.cost_item_id) = v_key;

  RETURN NEW;
END $fn$;

COMMENT ON FUNCTION public.scope_choice_alternatives() IS
  'One answer per question: a new choice removes whatever else answered the same decision. The second preference was retired on 2026-09-24 - Duplicate + Reprice makes a second document.';

-- Every alternative on record becomes nothing. They were never priced on the
-- main quotation, so no document changes; the Option 2 already built keeps
-- every line it has, because a quotation is frozen once built.
DO $$
DECLARE v_rows integer;
BEGIN
  DELETE FROM public.property_scope_items WHERE choice_status = 'p2';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE 'Removed % second preference(s).', v_rows;
END $$;

ALTER TABLE public.property_scope_items
  DROP CONSTRAINT IF EXISTS property_scope_items_choice_status_check;
ALTER TABLE public.property_scope_items
  ADD CONSTRAINT property_scope_items_choice_status_check
  CHECK (choice_status IS NULL OR choice_status = 'p1');

COMMENT ON COLUMN public.property_scope_items.choice_status IS
  'p1 when this item is the answer to its question, null otherwise. There is no second preference.';

-- `quotations.scope_preference` is kept and pinned to p1: the one Option 2
-- ever built still names what it was, and dropping a column to erase that
-- would make a real document unexplainable.
ALTER TABLE public.quotations
  ALTER COLUMN scope_preference SET DEFAULT 'p1';
COMMENT ON COLUMN public.quotations.scope_preference IS
  'Historical. p2 marks a quotation built from the scope''s alternatives, before those were retired on 2026-09-24. Nothing sets p2 any more.';

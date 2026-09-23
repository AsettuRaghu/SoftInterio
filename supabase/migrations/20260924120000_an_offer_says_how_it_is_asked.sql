-- An offer says how it is asked, instead of it being deduced.
--
-- Whether the room sheet shows "Which hinges?" or "+ Tandem Box Drawer × 2"
-- was inferred from two other settings: a per-piece unit with no priced-per
-- became counted, anything else became a question. Nobody would guess that
-- the priced-per dropdown decides which of the two you get, and the inference
-- cannot express a per-piece FAMILY - four drawer grades, all `nos`, all
-- wanting to be one question - which is exactly how the Drawer Systems ladder
-- came out as four steppers and had to be retired.
--
--   ask_as = 'one_of'  several answers to one question
--            'count'   a thing you have some number of, with a × n
--            'auto'    prices itself from the measurement, nothing to decide
--
-- Backfilled from what the inference said, so nothing changes. The `auto`
-- boolean stays and is kept in step by the route: it predates this and other
-- code still reads it.

ALTER TABLE public.component_type_offers
  ADD COLUMN IF NOT EXISTS ask_as text;

ALTER TABLE public.component_type_offers
  DROP CONSTRAINT IF EXISTS component_type_offers_ask_as_check;
ALTER TABLE public.component_type_offers
  ADD CONSTRAINT component_type_offers_ask_as_check
  CHECK (ask_as IS NULL OR ask_as IN ('one_of', 'count', 'auto'));

COMMENT ON COLUMN public.component_type_offers.ask_as IS
  'How the room sheet asks for this on this component: one_of | count | auto. Null falls back to the old inference (per-piece with no quantity = count).';

UPDATE component_type_offers o
SET ask_as = CASE
      WHEN o.auto THEN 'auto'
      WHEN lower(ci.unit_code) IN ('nos', 'set', 'kg', 'ltr', 'pcs') AND o.quantity_key IS NULL THEN 'count'
      ELSE 'one_of'
    END
FROM quotation_cost_items ci
WHERE ci.id = o.cost_item_id AND o.ask_as IS NULL;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT ask_as, count(*) AS n FROM component_type_offers GROUP BY ask_as ORDER BY ask_as LOOP
    RAISE NOTICE '  % : % offer(s)', coalesce(r.ask_as, '(none)'), r.n;
  END LOOP;
END $$;

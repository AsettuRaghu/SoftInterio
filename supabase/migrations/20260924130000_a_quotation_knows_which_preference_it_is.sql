-- A quotation built from the alternatives is not a quotation that has drifted.
--
-- "Option 2" prices the scope's ② wherever there is one and the ① elsewhere.
-- `scopeDrift` compares every quotation against the FIRST preferences, so the
-- moment one was created it reported the maximum possible drift: on
-- LD-202609-005, 50 items "not in it yet" (the ①s it deliberately swapped
-- out) and 53 "no longer chosen" (the ②s it deliberately used), against a
-- scope holding 92 ①s and 53 ②s. Every number true, every number meaningless
-- - and a notice that cries wolf on a document that is exactly right is worse
-- than no notice, because it teaches people to dismiss the one that matters.
--
-- The quotation now says which preference it was built from, and drift
-- compares like with like.
--
-- Backfill: p1 for everything, then p2 for any quotation where at least a
-- quarter of its lines name a cost item that is currently a SECOND preference
-- on its scope. The separation is not close - the Option 2 here is 53 of 100
-- and every other quotation is 0 - and the column is set at creation from
-- here on, so this runs once over what already exists.

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS scope_preference text NOT NULL DEFAULT 'p1';

ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS quotations_scope_preference_check;
ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_scope_preference_check CHECK (scope_preference IN ('p1', 'p2'));

COMMENT ON COLUMN public.quotations.scope_preference IS
  'Which preference on the scope this was built from: p1 the answers, p2 the alternatives ("Option 2"). Drift compares against the matching one.';

DO $$
DECLARE r record; v_tagged integer := 0;
BEGIN
  FOR r IN
    SELECT q.id, q.quotation_number,
           count(*) FILTER (WHERE si.choice_status = 'p2') AS alt,
           count(*) AS lines
    FROM quotations q
    JOIN quotation_line_items li ON li.quotation_id = q.id
    LEFT JOIN leads l ON l.id = q.lead_id
    LEFT JOIN projects p ON p.id = q.project_id
    LEFT JOIN property_scope_items si
           ON si.property_id = coalesce(l.property_id, p.property_id)
          AND si.cost_item_id = li.quotation_cost_item_id
    WHERE q.scope_preference = 'p1'
    GROUP BY q.id, q.quotation_number
    HAVING count(*) > 0
       AND count(*) FILTER (WHERE si.choice_status = 'p2')::numeric / count(*) >= 0.25
  LOOP
    UPDATE quotations SET scope_preference = 'p2' WHERE id = r.id;
    v_tagged := v_tagged + 1;
    RAISE NOTICE '  % - % of % lines are alternatives, tagged p2', r.quotation_number, r.alt, r.lines;
  END LOOP;
  RAISE NOTICE 'Tagged % quotation(s) as built from the alternatives.', v_tagged;
END $$;

-- A size in a cost item's name is a measurement someone has to guess at.
--
-- "LED Light Strip - 3ft" (nos, 900) and "LED Light Strip - 6ft" (nos, 1500)
-- are the same product sold twice, and they do not agree with each other:
-- 900/3 = 300 a foot against 1500/6 = 250 a foot, so the price per foot
-- depends on which row the seller taps, and a 7ft run has no honest answer
-- at all - 6 + 3 bills a foot of waste.
--
-- The length is not a decision. The Kitchen Base Unit's rule already derives
-- counter_rft from the run the seller measures, and the catalogue already
-- prices lighting that way four rows away: Profile Lighting basic/standard/
-- premium/luxury, all rft at 150/220/320/450, plus Under-cabinet Light at
-- rft 350. Both sets sat on the base unit's offers at once, which is the
-- "a menu carries one or the other, never both" rule broken in the open -
-- that component offered six ways to buy one strip of light.
--
-- The test for a name: is the difference a number the measurement already
-- knows, or a decision the customer makes? Length, area and count are
-- measured - they belong in the unit and the rule, never in the name.
-- "Organizer Basket - Large / Small" and "Hob - 4 burner" are decisions and
-- stay as they are.
--
-- Deactivated rather than deleted, and only where nothing has used them.

DO $$
DECLARE
  v_used integer;
  v_offers integer;
  v_items integer;
BEGIN
  SELECT count(*) INTO v_used
  FROM quotation_line_items li
  JOIN quotation_cost_items ci ON ci.id = li.quotation_cost_item_id
  WHERE ci.slug IN ('led-light-strip-3ft', 'led-light-strip-6ft');

  SELECT count(*) INTO v_items
  FROM property_scope_items si
  JOIN quotation_cost_items ci ON ci.id = si.cost_item_id
  WHERE ci.slug IN ('led-light-strip-3ft', 'led-light-strip-6ft');

  IF v_used > 0 OR v_items > 0 THEN
    RAISE EXCEPTION 'Refusing: % quotation line(s) and % scope row(s) still use the fixed-length LED strips. Reprice them onto Profile Lighting first.', v_used, v_items;
  END IF;

  DELETE FROM component_type_offers o
  USING quotation_cost_items ci
  WHERE ci.id = o.cost_item_id
    AND ci.slug IN ('led-light-strip-3ft', 'led-light-strip-6ft');
  GET DIAGNOSTICS v_offers = ROW_COUNT;

  UPDATE quotation_cost_items
  SET is_active = false,
      description = coalesce(description || ' ', '')
        || 'Retired 2026-09-23: length belongs in the measurement, not the name. Use Profile Lighting (per rft).',
      updated_at = now()
  WHERE slug IN ('led-light-strip-3ft', 'led-light-strip-6ft')
    AND is_active;

  RAISE NOTICE 'Retired the fixed-length LED strips; removed % offer row(s).', v_offers;
END $$;

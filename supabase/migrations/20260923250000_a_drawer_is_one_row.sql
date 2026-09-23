-- "Tandem Box Drawer × 3" already says the type and the number.
--
-- Yesterday's reading - a graded Drawer Systems ladder for the quality, a
-- `drawers` count on the rule for the number - was the same sentence said a
-- second way, and the user saw it at once: "how is that different from the
-- answer we give for how many?". It is not. A counted internal named by its
-- kind carries both facts in one row, one line and one price.
--
-- So the ladder goes off every room sheet and the by-type drawers come back.
-- This settles a duplicate that has now been approached from both ends: on
-- 2026-09-22 the graded ladder sat beside the by-type drawers and was left
-- alone as "arguably two real axes"; it is one axis, and this is the half to
-- keep - the half a seller can point at while the customer is looking.
--
-- Deactivated, not deleted: 26 quotation lines name Drawer Systems - Standard
-- and 92 name Premium, and the printed Material column reads an item's live
-- description.
--
-- `handles` had been derived from that count on four types. A sliding
-- wardrobe's handles follow its shutters, which is what they always meant;
-- the three tables have nothing to derive from and go back to being counted,
-- as they were before.

DO $$
DECLARE
  v_off integer; v_back integer; v_fields integer := 0; r record;
BEGIN
  -- 1. The ladder leaves every menu, and retires.
  DELETE FROM component_type_offers o
  USING quotation_cost_items ci
  WHERE ci.id = o.cost_item_id AND ci.slug LIKE 'drawer-systems-%';
  GET DIAGNOSTICS v_off = ROW_COUNT;

  UPDATE quotation_cost_items
  SET is_active = false,
      description = coalesce(description || ' ', '')
        || 'Retired 2026-09-23: a drawer is one counted row in Internals, named by its kind - the grade and the number in one place.',
      updated_at = now()
  WHERE slug LIKE 'drawer-systems-%' AND is_active;

  -- 2. The by-type drawers return wherever they were taken from - every type
  --    that carried the ladder and can hold a drawer.
  INSERT INTO component_type_offers (tenant_id, component_type_id, cost_item_id, quantity_key, auto, display_order)
  SELECT DISTINCT ct.tenant_id, ct.id, ci.id, NULL, false, 55
  FROM component_types ct
  JOIN quotation_cost_items ci ON ci.tenant_id = ct.tenant_id AND ci.slug IN ('internal-wooden-drawer', 'internal-tandem-box') AND ci.is_active
  WHERE ct.config_schema->'fields' @> '[{"key":"drawers"}]'
    AND NOT EXISTS (SELECT 1 FROM component_type_offers e WHERE e.component_type_id = ct.id AND e.cost_item_id = ci.id);
  GET DIAGNOSTICS v_back = ROW_COUNT;

  -- 3. A sliding wardrobe's handles follow its doors; the tables go back to
  --    counted. Done before the field is dropped, so the formula is valid.
  UPDATE component_types ct
  SET config_schema = jsonb_set(config_schema, '{quantities}', (
        SELECT jsonb_agg(CASE WHEN q->>'key' = 'handles' THEN jsonb_set(q, '{formula}', '"shutters"') ELSE q END)
        FROM jsonb_array_elements(config_schema->'quantities') q))
  WHERE ct.config_schema->'quantities' @> '[{"key":"handles","formula":"drawers"}]'
    AND ct.config_schema->'fields' @> '[{"key":"shutters"}]';

  UPDATE component_type_offers o SET quantity_key = NULL
  FROM component_types ct
  WHERE ct.id = o.component_type_id AND o.quantity_key = 'handles'
    AND ct.config_schema->'quantities' @> '[{"key":"handles","formula":"drawers"}]';

  UPDATE component_types ct
  SET config_schema = jsonb_set(config_schema, '{quantities}', coalesce((
        SELECT jsonb_agg(q) FROM jsonb_array_elements(config_schema->'quantities') q
        WHERE NOT (q->>'key' = 'handles' AND q->>'formula' = 'drawers')), '[]'::jsonb))
  WHERE ct.config_schema->'quantities' @> '[{"key":"handles","formula":"drawers"}]';

  -- 4. The count itself goes. Nothing is priced per it any more.
  FOR r IN SELECT id FROM component_types WHERE config_schema->'fields' @> '[{"key":"drawers"}]' LOOP
    UPDATE component_types
    SET config_schema = jsonb_set(
          jsonb_set(config_schema, '{fields}', coalesce((
            SELECT jsonb_agg(f) FROM jsonb_array_elements(config_schema->'fields') f WHERE f->>'key' <> 'drawers'), '[]'::jsonb)),
          '{quantities}', coalesce((
            SELECT jsonb_agg(q) FROM jsonb_array_elements(config_schema->'quantities') q WHERE q->>'key' <> 'drawers'), '[]'::jsonb)),
        updated_at = now()
    WHERE id = r.id;
    v_fields := v_fields + 1;
  END LOOP;

  RAISE NOTICE 'ladder: % offer(s) removed and retired; % by-type drawer offer(s) restored; drawers count dropped from % type(s).',
    v_off, v_back, v_fields;
END $$;

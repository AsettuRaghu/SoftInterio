-- A handle offered with nothing to size it by is a stepper, not a question.
--
-- Four types offer the Handles ladder with no quantity to price it per, so
-- the sheet draws four "+ Handles - Basic × n" chips instead of asking which
-- handles - the meaningless count the user objected to. The Loft has a hinge
-- count already and its handles follow it, one per door like everywhere
-- else. The three tables have neither doors nor a drawer count now that a
-- drawer is a counted internal, and there is nothing honest to derive from:
-- their handles come fitted to the drawer, so the offer goes.
--
-- The rule to keep: if a type cannot say how many of something it needs, it
-- should not be offering it as a priced line.

DO $$
DECLARE v_fixed integer := 0; v_dropped integer := 0;
BEGIN
  -- A loft's handles are one per door, like every other shuttered unit.
  UPDATE component_types ct
  SET config_schema = jsonb_set(config_schema, '{quantities}',
        coalesce(config_schema->'quantities', '[]'::jsonb) || jsonb_build_object(
          'key', 'handles', 'label', 'Handles', 'unit_code', 'nos', 'formula', 'shutters')),
      updated_at = now()
  WHERE ct.slug = 'loft'
    AND ct.config_schema->'fields' @> '[{"key":"shutters"}]'
    AND NOT (coalesce(ct.config_schema->'quantities', '[]'::jsonb) @> '[{"key":"handles"}]');

  UPDATE component_type_offers o SET quantity_key = 'handles'
  FROM component_types ct, quotation_cost_items ci, quotation_cost_item_categories cc
  WHERE ct.id = o.component_type_id AND ci.id = o.cost_item_id AND cc.id = ci.category_id
    AND cc.slug = 'handles' AND o.quantity_key IS NULL
    AND ct.config_schema->'quantities' @> '[{"key":"handles"}]';
  GET DIAGNOSTICS v_fixed = ROW_COUNT;

  -- Anything still unsized stops being offered.
  DELETE FROM component_type_offers o
  USING quotation_cost_items ci, quotation_cost_item_categories cc
  WHERE ci.id = o.cost_item_id AND cc.id = ci.category_id
    AND cc.slug = 'handles' AND o.quantity_key IS NULL;
  GET DIAGNOSTICS v_dropped = ROW_COUNT;

  RAISE NOTICE '% handle offer(s) given a count, % dropped for having none.', v_fixed, v_dropped;
END $$;

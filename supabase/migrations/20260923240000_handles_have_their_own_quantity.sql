-- Handles must not borrow the drawer count.
--
-- Yesterday's change pointed Handles at `drawers` wherever a type had no
-- handle count of its own. The arithmetic was right - a dressing table's
-- handles are one per drawer - but it made the drawer count *belong* to the
-- handles question, and a count belongs to the question that is priced per
-- it. On a dressing table the sheet would have asked "How do the doors open?
-- ... how many drawers?", which is nonsense.
--
-- So the types get a real `handles` quantity, derived from the drawers, and
-- the handle offers point at that. The number is identical; the ownership is
-- right, and `drawers` goes back to the drawer-system question.

DO $$
DECLARE
  v_types integer := 0;
  v_offers integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ct.id
    FROM component_types ct
    JOIN component_type_offers o ON o.component_type_id = ct.id
    JOIN quotation_cost_items ci ON ci.id = o.cost_item_id
    JOIN quotation_cost_item_categories cc ON cc.id = ci.category_id
    WHERE cc.slug = 'handles'
      AND o.quantity_key = 'drawers'
      AND NOT (coalesce(ct.config_schema->'quantities', '[]'::jsonb) @> '[{"key":"handles"}]')
  LOOP
    UPDATE component_types
    SET config_schema = jsonb_set(
          coalesce(config_schema, '{}'::jsonb),
          '{quantities}',
          coalesce(config_schema->'quantities', '[]'::jsonb) || jsonb_build_object(
            'key', 'handles', 'label', 'Handles', 'unit_code', 'nos', 'formula', 'drawers')
        ),
        updated_at = now()
    WHERE id = r.id;
    v_types := v_types + 1;
  END LOOP;

  UPDATE component_type_offers o
  SET quantity_key = 'handles'
  FROM quotation_cost_items ci, quotation_cost_item_categories cc, component_types ct
  WHERE ci.id = o.cost_item_id AND cc.id = ci.category_id AND ct.id = o.component_type_id
    AND cc.slug = 'handles' AND o.quantity_key = 'drawers'
    AND ct.config_schema->'quantities' @> '[{"key":"handles"}]';
  GET DIAGNOSTICS v_offers = ROW_COUNT;

  RAISE NOTICE '% type(s) gained a handles quantity, % handle offer(s) repointed.', v_types, v_offers;
END $$;

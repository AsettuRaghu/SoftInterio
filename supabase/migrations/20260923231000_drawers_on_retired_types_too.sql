-- The drawer count skipped inactive component types, because the loop that
-- added it filtered on is_active - and "Modular Wardrobe with Loft - Sliding"
-- is retired but still offers the Drawer Systems ladder. A retired type shows
-- on no room sheet, so nothing is wrong today; the moment somebody reactivates
-- it, every drawer line would price against a quantity that does not exist and
-- come out at nothing. Cheaper to close now than to find later.

DO $$
DECLARE
  v_types integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ct.id
    FROM component_types ct
    JOIN component_type_offers o ON o.component_type_id = ct.id
    JOIN quotation_cost_items ci ON ci.id = o.cost_item_id
    WHERE ci.slug LIKE 'drawer-systems-%'
      AND NOT (coalesce(ct.config_schema->'fields', '[]'::jsonb) @> '[{"key":"drawers"}]')
  LOOP
    UPDATE component_types
    SET config_schema = jsonb_set(
          jsonb_set(
            coalesce(config_schema, '{}'::jsonb),
            '{fields}',
            coalesce(config_schema->'fields', '[]'::jsonb) || jsonb_build_object(
              'key', 'drawers', 'label', 'Drawers', 'kind', 'count', 'default', 0,
              'hint', 'How many drawers in this unit. None unless the customer asks for them.')
          ),
          '{quantities}',
          coalesce(config_schema->'quantities', '[]'::jsonb) || jsonb_build_object(
            'key', 'drawers', 'label', 'Drawers', 'unit_code', 'nos', 'formula', 'drawers')
        ),
        updated_at = now()
    WHERE id = r.id;
    v_types := v_types + 1;
  END LOOP;
  RAISE NOTICE 'Added the drawer count to % retired type(s).', v_types;
END $$;

-- A drawer has a quality and a number, and they are two different questions.
--
-- The sheet asked neither well. On a wardrobe, drawers were counted
-- accessories in Internals - Wooden Drawer and Tandem Box Drawer, each with
-- its own +/- stepper - so "what quality" and "how many" were tangled into
-- one list. On a dressing table the graded Drawer Systems ladder was offered
-- with no quantity at all, which made four qualities into four counted
-- things. Settled 2026-09-23: **the type tells us the quality, the count
-- tells us how many** - which reverses the 2026-09-21 reading that a drawer
-- kind is never a preference, and is better than either, because it stops
-- asking one question in two places.
--
--   drawers          a count on the rule, answered "None · 1 · 2 · 3 · 4 · 6"
--                    on the sheet, never a typed number
--   Drawer Systems   Basic / Standard / Premium / Luxury, priced per that
--                    count - one question, one answer
--
-- The specialised pull-outs stay counted accessories in Internals: a trouser
-- pull-out and a saree pull-out are different THINGS, not grades of drawer,
-- and each is genuinely "how many of these".
--
-- Also here, from the same walkthrough:
--   * Lighting on a wardrobe reads "Internal Lighting?" - the category's
--     question was the generic "Lighting?", which said nothing about what is
--     being lit. Blank now, so a lone item asks by its own name.
--   * A dressing table stops asking "What goes inside?" and "Which profile
--     lighting?" - neither means anything on a dressing table.
--   * Where a type offers Handles with nothing to count them by, they follow
--     the drawers rather than becoming a stepper of their own.

DO $$
DECLARE
  v_types integer := 0;
  v_offers integer := 0;
  v_dropped integer := 0;
  r record;
BEGIN
  -- 1. Every type that sells a drawer system gets a drawer count. The two
  --    openable wardrobes get the ladder as well - they had only the by-type
  --    drawers, which is the tangle this removes.
  FOR r IN
    SELECT DISTINCT ct.id, ct.tenant_id, ct.config_schema
    FROM component_types ct
    WHERE ct.is_active
      AND (
        EXISTS (
          SELECT 1 FROM component_type_offers o
          JOIN quotation_cost_items ci ON ci.id = o.cost_item_id
          WHERE o.component_type_id = ct.id AND ci.slug LIKE 'drawer-systems-%'
        )
        OR ct.slug IN ('wardrobe---openable', 'wardrobe-with-loft---openable')
      )
  LOOP
    IF NOT (coalesce(r.config_schema->'fields', '[]'::jsonb) @> '[{"key":"drawers"}]') THEN
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
    END IF;

    -- The ladder, on the two wardrobes that did not carry it.
    INSERT INTO component_type_offers (tenant_id, component_type_id, cost_item_id, quantity_key, auto, display_order)
    SELECT r.tenant_id, r.id, ci.id, 'drawers', false, 60
    FROM quotation_cost_items ci
    WHERE ci.tenant_id = r.tenant_id AND ci.slug LIKE 'drawer-systems-%' AND ci.is_active
      AND NOT EXISTS (SELECT 1 FROM component_type_offers e WHERE e.component_type_id = r.id AND e.cost_item_id = ci.id);
  END LOOP;

  -- 2. Every drawer-system offer is priced per the count.
  UPDATE component_type_offers o
  SET quantity_key = 'drawers'
  FROM quotation_cost_items ci
  WHERE ci.id = o.cost_item_id AND ci.slug LIKE 'drawer-systems-%'
    AND o.quantity_key IS DISTINCT FROM 'drawers';
  GET DIAGNOSTICS v_offers = ROW_COUNT;

  -- 3. The plain by-type drawers go wherever the ladder now answers for them.
  --    Pull-outs, baskets and trays stay: those are things, not grades.
  DELETE FROM component_type_offers o
  USING quotation_cost_items ci
  WHERE ci.id = o.cost_item_id
    AND ci.slug IN ('internal-wooden-drawer', 'internal-tandem-box')
    AND EXISTS (
      SELECT 1 FROM component_type_offers d
      JOIN quotation_cost_items dci ON dci.id = d.cost_item_id
      WHERE d.component_type_id = o.component_type_id AND dci.slug LIKE 'drawer-systems-%'
    );
  GET DIAGNOSTICS v_dropped = ROW_COUNT;

  -- 4. Handles with nothing to count them by follow the drawers.
  UPDATE component_type_offers o
  SET quantity_key = 'drawers'
  FROM quotation_cost_items ci, quotation_cost_item_categories cc, component_types ct
  WHERE ci.id = o.cost_item_id AND cc.id = ci.category_id AND ct.id = o.component_type_id
    AND cc.slug = 'handles' AND o.quantity_key IS NULL
    AND ct.config_schema->'quantities' @> '[{"key":"drawers"}]'
    AND NOT (ct.config_schema->'quantities' @> '[{"key":"handles"}]');

  -- 5. "Lighting?" says nothing about what is lit. Blank, so a lone item asks
  --    by its own name - "Internal Lighting?" on a wardrobe.
  UPDATE quotation_cost_item_categories SET question = NULL, updated_at = now()
  WHERE slug = 'lighting' AND question IS NOT NULL;
  UPDATE quotation_cost_items SET name = 'Internal Lighting', updated_at = now()
  WHERE slug = 'light-wardrobe-sensor' AND name <> 'Internal Lighting';

  -- 6. A dressing table is not asked what goes inside it, nor which profile
  --    lighting it takes.
  DELETE FROM component_type_offers o
  USING quotation_cost_items ci, quotation_cost_item_categories cc, component_types ct
  WHERE ci.id = o.cost_item_id AND cc.id = ci.category_id AND ct.id = o.component_type_id
    AND ct.slug = 'dressing-table'
    AND cc.slug IN ('internals', 'profile-lighting');

  RAISE NOTICE 'drawers: % type(s) gained the count, % offer(s) repriced, % by-type drawer offer(s) dropped.',
    v_types, v_offers, v_dropped;
END $$;

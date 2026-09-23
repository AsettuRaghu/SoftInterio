-- Shelves start from the height rather than from zero.
--
-- They were defaulted to 0 on the rule that a default which invents work
-- invents money. True of exposed ends and blind corners, which are nothing
-- until somebody sees the room - but not of shelves: "most customers do ask
-- for internals with a standard shelf height of 1-1.5 feet" (2026-09-23).
-- A wardrobe with no shelves is the unusual one, and quoting every wardrobe
-- with none is as wrong in the other direction.
--
--   shelves = ceil(height / 1.5)
--
-- A shelf every eighteen inches: six on a 2700 mm wardrobe, seven on a
-- 3000 mm one. It is a starting point in one box on the component's page,
-- and the seller can overrule it on the sheet like any other derived number.
--
-- Applied only where a shelf is actually sold - the type has a `shelves`
-- field and offers the Shelf item - and only where the default is still the
-- original 0, so a tenant who has already chosen a number keeps it.

DO $$
DECLARE v_types integer := 0; r record;
BEGIN
  FOR r IN
    SELECT ct.id, ct.name
    FROM component_types ct
    WHERE ct.config_schema->'fields' @> '[{"key":"shelves","default":0}]'
      AND EXISTS (
        SELECT 1 FROM component_type_offers o
        JOIN quotation_cost_items ci ON ci.id = o.cost_item_id
        WHERE o.component_type_id = ct.id AND ci.slug = 'internal-shelf' AND ci.is_active
      )
      AND ct.config_schema->'fields' @> '[{"key":"height"}]'
  LOOP
    UPDATE component_types
    SET config_schema = jsonb_set(config_schema, '{fields}', (
          SELECT jsonb_agg(CASE WHEN f->>'key' = 'shelves'
                 THEN jsonb_set(jsonb_set(f, '{default}', '"ceil(height / 1.5)"'),
                                '{hint}', '"A shelf every 18 inches. Change it here if this one is different."')
                 ELSE f END)
          FROM jsonb_array_elements(config_schema->'fields') f)),
        updated_at = now()
    WHERE id = r.id;
    v_types := v_types + 1;
    RAISE NOTICE '  %', r.name;
  END LOOP;
  RAISE NOTICE 'shelves now follow the height on % type(s).', v_types;
END $$;

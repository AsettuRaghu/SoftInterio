-- A count's question belongs to the field, not to the code.
--
-- Three counts asked properly on the room sheet - "Any blind corners? None ·
-- One (L-shaped) · Two (U-shaped)", "Any exposed ends?", "Wall units -
-- exposed ends?" - because `ScopeItemPanel` held a map keyed by field NAME.
-- So a tenant who added a `niches` count to a rule got a bare number box and
-- no way to fix it, which is the opposite of the rules being theirs.
--
-- The wording and the answers move onto the field itself
-- (`CostingField.question` / `.choices`), and the map goes. Anything without
-- choices asks for a number, as everything but those three already did.
--
-- Backfilled from what the code said, so nothing changes on screen.

DO $$
DECLARE
  v_types integer := 0;
  r record;
  -- field key -> question, and the answers it offers
  asks jsonb := jsonb_build_object(
    'corners', jsonb_build_object(
      'question', 'Any blind corners?',
      'choices', jsonb_build_array(
        jsonb_build_object('value', 0, 'label', 'None'),
        jsonb_build_object('value', 1, 'label', 'One (L-shaped)'),
        jsonb_build_object('value', 2, 'label', 'Two (U-shaped)'))),
    'exposed_sides', jsonb_build_object(
      'question', 'Any exposed ends?',
      'choices', jsonb_build_array(
        jsonb_build_object('value', 0, 'label', 'None'),
        jsonb_build_object('value', 1, 'label', 'One end'),
        jsonb_build_object('value', 2, 'label', 'Both ends'))),
    'wall_exposed_sides', jsonb_build_object(
      'question', 'Wall units - exposed ends?',
      'choices', jsonb_build_array(
        jsonb_build_object('value', 0, 'label', 'None'),
        jsonb_build_object('value', 1, 'label', 'One end'),
        jsonb_build_object('value', 2, 'label', 'Both ends')))
  );
BEGIN
  FOR r IN
    SELECT id FROM component_types
    WHERE config_schema->'fields' IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(config_schema->'fields') f
        WHERE asks ? (f->>'key') AND NOT (f ? 'choices')
      )
  LOOP
    UPDATE component_types
    SET config_schema = jsonb_set(config_schema, '{fields}', (
          SELECT jsonb_agg(
            CASE WHEN asks ? (f->>'key') AND NOT (f ? 'choices')
                 THEN f || jsonb_build_object(
                        'question', asks->(f->>'key')->>'question',
                        'choices',  asks->(f->>'key')->'choices')
                 ELSE f END
            ORDER BY ord)
          FROM jsonb_array_elements(config_schema->'fields') WITH ORDINALITY AS t(f, ord)
        )),
        updated_at = now()
    WHERE id = r.id;
    v_types := v_types + 1;
  END LOOP;
  RAISE NOTICE 'Moved the count questions onto % component type(s).', v_types;
END $$;

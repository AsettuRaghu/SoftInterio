-- A preset said which home it was for by being CALLED "3 BHK".
--
-- `presetMatches()` stripped the spaces and looked for the configuration
-- inside the name, so the link between the Configuration dropdown and the
-- preset was a naming convention nobody was told about: rename "3 BHK" to
-- "3 Bedroom Flat" and qualification quietly stopped laying a scope down,
-- with no error and nothing on any screen to explain the blank list. Villa
-- was worse - it matched on the property TYPE being a villa, also by name.
--
-- The preset now says so outright. `configurations` is the list of
-- Configuration values it answers (a preset may serve more than one), and
-- `property_types` optionally narrows it to villas or independent houses -
-- which is how a Villa preset beats the plain 4 BHK for the same
-- configuration.
--
-- Backfilled from the names by the same rules the code used, so nothing
-- changes today. A preset declaring nothing still falls back to its name,
-- which keeps a tenant who never opens the editor working.

ALTER TABLE scope_presets
  ADD COLUMN IF NOT EXISTS configurations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS property_types text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN scope_presets.configurations IS
  'Configuration values this preset answers (studio, 1bhk … 5bhk_plus, other). Empty falls back to matching the name.';
COMMENT ON COLUMN scope_presets.property_types IS
  'Optional narrowing - a preset for villas only. A preset naming the property type beats one that does not.';

DO $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE scope_presets p
  SET configurations = c.cfg
  FROM (
    SELECT s.id,
           array_remove(ARRAY[
             CASE WHEN lower(replace(s.name,' ','')) LIKE '%studio%'      THEN 'studio'    END,
             CASE WHEN lower(replace(s.name,' ','')) LIKE '%1bhk%'        THEN '1bhk'      END,
             CASE WHEN lower(replace(s.name,' ','')) LIKE '%2bhk%'        THEN '2bhk'      END,
             CASE WHEN lower(replace(s.name,' ','')) LIKE '%3bhk%'        THEN '3bhk'      END,
             CASE WHEN lower(replace(s.name,' ','')) LIKE '%4bhk%'        THEN '4bhk'      END,
             CASE WHEN lower(replace(s.name,' ','')) ~ '5\+?bhk'          THEN '5bhk_plus' END
           ], NULL) AS cfg
    FROM scope_presets s
  ) c
  WHERE c.id = p.id AND cardinality(p.configurations) = 0 AND cardinality(c.cfg) > 0;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- A Villa preset served every configuration, narrowed by the property
  -- being a villa - the code checked those three types by hand.
  UPDATE scope_presets
  SET property_types = ARRAY['villa','independent_house','farmhouse']
  WHERE lower(replace(name,' ','')) LIKE '%villa%'
    AND cardinality(property_types) = 0;

  RAISE NOTICE 'Declared the configuration on % preset(s).', v_rows;
END $$;

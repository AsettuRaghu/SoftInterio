-- Ask the seller almost nothing (2026-09-23, the user: "almost all the
-- components say x fields not measured ... it's important that we have as
-- minimal fields as possible").
--
-- Every field that is a trade constant or can be worked out from the size
-- now has a default, and a field with a default is never asked for. What
-- is left on a wardrobe is the width and height the Scope list already
-- holds - nothing else, unless the seller wants to say otherwise.
--
--   depth          a constant per type, already defaulted
--   shutters       ceil(width / 2) - a door is about two feet wide, which
--                  is what the trade fits; type a number to say otherwise
--   exposed_sides  0 - an end is exposed only when somebody says so, and
--                  inventing one invents money
--   corners        0 - likewise
--   shelves        0 - a shelf is priced per shelf, so a default would bill
--                  shelves nobody asked for
--   dado_height    600 mm, counter to the underside of the wall units
--
-- A formula default is evaluated in feet over the fields above it, so
-- `ceil(width / 2)` reads "one door per two feet of width".
DO $ask$
DECLARE ct record; fields jsonb; f jsonb;
BEGIN
FOR ct IN SELECT id, config_schema FROM public.component_types WHERE config_schema ? 'fields' LOOP
  fields := '[]'::jsonb;
  FOR f IN SELECT jsonb_array_elements(ct.config_schema->'fields') LOOP
    IF NOT (f ? 'default') THEN
      f := f || CASE f->>'key'
        WHEN 'shutters'      THEN '{"default":"ceil(width / 2)"}'::jsonb
        WHEN 'loft_shutters' THEN '{"default":"ceil(width / 2)"}'::jsonb
        WHEN 'exposed_sides' THEN '{"default":0}'::jsonb
        WHEN 'wall_exposed_sides' THEN '{"default":0}'::jsonb
        WHEN 'corners'       THEN '{"default":0}'::jsonb
        WHEN 'shelves'       THEN '{"default":0}'::jsonb
        WHEN 'drawers'       THEN '{"default":0}'::jsonb
        WHEN 'loft_height'   THEN '{"default":0}'::jsonb
        WHEN 'dado_height'   THEN '{"default":600}'::jsonb
        ELSE '{}'::jsonb END;
    END IF;
    -- How each is counted, because exposed sides and blind corners are the
    -- two nobody guesses right.
    f := f || CASE f->>'key'
      WHEN 'exposed_sides' THEN '{"hint":"Ends you can see from the room. A run between two walls is 0; one open end is 1; an island or peninsula is 2."}'::jsonb
      WHEN 'wall_exposed_sides' THEN '{"hint":"Ends of the wall units you can see from the room."}'::jsonb
      WHEN 'corners' THEN '{"hint":"Right-angle turns in this run. An L-shaped kitchen has 1, a U-shaped one 2, a straight run none."}'::jsonb
      WHEN 'shutters' THEN '{"hint":"Doors. Left blank we take one per two feet of width."}'::jsonb
      WHEN 'loft_shutters' THEN '{"hint":"Loft doors. Left blank we take one per two feet."}'::jsonb
      WHEN 'shelves' THEN '{"hint":"How many shelves to price. Blank means none."}'::jsonb
      WHEN 'drawers' THEN '{"hint":"How many plain drawers. Blank means none; other kinds are picked as options."}'::jsonb
      ELSE '{}'::jsonb END;
    fields := fields || jsonb_build_array(f);
  END LOOP;
  UPDATE public.component_types SET config_schema = jsonb_set(config_schema, '{fields}', fields) WHERE id = ct.id;
END LOOP;
END
$ask$;

-- The whole-home rules ask for an area nobody can derive; say so plainly
-- rather than leaving a blank that reads as forgotten.
UPDATE public.component_types ct SET config_schema = jsonb_set(ct.config_schema, '{fields}', (
  SELECT COALESCE(jsonb_agg(
    CASE WHEN f->>'key' IN ('wall_sqft','area','perimeter','wiring_run','plumbing_run','demolition_area','floor_area','wall_area')
         THEN f || jsonb_build_object('hint', COALESCE(f->>'hint', '') || CASE WHEN COALESCE(f->>'hint','') = '' THEN '' ELSE ' · ' END || 'Only what is being done - leave it blank if none')
         ELSE f END ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements(ct.config_schema->'fields') WITH ORDINALITY AS t(f, ord)))
WHERE ct.slug IN ('painting','electrical-work','civil-work','false-ceiling','site-services');

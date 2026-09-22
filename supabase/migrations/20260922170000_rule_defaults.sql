-- Defaults on the rule fields whose value is a trade convention
-- (2026-09-22): a base unit is 850 mm to the counter and 600 deep, a wall
-- unit 750 and 300, a wardrobe 600 deep. The seller corrects the number
-- rather than inventing it - the first real quotation had a base unit
-- 600 mm high, so its front area was a third light.
-- Kept in millimetres, which is what every row on this tenant uses; a
-- business measuring in feet edits them on the component's page.
DO $$
DECLARE r record; f jsonb; out_fields jsonb;
BEGIN
FOR r IN SELECT * FROM (VALUES
  ('kitchen-base-unit',  '{"height":850,"depth":600}'::jsonb),
  ('kitchen-island',     '{"height":850,"depth":900}'::jsonb),
  ('kitchen-wall-unit',  '{"height":750,"depth":300}'::jsonb),
  ('kitchen-tall-unit',  '{"height":2100,"depth":600}'::jsonb),
  ('kitchen-loft-unit',  '{"height":600}'::jsonb),
  ('breakfast-counter',  '{"height":850,"depth":600}'::jsonb),
  ('utility-unit',       '{"height":850,"depth":600}'::jsonb),
  ('vanity',             '{"height":850,"depth":500}'::jsonb),
  ('wardrobe---openable','{"depth":600}'::jsonb),
  ('wardrobe---sliding', '{"depth":650}'::jsonb),
  ('wardrobe-with-loft---openable','{"depth":600}'::jsonb),
  ('modular-wardrobe-with-loft---sliding','{"depth":650}'::jsonb),
  ('loft',               '{"height":600}'::jsonb),
  ('tv-unit',            '{"depth":450}'::jsonb),
  ('crockery-unit',      '{"depth":450}'::jsonb),
  ('shoe-rack',          '{"depth":350}'::jsonb),
  ('bookshelf',          '{"depth":350}'::jsonb),
  ('pooja-unit',         '{"depth":450}'::jsonb),
  ('bar-unit',           '{"depth":450}'::jsonb),
  ('study-table',        '{"height":750,"depth":600}'::jsonb),
  ('console-table',      '{"height":750,"depth":400}'::jsonb),
  ('dressing-table',     '{"height":750,"depth":450}'::jsonb),
  ('bed',                '{"length":1900,"height":900}'::jsonb)
) AS d(slug, defaults) LOOP
  FOR f IN SELECT jsonb_array_elements(config_schema->'fields') FROM public.component_types WHERE slug = r.slug LIMIT 1 LOOP EXIT; END LOOP;
  UPDATE public.component_types ct
  SET config_schema = jsonb_set(ct.config_schema, '{fields}', (
    SELECT COALESCE(jsonb_agg(
      CASE WHEN r.defaults ? (fld->>'key') AND NOT (fld ? 'default')
           THEN fld || jsonb_build_object('default', r.defaults->(fld->>'key'))
           ELSE fld END ORDER BY ord), '[]'::jsonb)
    FROM jsonb_array_elements(ct.config_schema->'fields') WITH ORDINALITY AS t(fld, ord)))
  WHERE ct.slug = r.slug AND ct.config_schema ? 'fields';
END LOOP;
END $$;

-- Three of the seven configurations matched no preset, silently.
--
-- `applyPresetForConfiguration` finds a preset by NAME - `presetMatches()`
-- strips the spaces and looks for the configuration inside it - and the
-- shipped five are 1/2/3/4 BHK and Villa. So qualifying a lead as **Studio**
-- or **5+ BHK** laid down nothing at all, while the stage dialog said only
-- "moved to qualified stage successfully": the seller opened Requirement
-- discussion on a blank list with nothing saying why. (`Other` matches
-- nothing by design - there is no usual shape for it - and the transition
-- now says so rather than shrugging.)
--
-- These follow the shape the tenant set when they made the first five
-- practical: a bedroom is a wardrobe and a dressing table, not every
-- component that declares the space. Studio is the 1 BHK without the
-- utility; 5+ BHK is the 4 BHK with a fifth bedroom and bath and a study.
--
-- Seeded per tenant and only where absent, so editing them afterwards is
-- safe and re-running this changes nothing.

CREATE OR REPLACE FUNCTION pg_temp.preset_item(p_tenant uuid, p_space text, p_count int, p_components text[])
RETURNS jsonb LANGUAGE sql AS $fn$
  SELECT CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
    'space_type_id', s.id,
    'count', p_count,
    'component_type_ids', coalesce(
      (SELECT jsonb_agg(c.id) FROM component_types c
        WHERE c.tenant_id = p_tenant AND c.is_active AND c.slug = ANY (p_components)),
      '[]'::jsonb)
  ) END
  FROM (SELECT id FROM space_types WHERE tenant_id = p_tenant AND slug = p_space AND is_active LIMIT 1) s;
$fn$;

DO $$
DECLARE
  t record;
  v_items jsonb;
  v_added integer := 0;
BEGIN
  FOR t IN SELECT DISTINCT tenant_id FROM scope_presets LOOP

    IF NOT EXISTS (SELECT 1 FROM scope_presets p
                   WHERE p.tenant_id = t.tenant_id
                     AND lower(replace(p.name, ' ', '')) LIKE '%studio%') THEN
      SELECT jsonb_agg(i) INTO v_items FROM unnest(ARRAY[
        pg_temp.preset_item(t.tenant_id, 'bedroom',     1, ARRAY['wardrobe---openable']),
        pg_temp.preset_item(t.tenant_id, 'kitchen',     1, ARRAY['kitchen-base-unit','kitchen-wall-unit','kitchen-loft-unit']),
        pg_temp.preset_item(t.tenant_id, 'living-room', 1, ARRAY['tv-unit']),
        pg_temp.preset_item(t.tenant_id, 'bathroom',    1, ARRAY['vanity'])
      ]) i WHERE i IS NOT NULL;
      IF v_items IS NOT NULL THEN
        INSERT INTO scope_presets (tenant_id, name, description, items, display_order, is_active)
        VALUES (t.tenant_id, 'Studio', 'One room, a kitchen and a bath.', v_items, 0, true);
        v_added := v_added + 1;
      END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM scope_presets p
                   WHERE p.tenant_id = t.tenant_id
                     AND lower(replace(p.name, ' ', '')) ~ '5\+?bhk') THEN
      SELECT jsonb_agg(i) INTO v_items FROM unnest(ARRAY[
        pg_temp.preset_item(t.tenant_id, 'bedroom',     5, ARRAY['wardrobe---openable','study-table','dressing-table']),
        pg_temp.preset_item(t.tenant_id, 'kitchen',     1, ARRAY['kitchen-tall-unit','kitchen-wall-unit','kitchen-loft-unit','kitchen-base-unit']),
        pg_temp.preset_item(t.tenant_id, 'living-room', 1, ARRAY['tv-unit','wall-paneling']),
        pg_temp.preset_item(t.tenant_id, 'dining',      1, ARRAY['crockery-unit']),
        pg_temp.preset_item(t.tenant_id, 'bathroom',    5, ARRAY['vanity']),
        pg_temp.preset_item(t.tenant_id, 'pooja-room',  1, ARRAY['pooja-unit']),
        pg_temp.preset_item(t.tenant_id, 'utility',     1, ARRAY['utility-unit','shoe-rack']),
        pg_temp.preset_item(t.tenant_id, 'study-room',  1, ARRAY['study-table','bookshelf'])
      ]) i WHERE i IS NOT NULL;
      IF v_items IS NOT NULL THEN
        INSERT INTO scope_presets (tenant_id, name, description, items, display_order, is_active)
        VALUES (t.tenant_id, '5+ BHK', 'The 4 BHK, a bedroom and bath further, with a study.', v_items, 5, true);
        v_added := v_added + 1;
      END IF;
    END IF;

  END LOOP;
  RAISE NOTICE 'Added % preset(s).', v_added;
END $$;

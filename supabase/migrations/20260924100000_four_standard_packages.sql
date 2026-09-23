-- Four packages, one per grade, built to be argued with rather than admired.
--
-- The first package a tenant made was named "My Budget" and contained 68
-- Premium answers, every one of them from the seed-from-a-grade shortcut, and
-- nothing else. That is not a package - it is the Apply-a-grade button with a
-- name on it, and it is exactly why a grade alone is not enough:
--
--   a wardrobe 3600 x 2400, 93 sqft of front
--     graded part   Budget 74,850  Standard 97,350  Premium 1,30,350  Luxury 1,71,600
--     THE FINISH    Laminate 55,800 ... Veneer 1,48,800
--
-- The finish is half the wardrobe and the grade never touches it, because a
-- finish is a KIND, not a level. A "Luxury" package that names no finish does
-- not quote a luxury wardrobe.
--
-- So each package here answers three things: the graded families at its own
-- level, the by-kind questions that carry the money, and the accessories that
-- business gives as standard at that level.
--
-- What is deliberately LEFT unanswered, and why it matters: profile lighting
-- below Premium, wall panelling below Luxury, every appliance, every specialised
-- pull-out beyond the ones listed. A package cannot record "no" - there is no
-- way to say *decline this question* - so anything genuinely optional is left
-- for the seller to ask, and shows as still-to-ask rather than being quietly
-- added to the price. Under-selling by default is recoverable; over-selling by
-- default is a quotation nobody can defend.
--
-- Every number below is a starting point. The whole point of the scope work is
-- that each of these gets argued down to the real one.

DO $$
DECLARE
  t record;
  v_pkg uuid;
  v_rows integer;
  -- tier, name, finish, countertop, and which graded categories it answers
  tiers text[][] := ARRAY[
    ARRAY['basic',    'Budget',   'shutter-laminate', 'countertop-granite'],
    ARRAY['standard', 'Standard', 'shutter-membrane', 'countertop-granite'],
    ARRAY['premium',  'Premium',  'shutter-acrylic',  'countertop-quartz'],
    ARRAY['luxury',   'Luxury',   'shutter-veneer',   'countertop-nano-white']
  ];
  spec text[];
BEGIN
FOR t IN SELECT DISTINCT tenant_id FROM component_types WHERE tenant_id IS NOT NULL LOOP
  FOREACH spec SLICE 1 IN ARRAY tiers LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM scope_packages p WHERE p.tenant_id = t.tenant_id AND lower(p.name) = lower(spec[2])
    );

    INSERT INTO scope_packages (tenant_id, name, description, display_order, is_active)
    VALUES (
      t.tenant_id, spec[2],
      'Starting point - the graded families at this level, the finish, and the accessories given as standard. Edit freely.',
      CASE spec[1] WHEN 'basic' THEN 1 WHEN 'standard' THEN 2 WHEN 'premium' THEN 3 ELSE 4 END,
      true
    )
    RETURNING id INTO v_pkg;

    -- 1. The graded families, at this level. Profile lighting only from
    --    Premium and panelling only at Luxury: both are upsells, not part of
    --    the job, and answering them adds money nobody asked for.
    INSERT INTO scope_package_items (tenant_id, package_id, component_type_id, cost_item_id, quantity)
    SELECT DISTINCT t.tenant_id, v_pkg, o.component_type_id, ci.id, NULL::numeric
    FROM component_type_offers o
    JOIN quotation_cost_items ci ON ci.id = o.cost_item_id AND ci.is_active
    JOIN quotation_cost_item_categories cc ON cc.id = ci.category_id
    WHERE o.tenant_id = t.tenant_id
      AND NOT o.auto
      AND lower(coalesce(ci.quality_tier, '')) = spec[1]
      AND (
        cc.slug IN ('carcass', 'hinges', 'handles', 'sliding-systems')
        OR (cc.slug = 'profile-lighting' AND spec[1] IN ('premium', 'luxury'))
        OR (cc.slug = 'wall-paneling' AND spec[1] = 'luxury')
      );

    -- 2. The by-kind questions that carry the money. Only onto the component
    --    types that actually offer them.
    INSERT INTO scope_package_items (tenant_id, package_id, component_type_id, cost_item_id, quantity)
    SELECT DISTINCT t.tenant_id, v_pkg, o.component_type_id, ci.id, NULL::numeric
    FROM component_type_offers o
    JOIN quotation_cost_items ci ON ci.id = o.cost_item_id AND ci.is_active
    WHERE o.tenant_id = t.tenant_id AND NOT o.auto AND ci.slug IN (spec[3], spec[4]);

    -- 3. What we give as standard. Wardrobes and kitchens only, because that
    --    is where "as standard" means anything.
    INSERT INTO scope_package_items (tenant_id, package_id, component_type_id, cost_item_id, quantity)
    SELECT DISTINCT t.tenant_id, v_pkg, o.component_type_id, ci.id, x.qty::numeric
    FROM (VALUES
      -- wardrobes
      ('wardrobe%',        'internal-hanging-rod',      1::integer, 'basic'),
      ('wardrobe%',        'internal-tandem-box',       2, 'standard'),
      ('wardrobe%',        'internal-trouser-pullout',  1, 'premium'),
      ('wardrobe%',        'internal-mirror',           1, 'luxury'),
      ('wardrobe%',        'light-wardrobe-sensor',     1, 'luxury'),
      -- kitchens
      ('kitchen-base-unit','internal-cutlery-tray',     1, 'standard'),
      ('kitchen-base-unit','internal-bottle-pullout',   1, 'premium'),
      -- a dressing table without a mirror is not one
      ('dressing-table',   'glass-mirror',              NULL::integer, 'basic')
    ) AS x(type_like, item_slug, qty, from_tier)
    JOIN component_types ct ON ct.tenant_id = t.tenant_id AND ct.slug LIKE x.type_like AND ct.is_active
    JOIN component_type_offers o ON o.component_type_id = ct.id
    JOIN quotation_cost_items ci ON ci.id = o.cost_item_id AND ci.slug = x.item_slug AND ci.is_active
    WHERE o.tenant_id = t.tenant_id
      -- a thing given as standard at Standard is also given at Premium and Luxury
      AND CASE x.from_tier
            WHEN 'basic'    THEN true
            WHEN 'standard' THEN spec[1] IN ('standard', 'premium', 'luxury')
            WHEN 'premium'  THEN spec[1] IN ('premium', 'luxury')
            ELSE spec[1] = 'luxury'
          END
    ON CONFLICT (package_id, component_type_id, cost_item_id) DO NOTHING;

    SELECT count(*) INTO v_rows FROM scope_package_items WHERE package_id = v_pkg;
    RAISE NOTICE '  % - % answers', spec[2], v_rows;
  END LOOP;

  -- Every preset answers with Standard unless the tenant says otherwise: it is
  -- the level most homes are quoted at, and a preset that answers nothing is
  -- the whole reason qualification still felt like data entry.
  UPDATE scope_presets p
  SET package_id = (SELECT id FROM scope_packages WHERE tenant_id = t.tenant_id AND name = 'Standard' LIMIT 1)
  WHERE p.tenant_id = t.tenant_id AND p.package_id IS NULL;
END LOOP;
END $$;

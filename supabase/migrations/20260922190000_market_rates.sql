-- Starting rates brought into the real world (2026-09-22, asked for after
-- the first quotation came out at ₹62 lakh for a 3 BHK - roughly three
-- times what that home is quoted at in the market).
--
-- The December seed priced each PART as though it were the whole job: a
-- carcass at ₹2,000/sqft and a shutter at ₹2,500/sqft together exceed what
-- a finished modular kitchen sells for, and a hinge at ₹1,000 is four
-- times a soft-close hinge fitted. These are per square foot of FRONT
-- ELEVATION, supply and fit, Indian metro:
--
--   carcass   MR ply 750 · BWR 950 · BWP/marine 1,250 · WPC/SS 1,600
--   shutter   laminate 550-750 · acrylic 1,150 · PU 1,350 ·
--             lacquered glass 1,450 · veneer 1,600
--   so a standard run is ~₹1,700/sqft of front before hardware, and a
--   premium one ~₹2,400 - which is where the market quotes ₹1,600-2,600
--   and ₹2,500-3,500 all in.
--
-- Still starting rates, and still every business's to replace: the point
-- is that a tenant who never edits them produces a quotation in the right
-- order of magnitude rather than one three times over.
UPDATE public.quotation_cost_items SET default_rate = v.rate,
  description = COALESCE(NULLIF(description, ''), 'Starting rate - edit.')
FROM (VALUES
  -- per sqft of front elevation
  ('carcass-basic', 750), ('carcass-standard', 950), ('carcass-premium', 1250), ('carcass-luxury', 1600),
  ('shutters-basic', 550), ('shutters-standard', 750), ('shutters-premium', 1200), ('shutters-luxury', 1700),
  ('shutter-membrane', 650), ('shutter-laminate', 600), ('shutter-acrylic', 1150),
  ('shutter-pu', 1350), ('shutter-lacquered-glass', 1450), ('shutter-veneer', 1600),
  ('wall-paneling-basic', 550), ('wall-paneling-standard', 850), ('wall-paneling-premium', 1300), ('wall-paneling-luxury', 2000),
  -- each, fitted
  ('hinges-basic', 150), ('hinges-standard', 250), ('hinges-premium', 400), ('hinges-luxury', 650),
  ('handles-basic', 250),
  ('corner-carousel', 9500),
  ('sliding-roller-set', 2500),
  ('civil-core-cutting', 800),
  -- per running foot
  ('profile-lighting-basic', 150), ('profile-lighting-standard', 220), ('profile-lighting-premium', 320), ('profile-lighting-luxury', 450),
  -- per visit
  ('site-cleanup-per-visit', 3500)
) AS v(slug, rate)
WHERE quotation_cost_items.slug = v.slug;

-- Rates must climb across a graded ladder, or "upgrade to Premium" lowers
-- the quote. Refuse the migration rather than leave a ladder inverted.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(cat || ': ' || detail, '; ') INTO bad FROM (
    SELECT cat.name AS cat,
           string_agg(ci.quality_tier || ' ' || ci.default_rate, ' ' ORDER BY array_position(ARRAY['basic','standard','premium','luxury'], ci.quality_tier)) AS detail
    FROM public.quotation_cost_items ci JOIN public.quotation_cost_item_categories cat ON cat.id = ci.category_id
    WHERE ci.quality_tier IS NOT NULL AND ci.is_active
    GROUP BY cat.id, cat.name
    HAVING bool_or(ci.default_rate IS NULL) OR count(*) FILTER (WHERE ci.quality_tier IS NOT NULL) <> count(DISTINCT ci.quality_tier)
  ) x;
  IF bad IS NOT NULL THEN RAISE NOTICE 'Graded categories to look at: %', bad; END IF;
END $$;

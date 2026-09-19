-- Catalogue completion (2026-09-19), agreed with the user after the
-- Scope-to-Quotation handbook listed the gaps a kitchen or a full-home
-- quotation runs into. Everything here is an ordinary catalogue entry the
-- tenant can rename, reprice or retire; nothing is enforced by code.
--
-- Idempotent per tenant: keyed on (tenant_id, slug), ON CONFLICT DO NOTHING,
-- so a tenant that already has an item under that slug keeps their own.
-- Rates are STARTING VALUES in INR, marked as such in each description.
-- New categories are untiered (quality_tier NULL) so Reprice - which moves a
-- category up or down the Basic/Standard/Premium/Luxury ladder and needs
-- exactly one family per graded category - leaves them alone.
--
-- Runs for every tenant that has a catalogue (any component_types row).

DO $$
DECLARE
  t record;
  v_cat uuid;
  v_ct uuid;
  v_tpl uuid;
  v_space uuid[];
  v_order int;
  cat_row record;
  item_row record;
  comp_row record;
  map_row record;
BEGIN
FOR t IN SELECT DISTINCT tenant_id FROM public.component_types LOOP

  ---------------------------------------------------------------- categories
  FOR cat_row IN SELECT * FROM (VALUES
    ('countertop',        'Countertop',          'Granite, quartz, nano-white on the base units. Priced per sqft or per rft of run.', 100),
    ('dado-backsplash',   'Dado & Backsplash',   'The wall band between counter and wall units. None behind a tall unit.', 101),
    ('shutter-finishes',  'Shutters by Finish',  'The shutter priced by the finish the customer chooses. Use these OR the graded Shutters ladder for a line, not both.', 102),
    ('appliances',        'Appliances',          'Hob, chimney, oven, sink, faucet. Often bought by the customer - mark the item Done by: Client on the project.', 103),
    ('sliding-systems',   'Sliding Systems',     'Tracks and rollers for sliding wardrobes, in place of hinges.', 104),
    ('profiles',          'Profiles',            'Gola / J-profiles along a run, in place of handles. Per running foot.', 105),
    ('internals',         'Internals',           'What goes inside a carcass: shelves, rods, drawers of each type, trays, pull-outs.', 106),
    ('glass-mirror',      'Glass & Mirror',      'Mirror on or inside a door; glass shutters on a display or crockery unit.', 107),
    ('false-ceiling',     'False Ceiling',       'Gypsum / POP ceiling, coves and cove light.', 108),
    ('painting',          'Painting',            'Putty, primer, emulsion, texture. Per sqft of wall.', 109),
    ('electrical',        'Electrical',          'Points, wiring and boards added for the new layout.', 110),
    ('civil-plumbing',    'Civil & Plumbing',    'Breaking, making, moving lines.', 111),
    ('soft-furnishings',  'Soft Furnishings',    'Wallpaper, blinds, curtains.', 112)
  ) AS c(slug, name, description, display_order) LOOP
    INSERT INTO public.quotation_cost_item_categories (tenant_id, name, slug, description, display_order, is_active, is_charge)
    VALUES (t.tenant_id, cat_row.name, cat_row.slug, cat_row.description, cat_row.display_order, true, false)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
  END LOOP;

  ---------------------------------------------------------------- cost items
  -- (category slug, item slug, name, unit, starting rate, description)
  FOR item_row IN SELECT * FROM (VALUES
    -- Countertop
    ('countertop','countertop-granite','Countertop - Granite','sqft',250,'Starting rate - edit. Per sqft of counter (run × depth).'),
    ('countertop','countertop-quartz','Countertop - Quartz','sqft',650,'Starting rate - edit.'),
    ('countertop','countertop-nano-white','Countertop - Nano White','sqft',750,'Starting rate - edit.'),
    ('countertop','countertop-sink-cutout','Sink / Hob Cut-out','nos',1500,'Starting rate - edit. Per cut-out.'),
    -- Dado
    ('dado-backsplash','dado-ceramic-tile','Dado - Ceramic Tile','sqft',180,'Starting rate - edit. Run × dado height, less the tall unit.'),
    ('dado-backsplash','dado-lacquered-glass','Dado - Lacquered Glass','sqft',450,'Starting rate - edit.'),
    ('dado-backsplash','dado-laminate','Dado - Laminate','sqft',220,'Starting rate - edit.'),
    -- Shutters by finish (full shutter price, per sqft of shutter area)
    ('shutter-finishes','shutter-membrane','Shutter - Membrane','sqft',1600,'Starting rate - edit. Full shutter, membrane finish. Use instead of the graded Shutters item on a line.'),
    ('shutter-finishes','shutter-laminate','Shutter - Laminate','sqft',1900,'Starting rate - edit. Full shutter, laminate finish.'),
    ('shutter-finishes','shutter-acrylic','Shutter - Acrylic','sqft',3200,'Starting rate - edit. Full shutter, high-gloss acrylic.'),
    ('shutter-finishes','shutter-pu','Shutter - PU','sqft',3400,'Starting rate - edit. Full shutter, PU paint finish.'),
    ('shutter-finishes','shutter-veneer','Shutter - Veneer','sqft',4200,'Starting rate - edit. Full shutter, natural veneer.'),
    ('shutter-finishes','shutter-lacquered-glass','Shutter - Lacquered Glass','sqft',3800,'Starting rate - edit.'),
    -- Appliances
    ('appliances','appliance-chimney-90','Chimney - 90 cm','nos',18000,'Starting rate - edit. Often client-supplied.'),
    ('appliances','appliance-hob-4','Hob - 4 burner','nos',12000,'Starting rate - edit. Often client-supplied.'),
    ('appliances','appliance-oven','Built-in Oven','nos',32000,'Starting rate - edit.'),
    ('appliances','appliance-microwave','Built-in Microwave','nos',15000,'Starting rate - edit.'),
    ('appliances','appliance-dishwasher','Dishwasher','nos',45000,'Starting rate - edit.'),
    ('appliances','appliance-sink','Sink - Single Bowl','nos',8000,'Starting rate - edit.'),
    ('appliances','appliance-faucet','Faucet','nos',4500,'Starting rate - edit.'),
    -- Sliding systems
    ('sliding-systems','sliding-track','Sliding Track','rft',350,'Starting rate - edit. Top and bottom rail: 2 × width.'),
    ('sliding-systems','sliding-roller-set','Roller Set','nos',1200,'Starting rate - edit. Per sliding shutter.'),
    ('sliding-systems','sliding-damper','Soft-close Damper','nos',900,'Starting rate - edit. Per sliding shutter.'),
    -- Profiles
    ('profiles','profile-gola','Gola Profile','rft',450,'Starting rate - edit. Along base and wall runs, instead of handles.'),
    ('profiles','profile-j','J-Profile','rft',380,'Starting rate - edit.'),
    ('profiles','profile-end-caps','Profile End Caps','nos',150,'Starting rate - edit.'),
    -- Internals
    ('internals','internal-shelf','Shelf','nos',900,'Starting rate - edit. Per shelf; or price a Shelf (sqft) item per shelves × width × depth.'),
    ('internals','internal-shelf-area','Shelf - per area','sqft',180,'Starting rate - edit. Per sqft of shelf; use a rule quantity shelves × width × shelf_depth.'),
    ('internals','internal-hanging-rod','Hanging Rod','rft',250,'Starting rate - edit. Per running foot.'),
    ('internals','internal-tandem-box','Tandem Box Drawer','nos',3200,'Starting rate - edit. Count on the room sheet.'),
    ('internals','internal-wooden-drawer','Wooden Drawer','nos',1900,'Starting rate - edit. Count on the room sheet.'),
    ('internals','internal-trouser-pullout','Trouser Pull-out','nos',4500,'Starting rate - edit.'),
    ('internals','internal-tie-belt-rack','Tie & Belt Rack','nos',2200,'Starting rate - edit.'),
    ('internals','internal-wicker-basket','Wicker Basket','nos',1400,'Starting rate - edit.'),
    ('internals','internal-cutlery-tray','Cutlery Tray','nos',1800,'Starting rate - edit.'),
    ('internals','internal-bottle-pullout','Bottle Pull-out','nos',6500,'Starting rate - edit.'),
    ('internals','internal-plate-rack','Plate Rack','nos',2800,'Starting rate - edit.'),
    ('internals','internal-pantry-pullout','Pantry Pull-out','nos',18000,'Starting rate - edit. Tall unit.'),
    ('internals','internal-mirror','Internal Mirror','sqft',450,'Starting rate - edit. Inside a wardrobe door.'),
    -- Glass & mirror
    ('glass-mirror','glass-mirror','Mirror','sqft',380,'Starting rate - edit.'),
    ('glass-mirror','glass-frosted-shutter','Frosted Glass Shutter','sqft',1200,'Starting rate - edit.'),
    -- False ceiling
    ('false-ceiling','ceiling-gypsum','Gypsum Ceiling','sqft',95,'Starting rate - edit. Per sqft of ceiling.'),
    ('false-ceiling','ceiling-pop-cove','POP Cove','rft',180,'Starting rate - edit. Per running foot of cove.'),
    ('false-ceiling','ceiling-cove-light','Cove Light','rft',220,'Starting rate - edit.'),
    -- Painting
    ('painting','paint-emulsion','Emulsion - 2 coats','sqft',28,'Starting rate - edit. Per sqft of wall.'),
    ('painting','paint-putty-primer','Putty & Primer','sqft',18,'Starting rate - edit.'),
    ('painting','paint-texture','Texture Paint','sqft',120,'Starting rate - edit.'),
    -- Electrical
    ('electrical','elec-point','Electrical Point','nos',1200,'Starting rate - edit.'),
    ('electrical','elec-wiring','Wiring','rft',90,'Starting rate - edit.'),
    ('electrical','elec-switchboard','Switchboard','nos',2500,'Starting rate - edit.'),
    -- Civil & plumbing
    ('civil-plumbing','civil-demolition','Wall Demolition','sqft',120,'Starting rate - edit.'),
    ('civil-plumbing','civil-plumbing-line','Plumbing Line','rft',350,'Starting rate - edit.'),
    ('civil-plumbing','civil-core-cutting','Core Cutting','nos',1800,'Starting rate - edit.'),
    -- Soft furnishings
    ('soft-furnishings','soft-wallpaper','Wallpaper','sqft',110,'Starting rate - edit.'),
    ('soft-furnishings','soft-roller-blinds','Roller Blinds','sqft',180,'Starting rate - edit.'),
    ('soft-furnishings','soft-curtain-stitching','Curtain Stitching','nos',450,'Starting rate - edit. Per panel.')
  ) AS i(cat_slug, slug, name, unit_code, rate, description) LOOP
    SELECT id INTO v_cat FROM public.quotation_cost_item_categories WHERE tenant_id = t.tenant_id AND slug = item_row.cat_slug;
    IF v_cat IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.quotation_cost_items (tenant_id, category_id, name, slug, unit_code, default_rate, quality_tier, description, is_active)
    VALUES (t.tenant_id, v_cat, item_row.name, item_row.slug, item_row.unit_code, item_row.rate, NULL, item_row.description, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
  END LOOP;

  ---------------------------------------------------------------- component types
  -- (slug, name, description, applicable space slugs - empty = any space)
  SELECT COALESCE(MAX(display_order), 0) INTO v_order FROM public.component_types WHERE tenant_id = t.tenant_id;
  FOR comp_row IN SELECT * FROM (VALUES
    ('kitchen-island',    'Kitchen Island',            'A free-standing base run with its own counter.',            ARRAY['kitchen','dining']),
    ('breakfast-counter', 'Breakfast Counter',         'A counter with seating overhang, off the kitchen run.',      ARRAY['kitchen','dining']),
    ('loft',              'Loft',                      'Storage up to the ceiling, on its own or above a wardrobe.', ARRAY['bedroom','passage','utility','foyer','store-room']),
    ('pooja-unit',        'Pooja Unit',                'Mandir unit.',                                              ARRAY['pooja-room','living-room']),
    ('bookshelf',         'Bookshelf / Display Unit',  'Open shelving priced by face area.',                        ARRAY['living-room','study-room']),
    ('utility-unit',      'Utility Unit',              'The wet-area base run in a utility.',                        ARRAY['utility']),
    ('painting',          'Painting',                  'Wall painting for the room, as a line of scope.',           ARRAY[]::text[]),
    ('electrical-work',   'Electrical Work',           'Points and wiring for the room.',                            ARRAY[]::text[]),
    ('civil-work',        'Civil & Plumbing Work',     'Breaking, making, moving lines.',                            ARRAY[]::text[]),
    ('curtains-blinds',   'Curtains & Blinds',         'Soft furnishing per window.',                                ARRAY['bedroom','living-room','study-room','dining'])
  ) AS c(slug, name, description, spaces) LOOP
    v_space := NULL;
    IF array_length(comp_row.spaces, 1) IS NOT NULL THEN
      SELECT array_agg(id) INTO v_space FROM public.space_types WHERE tenant_id = t.tenant_id AND slug = ANY (comp_row.spaces);
    END IF;
    v_order := v_order + 1;
    INSERT INTO public.component_types (tenant_id, name, slug, description, applicable_space_types, display_order, is_active, is_system)
    VALUES (t.tenant_id, comp_row.name, comp_row.slug, comp_row.description, v_space, v_order, true, false)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
  END LOOP;

  ---------------------------------------------------------------- templates: the options menu per component type
  -- One component-level template per component type, listing every cost
  -- item that type can carry (by category, plus named internals). The room
  -- sheet reads the union of active templates, so this is what appears as
  -- options. A tenant prunes or extends these like any template.
  FOR map_row IN SELECT * FROM (VALUES
    ('kitchen-base-unit',   ARRAY['shutters','carcass','shutter-finishes','hinges','handles','drawer-systems','profiles','countertop','dado-backsplash','profile-lighting','labour'],
                            ARRAY['internal-tandem-box','internal-wooden-drawer','internal-cutlery-tray','internal-bottle-pullout','internal-plate-rack','internal-wicker-basket','appliance-sink','appliance-faucet','appliance-hob-4','appliance-chimney-90','appliance-dishwasher','corner-carousel','toe-board','tandem-drawer-runner','organizer-basket-large','organizer-basket-small','led-light-strip-3ft','led-light-strip-6ft']),
    ('kitchen-wall-unit',   ARRAY['shutters','carcass','shutter-finishes','hinges','handles','profiles','profile-lighting','labour'],
                            ARRAY['internal-shelf','internal-plate-rack','appliance-chimney-90']),
    ('kitchen-tall-unit',   ARRAY['shutters','carcass','shutter-finishes','hinges','handles','labour'],
                            ARRAY['internal-pantry-pullout','internal-shelf','appliance-oven','appliance-microwave']),
    ('kitchen-loft-unit',   ARRAY['shutters','carcass','shutter-finishes','hinges','handles'], ARRAY[]::text[]),
    ('kitchen-island',      ARRAY['shutters','carcass','shutter-finishes','handles','drawer-systems','countertop','profiles','labour'], ARRAY['internal-tandem-box','internal-wooden-drawer']),
    ('breakfast-counter',   ARRAY['carcass','shutter-finishes','countertop','labour'], ARRAY[]::text[]),
    ('utility-unit',        ARRAY['shutters','carcass','shutter-finishes','hinges','handles','countertop','labour'], ARRAY['appliance-sink','appliance-faucet']),
    ('wardrobe---openable', ARRAY['shutters','carcass','shutter-finishes','hinges','handles','drawer-systems','glass-mirror','profile-lighting','labour'],
                            ARRAY['internal-shelf','internal-shelf-area','internal-hanging-rod','internal-tandem-box','internal-wooden-drawer','internal-trouser-pullout','internal-tie-belt-rack','internal-mirror']),
    ('wardrobe-with-loft---openable', ARRAY['shutters','carcass','shutter-finishes','hinges','handles','drawer-systems','glass-mirror','profile-lighting','labour'],
                            ARRAY['internal-shelf','internal-shelf-area','internal-hanging-rod','internal-tandem-box','internal-wooden-drawer','internal-trouser-pullout','internal-tie-belt-rack','internal-mirror']),
    ('wardrobe---sliding',  ARRAY['shutters','carcass','shutter-finishes','sliding-systems','handles','drawer-systems','glass-mirror','profile-lighting','labour'],
                            ARRAY['internal-shelf','internal-shelf-area','internal-hanging-rod','internal-tandem-box','internal-wooden-drawer','internal-trouser-pullout','internal-tie-belt-rack','internal-mirror']),
    ('modular-wardrobe-with-loft---sliding', ARRAY['shutters','carcass','shutter-finishes','sliding-systems','handles','drawer-systems','glass-mirror','profile-lighting','labour'],
                            ARRAY['internal-shelf','internal-shelf-area','internal-hanging-rod','internal-tandem-box','internal-wooden-drawer','internal-trouser-pullout','internal-tie-belt-rack','internal-mirror']),
    ('loft',                ARRAY['shutters','carcass','shutter-finishes','hinges','handles'], ARRAY[]::text[]),
    ('tv-unit',             ARRAY['shutters','carcass','shutter-finishes','hinges','handles','drawer-systems','glass-mirror','profile-lighting','wall-paneling','labour'], ARRAY['internal-shelf','internal-shelf-area']),
    ('crockery-unit',       ARRAY['shutters','carcass','shutter-finishes','hinges','handles','drawer-systems','glass-mirror','profile-lighting','labour'], ARRAY['internal-shelf','internal-shelf-area','internal-plate-rack']),
    ('shoe-rack',           ARRAY['shutters','carcass','shutter-finishes','hinges','handles','labour'], ARRAY['internal-shelf']),
    ('study-table',         ARRAY['carcass','shutter-finishes','handles','drawer-systems','labour'], ARRAY['internal-shelf','internal-wooden-drawer','internal-tandem-box']),
    ('vanity',              ARRAY['shutters','carcass','shutter-finishes','hinges','handles','drawer-systems','countertop','glass-mirror','labour'], ARRAY['appliance-faucet']),
    ('dressing-table',      ARRAY['carcass','shutter-finishes','handles','drawer-systems','glass-mirror','profile-lighting','labour'], ARRAY['internal-wooden-drawer']),
    ('console-table',       ARRAY['carcass','shutter-finishes','handles','drawer-systems','labour'], ARRAY[]::text[]),
    ('bar-unit',            ARRAY['shutters','carcass','shutter-finishes','hinges','handles','glass-mirror','profile-lighting','labour'], ARRAY['internal-shelf','internal-bottle-pullout']),
    ('bookshelf',           ARRAY['carcass','shutter-finishes','profile-lighting','labour'], ARRAY['internal-shelf','internal-shelf-area']),
    ('pooja-unit',          ARRAY['shutters','carcass','shutter-finishes','hinges','handles','glass-mirror','profile-lighting','labour'], ARRAY['internal-shelf','internal-wooden-drawer']),
    ('bed',                 ARRAY['carcass','shutter-finishes','drawer-systems','labour'], ARRAY['internal-wooden-drawer']),
    ('wall-paneling',       ARRAY['wall-paneling','profile-lighting','labour'], ARRAY[]::text[]),
    ('false-ceiling',       ARRAY['false-ceiling','profile-lighting'], ARRAY['elec-point']),
    ('painting',            ARRAY['painting'], ARRAY[]::text[]),
    ('electrical-work',     ARRAY['electrical'], ARRAY[]::text[]),
    ('civil-work',          ARRAY['civil-plumbing'], ARRAY[]::text[]),
    ('curtains-blinds',     ARRAY['soft-furnishings'], ARRAY[]::text[])
  ) AS m(comp_slug, cat_slugs, item_slugs) LOOP
    SELECT id INTO v_ct FROM public.component_types WHERE tenant_id = t.tenant_id AND slug = map_row.comp_slug;
    IF v_ct IS NULL THEN CONTINUE; END IF;
    -- One menu template per component type; skip if one already exists.
    SELECT id INTO v_tpl FROM public.quotation_templates
      WHERE tenant_id = t.tenant_id AND level = 'component' AND name = (SELECT name FROM public.component_types WHERE id = v_ct) || ' - Options Menu';
    IF v_tpl IS NOT NULL THEN CONTINUE; END IF;
    INSERT INTO public.quotation_templates (tenant_id, name, description, template_data, is_active, level)
    VALUES (t.tenant_id,
            (SELECT name FROM public.component_types WHERE id = v_ct) || ' - Options Menu',
            'Every cost item this component can carry - what the room sheet offers as options. Prune or extend freely. Seeded 2026-09-19.',
            '{}'::jsonb, true, 'component')
    RETURNING id INTO v_tpl;
    INSERT INTO public.quotation_template_line_items (template_id, component_type_id, cost_item_id, display_order, measurement_unit)
    SELECT v_tpl, v_ct, ci.id, row_number() OVER (ORDER BY cat.display_order, ci.display_order, ci.name), 'ft'
    FROM public.quotation_cost_items ci
    JOIN public.quotation_cost_item_categories cat ON cat.id = ci.category_id
    WHERE ci.tenant_id = t.tenant_id AND ci.is_active
      AND (cat.slug = ANY (map_row.cat_slugs) OR ci.slug = ANY (map_row.item_slugs));
  END LOOP;

  ---------------------------------------------------------------- a rule for the new Loft
  UPDATE public.component_types SET config_schema = '{
    "fields": [
      {"key": "width", "label": "Width", "kind": "length"},
      {"key": "loft_height", "label": "Loft height", "kind": "length", "hint": "Wall-unit top or wardrobe top to ceiling"},
      {"key": "shutters", "label": "Shutters", "kind": "count"}
    ],
    "quantities": [
      {"key": "loft_sqft", "label": "Loft area", "unit_code": "sqft", "formula": "width * loft_height"},
      {"key": "hinges", "label": "Hinges", "unit_code": "nos", "formula": "shutters * 2"}
    ]
  }'::jsonb
  WHERE tenant_id = t.tenant_id AND slug = 'loft' AND (config_schema IS NULL OR config_schema = '{}'::jsonb);

END LOOP;
END $$;

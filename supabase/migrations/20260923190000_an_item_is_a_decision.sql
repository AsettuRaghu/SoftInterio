-- An item is an answer a customer gives, not a thing in a warehouse.
--
-- Read against that, 110 active items held three kinds of row that are not
-- answers to anything, and each was reachable on the room sheet:
--
--   PARTS of something already priced. A tandem runner is inside a Tandem
--   Box Drawer; end caps come with the profile; a toe board is on every base
--   unit; a sink cut-out is a fabrication step. Nobody is asked about them,
--   and pricing them beside their parent bills the same thing twice.
--
--   PARTS OFFERED AS A SYSTEM. Roller Set + Sliding Track + Soft-close
--   Damper made the seller assemble a sliding system from three taps. A
--   customer answers "which sliding system?" once, so it becomes one graded
--   family like Drawer Systems - 3000/4500/6500/9500 a door, against the
--   ~4450 the three parts came to for a two-door 6ft wardrobe.
--
--   SECOND ANSWERS TO A LIVE QUESTION. Cove Light (rft 220) is Profile
--   Lighting - Standard (rft 220) to the rupee and sat on the same false
--   ceiling; Under-cabinet Light (rft 350) sat on the same counter run as
--   the same ladder; the graded Shutters family duplicates Shutters by
--   Finish, which every menu actually uses. "A menu carries one or the
--   other, never both" - broken three more times after the LED strips.
--
-- Appliances keep their rows and lose their offers: they are products with
-- brands and prices, they are billed on their own quotation, and a generic
-- "Hob - 4 burner" is not an answer anyone gives (2026-09-23).
--
-- DELETED where nothing ever used the row; DEACTIVATED where a quotation
-- line points at it. A printed quotation reads the Material column from the
-- item's live description, so deleting a quoted item silently rewrites a
-- document somebody has already been sent.

DO $$
DECLARE
  v_deleted integer := 0;
  v_off integer := 0;
  v_deact integer := 0;
  v_new integer := 0;
  v_blocked text;
  -- Not answers to anything. Deleted outright where unused.
  k_gone text[] := ARRAY[
    'toe-board', 'profile-end-caps', 'countertop-sink-cutout', 'internal-shelf-area',
    'ceiling-cove-light', 'light-under-cabinet',
    'sliding-roller-set', 'sliding-track', 'sliding-damper'
  ];
  -- Same verdict, but quoted before - deactivated so history still prints.
  k_retire text[] := ARRAY[
    'tandem-drawer-runner', 'shutters-basic', 'shutters-standard', 'shutters-premium', 'shutters-luxury'
  ];
  -- Sold separately: kept, but off every room sheet.
  k_appliance text[] := ARRAY[
    'appliance-microwave', 'appliance-oven', 'chimney', 'appliance-dishwasher',
    'appliance-faucet', 'appliance-hob-4', 'appliance-sink'
  ];
BEGIN
  -- Refuse rather than guess if something in the delete list has been used
  -- since this was checked.
  SELECT string_agg(DISTINCT ci.name, ', ') INTO v_blocked
  FROM quotation_cost_items ci
  WHERE ci.slug = ANY (k_gone)
    AND (EXISTS (SELECT 1 FROM quotation_line_items li WHERE li.quotation_cost_item_id = ci.id)
      OR EXISTS (SELECT 1 FROM property_scope_items si WHERE si.cost_item_id = ci.id)
      OR EXISTS (SELECT 1 FROM stock_materials sm WHERE sm.cost_item_id = ci.id));
  IF v_blocked IS NOT NULL THEN
    RAISE EXCEPTION 'Refusing: % now has history. Move it to the deactivate list instead of deleting it.', v_blocked;
  END IF;

  -- The sliding system, as one decision, wherever its parts were offered.
  INSERT INTO quotation_cost_items (tenant_id, category_id, name, slug, unit_code, default_rate, quality_tier, description, display_order, is_active)
  SELECT c.tenant_id, c.id, x.name, x.slug, 'nos', x.rate, x.tier,
         'Starting rate - edit. Track, rollers and dampers for one sliding door.', x.ord, true
  FROM quotation_cost_item_categories c
  CROSS JOIN (VALUES
      ('Sliding System - Basic',   'sliding-system-basic',   3000::numeric, 'basic',    10),
      ('Sliding System - Standard','sliding-system-standard',4500::numeric, 'standard', 20),
      ('Sliding System - Premium', 'sliding-system-premium', 6500::numeric, 'premium',  30),
      ('Sliding System - Luxury',  'sliding-system-luxury',  9500::numeric, 'luxury',   40)
    ) AS x(name, slug, rate, tier, ord)
  WHERE c.slug = 'sliding-systems'
    AND NOT EXISTS (SELECT 1 FROM quotation_cost_items e WHERE e.tenant_id = c.tenant_id AND e.slug = x.slug);
  GET DIAGNOSTICS v_new = ROW_COUNT;

  INSERT INTO component_type_offers (tenant_id, component_type_id, cost_item_id, quantity_key, auto, display_order)
  SELECT DISTINCT ni.tenant_id, ct.id, ni.id, NULL, false, 50
  FROM quotation_cost_items ni
  JOIN component_types ct ON ct.tenant_id = ni.tenant_id
   AND ct.slug IN ('wardrobe---sliding', 'modular-wardrobe-with-loft---sliding')
  WHERE ni.slug LIKE 'sliding-system-%'
    AND NOT EXISTS (SELECT 1 FROM component_type_offers o WHERE o.component_type_id = ct.id AND o.cost_item_id = ni.id);

  -- Off every room sheet: the three lists plus appliances.
  DELETE FROM component_type_offers o
  USING quotation_cost_items ci
  WHERE ci.id = o.cost_item_id
    AND ci.slug = ANY (k_gone || k_retire || k_appliance);
  GET DIAGNOSTICS v_off = ROW_COUNT;

  UPDATE quotation_cost_items
  SET is_active = false,
      description = coalesce(description || ' ', '')
        || 'Retired 2026-09-23: not a decision a customer is asked to make. Kept because quotations reference it.',
      updated_at = now()
  WHERE slug = ANY (k_retire) AND is_active;
  GET DIAGNOSTICS v_deact = ROW_COUNT;

  DELETE FROM quotation_cost_items WHERE slug = ANY (k_gone);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Hardware was split into Hinges and Handles long ago and has held nothing
  -- since; an empty category is an empty question on the sheet.
  DELETE FROM quotation_cost_item_categories c
  WHERE c.slug = 'hardware'
    AND NOT EXISTS (SELECT 1 FROM quotation_cost_items i WHERE i.category_id = c.id);

  RAISE NOTICE 'items: % deleted, % deactivated, % created (sliding system); % offer rows removed.',
    v_deleted, v_deact, v_new, v_off;
END $$;

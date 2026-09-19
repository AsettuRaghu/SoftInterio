-- How many of a chosen item, for items priced per piece: two wooden drawers,
-- one tandem box, one trouser pull-out are three cost items with their own
-- counts on the same wardrobe. Items priced per a rule quantity (shutter
-- area, hinges) ignore this - the rule already knows.
ALTER TABLE public.property_scope_items
  ADD COLUMN IF NOT EXISTS choice_quantity numeric(10,2);
COMMENT ON COLUMN public.property_scope_items.choice_quantity IS
  'On a cost-item row priced per piece: how many. NULL = 1.';

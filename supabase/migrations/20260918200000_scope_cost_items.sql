-- Scope = Space > Component > Cost item (2026-09-18, decided with the user).
--
-- A cost item is a third kind of row in property_scope_items, hanging off
-- its component: WHICH items the customer is considering or has chosen.
-- Never a rate, a quantity or a total - the quotation holds how much; the
-- scope holds what. "Bring in from scope" copies chosen items as line items.
-- Same table, so ordering, Done-by and the change log apply unchanged.

ALTER TABLE public.property_scope_items
  ADD COLUMN IF NOT EXISTS cost_item_id uuid REFERENCES public.quotation_cost_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS choice_status text;

ALTER TABLE public.property_scope_items
  DROP CONSTRAINT IF EXISTS property_scope_items_cost_item_shape;
ALTER TABLE public.property_scope_items
  ADD CONSTRAINT property_scope_items_cost_item_shape CHECK (
    cost_item_id IS NULL
    OR (parent_id IS NOT NULL AND space_type_id IS NULL AND component_type_id IS NULL
        AND choice_status IN ('considering', 'chosen'))
  );

-- One row per cost item under a component.
CREATE UNIQUE INDEX IF NOT EXISTS property_scope_items_one_choice
  ON public.property_scope_items (parent_id, cost_item_id)
  WHERE cost_item_id IS NOT NULL;

COMMENT ON COLUMN public.property_scope_items.cost_item_id IS
  'Set on a cost-item row (under a component): which catalogue item; choice_status says considering or chosen.';

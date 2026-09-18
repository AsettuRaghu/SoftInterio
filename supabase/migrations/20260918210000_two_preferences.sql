-- Two preferences, not "considering / chosen" (2026-09-18): an option on a
-- component is preference 1 or preference 2. Preference 1 is what a
-- quotation starts from; preference 2 is recorded for the conversation
-- and, later, for an alternative quotation.
ALTER TABLE public.property_scope_items DROP CONSTRAINT IF EXISTS property_scope_items_cost_item_shape;
UPDATE public.property_scope_items SET choice_status = 'p1' WHERE choice_status = 'chosen';
UPDATE public.property_scope_items SET choice_status = 'p2' WHERE choice_status = 'considering';
ALTER TABLE public.property_scope_items
  ADD CONSTRAINT property_scope_items_cost_item_shape CHECK (
    cost_item_id IS NULL
    OR (parent_id IS NOT NULL AND space_type_id IS NULL AND component_type_id IS NULL
        AND choice_status IN ('p1', 'p2'))
  );

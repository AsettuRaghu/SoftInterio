-- A reference picture or drawing can hang off one space or component of the
-- scope. On its own because a new enum value cannot be used in the same
-- transaction that adds it.
ALTER TYPE public.document_linked_type ADD VALUE IF NOT EXISTS 'scope_item';

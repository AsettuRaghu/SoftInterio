-- A starred reference is shown first - the picture the customer pointed at.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;
ALTER TABLE public.scope_item_library_pins ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;

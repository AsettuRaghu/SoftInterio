-- Scope, slices 3 and 4 (2026-09-18). See docs/plans/scope.md.
--
--  * preferences on the brief: style, finishes, budget band, open to
--    carpentry, timeline notes - the sales-cycle memory;
--  * per row: a preferred finish, and for anything not ours what the client
--    or vendor is supplying and by when (the project register);
--  * a discussion per row (and one at property level), each entry a note or
--    a decision, optionally turned into a task;
--  * library entries pinned to a row ("they liked this one");
--  * a change log on every row, written by trigger so no route can skip it.
--    changed_by is auth.uid() - every scope write goes through the session
--    client, so it is there. The route adds the reason afterwards.

-- 1. Preferences
ALTER TABLE public.property_scope_brief
  ADD COLUMN IF NOT EXISTS style_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_finishes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS budget_band text,
  ADD COLUMN IF NOT EXISTS open_to_carpentry boolean,
  ADD COLUMN IF NOT EXISTS timeline_notes text;

-- 2. The register
ALTER TABLE public.property_scope_items
  ADD COLUMN IF NOT EXISTS preferred_finish text,
  ADD COLUMN IF NOT EXISTS supplied_detail text,
  ADD COLUMN IF NOT EXISTS supplied_expected_by date;
COMMENT ON COLUMN public.property_scope_items.supplied_detail IS
  'For a client/vendor row: make, model, size - what is arriving from them.';

-- 3. Discussion
CREATE TABLE IF NOT EXISTS public.scope_item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  -- NULL = about the scope as a whole
  scope_item_id uuid REFERENCES public.property_scope_items(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_decision boolean NOT NULL DEFAULT false,
  needs_rework boolean NOT NULL DEFAULT false,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scope_item_comments_item ON public.scope_item_comments (scope_item_id, created_at);
CREATE INDEX IF NOT EXISTS scope_item_comments_property ON public.scope_item_comments (property_id, created_at);
ALTER TABLE public.scope_item_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scope_item_comments_tenant_access ON public.scope_item_comments;
CREATE POLICY scope_item_comments_tenant_access ON public.scope_item_comments
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- 4. Pins
CREATE TABLE IF NOT EXISTS public.scope_item_library_pins (
  scope_item_id uuid NOT NULL REFERENCES public.property_scope_items(id) ON DELETE CASCADE,
  library_entry_id uuid NOT NULL REFERENCES public.library_entries(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pinned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_item_id, library_entry_id)
);
ALTER TABLE public.scope_item_library_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scope_item_library_pins_tenant_access ON public.scope_item_library_pins;
CREATE POLICY scope_item_library_pins_tenant_access ON public.scope_item_library_pins
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- 5. Change log
CREATE TABLE IF NOT EXISTS public.property_scope_item_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  property_id uuid NOT NULL,
  scope_item_id uuid NOT NULL,
  item_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('added', 'changed', 'removed')),
  -- { field: { from, to } } for a change; the row for added/removed
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS psih_item ON public.property_scope_item_history (scope_item_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS psih_property ON public.property_scope_item_history (property_id, changed_at DESC);
ALTER TABLE public.property_scope_item_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS psih_tenant_read ON public.property_scope_item_history;
CREATE POLICY psih_tenant_read ON public.property_scope_item_history
  FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
-- The route may add a reason to the row the trigger just wrote; nothing else
-- writes here from the application.
DROP POLICY IF EXISTS psih_tenant_reason ON public.property_scope_item_history;
CREATE POLICY psih_tenant_reason ON public.property_scope_item_history
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE OR REPLACE FUNCTION public.trg_scope_item_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
  v_col text;
  v_old jsonb;
  v_new jsonb;
  -- What a person would call a change to the scope. Ordering and timestamps
  -- are not.
  v_tracked text[] := ARRAY['name','length','width','height','measurement_unit',
    'measurement_status','measurement_source','quality_tier','scope_owner',
    'scope_vendor_name','preferred_finish','supplied_detail','supplied_expected_by','notes','parent_id'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO property_scope_item_history (tenant_id, property_id, scope_item_id, item_name, action, changes, changed_by)
    VALUES (NEW.tenant_id, NEW.property_id, NEW.id, NEW.name, 'added',
            jsonb_build_object('scope_owner', NEW.scope_owner, 'quality_tier', NEW.quality_tier), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO property_scope_item_history (tenant_id, property_id, scope_item_id, item_name, action, changes, changed_by)
    VALUES (OLD.tenant_id, OLD.property_id, OLD.id, OLD.name, 'removed', '{}'::jsonb, auth.uid());
    RETURN OLD;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);
  FOREACH v_col IN ARRAY v_tracked LOOP
    IF v_old -> v_col IS DISTINCT FROM v_new -> v_col THEN
      v_changes := v_changes || jsonb_build_object(v_col, jsonb_build_object('from', v_old -> v_col, 'to', v_new -> v_col));
    END IF;
  END LOOP;
  IF v_changes <> '{}'::jsonb THEN
    INSERT INTO property_scope_item_history (tenant_id, property_id, scope_item_id, item_name, action, changes, changed_by)
    VALUES (NEW.tenant_id, NEW.property_id, NEW.id, NEW.name, 'changed', v_changes, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_scope_items_history ON public.property_scope_items;
CREATE TRIGGER trg_property_scope_items_history
  AFTER INSERT OR UPDATE OR DELETE ON public.property_scope_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_scope_item_history();

-- The delete trigger fires after the cascade has already removed the row's
-- children, so a removed space logs its own row and each child logs its own.

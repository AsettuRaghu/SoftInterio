-- Direct project creation is off by default.
--
-- A project should originate from a won lead: that path carries the client,
-- the property, the quotation and the scope with it. Creating one from a blank
-- form produces a project with none of that history, so it is a capability the
-- platform offers rather than the normal route.
--
-- This sits beside auto_create_project_on_won, which is the existing
-- precedent for project-flow policy living on tenant_settings. It is a tenant
-- setting and not a subscription_plan_feature because it is a workflow choice
-- each business makes, not something sold by tier - and because
-- subscription_plan_features is read only for displaying plan cards today and
-- enforces nothing.
--
-- Existing tenants get false, which matches the policy. Anyone who wants the
-- button turns it on in Settings -> Company.

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS allow_direct_project_create BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN tenant_settings.allow_direct_project_create IS
  'When false (the default), projects may only be created from a won lead. '
  'Enforced in POST /api/projects; the New Project button is hidden to match.';

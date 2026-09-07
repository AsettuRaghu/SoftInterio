-- Removes the five-argument create_project_from_lead.
--
-- Two overloads existed. The application passes nine arguments, so it always
-- resolved to the newer one and the five-argument version had no caller in the
-- codebase or in any other function - it was left behind when project manager,
-- priority and target dates were added.
--
-- Worth removing rather than leaving: both were granted to anon, and a
-- SECURITY DEFINER function that creates projects, copies documents and
-- rewrites lead rows is not something to leave reachable and untested. An
-- overload also makes the call ambiguous to anyone reading the route, since
-- which one runs depends on the argument names sent.

DROP FUNCTION IF EXISTS "public"."create_project_from_lead"(
  "p_lead_id" "uuid",
  "p_created_by" "uuid",
  "p_project_category" "text",
  "p_initialize_phases" boolean,
  "p_quotation_id" "uuid"
);

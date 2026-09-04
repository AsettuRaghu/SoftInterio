-- =====================================================================
-- Migration: close the view RLS bypass
-- Created: 2026-09-03
-- Severity: HIGH -- unauthenticated cross-tenant read
--
-- A Postgres view runs with the privileges of its OWNER unless it is declared
-- with security_invoker. Every view here is owned by "postgres", so querying
-- it through PostgREST bypassed the row level security on its base tables.
--
-- Verified before the fix, using only the public anon key and NO session:
--     tasks                    -> 0 rows   (RLS correctly applied)
--     tasks_with_details       -> 3 rows   <-- leak
--     project_phases_summary   -> 3 rows   <-- leak
--     vendors                  -> 3 rows   <-- leak
--     project_notes_combined   -> 1 row    <-- leak
--
-- The anon key is embedded in the browser bundle, so this was reachable by
-- anyone who had ever loaded the app.
--
-- security_invoker makes each view execute as the CALLER, so the existing
-- policies on the base tables apply again. No policy changes are needed - the
-- policies were always correct, the views were simply stepping around them.
-- =====================================================================

ALTER VIEW "public"."tasks_with_details"              SET ("security_invoker" = true);
ALTER VIEW "public"."project_phases_summary"          SET ("security_invoker" = true);
ALTER VIEW "public"."project_notes_combined"          SET ("security_invoker" = true);
ALTER VIEW "public"."project_payment_milestones_view" SET ("security_invoker" = true);
ALTER VIEW "public"."project_material_costs"          SET ("security_invoker" = true);
ALTER VIEW "public"."stock_material_best_prices"      SET ("security_invoker" = true);
ALTER VIEW "public"."vendors"                         SET ("security_invoker" = true);

-- Defence in depth: none of these are meant for unauthenticated callers.
-- The app's public routes (the quotation client portal) read base tables
-- directly and never touch these views, so this is safe to revoke.
REVOKE ALL ON TABLE "public"."tasks_with_details"              FROM "anon";
REVOKE ALL ON TABLE "public"."project_phases_summary"          FROM "anon";
REVOKE ALL ON TABLE "public"."project_notes_combined"          FROM "anon";
REVOKE ALL ON TABLE "public"."project_payment_milestones_view" FROM "anon";
REVOKE ALL ON TABLE "public"."project_material_costs"          FROM "anon";
REVOKE ALL ON TABLE "public"."stock_material_best_prices"      FROM "anon";
REVOKE ALL ON TABLE "public"."vendors"                         FROM "anon";

-- Re-run the probe in scripts after applying: every view must return 0 rows
-- to an unauthenticated anon caller.

-- task_transition has one signature.
--
-- 20260915150000 added four hold parameters, which made CREATE OR REPLACE
-- create a second overload beside the original four-argument one. A call
-- passing only the original arguments then matched both and failed with
-- "Could not choose the best candidate function". The application always
-- passes all eight, so the UI kept working; a direct call did not.

DROP FUNCTION IF EXISTS "public"."task_transition"("uuid", "uuid", "public"."task_status", "text");

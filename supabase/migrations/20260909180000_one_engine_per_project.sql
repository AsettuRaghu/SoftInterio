-- Remove native phases from projects that are already running a playbook.
--
-- A converted project got both: create_project_from_lead calls
-- initialize_project_phases, and autoStartProjectPlaybook then starts a
-- playbook over the top. Two engines describing the same work.
--
-- It is invisible day to day, because the Plan tab prefers the run - and that
-- is what makes it worse. The phases reappear the moment the run is cancelled,
-- which is exactly what "I just cancelled and it shows a completely different
-- playbook which I'm not aware of" was.
--
-- PRJ_20251219_0001 is the one affected today: 4 phases (Design & Planning,
-- Procurement, Execution, Handover), no sub-phases, all not_started, against a
-- live 8-stage run of Modular Design Template v4.
--
-- Strictly conservative. A project is only cleaned when nothing has happened
-- on its phases: every phase not_started, every sub-phase not_started, and no
-- payment milestone pointing at any of them. PRJ-25-0002 keeps its 6 phases
-- and 18 sub-phases because it has no playbook at all - it is still legitimately
-- on the older engine.
--
-- Going forward autoStartProjectPlaybook does this itself, so the two never
-- coexist on a new project.

WITH playbook_driven AS (
  SELECT DISTINCT r."related_id" AS project_id
    FROM "public"."procedure_runs" r
   WHERE r."related_type" = 'project'
     AND r."status" = 'active'
),
untouched AS (
  SELECT p.project_id
    FROM playbook_driven p
   WHERE EXISTS (
           SELECT 1 FROM "public"."project_phases" ph
            WHERE ph."project_id" = p.project_id
         )
     -- no phase started
     AND NOT EXISTS (
           SELECT 1 FROM "public"."project_phases" ph
            WHERE ph."project_id" = p.project_id
              AND ph."status" <> 'not_started'
         )
     -- no sub-phase started
     AND NOT EXISTS (
           SELECT 1
             FROM "public"."project_sub_phases" sp
             JOIN "public"."project_phases" ph ON ph."id" = sp."project_phase_id"
            WHERE ph."project_id" = p.project_id
              AND sp."status" <> 'not_started'
         )
     -- nothing in the payment schedule depends on them
     AND NOT EXISTS (
           SELECT 1
             FROM "public"."project_payment_milestones" m
             JOIN "public"."project_phases" ph ON ph."id" = m."linked_phase_id"
            WHERE ph."project_id" = p.project_id
         )
)
DELETE FROM "public"."project_sub_phases" sp
 USING "public"."project_phases" ph, untouched u
 WHERE sp."project_phase_id" = ph."id"
   AND ph."project_id" = u.project_id;

WITH playbook_driven AS (
  SELECT DISTINCT r."related_id" AS project_id
    FROM "public"."procedure_runs" r
   WHERE r."related_type" = 'project'
     AND r."status" = 'active'
)
DELETE FROM "public"."project_phases" ph
 USING playbook_driven p
 WHERE ph."project_id" = p.project_id
   AND ph."status" = 'not_started'
   AND NOT EXISTS (
         SELECT 1 FROM "public"."project_sub_phases" sp
          WHERE sp."project_phase_id" = ph."id"
       )
   AND NOT EXISTS (
         SELECT 1 FROM "public"."project_payment_milestones" m
          WHERE m."linked_phase_id" = ph."id"
       );

-- current_phase_id pointed at a row that may no longer exist. Stage is derived
-- from the playbook on every read now (src/lib/projects/stages.ts), so the
-- stored copy has nothing to say and was only ever able to go stale.
UPDATE "public"."projects" p
   SET "current_phase_id" = NULL
 WHERE p."current_phase_id" IS NOT NULL
   AND NOT EXISTS (
         SELECT 1 FROM "public"."project_phases" ph
          WHERE ph."id" = p."current_phase_id"
       );

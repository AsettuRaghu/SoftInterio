-- Migration: notes can carry a follow-up
-- Created: 2026-09-04
--
-- A follow-up is a scheduled next contact, and the note IS the reason for it:
-- "client asked to call back after Diwali" is simultaneously the record of
-- what happened and why we are calling again. Storing that sentence twice -
-- once as a note, once as a follow_up_note - would be redundant, so the
-- follow-up hangs off the note rather than becoming its own entity.
--
-- Deliberately three columns and no more. A fourth would be the signal that
-- this is turning into a second task system, which is exactly what it must
-- not become. No assignment (it is the record owner), no status machine
-- (resolving it IS completion), no subtasks.
--
-- CARDINALITY: a record has many notes but only ONE next follow-up, and the
-- whole point is sorting an entire pipeline by who needs chasing. That cannot
-- be a per-row subquery over notes, so the earliest unresolved date is rolled
-- up onto the parent record by trigger - the same pattern already used for
-- storage_used_bytes and open_subtask_count.
--
-- NOTE ON DUPLICATION: lead_notes and project_notes are separate tables with
-- different columns (project_notes has title/category/tenant_id; lead_notes
-- has a vestigial project_id). project_notes_combined exists to unify them and
-- is unused. Both get the same three columns here rather than being merged -
-- merging is a larger job and nothing is blocked by it - but that duplication
-- is real debt.

-- ---------------------------------------------------------------------
-- 1. Follow-up on notes
-- ---------------------------------------------------------------------

ALTER TABLE "public"."lead_notes"
    ADD COLUMN IF NOT EXISTS "follow_up_at"      "date",
    ADD COLUMN IF NOT EXISTS "follow_up_done_at" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "follow_up_done_by" "uuid";

ALTER TABLE "public"."project_notes"
    ADD COLUMN IF NOT EXISTS "follow_up_at"      "date",
    ADD COLUMN IF NOT EXISTS "follow_up_done_at" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "follow_up_done_by" "uuid";

COMMENT ON COLUMN "public"."lead_notes"."follow_up_at" IS 'When to make contact again. The note content is the reason, so there is no separate reason field.';
COMMENT ON COLUMN "public"."lead_notes"."follow_up_done_at" IS 'Set when the follow-up is dealt with. Without this a follow-up stays due forever and the queue fills with ghosts.';

CREATE INDEX IF NOT EXISTS "idx_lead_notes_followup"
    ON "public"."lead_notes" ("lead_id", "follow_up_at")
    WHERE "follow_up_at" IS NOT NULL AND "follow_up_done_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_project_notes_followup"
    ON "public"."project_notes" ("project_id", "follow_up_at")
    WHERE "follow_up_at" IS NOT NULL AND "follow_up_done_at" IS NULL;

-- ---------------------------------------------------------------------
-- 2. Rollup onto the parent record, so a pipeline can be sorted by it
-- ---------------------------------------------------------------------

ALTER TABLE "public"."leads"
    ADD COLUMN IF NOT EXISTS "next_follow_up_at" "date";
ALTER TABLE "public"."projects"
    ADD COLUMN IF NOT EXISTS "next_follow_up_at" "date";

COMMENT ON COLUMN "public"."leads"."next_follow_up_at" IS 'Earliest unresolved follow-up across this lead''s notes. Derived by trigger - never set directly.';

CREATE OR REPLACE FUNCTION "public"."recalc_lead_next_follow_up"("p_lead_id" "uuid")
RETURNS "void" LANGUAGE "plpgsql" SECURITY DEFINER AS $$
BEGIN
    UPDATE "public"."leads"
       SET next_follow_up_at = (
            SELECT MIN(follow_up_at) FROM "public"."lead_notes"
             WHERE lead_id = p_lead_id
               AND follow_up_at IS NOT NULL
               AND follow_up_done_at IS NULL
           )
     WHERE id = p_lead_id;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."recalc_project_next_follow_up"("p_project_id" "uuid")
RETURNS "void" LANGUAGE "plpgsql" SECURITY DEFINER AS $$
BEGIN
    UPDATE "public"."projects"
       SET next_follow_up_at = (
            SELECT MIN(follow_up_at) FROM "public"."project_notes"
             WHERE project_id = p_project_id
               AND follow_up_at IS NOT NULL
               AND follow_up_done_at IS NULL
           )
     WHERE id = p_project_id;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_lead_note_follow_up"() RETURNS "trigger"
LANGUAGE "plpgsql" SECURITY DEFINER AS $$
BEGIN
    PERFORM "public"."recalc_lead_next_follow_up"(
        COALESCE(NEW.lead_id, OLD.lead_id));
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_project_note_follow_up"() RETURNS "trigger"
LANGUAGE "plpgsql" SECURITY DEFINER AS $$
BEGIN
    PERFORM "public"."recalc_project_next_follow_up"(
        COALESCE(NEW.project_id, OLD.project_id));
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS "trg_lead_notes_follow_up" ON "public"."lead_notes";
CREATE TRIGGER "trg_lead_notes_follow_up"
    AFTER INSERT OR DELETE OR UPDATE OF "follow_up_at", "follow_up_done_at"
    ON "public"."lead_notes"
    FOR EACH ROW EXECUTE FUNCTION "public"."trg_lead_note_follow_up"();

DROP TRIGGER IF EXISTS "trg_project_notes_follow_up" ON "public"."project_notes";
CREATE TRIGGER "trg_project_notes_follow_up"
    AFTER INSERT OR DELETE OR UPDATE OF "follow_up_at", "follow_up_done_at"
    ON "public"."project_notes"
    FOR EACH ROW EXECUTE FUNCTION "public"."trg_project_note_follow_up"();

-- ---------------------------------------------------------------------
-- 3. Honour the setting that already exists
-- ---------------------------------------------------------------------

-- get_lead_statistics hardcoded INTERVAL '3 days' while
-- tenant_lead_settings.auto_followup_days sat there configured and ignored,
-- so a tenant setting 7 days still got 3. A lead is now due when its explicit
-- follow-up date arrives OR, with no date set, when it has simply gone quiet.
CREATE OR REPLACE FUNCTION "public"."get_lead_statistics"("p_tenant_id" "uuid")
RETURNS json LANGUAGE "plpgsql" SECURITY DEFINER AS $$
DECLARE
    result json;
    v_days integer;
BEGIN
    SELECT COALESCE(auto_followup_days, 3) INTO v_days
      FROM "public"."tenant_lead_settings" WHERE tenant_id = p_tenant_id;
    v_days := COALESCE(v_days, 3);

    SELECT json_build_object(
        'total', COUNT(*),
        'new', COUNT(*) FILTER (WHERE stage = 'new'),
        'qualified', COUNT(*) FILTER (WHERE stage = 'qualified'),
        'disqualified', COUNT(*) FILTER (WHERE stage = 'disqualified'),
        'requirement_discussion', COUNT(*) FILTER (WHERE stage = 'requirement_discussion'),
        'proposal_discussion', COUNT(*) FILTER (WHERE stage = 'proposal_discussion'),
        'won', COUNT(*) FILTER (WHERE stage = 'won'),
        'lost', COUNT(*) FILTER (WHERE stage = 'lost'),
        'pipeline_value', COALESCE(SUM(won_amount) FILTER (WHERE stage NOT IN ('won','lost','disqualified')), 0),
        'won_value', COALESCE(SUM(won_amount) FILTER (WHERE stage = 'won'), 0),
        'this_month_new', COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)),
        'this_month_won', COUNT(*) FILTER (WHERE stage = 'won' AND DATE_TRUNC('month', won_at) = DATE_TRUNC('month', CURRENT_DATE)),
        'needs_followup', COUNT(*) FILTER (WHERE
            stage NOT IN ('won', 'lost', 'disqualified')
            AND (
                 next_follow_up_at <= CURRENT_DATE
              OR (next_follow_up_at IS NULL
                  AND last_activity_at < CURRENT_TIMESTAMP - (v_days || ' days')::interval)
            )
        ),
        'overdue_followup', COUNT(*) FILTER (WHERE
            stage NOT IN ('won', 'lost', 'disqualified')
            AND next_follow_up_at < CURRENT_DATE
        )
    ) INTO result
    FROM "public"."leads"
    WHERE tenant_id = p_tenant_id;

    RETURN result;
END;
$$;

GRANT ALL ON FUNCTION "public"."recalc_lead_next_follow_up"("uuid") TO "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."recalc_project_next_follow_up"("uuid") TO "authenticated", "service_role";

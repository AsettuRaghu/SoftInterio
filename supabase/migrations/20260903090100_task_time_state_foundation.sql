-- =====================================================================
-- Migration: Task time & state foundation
-- Created: 2026-09-03
-- Purpose: Make task lifecycle (start / pause / block / resume / complete)
--          measurable, so cycle-time and effort analytics are possible later.
--
-- Design note: two SEPARATE event logs, because they answer different
-- questions and neither can be derived from the other:
--   * task_status_history -> ELAPSED time. How long did this sit in todo?
--                            How long was it blocked, and by whose fault?
--   * task_work_sessions  -> EFFORT. How many hours were actually worked,
--                            and by whom. Multiple people can log against
--                            the same task concurrently.
-- Both are append-only. They CANNOT be backfilled, which is why they land
-- before any reporting work.
--
-- Depends on 20260903090000_task_status_add_blocked.sql having been applied.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1.  New lifecycle columns on tasks
-- ---------------------------------------------------------------------

ALTER TABLE "public"."tasks"
    ADD COLUMN IF NOT EXISTS "started_at"           timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "first_started_at"     timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "cancelled_at"         timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "cancelled_by"         "uuid",
    ADD COLUMN IF NOT EXISTS "hold_reason"          "text",
    ADD COLUMN IF NOT EXISTS "total_active_seconds" bigint DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS "total_held_seconds"   bigint DEFAULT 0 NOT NULL;

COMMENT ON COLUMN "public"."tasks"."started_at" IS 'Most recent transition into in_progress. Resets on every resume.';
COMMENT ON COLUMN "public"."tasks"."first_started_at" IS 'First ever transition into in_progress. Never overwritten - survives reopen, so true lead time stays computable.';
COMMENT ON COLUMN "public"."tasks"."hold_reason" IS 'Why the task is currently on_hold or blocked. Copied onto the status history row at transition time.';
COMMENT ON COLUMN "public"."tasks"."total_active_seconds" IS 'Rollup of CLOSED work sessions. Excludes any currently running session - use the tasks_with_timing view for live totals.';
COMMENT ON COLUMN "public"."tasks"."total_held_seconds" IS 'Accumulated time spent in on_hold or blocked.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tasks_cancelled_by_fkey'
    ) THEN
        ALTER TABLE ONLY "public"."tasks"
            ADD CONSTRAINT "tasks_cancelled_by_fkey"
            FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
    END IF;
END $$;


-- ---------------------------------------------------------------------
-- 2.  task_status_history  -- elapsed time / time-in-status
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."task_status_history" (
    "id"               "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id"          "uuid" NOT NULL,
    "tenant_id"        "uuid" NOT NULL,
    "from_status"      "public"."task_status",
    "to_status"        "public"."task_status" NOT NULL,
    "duration_seconds" bigint DEFAULT 0 NOT NULL,
    "reason"           "text",
    "changed_by"       "uuid",
    "changed_at"       timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."task_status_history" OWNER TO "postgres";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_status_history_pkey') THEN
        ALTER TABLE ONLY "public"."task_status_history" ADD CONSTRAINT "task_status_history_pkey" PRIMARY KEY ("id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_status_history_task_id_fkey') THEN
        ALTER TABLE ONLY "public"."task_status_history"
            ADD CONSTRAINT "task_status_history_task_id_fkey"
            FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_status_history_tenant_id_fkey') THEN
        ALTER TABLE ONLY "public"."task_status_history"
            ADD CONSTRAINT "task_status_history_tenant_id_fkey"
            FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_status_history_changed_by_fkey') THEN
        ALTER TABLE ONLY "public"."task_status_history"
            ADD CONSTRAINT "task_status_history_changed_by_fkey"
            FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_task_status_history_task"    ON "public"."task_status_history" USING "btree" ("task_id", "changed_at");
CREATE INDEX IF NOT EXISTS "idx_task_status_history_tenant"  ON "public"."task_status_history" USING "btree" ("tenant_id", "changed_at");
CREATE INDEX IF NOT EXISTS "idx_task_status_history_to"      ON "public"."task_status_history" USING "btree" ("to_status");

COMMENT ON TABLE  "public"."task_status_history" IS 'Append-only log of every task status change. Source of truth for time-in-status analytics.';
COMMENT ON COLUMN "public"."task_status_history"."duration_seconds" IS 'How long the task sat in from_status BEFORE this change. Stored so time-in-status is a plain SUM/GROUP BY with no window functions.';


-- ---------------------------------------------------------------------
-- 3.  task_work_sessions  -- effort / actual worked time
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."task_work_sessions" (
    "id"               "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id"          "uuid" NOT NULL,
    "tenant_id"        "uuid" NOT NULL,
    "user_id"          "uuid",
    "started_at"       timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at"         timestamp with time zone,
    "duration_seconds" bigint GENERATED ALWAYS AS (
        CASE WHEN "ended_at" IS NULL THEN 0
             ELSE GREATEST(0, (EXTRACT(EPOCH FROM ("ended_at" - "started_at")))::bigint)
        END
    ) STORED,
    "source"           character varying(20) DEFAULT 'status' NOT NULL,
    "note"             "text",
    "created_at"       timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "task_work_sessions_source_check"
        CHECK (("source")::"text" = ANY (ARRAY['status'::"text", 'manual'::"text", 'timer'::"text"])),
    CONSTRAINT "task_work_sessions_range_check"
        CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);

ALTER TABLE "public"."task_work_sessions" OWNER TO "postgres";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_work_sessions_pkey') THEN
        ALTER TABLE ONLY "public"."task_work_sessions" ADD CONSTRAINT "task_work_sessions_pkey" PRIMARY KEY ("id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_work_sessions_task_id_fkey') THEN
        ALTER TABLE ONLY "public"."task_work_sessions"
            ADD CONSTRAINT "task_work_sessions_task_id_fkey"
            FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_work_sessions_tenant_id_fkey') THEN
        ALTER TABLE ONLY "public"."task_work_sessions"
            ADD CONSTRAINT "task_work_sessions_tenant_id_fkey"
            FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_work_sessions_user_id_fkey') THEN
        ALTER TABLE ONLY "public"."task_work_sessions"
            ADD CONSTRAINT "task_work_sessions_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- One OPEN session per (task, user). Two people may run the clock on the
-- same task at once; the same person may not double-count themselves.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_task_work_sessions_open_unique"
    ON "public"."task_work_sessions" USING "btree" ("task_id", "user_id")
    WHERE ("ended_at" IS NULL);

CREATE INDEX IF NOT EXISTS "idx_task_work_sessions_task"   ON "public"."task_work_sessions" USING "btree" ("task_id", "started_at");
CREATE INDEX IF NOT EXISTS "idx_task_work_sessions_user"   ON "public"."task_work_sessions" USING "btree" ("user_id", "started_at");
CREATE INDEX IF NOT EXISTS "idx_task_work_sessions_tenant" ON "public"."task_work_sessions" USING "btree" ("tenant_id", "started_at");

COMMENT ON TABLE  "public"."task_work_sessions" IS 'Append-only log of worked intervals. tasks.actual_hours is derived from this rather than typed by hand.';
COMMENT ON COLUMN "public"."task_work_sessions"."source" IS 'status = opened/closed automatically by a status change; manual = entered after the fact; timer = explicit user timer control.';


-- ---------------------------------------------------------------------
-- 4.  Transition validation
-- ---------------------------------------------------------------------

-- Mirrors the existing is_valid_stage_transition() pattern used for leads.
-- Advisory only: called by the task_transition() RPC, NOT enforced by a
-- constraint, so existing inline status dropdowns keep working.
CREATE OR REPLACE FUNCTION "public"."is_valid_task_transition"(
    "p_from" "public"."task_status",
    "p_to"   "public"."task_status"
) RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    IF p_from IS NULL OR p_from = p_to THEN
        RETURN true;
    END IF;

    RETURN CASE p_from
        WHEN 'todo'        THEN p_to IN ('in_progress', 'cancelled')
        WHEN 'in_progress' THEN p_to IN ('on_hold', 'blocked', 'completed', 'cancelled')
        WHEN 'on_hold'     THEN p_to IN ('in_progress', 'blocked', 'completed', 'cancelled')
        WHEN 'blocked'     THEN p_to IN ('in_progress', 'on_hold', 'completed', 'cancelled')
        WHEN 'completed'   THEN p_to IN ('in_progress', 'todo')   -- reopen
        WHEN 'cancelled'   THEN p_to IN ('todo')                  -- reactivate
        ELSE false
    END;
END;
$$;

ALTER FUNCTION "public"."is_valid_task_transition"("public"."task_status", "public"."task_status") OWNER TO "postgres";
COMMENT ON FUNCTION "public"."is_valid_task_transition"("public"."task_status", "public"."task_status") IS 'Allowed task status transitions. Advisory - enforced in the task_transition() RPC, not by constraint.';


-- ---------------------------------------------------------------------
-- 5.  The trigger that makes all of this automatic
-- ---------------------------------------------------------------------

-- Fires on ANY update that changes tasks.status, whatever the code path.
-- That is deliberate: the existing PATCH handler and every inline dropdown
-- get correct history and session bookkeeping without being rewritten.
CREATE OR REPLACE FUNCTION "public"."trg_tasks_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_now         timestamp with time zone := now();
    v_last_change timestamp with time zone;
    v_duration    bigint;
    v_actor       "uuid";
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    v_actor := COALESCE(NEW.updated_by, NEW.completed_by, NEW.assigned_to, OLD.assigned_to);

    -- Time spent in the status we are leaving: since the last status change,
    -- or since creation if this is the first one.
    SELECT COALESCE(MAX(changed_at), OLD.created_at)
      INTO v_last_change
      FROM "public"."task_status_history"
     WHERE task_id = NEW.id;

    v_duration := GREATEST(0, (EXTRACT(EPOCH FROM (v_now - COALESCE(v_last_change, v_now))))::bigint);

    INSERT INTO "public"."task_status_history"
        (task_id, tenant_id, from_status, to_status, duration_seconds, reason, changed_by, changed_at)
    VALUES
        (NEW.id, NEW.tenant_id, OLD.status, NEW.status, v_duration, NEW.hold_reason, v_actor, v_now);

    -- Accumulate parked time.
    IF OLD.status IN ('on_hold', 'blocked') THEN
        NEW.total_held_seconds := COALESCE(OLD.total_held_seconds, 0) + v_duration;
    END IF;

    IF NEW.status = 'in_progress' THEN
        -- Entering work: stamp timestamps and open a session for the actor.
        NEW.started_at := v_now;
        IF NEW.first_started_at IS NULL THEN
            NEW.first_started_at := v_now;
        END IF;

        IF v_actor IS NOT NULL THEN
            INSERT INTO "public"."task_work_sessions" (task_id, tenant_id, user_id, started_at, source)
            VALUES (NEW.id, NEW.tenant_id, v_actor, v_now, 'status')
            ON CONFLICT (task_id, user_id) WHERE (ended_at IS NULL) DO NOTHING;
        END IF;

        -- Reopening a completed/cancelled task clears the terminal stamps.
        NEW.completed_at := NULL;
        NEW.completed_by := NULL;
        NEW.cancelled_at := NULL;
        NEW.cancelled_by := NULL;
    ELSE
        -- Leaving work: close every open session and refresh the rollup.
        UPDATE "public"."task_work_sessions"
           SET ended_at = v_now
         WHERE task_id = NEW.id
           AND ended_at IS NULL;

        SELECT COALESCE(SUM(duration_seconds), 0)
          INTO NEW.total_active_seconds
          FROM "public"."task_work_sessions"
         WHERE task_id = NEW.id
           AND ended_at IS NOT NULL;

        -- Keep the legacy hours field meaningful instead of hand-typed.
        NEW.actual_hours := ROUND((NEW.total_active_seconds / 3600.0)::numeric, 2);
    END IF;

    IF NEW.status = 'completed' THEN
        NEW.completed_at := COALESCE(NEW.completed_at, v_now);
        NEW.completed_by := COALESCE(NEW.completed_by, v_actor);
    END IF;

    IF NEW.status = 'cancelled' THEN
        NEW.cancelled_at := COALESCE(NEW.cancelled_at, v_now);
        NEW.cancelled_by := COALESCE(NEW.cancelled_by, v_actor);
    END IF;

    -- hold_reason only means anything while parked.
    IF NEW.status NOT IN ('on_hold', 'blocked') THEN
        NEW.hold_reason := NULL;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."trg_tasks_status_change"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_tasks_status_change" ON "public"."tasks";
CREATE TRIGGER "trg_tasks_status_change"
    BEFORE UPDATE OF "status" ON "public"."tasks"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."trg_tasks_status_change"();


-- ---------------------------------------------------------------------
-- 6.  task_transition() -- the validated entry point used by the API
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."task_transition"(
    "p_task_id" "uuid",
    "p_user_id" "uuid",
    "p_to"      "public"."task_status",
    "p_reason"  "text" DEFAULT NULL
) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_task RECORD;
BEGIN
    SELECT * INTO v_task FROM "public"."tasks" WHERE id = p_task_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Task not found');
    END IF;

    IF v_task.status = p_to THEN
        RETURN jsonb_build_object('success', true, 'message', 'No change', 'status', p_to);
    END IF;

    IF NOT "public"."is_valid_task_transition"(v_task.status, p_to) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Cannot move a task from %s to %s', v_task.status, p_to),
            'from', v_task.status,
            'to', p_to
        );
    END IF;

    IF p_to IN ('on_hold', 'blocked') AND COALESCE(btrim(p_reason), '') = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'A reason is required to pause or block a task');
    END IF;

    -- The BEFORE trigger does the history, sessions and timestamp work.
    UPDATE "public"."tasks"
       SET status      = p_to,
           hold_reason = p_reason,
           updated_by  = p_user_id,
           updated_at  = now()
     WHERE id = p_task_id;

    SELECT * INTO v_task FROM "public"."tasks" WHERE id = p_task_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', v_task.status,
        'started_at', v_task.started_at,
        'first_started_at', v_task.first_started_at,
        'completed_at', v_task.completed_at,
        'total_active_seconds', v_task.total_active_seconds,
        'total_held_seconds', v_task.total_held_seconds
    );
END;
$$;

ALTER FUNCTION "public"."task_transition"("uuid", "uuid", "public"."task_status", "text") OWNER TO "postgres";
COMMENT ON FUNCTION "public"."task_transition"("uuid", "uuid", "public"."task_status", "text") IS 'Validated task status change. Use this instead of updating tasks.status directly.';


-- ---------------------------------------------------------------------
-- 7.  recalc helper (for manually edited / imported sessions)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."recalc_task_timing"("p_task_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_active bigint;
    v_held   bigint;
BEGIN
    SELECT COALESCE(SUM(duration_seconds), 0) INTO v_active
      FROM "public"."task_work_sessions"
     WHERE task_id = p_task_id AND ended_at IS NOT NULL;

    SELECT COALESCE(SUM(duration_seconds), 0) INTO v_held
      FROM "public"."task_status_history"
     WHERE task_id = p_task_id AND from_status IN ('on_hold', 'blocked');

    UPDATE "public"."tasks"
       SET total_active_seconds = v_active,
           total_held_seconds   = v_held,
           actual_hours         = ROUND((v_active / 3600.0)::numeric, 2)
     WHERE id = p_task_id;

    RETURN jsonb_build_object('success', true, 'total_active_seconds', v_active, 'total_held_seconds', v_held);
END;
$$;

ALTER FUNCTION "public"."recalc_task_timing"("uuid") OWNER TO "postgres";


-- ---------------------------------------------------------------------
-- 8.  Live timing view (includes the currently running session)
-- ---------------------------------------------------------------------

-- security_invoker is NOT optional here. A view owned by postgres runs with the
-- owner's rights and would hand every tenant's tasks to any authenticated
-- caller through PostgREST. This makes it run as the caller so the tasks RLS
-- policy still applies.
CREATE OR REPLACE VIEW "public"."tasks_with_timing" WITH ("security_invoker" = 'true') AS
SELECT
    t.*,
    -- Closed sessions plus whatever is running right now.
    (t.total_active_seconds + COALESCE((
        SELECT SUM(GREATEST(0, (EXTRACT(EPOCH FROM (now() - ws.started_at)))::bigint))
          FROM "public"."task_work_sessions" ws
         WHERE ws.task_id = t.id AND ws.ended_at IS NULL
    ), 0))::bigint AS "live_active_seconds",

    (t.total_held_seconds + CASE
        WHEN t.status IN ('on_hold', 'blocked')
        THEN GREATEST(0, (EXTRACT(EPOCH FROM (now() - COALESCE(
                (SELECT MAX(changed_at) FROM "public"."task_status_history" h WHERE h.task_id = t.id),
                t.created_at))))::bigint)
        ELSE 0
    END)::bigint AS "live_held_seconds",

    EXISTS (
        SELECT 1 FROM "public"."task_work_sessions" ws
         WHERE ws.task_id = t.id AND ws.ended_at IS NULL
    ) AS "is_clock_running",

    -- Lead time: created -> completed. Cycle time: first touched -> completed.
    CASE WHEN t.completed_at IS NOT NULL
         THEN (EXTRACT(EPOCH FROM (t.completed_at - t.created_at)))::bigint END AS "lead_time_seconds",
    CASE WHEN t.completed_at IS NOT NULL AND t.first_started_at IS NOT NULL
         THEN (EXTRACT(EPOCH FROM (t.completed_at - t.first_started_at)))::bigint END AS "cycle_time_seconds"
FROM "public"."tasks" t;

ALTER VIEW "public"."tasks_with_timing" OWNER TO "postgres";
COMMENT ON VIEW "public"."tasks_with_timing" IS 'Tasks plus live timing. live_* columns include the in-flight session/hold; the underlying tasks columns hold only settled totals.';


-- ---------------------------------------------------------------------
-- 9.  RLS + grants (mirrors the existing task_comments_access pattern)
-- ---------------------------------------------------------------------

ALTER TABLE "public"."task_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."task_work_sessions"  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_status_history_access" ON "public"."task_status_history";
CREATE POLICY "task_status_history_access" ON "public"."task_status_history"
    USING (("task_id" IN ( SELECT "tasks"."id" FROM "public"."tasks"
                            WHERE ("tasks"."tenant_id" = "public"."get_user_tenant_id"()))));

DROP POLICY IF EXISTS "task_work_sessions_access" ON "public"."task_work_sessions";
CREATE POLICY "task_work_sessions_access" ON "public"."task_work_sessions"
    USING (("task_id" IN ( SELECT "tasks"."id" FROM "public"."tasks"
                            WHERE ("tasks"."tenant_id" = "public"."get_user_tenant_id"()))));

GRANT ALL ON TABLE "public"."task_status_history" TO "anon";
GRANT ALL ON TABLE "public"."task_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."task_status_history" TO "service_role";

GRANT ALL ON TABLE "public"."task_work_sessions" TO "anon";
GRANT ALL ON TABLE "public"."task_work_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."task_work_sessions" TO "service_role";

GRANT ALL ON TABLE "public"."tasks_with_timing" TO "anon";
GRANT ALL ON TABLE "public"."tasks_with_timing" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks_with_timing" TO "service_role";

GRANT ALL ON FUNCTION "public"."is_valid_task_transition"("public"."task_status", "public"."task_status") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_task_transition"("public"."task_status", "public"."task_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_task_transition"("public"."task_status", "public"."task_status") TO "service_role";

GRANT ALL ON FUNCTION "public"."task_transition"("uuid", "uuid", "public"."task_status", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."task_transition"("uuid", "uuid", "public"."task_status", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."task_transition"("uuid", "uuid", "public"."task_status", "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."recalc_task_timing"("uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_task_timing"("uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_task_timing"("uuid") TO "service_role";


-- ---------------------------------------------------------------------
-- 10.  Seed history for tasks that already exist
-- ---------------------------------------------------------------------

-- Existing tasks have no history, which would make their first future
-- transition report a duration measured from created_at. Give each one an
-- opening row so the timeline starts honestly at its current status.
INSERT INTO "public"."task_status_history"
    (task_id, tenant_id, from_status, to_status, duration_seconds, reason, changed_by, changed_at)
SELECT t.id, t.tenant_id, NULL, t.status, 0, 'Backfilled at migration', t.created_by,
       COALESCE(t.completed_at, t.updated_at, t.created_at)
  FROM "public"."tasks" t
 WHERE NOT EXISTS (
       SELECT 1 FROM "public"."task_status_history" h WHERE h.task_id = t.id
 );

-- Best-effort timestamps for already-finished work.
UPDATE "public"."tasks"
   SET first_started_at = COALESCE(first_started_at, created_at)
 WHERE status IN ('in_progress', 'on_hold', 'completed')
   AND first_started_at IS NULL;

UPDATE "public"."tasks"
   SET cancelled_at = COALESCE(cancelled_at, updated_at)
 WHERE status = 'cancelled' AND cancelled_at IS NULL;

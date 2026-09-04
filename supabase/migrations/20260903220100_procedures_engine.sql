-- Migration: the Procedures engine
-- Created: 2026-09-03
-- Depends on 20260903220000_procedure_enums.sql
--
-- A Procedure is a predefined, ordered set of steps with completion gates,
-- attached to a lead / project / quotation / client. It replaces task
-- templates, which could spawn tasks but enforce nothing - your one real
-- template ("Modular Design Template", 25 items including "Site Measurement
-- Collection" and three "Internal Review" steps) was never instantiated once,
-- because a stamp cannot express a workflow.
--
-- Design decisions already settled:
--   * Every step IS a task, so steps inherit assignment, comments,
--     attachments, the timing engine and notifications for free. Nesting maps
--     onto the parent/subtask gate that already exists.
--   * A run snapshots its definition version. Editing a procedure must not
--     rewrite the rules of work already in flight.
--   * Sequential by default, with allow_parallel per step. No dependency
--     graph yet.
--   * Skippable where the definition allows, reason mandatory, counts as
--     settled.
--   * assign_to_role that resolves to more than one person leaves the step
--     unassigned as a team queue, rather than guessing an owner.

-- ---------------------------------------------------------------------
-- 1. Definitions
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."procedure_definitions" (
    "id"          "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id"   "uuid" NOT NULL,
    -- Seeded starter procedures are keyed by vertical. An architect's step set
    -- differs from an interiors one, and that difference must be DATA, not a
    -- branch in code.
    "tenant_type" "public"."tenant_type_enum",
    "name"        character varying(255) NOT NULL,
    "description" "text",
    "version"     integer DEFAULT 1 NOT NULL,
    "applies_to"  "public"."task_related_type" NOT NULL,
    "is_active"   boolean DEFAULT true NOT NULL,
    -- Carried over from task_templates: a workflow anyone can rewrite is not
    -- much of a control.
    "is_protected" boolean DEFAULT false NOT NULL,
    "created_by"  "uuid",
    "updated_by"  "uuid",
    "created_at"  timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"  timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "procedure_definitions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "procedure_definitions_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."procedure_definitions" OWNER TO "postgres";
CREATE INDEX IF NOT EXISTS "idx_procedure_definitions_tenant"
    ON "public"."procedure_definitions" ("tenant_id", "is_active");
COMMENT ON TABLE "public"."procedure_definitions" IS 'A reusable workflow. Replaces task_templates, which spawned tasks but enforced nothing.';

-- ---------------------------------------------------------------------
-- 2. Step definitions
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."procedure_step_definitions" (
    "id"            "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "definition_id" "uuid" NOT NULL,
    -- Grouping, e.g. "3D Design" with "Internal Review" and "Client
    -- Confirmation" beneath it. Materialises as parent task + subtasks.
    "parent_step_id" "uuid",
    "title"         character varying(255) NOT NULL,
    "description"   "text",
    "instructions"  "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "action_type"   "public"."procedure_action_type" DEFAULT 'manual' NOT NULL,
    -- For action_type='form'. A small fixed field vocabulary, not a form
    -- builder: text, number, date, select, multiselect, checkbox, photo.
    "form_schema"   "jsonb",
    -- For action_type='upload'. Empty array means "any file will do".
    "required_upload_types" "text"[],
    "approval_role" character varying(100),
    "assign_to_role" character varying(100),
    "relative_due_days" integer,
    "estimated_hours"  numeric(6,2),
    "priority"      "public"."task_priority" DEFAULT 'medium',
    -- false = the run can finish without it
    "is_required"   boolean DEFAULT true NOT NULL,
    "can_skip"      boolean DEFAULT false NOT NULL,
    "skip_requires_reason" boolean DEFAULT true NOT NULL,
    -- true = does not wait for the preceding step
    "allow_parallel" boolean DEFAULT false NOT NULL,
    "created_at"    timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"    timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "procedure_step_definitions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "procedure_step_definitions_definition_id_fkey"
        FOREIGN KEY ("definition_id") REFERENCES "public"."procedure_definitions"("id") ON DELETE CASCADE,
    CONSTRAINT "procedure_step_definitions_parent_step_id_fkey"
        FOREIGN KEY ("parent_step_id") REFERENCES "public"."procedure_step_definitions"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."procedure_step_definitions" OWNER TO "postgres";
CREATE INDEX IF NOT EXISTS "idx_procedure_steps_definition"
    ON "public"."procedure_step_definitions" ("definition_id", "display_order");

-- ---------------------------------------------------------------------
-- 3. Runs
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."procedure_runs" (
    "id"            "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id"     "uuid" NOT NULL,
    "definition_id" "uuid" NOT NULL,
    -- Pinned so that editing the definition cannot change the rules of a run
    -- already under way.
    "definition_version" integer NOT NULL,
    "definition_name"    character varying(255) NOT NULL,
    "related_type"  "public"."task_related_type" NOT NULL,
    "related_id"    "uuid" NOT NULL,
    "status"        "public"."procedure_run_status" DEFAULT 'active' NOT NULL,
    "started_by"    "uuid",
    "started_at"    timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at"  timestamp with time zone,
    "cancelled_at"  timestamp with time zone,
    "cancel_reason" "text",
    "created_at"    timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"    timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "procedure_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "procedure_runs_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "procedure_runs_definition_id_fkey"
        FOREIGN KEY ("definition_id") REFERENCES "public"."procedure_definitions"("id") ON DELETE RESTRICT
);

ALTER TABLE "public"."procedure_runs" OWNER TO "postgres";
CREATE INDEX IF NOT EXISTS "idx_procedure_runs_entity"
    ON "public"."procedure_runs" ("related_type", "related_id", "status");
CREATE INDEX IF NOT EXISTS "idx_procedure_runs_tenant"
    ON "public"."procedure_runs" ("tenant_id", "status");
COMMENT ON COLUMN "public"."procedure_runs"."definition_name" IS 'Snapshot of the name at start, so a renamed or deleted definition does not rewrite history.';

-- ---------------------------------------------------------------------
-- 4. Tasks become procedure steps
-- ---------------------------------------------------------------------

ALTER TABLE "public"."tasks"
    ADD COLUMN IF NOT EXISTS "procedure_run_id"  "uuid",
    ADD COLUMN IF NOT EXISTS "procedure_step_id" "uuid",
    ADD COLUMN IF NOT EXISTS "form_data"         "jsonb",
    ADD COLUMN IF NOT EXISTS "skip_reason"       "text",
    ADD COLUMN IF NOT EXISTS "skipped_at"        timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "skipped_by"        "uuid";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_procedure_run_id_fkey') THEN
        ALTER TABLE ONLY "public"."tasks" ADD CONSTRAINT "tasks_procedure_run_id_fkey"
            FOREIGN KEY ("procedure_run_id") REFERENCES "public"."procedure_runs"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_procedure_step_id_fkey') THEN
        ALTER TABLE ONLY "public"."tasks" ADD CONSTRAINT "tasks_procedure_step_id_fkey"
            FOREIGN KEY ("procedure_step_id") REFERENCES "public"."procedure_step_definitions"("id") ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_tasks_procedure_run"
    ON "public"."tasks" ("procedure_run_id");
COMMENT ON COLUMN "public"."tasks"."form_data" IS 'Values captured for a form step, shaped by the step definition''s form_schema.';

-- ---------------------------------------------------------------------
-- 5. Completion requirements (generalised from sub_phase_completion_requirements)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."task_completion_requirements" (
    "id"                "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id"           "uuid" NOT NULL,
    "requirement_type"  character varying(50) NOT NULL,
    "requirement_key"   character varying(100) NOT NULL,
    "requirement_label" character varying(255),
    "is_required"       boolean DEFAULT true NOT NULL,
    "is_satisfied"      boolean DEFAULT false NOT NULL,
    "satisfied_at"      timestamp with time zone,
    "satisfied_by"      "uuid",
    "reference_type"    character varying(50),
    "reference_id"      "uuid",
    "created_at"        timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "task_completion_requirements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_completion_requirements_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."task_completion_requirements" OWNER TO "postgres";
CREATE INDEX IF NOT EXISTS "idx_task_requirements_task"
    ON "public"."task_completion_requirements" ("task_id", "is_satisfied");
COMMENT ON TABLE "public"."task_completion_requirements" IS 'Gates that must be met before a task can complete. Generalised from sub_phase_completion_requirements so one engine serves procedures and, later, project phases.';

-- Migration: sign-off with a record
-- Created: 2026-09-04
--
-- 8 of the 25 Modular Design steps are approval steps, and nothing could ever
-- satisfy them - a run stalled permanently at the first "Internal Review".
--
-- This is deliberately NOT a routed approval system. There is no approver
-- role, no request, no inbox and no threshold. Anyone who can see the task can
-- confirm the step, and the system records WHO and WHEN. For a small studio
-- that is the whole value: evidence that the review happened and who did it,
-- without an org hierarchy that does not exist yet.
--
-- Routed approvals (an approver who is not the doer, revisions on rejection,
-- a waiting-on-me inbox) extend this rather than replace it: the same
-- requirement row gains a requested_by/approver_id when that day comes.
--
-- task_completion_requirements already carried is_satisfied, satisfied_at and
-- satisfied_by. Only the note and the operations were missing.

ALTER TABLE "public"."task_completion_requirements"
    ADD COLUMN IF NOT EXISTS "note" "text";

COMMENT ON COLUMN "public"."task_completion_requirements"."note" IS 'Optional remark left when signing off, e.g. what was checked.';

-- ---------------------------------------------------------------------
-- Sign off
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."sign_off_requirement"(
    "p_requirement_id" "uuid",
    "p_user_id"        "uuid",
    "p_note"           "text" DEFAULT NULL
) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_req RECORD;
BEGIN
    SELECT * INTO v_req FROM "public"."task_completion_requirements"
     WHERE id = p_requirement_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Requirement not found');
    END IF;

    -- Upload and form gates prove themselves: a file exists or it does not.
    -- Letting someone tick them by hand would make the evidence meaningless.
    IF v_req.requirement_type NOT IN ('approval', 'checklist', 'manual') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format(
                'A %s requirement is satisfied by doing the thing, not by confirming it.',
                v_req.requirement_type)
        );
    END IF;

    IF v_req.is_satisfied THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already signed off');
    END IF;

    UPDATE "public"."task_completion_requirements"
       SET is_satisfied = true,
           satisfied_at = now(),
           satisfied_by = p_user_id,
           note = NULLIF(btrim(COALESCE(p_note, '')), '')
     WHERE id = p_requirement_id;

    RETURN jsonb_build_object('success', true, 'signed_off_at', now());
END;
$$;

ALTER FUNCTION "public"."sign_off_requirement"("uuid", "uuid", "text") OWNER TO "postgres";

-- ---------------------------------------------------------------------
-- Withdraw a sign-off
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."revoke_requirement_signoff"(
    "p_requirement_id" "uuid",
    "p_user_id"        "uuid"
) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_req  RECORD;
    v_task RECORD;
BEGIN
    SELECT * INTO v_req FROM "public"."task_completion_requirements"
     WHERE id = p_requirement_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Requirement not found');
    END IF;

    IF v_req.requirement_type NOT IN ('approval', 'checklist', 'manual') THEN
        RETURN jsonb_build_object('success', false,
            'error', 'Only a sign-off can be withdrawn.');
    END IF;

    SELECT * INTO v_task FROM "public"."tasks" WHERE id = v_req.task_id;

    -- Withdrawing a sign-off on finished work would leave the task complete
    -- with an unmet gate - exactly the state the gate exists to prevent. The
    -- task has to be reopened first, deliberately.
    IF v_task.status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Reopen the task before withdrawing its sign-off.'
        );
    END IF;

    UPDATE "public"."task_completion_requirements"
       SET is_satisfied = false,
           satisfied_at = NULL,
           satisfied_by = NULL,
           note = NULL
     WHERE id = p_requirement_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

ALTER FUNCTION "public"."revoke_requirement_signoff"("uuid", "uuid") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."sign_off_requirement"("uuid", "uuid", "text") TO "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."revoke_requirement_signoff"("uuid", "uuid") TO "authenticated", "service_role";

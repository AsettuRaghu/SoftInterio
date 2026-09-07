-- Migration: let task_transition() accept a pause/block without a reason
-- Created: 2026-09-03
--
-- The original version hard-rejected on_hold/blocked with no reason. That made
-- the inline status dropdowns in the task tables unusable: they can set a
-- status but have nowhere to collect a reason, so picking "On Hold" returned
-- 409 and the change silently failed.
--
-- A required field that a legitimate UI path cannot supply is a bug, not a
-- safeguard. The requirement moves up to the UI instead:
--
--   TaskStatusControls (Pause / Block buttons) -> opens a modal, still requires
--     a reason, and POSTs to /api/tasks/[id]/transition which also enforces it.
--   Inline status dropdown -> quick change, reason recorded as NULL.
--
-- So the reason is still captured on the path people actually use to pause
-- work, without breaking the quick path. task_status_history.reason is simply
-- nullable, which it always was.

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

    -- No reason requirement here any more; see the note above.
    UPDATE "public"."tasks"
       SET status      = p_to,
           hold_reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
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

COMMENT ON FUNCTION "public"."task_transition"("uuid", "uuid", "public"."task_status", "text") IS 'Validated task status change. Use this instead of updating tasks.status directly. A reason is optional here and enforced by the UI on the Pause/Block controls.';

/**
 * The answers to a playbook form step.
 *
 *   GET   /api/tasks/:id/form   the fields to fill, and what has been filled
 *   PATCH /api/tasks/:id/form   save answers
 *
 * `form` was the one action type that promised a gate and delivered nothing:
 * create_step_requirements only writes a requirement when `form_schema` is set,
 * and until now nothing could set it, so a form step behaved exactly like a
 * manual one.
 *
 * The schema lives on the step definition, not the task, because it is part of
 * the process rather than of one instance of it. The answers live on the task
 * (`tasks.form_data`), because they are what happened this time.
 *
 * Saving satisfies the requirement only when every required field has an
 * answer. Partial saves are allowed and expected - somebody fills in what they
 * know on site and finishes later - so the requirement flips both ways.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface FormField {
  key: string;
  label: string;
  required?: boolean;
}

/** RLS on tasks scopes by tenant, so a miss here is "not yours" as well as "gone". */
async function loadTaskForm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string
) {
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, form_data, procedure_step_id")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) return { error: "Task not found", status: 404 as const };

  if (!task.procedure_step_id) {
    return { error: "This task is not a playbook step", status: 400 as const };
  }

  const { data: step } = await supabase
    .from("procedure_step_definitions")
    .select("id, action_type, form_schema")
    .eq("id", task.procedure_step_id)
    .maybeSingle();

  if (!step || step.action_type !== "form") {
    return { error: "This step does not ask for a form", status: 400 as const };
  }

  const fields = ((step.form_schema as any)?.fields ?? []) as FormField[];
  return { task, fields };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["tasks.view"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const supabase = await createClient();
    const loaded = await loadTaskForm(supabase, id);

    if ("error" in loaded) {
      return NextResponse.json(
        { error: loaded.error },
        { status: loaded.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        fields: loaded.fields,
        answers: (loaded.task.form_data as Record<string, unknown>) ?? {},
      },
    });
  } catch (error) {
    log.error("Error reading task form", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["tasks.edit"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();
    const loaded = await loadTaskForm(supabase, id);

    if ("error" in loaded) {
      return NextResponse.json(
        { error: loaded.error },
        { status: loaded.status }
      );
    }

    const body = await request.json();
    const submitted = (body?.answers ?? {}) as Record<string, unknown>;

    // Only keys the step actually asks for. A form is a contract written in
    // the playbook; accepting anything else would let a task carry data no
    // version of the process ever asked for.
    const known = new Set(loaded.fields.map((f) => f.key));
    const answers: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(submitted)) {
      if (known.has(key)) answers[key] = value;
    }

    const missing = loaded.fields
      .filter((f) => f.required)
      .filter((f) => {
        const v = answers[f.key];
        return v === undefined || v === null || String(v).trim() === "";
      });

    const { error: saveError } = await supabase
      .from("tasks")
      .update({ form_data: answers, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (saveError) {
      log.error("Failed to save task form", saveError);
      return NextResponse.json(
        { error: "Failed to save the form" },
        { status: 500 }
      );
    }

    // The requirement follows the answers in both directions: filling the last
    // required field satisfies it, clearing one takes it back. A half-filled
    // form that still reads as satisfied is worse than no gate at all.
    const complete = missing.length === 0;

    const { error: reqError } = await supabase
      .from("task_completion_requirements")
      .update({
        is_satisfied: complete,
        satisfied_at: complete ? new Date().toISOString() : null,
        satisfied_by: complete ? user.id : null,
      })
      .eq("task_id", id)
      .eq("requirement_type", "form");

    if (reqError) {
      log.warn("Saved the form but could not update its requirement", {
        taskId: id,
        error: reqError.message,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        answers,
        complete,
        missing: missing.map((f) => f.label),
      },
    });
  } catch (error) {
    log.error("Error saving task form", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

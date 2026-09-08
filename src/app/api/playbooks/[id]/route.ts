/**
 * GET /api/playbooks/[id] - one definition with its ordered steps
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { replaceSteps } from "../route";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data: playbook } = await supabase
      .from("procedure_definitions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!playbook) {
      return NextResponse.json(
        { error: "Playbook not found" },
        { status: 404 }
      );
    }

    // Parents first so the client can nest without a second pass.
    const { data: steps } = await supabase
      .from("procedure_step_definitions")
      .select("*")
      .eq("definition_id", id)
      .eq("is_current", true)
      .order("display_order");

    // Dependencies come back attached to the step that waits, so the editor
    // can show "waits for" without a second round trip.
    const stepIds = (steps || []).map((s) => s.id as string);
    let depsByStep: Record<string, string[]> = {};
    if (stepIds.length > 0) {
      const { data: deps } = await supabase
        .from("procedure_step_dependencies")
        .select("step_id, depends_on_step_id")
        .in("step_id", stepIds);
      for (const d of deps || []) {
        (depsByStep[d.step_id as string] ||= []).push(
          d.depends_on_step_id as string
        );
      }
    }

    return NextResponse.json({
      playbook,
      steps: (steps || []).map((s) => ({
        ...s,
        depends_on_step_ids: depsByStep[s.id as string] || [],
      })),
    });
  } catch (error) {
    console.error("Playbook GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/playbooks/[id] - update a definition and replace its steps
 *
 * Editing steps bumps `version`. Live runs pinned their version at start, so
 * they keep the rules they began under; only new runs pick up the change.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { data: existing } = await supabase
      .from("procedure_definitions")
      .select("id, version, is_protected, status")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: "Playbook not found" },
        { status: 404 }
      );
    }

    const stepsChanged = Array.isArray(body.steps);

    /**
     * A committed playbook's contract is frozen.
     *
     * Steps, gates, order, dependencies and hours are what a running plan
     * agreed to. Wording is not, and forcing a new version to fix a typo is
     * how a process stops being maintained - so the name, the description and
     * a step's instructions stay editable in service. Revise it to change what
     * it actually asks people to do.
     */
    if (stepsChanged && existing.status === "committed") {
      return NextResponse.json(
        {
          error:
            "This playbook is in service, so its steps cannot change. Revise it to make a new version.",
          reason: "committed",
        },
        { status: 409 }
      );
    }

    // A superseded version is history, and a plan may still be following it -
    // PRJ_20251219_0001 follows v1 today. Editing it would rewrite what that
    // plan agreed to, which is the whole thing version pinning prevents.
    if (existing.status === "superseded") {
      return NextResponse.json(
        {
          error:
            "This version has been superseded. Plans that adopted it still follow it, so it cannot be changed.",
          reason: "superseded",
        },
        { status: 409 }
      );
    }

    if (existing.status === "retired") {
      return NextResponse.json(
        {
          error:
            "This playbook is retired. Plans already running it are unaffected, but it cannot be changed.",
          reason: "retired",
        },
        { status: 409 }
      );
    }

    const update: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) update.name = body.name?.trim();
    if (body.description !== undefined)
      update.description = body.description?.trim() || null;
    if (body.applies_to !== undefined) update.applies_to = body.applies_to;
    // Null is meaningful here - it means the playbook suits any kind of
    // business - so an explicit null must be distinguishable from "untouched".
    if (body.tenant_type !== undefined)
      update.tenant_type = body.tenant_type || null;
    if (body.auto_start !== undefined) update.auto_start = body.auto_start;
    if (body.auto_start_project_category !== undefined)
      update.auto_start_project_category =
        body.auto_start_project_category || null;
    if (body.is_active !== undefined) update.is_active = body.is_active;
    if (body.enforce_order !== undefined)
      update.enforce_order = body.enforce_order;
    if (body.is_protected !== undefined)
      update.is_protected = body.is_protected;
    /*
     * Saving does not move the version. It used to, from when a version was a
     * number on a single row and a save was the only way to make one - so a
     * draft edited over several days walked its number up on every save, and
     * this playbook reached v8 with v4 to v7 having never existed.
     *
     * A version is a row now. Revise creates the next one; commit puts it into
     * service. Writing a playbook takes a team days of drafting, and none of
     * that should count as a version of anything.
     */

    const { error } = await supabase
      .from("procedure_definitions")
      .update(update)
      .eq("id", id);

    if (error) {
      console.error("Error updating playbook:", error);
      return NextResponse.json(
        { error: "Failed to update the playbook" },
        { status: 500 }
      );
    }

    let stepCount: number | undefined;
    if (stepsChanged) {
      const result = await replaceSteps(supabase, id, body.steps);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      stepCount = result.count;
    }

    const { data: playbook } = await supabase
      .from("procedure_definitions")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json({ playbook, step_count: stepCount });
  } catch (error) {
    console.error("Playbook PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/playbooks/[id]
 *
 * Refused if any run references it - a run keeps a foreign key to its
 * definition so its history stays readable. Deactivate instead.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const supabase = await createClient();

    const { count } = await supabase
      .from("procedure_runs")
      .select("id", { count: "exact", head: true })
      .eq("definition_id", id);

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: `This playbook has been run ${count} time${
            count === 1 ? "" : "s"
          }. Deactivate it instead so that history stays intact.`,
        },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("procedure_definitions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting playbook:", error);
      return NextResponse.json(
        { error: "Failed to delete the playbook" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Playbook DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

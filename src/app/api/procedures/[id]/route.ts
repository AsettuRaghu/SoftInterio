/**
 * GET /api/procedures/[id] - one definition with its ordered steps
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

    const { data: procedure } = await supabase
      .from("procedure_definitions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!procedure) {
      return NextResponse.json(
        { error: "Procedure not found" },
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

    return NextResponse.json({ procedure, steps: steps || [] });
  } catch (error) {
    console.error("Procedure GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/procedures/[id] - update a definition and replace its steps
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
      .select("id, version, is_protected")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: "Procedure not found" },
        { status: 404 }
      );
    }

    const stepsChanged = Array.isArray(body.steps);

    const update: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) update.name = body.name?.trim();
    if (body.description !== undefined)
      update.description = body.description?.trim() || null;
    if (body.applies_to !== undefined) update.applies_to = body.applies_to;
    if (body.is_active !== undefined) update.is_active = body.is_active;
    if (body.enforce_order !== undefined)
      update.enforce_order = body.enforce_order;
    if (body.is_protected !== undefined)
      update.is_protected = body.is_protected;
    // Changing the steps changes the contract, so the version moves.
    if (stepsChanged) update.version = existing.version + 1;

    const { error } = await supabase
      .from("procedure_definitions")
      .update(update)
      .eq("id", id);

    if (error) {
      console.error("Error updating procedure:", error);
      return NextResponse.json(
        { error: "Failed to update the procedure" },
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

    const { data: procedure } = await supabase
      .from("procedure_definitions")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json({ procedure, step_count: stepCount });
  } catch (error) {
    console.error("Procedure PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/procedures/[id]
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
          error: `This procedure has been run ${count} time${
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
      console.error("Error deleting procedure:", error);
      return NextResponse.json(
        { error: "Failed to delete the procedure" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Procedure DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Playbooks
 * GET /api/playbooks - list definitions, optionally for one entity type
 *
 * A definition is a reusable workflow: ordered steps with completion gates.
 * It replaces task templates, which could spawn tasks but enforce nothing.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function GET(request: NextRequest) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const supabase = await createClient();
    const appliesTo = request.nextUrl.searchParams.get("applies_to");
    const includeInactive =
      request.nextUrl.searchParams.get("include_inactive") === "true";

    let query = supabase
      .from("procedure_definitions")
      .select("*, steps:procedure_step_definitions!inner(count)")
      .order("name");

    if (appliesTo) query = query.eq("applies_to", appliesTo);
    if (!includeInactive) query = query.eq("is_active", true);

    const { data, error } = await query;

    if (error) {
      console.error("Error listing playbooks:", error);
      return NextResponse.json(
        { error: "Failed to load playbooks" },
        { status: 500 }
      );
    }

    const playbooks = (data || []).map((p: any) => ({
      ...p,
      step_count: p.steps?.[0]?.count ?? 0,
      steps: undefined,
    }));

    return NextResponse.json({ playbooks });
  } catch (error) {
    console.error("Playbooks GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/playbooks - create a definition together with its steps
 *
 * Steps arrive as a flat, ordered list carrying an optional parent index, so
 * the client never has to invent ids. Nesting is resolved here.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const body = await request.json();

    const name = (body.name as string)?.trim();
    const appliesTo = body.applies_to as string;

    if (!name) {
      return NextResponse.json({ error: "A name is required" }, { status: 400 });
    }
    if (!["lead", "project", "quotation", "client"].includes(appliesTo)) {
      return NextResponse.json(
        { error: "applies_to must be lead, project, quotation or client" },
        { status: 400 }
      );
    }

    const { data: definition, error } = await supabase
      .from("procedure_definitions")
      .insert({
        tenant_id: user.tenantId,
        name,
        description: (body.description as string)?.trim() || null,
        applies_to: appliesTo,
        // Which kind of business this playbook is written for. An interiors
        // firm and an architecture practice run different processes, and the
        // tenant_type enum already knows the difference. Null means it suits
        // any of them.
        tenant_type: (body.tenant_type as string) || null,
        is_active: body.is_active !== false,
        enforce_order: body.enforce_order === true,
        is_protected: body.is_protected === true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error || !definition) {
      console.error("Error creating playbook:", error);
      if (error?.code === "23505") {
        return NextResponse.json(
          { error: "A playbook with this name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create the playbook" },
        { status: 500 }
      );
    }

    const created = await replaceSteps(supabase, definition.id, body.steps || []);
    if (created.error) {
      // Without steps the definition is useless, so do not leave a husk behind.
      await supabase.from("procedure_definitions").delete().eq("id", definition.id);
      return NextResponse.json({ error: created.error }, { status: 500 });
    }

    return NextResponse.json(
      { playbook: definition, step_count: created.count },
      { status: 201 }
    );
  } catch (error) {
    console.error("Playbook POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Write a flat step list, resolving parent_index into real parent ids.
 * Parents must be inserted before their children can reference them.
 */
export async function replaceSteps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  definitionId: string,
  steps: any[]
): Promise<{ count: number; error?: string }> {
  // Supersede rather than delete. tasks.procedure_step_id is ON DELETE SET
  // NULL, so deleting here would strip action_type, can_skip and instructions
  // from every task in a run already under way - defeating the version
  // pinning that exists to stop exactly that.
  await supabase
    .from("procedure_step_definitions")
    .update({ is_current: false })
    .eq("definition_id", definitionId)
    .eq("is_current", true);

  if (!Array.isArray(steps) || steps.length === 0) {
    return { count: 0 };
  }

  const idByIndex = new Map<number, string>();
  let order = 0;

  // Two passes: top-level first, then children, so parents always exist.
  for (const pass of [0, 1]) {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const hasParent =
        step.parent_index !== undefined &&
        step.parent_index !== null &&
        step.parent_index !== "";
      if ((pass === 0) === hasParent) continue;
      if (!step.title?.trim()) continue;

      order += 1;
      const { data, error } = await supabase
        .from("procedure_step_definitions")
        .insert({
          definition_id: definitionId,
          parent_step_id: hasParent
            ? idByIndex.get(Number(step.parent_index)) ?? null
            : null,
          title: step.title.trim(),
          description: step.description?.trim() || null,
          instructions: step.instructions?.trim() || null,
          display_order: order,
          action_type: step.action_type || "manual",
          required_upload_types:
            step.action_type === "upload" && step.required_upload_types?.length
              ? step.required_upload_types
              : null,
          approval_role: step.approval_role || null,
          // A named person is an explicit decision; the role is a fallback the
          // run only resolves when exactly one user holds it.
          assign_to_user: step.assign_to_user || null,
          assign_to_role: step.assign_to_role || null,
          duration_days: step.duration_days ?? null,
          // Kept in step with the new field so anything still reading the old
          // column sees a consistent value rather than a stale one.
          relative_due_days: null,
          estimated_hours: step.estimated_hours ?? null,
          priority: step.priority || "medium",
          is_required: step.is_required !== false,
          can_skip: step.can_skip === true,
          skip_requires_reason: step.skip_requires_reason !== false,
          allow_parallel: step.allow_parallel === true,
        })
        .select("id")
        .single();

      if (error || !data) {
        console.error("Error creating step:", error);
        return { count: order, error: "Failed to save the steps" };
      }
      if (!hasParent) idByIndex.set(i, data.id);
    }
  }

  return { count: order };
}

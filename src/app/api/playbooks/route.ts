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
    // Every version comes back; the grouping below picks which one represents
    // the playbook and hands the rest over as its history.

    const { data, error } = await query;

    if (error) {
      console.error("Error listing playbooks:", error);
      return NextResponse.json(
        { error: "Failed to load playbooks" },
        { status: 500 }
      );
    }

    const rows = (data || []).map((p: any) => ({
      ...p,
      step_count: p.steps?.[0]?.count ?? 0,
      steps: undefined,
    }));

    /**
     * One entry per playbook, not per version.
     *
     * A version is a row now, so the list would otherwise show "Modular Design
     * Template" three times. The row that represents the playbook is the one
     * in service; failing that the open draft, so a playbook being written for
     * the first time is still visible; failing that the newest version, which
     * is how a fully retired playbook still appears.
     */
    const byFamily = new Map<string, any[]>();
    for (const row of rows) {
      const family = row.root_id ?? row.id;
      (byFamily.get(family) ?? byFamily.set(family, []).get(family)!).push(row);
    }

    const playbooks = [...byFamily.values()]
      .map((versions) => {
        const ordered = [...versions].sort((a, b) => b.version - a.version);
        const head =
          ordered.find((v) => v.status === "committed") ??
          ordered.find((v) => v.status === "draft") ??
          ordered[0];

        return {
          ...head,
          versions: ordered.map((v) => ({
            id: v.id,
            version: v.version,
            status: v.status,
            step_count: v.step_count,
            updated_at: v.updated_at,
          })),
        };
      })
      .filter((p) => includeInactive || p.status !== "retired")
      .sort((a, b) => a.name.localeCompare(b.name));

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
        auto_start: body.auto_start === true,
        auto_start_project_category:
          (body.auto_start_project_category as string) || null,
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
  // Every step by index, not just the top-level ones idByIndex tracks for
  // parenting - a dependency can name any step.
  const allIdByIndex = new Map<number, string>();
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
          // Carried from the previous version where the editor knew it;
          // omitted for a new step, so the default generates one.
          ...(step.step_key ? { step_key: step.step_key } : {}),
          title: step.title.trim(),
          description: step.description?.trim() || null,
          // Carried through even though nothing edits it yet: dropping a field
          // on save because the editor has no control for it is how a playbook
          // quietly loses configuration.
          form_schema: step.form_schema ?? null,
          instructions: step.instructions?.trim() || null,
          display_order: order,
          action_type: step.action_type || "manual",
          required_upload_types:
            step.action_type === "upload" && step.required_upload_types?.length
              ? step.required_upload_types
              : null,
          approval_role: step.approval_role || null,
          checklist_items:
            step.action_type === "checklist" && step.checklist_items?.length
              ? step.checklist_items
              : null,
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
      allIdByIndex.set(i, data.id);
    }
  }

  // A third pass, once every step exists and can be pointed at. Dependencies
  // are given as indexes into the submitted list, the same way parents are.
  for (let i = 0; i < steps.length; i++) {
    const from = allIdByIndex.get(i);
    const wanted: unknown = steps[i]?.depends_on;
    if (!from || !Array.isArray(wanted) || wanted.length === 0) continue;

    for (const rawIndex of wanted) {
      const to = allIdByIndex.get(Number(rawIndex));
      // Self-reference would never start, and the constraint would reject it
      // anyway; skipping keeps the save from failing over a stale index.
      if (!to || to === from) continue;

      const { error } = await supabase
        .from("procedure_step_dependencies")
        .insert({ step_id: from, depends_on_step_id: to, dependency_type: "hard" });

      if (error) {
        console.error("Error saving a step dependency:", error);
      }
    }
  }

  return { count: order };
}

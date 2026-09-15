/**
 * The kick-off checklist.
 *
 *   GET  /api/projects/:id/kickoff   what is done and what is still missing
 *   POST /api/projects/:id/kickoff   Confirm - body { note }
 *
 * Kick-off is how a project goes from `new` to `in_progress`: the project
 * manager reviews what Sales handed over, chooses the playbook, sets owners
 * and dates on the stages, puts an expected date on everything the client
 * (or a vendor) must do, and confirms with a note. GET assembles that state;
 * POST hands it to kick_off_project(), which checks again and writes
 * everything in one transaction or nothing.
 *
 * Who may confirm: anyone who may edit the project, and who may create tasks
 * - because a plan is tasks. Both checked, no new permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";
import { suggestProjectPlaybook } from "@/lib/playbooks/auto-start";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);
  try {
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "read",
    });
    if (!gate.ok) return gate.response;

    const { data: project } = await supabase
      .from("projects")
      .select(
        `id, status, project_category, expected_start_date, expected_end_date,
         committed_start_date, committed_end_date, handover_reviewed_at,
         kicked_off_at, quotation_id, lead_id, property_id, project_manager_id,
         client:clients!client_id(name, phone, email),
         property:properties!property_id(property_name, city, property_type, category, carpet_area)`
      )
      .eq("id", id)
      .single();
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const [{ data: run }, { data: quotation }, { count: noteCount }, { count: spaceCount }, { data: lead }, suggested] =
      await Promise.all([
        supabase
          .from("procedure_runs")
          .select("id, definition_id, definition_name, definition_version, started_at")
          .eq("related_type", "project")
          .eq("related_id", id)
          .eq("status", "active")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        project.quotation_id
          ? supabase
              .from("quotations")
              .select("id, quotation_number, version, status, grand_total")
              .eq("id", project.quotation_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("project_notes").select("*", { count: "exact", head: true }).eq("project_id", id),
        project.property_id
          ? supabase
              .from("property_scope_items")
              .select("*", { count: "exact", head: true })
              .eq("property_id", project.property_id)
          : Promise.resolve({ count: 0 }),
        project.lead_id
          ? supabase
              .from("leads")
              .select("lead_number, service_type, expected_project_start, target_end_date, won_amount, assigned_to")
              .eq("id", project.lead_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        suggestProjectPlaybook(supabase, {
          tenantId: user.tenantId,
          projectCategory: project.project_category,
        }),
      ]);

    // Stages: the run's top-level tasks, with owner and dates.
    let stages: any[] = [];
    if (run) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, assigned_to, start_date, due_date, estimated_hours, procedure_step_id, status")
        .eq("procedure_run_id", run.id)
        .is("parent_task_id", null);
      const { data: order } = await supabase
        .from("procedure_step_definitions")
        .select("id, display_order")
        .eq("definition_id", run.definition_id);
      const pos = new Map((order ?? []).map((s) => [s.id, s.display_order ?? 0]));
      const ids = [...new Set((tasks ?? []).map((t) => t.assigned_to).filter(Boolean))] as string[];
      const { data: people } = ids.length
        ? await supabase.from("tenant_directory").select("id, name").in("id", ids)
        : { data: [] as { id: string; name: string }[] };
      const nameOf = new Map((people ?? []).map((p) => [p.id, p.name]));
      stages = (tasks ?? [])
        .sort((a, b) => (pos.get(a.procedure_step_id) ?? 0) - (pos.get(b.procedure_step_id) ?? 0))
        .map((t) => ({
          id: t.id,
          title: t.title,
          assigned_to: t.assigned_to,
          assigned_name: t.assigned_to ? (nameOf.get(t.assigned_to) ?? null) : null,
          start_date: t.start_date,
          due_date: t.due_date,
          estimated_hours: t.estimated_hours,
        }));
    }

    const { data: dependencies } = await supabase
      .from("project_dependencies")
      .select("id, task_id, owner_type, counterpart, description, expected_by, raised_at, resolved_at")
      .eq("project_id", id)
      .order("raised_at", { ascending: true });

    // The same checks kick_off_project() makes, so the page can say what is
    // missing before anyone presses Confirm.
    const missing: string[] = [];
    if (!project.handover_reviewed_at) missing.push("handover_review");
    if (!run) missing.push("playbook");
    if (run && stages.some((s) => !s.assigned_to)) missing.push("stage_owners");
    if (run && stages.some((s) => !s.start_date || !s.due_date)) missing.push("stage_dates");
    if ((dependencies ?? []).some((d) => !d.resolved_at && !d.expected_by)) missing.push("ask_dates");

    return NextResponse.json({
      success: true,
      data: {
        status: project.status,
        kicked_off_at: project.kicked_off_at,
        handover_reviewed_at: project.handover_reviewed_at,
        committed: { start: project.committed_start_date, end: project.committed_end_date },
        expected: { start: project.expected_start_date, end: project.expected_end_date },
        handover: {
          client: project.client,
          property: project.property,
          quotation,
          lead,
          note_count: noteCount ?? 0,
          space_count: spaceCount ?? 0,
        },
        playbook: run
          ? { runId: run.id, definitionId: run.definition_id, name: run.definition_name, version: run.definition_version }
          : null,
        suggested_playbook: suggested,
        stages,
        dependencies: dependencies ?? [],
        missing,
      },
    });
  } catch (error) {
    log.error("Kick-off checklist failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);
  try {
    const guard = await protectApiRoute(request, {
      loadPermissions: true,
      // A plan is tasks; confirming kick-off is what makes them real work.
      requiredPermissions: ["tasks.create"],
    });
    if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    const body = await request.json().catch(() => ({}));
    const note = typeof body.note === "string" ? body.note.trim() : "";

    const { data, error } = await supabase.rpc("kick_off_project", {
      p_project_id: id,
      p_user_id: user.id,
      p_note: note,
    });

    if (error) {
      log.error("kick_off_project failed", error, { projectId: id });
      return NextResponse.json({ error: "Could not kick off the project" }, { status: 500 });
    }

    const result = data as {
      success: boolean;
      error?: string;
      missing?: string[];
      unowned_stages?: string[];
      undated_stages?: string[];
      undated_asks?: string[];
      baseline_id?: string;
    };

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error ?? "The kick-off checklist is not complete",
          missing: result.missing ?? [],
          unowned_stages: result.unowned_stages ?? [],
          undated_stages: result.undated_stages ?? [],
          undated_asks: result.undated_asks ?? [],
        },
        { status: 409 }
      );
    }

    log.info("Project kicked off", { projectId: id, baselineId: result.baseline_id });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    log.error("Kick-off failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

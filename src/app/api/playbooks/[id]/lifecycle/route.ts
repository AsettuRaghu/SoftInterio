import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";

/**
 * Move a playbook through its life: commit, revise, retire.
 *
 * A version is a row, not a number on a row. That is what lets v3 stay in
 * service while v4 is being written - the earlier design flipped the single
 * row to draft, and since nothing but a committed playbook can be run, revising
 * took the process out of service until the editing was finished.
 *
 * So revising creates the next version beside the current one, copying its
 * steps to start from. Committing puts that version into service and
 * supersedes the one before it. Plans already running are untouched by any of
 * it: a run points at the row it adopted, which keeps its own steps.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["tasks.templates.edit"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json().catch(() => ({}));
    const action = body.action as string;

    if (!["commit", "revise", "retire"].includes(action)) {
      return NextResponse.json(
        { error: "action must be commit, revise or retire" },
        { status: 400 }
      );
    }

    const { data: playbook } = await supabase
      .from("procedure_definitions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!playbook) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
    }

    if (playbook.is_protected) {
      return NextResponse.json(
        {
          error:
            "This is a standard playbook. Copy it to make a version you control.",
          reason: "protected",
        },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------------- revise
    if (action === "revise") {
      if (playbook.status !== "committed") {
        return NextResponse.json(
          { error: `Only a playbook in service can be revised.` },
          { status: 409 }
        );
      }

      // One draft at a time. Two open drafts of one process is a question
      // nobody wants to answer at commit time.
      const { data: openDraft } = await supabase
        .from("procedure_definitions")
        .select("id, version")
        .eq("root_id", playbook.root_id)
        .eq("status", "draft")
        .maybeSingle();

      if (openDraft) {
        return NextResponse.json(
          {
            error: `Version ${openDraft.version} is already being drafted.`,
            reason: "draft_exists",
            draftId: openDraft.id,
          },
          { status: 409 }
        );
      }

      const { data: highest } = await supabase
        .from("procedure_definitions")
        .select("version")
        .eq("root_id", playbook.root_id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (highest?.version ?? playbook.version) + 1;

      const { data: draft, error: draftError } = await supabase
        .from("procedure_definitions")
        .insert({
          tenant_id: playbook.tenant_id,
          root_id: playbook.root_id,
          name: playbook.name,
          description: playbook.description,
          version: nextVersion,
          applies_to: playbook.applies_to,
          tenant_type: playbook.tenant_type,
          enforce_order: playbook.enforce_order,
          // The flag belongs to whichever version is in service, so a draft
          // never competes with the live one for the auto-start slot.
          auto_start: false,
          auto_start_project_category: playbook.auto_start_project_category,
          is_protected: false,
          is_active: false,
          status: "draft",
          created_by: user.id,
          updated_by: user.id,
        })
        .select("id, version")
        .single();

      if (draftError || !draft) {
        log.error("Could not open a revision", draftError, { playbookId: id });
        return NextResponse.json(
          { error: "Could not open a revision" },
          { status: 500 }
        );
      }

      // Start from what is in service rather than a blank page - a revision is
      // almost always two changes in twenty-five steps.
      const { data: steps } = await supabase
        .from("procedure_step_definitions")
        .select("*")
        .eq("definition_id", playbook.id)
        .eq("is_current", true)
        .order("display_order");

      const newIdByOld = new Map<string, string>();
      const ordered = [
        ...(steps ?? []).filter((s) => !s.parent_step_id),
        ...(steps ?? []).filter((s) => s.parent_step_id),
      ];

      for (const step of ordered) {
        const {
          id: oldId,
          definition_id: _d,
          created_at: _c,
          updated_at: _u,
          parent_step_id,
          ...rest
        } = step;

        const { data: made } = await supabase
          .from("procedure_step_definitions")
          .insert({
            ...rest,
            definition_id: draft.id,
            parent_step_id: parent_step_id
              ? (newIdByOld.get(parent_step_id) ?? null)
              : null,
          })
          .select("id")
          .single();

        if (made) newIdByOld.set(oldId, made.id);
      }

      // Dependencies are between steps, so they are remapped onto the copies.
      const oldIds = [...newIdByOld.keys()];
      if (oldIds.length > 0) {
        const { data: deps } = await supabase
          .from("procedure_step_dependencies")
          .select("step_id, depends_on_step_id, dependency_type")
          .in("step_id", oldIds);

        for (const d of deps ?? []) {
          const from = newIdByOld.get(d.step_id as string);
          const to = newIdByOld.get(d.depends_on_step_id as string);
          if (!from || !to) continue;
          await supabase.from("procedure_step_dependencies").insert({
            step_id: from,
            depends_on_step_id: to,
            dependency_type: d.dependency_type,
          });
        }
      }

      log.info("Playbook revision opened", {
        rootId: playbook.root_id,
        from: playbook.version,
        to: draft.version,
        steps: ordered.length,
      });

      return NextResponse.json({
        success: true,
        status: "draft",
        draftId: draft.id,
        version: draft.version,
      });
    }

    // ---------------------------------------------------------------- commit
    if (action === "commit") {
      if (playbook.status !== "draft") {
        return NextResponse.json(
          { error: "Only a draft can be put into service." },
          { status: 409 }
        );
      }

      const { count } = await supabase
        .from("procedure_step_definitions")
        .select("id", { count: "exact", head: true })
        .eq("definition_id", id)
        .eq("is_current", true);

      if (!count) {
        return NextResponse.json(
          { error: "Add at least one step before putting this into service." },
          { status: 409 }
        );
      }

      // Supersede first. The auto-start index allows one committed row per
      // category, so the outgoing version has to step aside before this one
      // takes its place.
      const { data: outgoing } = await supabase
        .from("procedure_definitions")
        .select("id, auto_start, auto_start_project_category")
        .eq("root_id", playbook.root_id)
        .eq("status", "committed")
        .maybeSingle();

      if (outgoing) {
        await supabase
          .from("procedure_definitions")
          .update({ status: "superseded", is_active: false, auto_start: false })
          .eq("id", outgoing.id);
      }

      const { error } = await supabase
        .from("procedure_definitions")
        .update({
          status: "committed",
          is_active: true,
          // The new version inherits how the old one was adopted.
          auto_start: outgoing?.auto_start ?? playbook.auto_start,
          auto_start_project_category:
            outgoing?.auto_start_project_category ??
            playbook.auto_start_project_category,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        log.error("Could not put a playbook into service", error, {
          playbookId: id,
        });
        return NextResponse.json(
          { error: "Could not put this into service" },
          { status: 500 }
        );
      }

      log.info("Playbook version in service", {
        rootId: playbook.root_id,
        version: playbook.version,
        superseded: outgoing?.id ?? null,
      });

      return NextResponse.json({ success: true, status: "committed" });
    }

    // ---------------------------------------------------------------- retire
    if (playbook.status !== "committed") {
      return NextResponse.json(
        { error: "Only a playbook in service can be retired." },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("procedure_definitions")
      .update({
        status: "retired",
        is_active: false,
        auto_start: false,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      log.error("Could not retire a playbook", error, { playbookId: id });
      return NextResponse.json(
        { error: "Could not retire this playbook" },
        { status: 500 }
      );
    }

    log.info("Playbook retired", {
      rootId: playbook.root_id,
      version: playbook.version,
    });

    return NextResponse.json({ success: true, status: "retired" });
  } catch (error) {
    log.error("Unhandled error changing playbook status", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

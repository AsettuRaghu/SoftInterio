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
      if (playbook.is_protected) {
        return NextResponse.json(
          {
            error:
              "This playbook is provided by SoftInterio. Copy it first, then revise your copy.",
          },
          { status: 409 }
        );
      }

      if (playbook.status !== "committed" && playbook.status !== "retired") {
        return NextResponse.json(
          { error: "Only a playbook in service can be revised." },
          { status: 409 }
        );
      }

      /**
       * One transaction, in the database.
       *
       * This used to be four statements from here - the draft, the parents,
       * the children, the dependencies - and between any two of them the draft
       * was visible half made. The editor renders whatever it finds, nesting
       * children under their parent and silently dropping any child whose
       * parent is missing, so a draft caught mid-copy looks like a complete,
       * shorter playbook. Saving from that screen then rewrites the draft to
       * match, and the steps that never copied are gone for good. That is
       * twice now, both times leaving 8 phases and none of their 24 steps.
       *
       * Application-level rollback could not close the window: the request can
       * be abandoned between statements - a navigation, a recompile, a dropped
       * connection - and then no rollback code runs at all. Either the whole
       * revision exists or none of it does.
       *
       * It is also about twelve times faster, which is what made the button
       * look dead long enough for people to click away mid-copy.
       */
      const { data: result, error: rpcError } = await supabase.rpc(
        "revise_playbook",
        { p_definition_id: id, p_user_id: user.id }
      );

      if (rpcError) {
        log.error("Revision failed", rpcError, { playbookId: id });
        return NextResponse.json(
          {
            error:
              "Could not open a revision. Nothing was changed; the version in service is untouched.",
            reason: "revision_failed",
          },
          { status: 500 }
        );
      }

      const outcome = result as {
        success: boolean;
        error?: string;
        draft_id?: string;
        version?: number;
        steps?: number;
      };

      if (!outcome?.success) {
        return NextResponse.json(
          { error: outcome?.error ?? "Could not open a revision", draftId: outcome?.draft_id },
          { status: 409 }
        );
      }

      log.info("Playbook revision opened", {
        rootId: playbook.root_id,
        from: playbook.version,
        to: outcome.version,
        steps: outcome.steps,
      });

      return NextResponse.json({
        success: true,
        status: "draft",
        draftId: outcome.draft_id,
        version: outcome.version,
      });
    }

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

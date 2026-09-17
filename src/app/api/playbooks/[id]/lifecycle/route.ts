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
      /**
       * One transaction, and it moves everything.
       *
       * Putting a version into service used to change only what NEW plans
       * adopt - a project already running v4 stayed on v4 - which meant
       * several versions were live at once, and that was most of what made
       * this confusing. Decided 2026-09-09: going live makes this THE version,
       * so every running plan moves onto it.
       *
       * Existing work is matched by step_key, which is stable across
       * revisions. A task keeps its status, its logged hours, its comments and
       * its attachments, and simply points at the same step in the newer
       * version. A step that is gone has its task cancelled only if nobody has
       * touched it; one with work on it is left exactly as it is.
       */
      const { data: result, error: rpcError } = await supabase.rpc(
        "commit_playbook_version",
        { p_definition_id: id, p_user_id: user.id }
      );

      if (rpcError) {
        log.error("Could not put the playbook into service", rpcError, {
          playbookId: id,
        });
        return NextResponse.json(
          { error: "Could not put this version into service. Nothing was changed." },
          { status: 500 }
        );
      }

      const outcome = result as {
        success: boolean;
        error?: string;
        version?: number;
        runs_moved?: number;
        tasks_added?: number;
        tasks_cancelled?: number;
        ticks_refreshed?: number;
      };

      if (!outcome?.success) {
        return NextResponse.json(
          { error: outcome?.error ?? "Could not put this version into service" },
          { status: 409 }
        );
      }

      log.info("Playbook version put into service", {
        playbookId: id,
        version: outcome.version,
        runsMoved: outcome.runs_moved,
        tasksAdded: outcome.tasks_added,
        tasksCancelled: outcome.tasks_cancelled,
      });

      // Said plainly, because it changed live projects.
      const moved = outcome.runs_moved ?? 0;
      const parts: string[] = [];
      if (moved > 0) {
        parts.push(`${moved} running project${moved === 1 ? "" : "s"} moved onto it`);
        if (outcome.tasks_added) parts.push(`${outcome.tasks_added} step(s) added`);
        if (outcome.tasks_cancelled)
          parts.push(`${outcome.tasks_cancelled} removed step(s) cancelled`);
        if (outcome.ticks_refreshed)
          parts.push(`${outcome.ticks_refreshed} tick(s) set on steps not yet started`);
      }

      return NextResponse.json({
        success: true,
        status: "committed",
        message: parts.length
          ? `Version ${outcome.version} is live. ${parts.join(", ")}.`
          : `Version ${outcome.version} is live.`,
        runsMoved: moved,
      });
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

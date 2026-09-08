import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";

/**
 * Move a playbook through its life: commit, revise, retire.
 *
 * A playbook is written in draft, put into service by committing it, and taken
 * out of service by retiring it. Revising sends a committed playbook back to
 * draft at the next version so the steps can change again.
 *
 * Plans already running are never affected by any of this. A run pins its
 * version at the start and resolves its tasks through procedure_step_id, which
 * keeps pointing at the rows it began under.
 */

const ALLOWED: Record<string, string[]> = {
  // from -> to
  draft: ["committed"],
  committed: ["draft", "retired"],
  retired: ["committed"],
};

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

    const target =
      action === "commit"
        ? "committed"
        : action === "revise"
          ? "draft"
          : action === "retire"
            ? "retired"
            : null;

    if (!target) {
      return NextResponse.json(
        { error: "action must be commit, revise or retire" },
        { status: 400 }
      );
    }

    const { data: playbook } = await supabase
      .from("procedure_definitions")
      .select("id, name, status, version, is_protected")
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

    if (!ALLOWED[playbook.status]?.includes(target)) {
      return NextResponse.json(
        {
          error: `A ${playbook.status} playbook cannot become ${target}.`,
          reason: "invalid_transition",
        },
        { status: 409 }
      );
    }

    // Committing with no steps would put an empty process into service.
    if (target === "committed") {
      const { count } = await supabase
        .from("procedure_step_definitions")
        .select("id", { count: "exact", head: true })
        .eq("definition_id", id)
        .eq("is_current", true);

      if (!count) {
        return NextResponse.json(
          {
            error: "Add at least one step before putting this into service.",
            reason: "no_steps",
          },
          { status: 409 }
        );
      }
    }

    const update: Record<string, unknown> = {
      status: target,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // Revising opens the next version. The number moves now rather than on the
    // first edit, so a plan can say which version it is behind.
    if (action === "revise") update.version = playbook.version + 1;

    // is_active is kept in step so anything still reading it agrees.
    update.is_active = target === "committed";

    const { error } = await supabase
      .from("procedure_definitions")
      .update(update)
      .eq("id", id);

    if (error) {
      log.error("Failed to change playbook status", error, { playbookId: id });
      return NextResponse.json(
        { error: "Could not change the playbook" },
        { status: 500 }
      );
    }

    log.info("Playbook lifecycle change", {
      playbookId: id,
      name: playbook.name,
      from: playbook.status,
      to: target,
    });

    return NextResponse.json({ success: true, status: target });
  } catch (error) {
    log.error("Unhandled error changing playbook status", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

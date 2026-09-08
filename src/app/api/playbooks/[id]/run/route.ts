/**
 * POST /api/playbooks/[id]/run
 *
 * Starts a playbook against an entity. Delegates to start_procedure_run(),
 * which creates the run, materialises every step as a task (nested steps
 * become subtasks) and writes the completion requirements that gate them.
 *
 * The run snapshots the definition's version, so editing the playbook later
 * cannot change the rules of work already under way.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_ENTITIES = ["lead", "project", "quotation", "client"];

export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
        // Starting a playbook creates the tasks the team will work.
const guard = await protectApiRoute(request, {
      requiredPermissions: ["tasks.create"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    const body = await request.json();
    const relatedType = body.related_type as string;
    const relatedId = body.related_id as string;
    const startDate = body.start_date as string | undefined;

    if (!relatedType || !VALID_ENTITIES.includes(relatedType) || !relatedId) {
      return NextResponse.json(
        { error: `related_type (${VALID_ENTITIES.join("/")}) and related_id are required` },
        { status: 400 }
      );
    }

        /**
     * One plan at a time.
     *
     * Nothing stopped a second run starting beside the first, and the Plan tab
     * shows only the most recently started one - so the other kept its tasks,
     * invisible on the tab where the work is done. Stopping the current
     * playbook is the deliberate act that makes room for another.
     */
    const { data: current } = await supabase
      .from("procedure_runs")
      .select("id, definition_name")
      .eq("related_type", relatedType)
      .eq("related_id", relatedId)
      .eq("status", "active")
      .maybeSingle();

    if (current) {
      return NextResponse.json(
        {
          error: `This already follows "${current.definition_name}". Stop it before starting another.`,
          reason: "already_running",
          runId: current.id,
        },
        { status: 409 }
      );
    }

const { data, error } = await supabase.rpc("start_procedure_run", {
      p_definition_id: id,
      p_related_type: relatedType,
      p_related_id: relatedId,
      p_user_id: user.id,
      p_start_date: startDate || new Date().toISOString().slice(0, 10),
    });

    if (error) {
      log.error("Error starting playbook run", error);
      return NextResponse.json(
        { error: "Failed to start the playbook" },
        { status: 500 }
      );
    }

    // The RPC reports rule violations in its payload, not as a thrown error.
    if (!data?.success) {
      return NextResponse.json(
        { error: data?.error || "Could not start the playbook" },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, ...data }, { status: 201 });
  } catch (error) {
    log.error("Playbook run POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

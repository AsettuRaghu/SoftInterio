/**
 * POST /api/procedures/[id]/run
 *
 * Starts a procedure against an entity. Delegates to start_procedure_run(),
 * which creates the run, materialises every step as a task (nested steps
 * become subtasks) and writes the completion requirements that gate them.
 *
 * The run snapshots the definition's version, so editing the procedure later
 * cannot change the rules of work already under way.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_ENTITIES = ["lead", "project", "quotation", "client"];

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
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

    const { data, error } = await supabase.rpc("start_procedure_run", {
      p_definition_id: id,
      p_related_type: relatedType,
      p_related_id: relatedId,
      p_user_id: user.id,
      p_start_date: startDate || new Date().toISOString().slice(0, 10),
    });

    if (error) {
      console.error("Error starting procedure run:", error);
      return NextResponse.json(
        { error: "Failed to start the procedure" },
        { status: 500 }
      );
    }

    // The RPC reports rule violations in its payload, not as a thrown error.
    if (!data?.success) {
      return NextResponse.json(
        { error: data?.error || "Could not start the procedure" },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, ...data }, { status: 201 });
  } catch (error) {
    console.error("Procedure run POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Task completion requirements — the gates that must be met before a task can
 * be completed.
 *
 * GET   list them, with who signed off and when
 * PATCH sign off, or withdraw a sign-off
 *
 * This is sign-off, not routed approval: anyone who can see the task may
 * confirm it, and the record is who and when. Upload gates are excluded on
 * purpose — a file either exists or it does not, and letting someone tick it
 * by hand would make the evidence worthless.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

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

    const { data, error } = await supabase
      .from("task_completion_requirements")
      .select(
        "*, satisfied_user:users!task_completion_requirements_satisfied_by_fkey(id, name, avatar_url)"
      )
      .eq("task_id", id)
      .order("created_at");

    if (error) {
      console.error("Error loading requirements:", error);
      return NextResponse.json(
        { error: "Failed to load requirements" },
        { status: 500 }
      );
    }

    return NextResponse.json({ requirements: data || [] });
  } catch (error) {
    console.error("Requirements GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    const requirementId = body.requirement_id as string;
    const action = body.action as string;

    if (!requirementId || !["sign_off", "revoke"].includes(action)) {
      return NextResponse.json(
        { error: "requirement_id and action (sign_off | revoke) are required" },
        { status: 400 }
      );
    }

    // RLS scopes requirements through their task, so a miss means "not found
    // or not yours".
    const { data: requirement } = await supabase
      .from("task_completion_requirements")
      .select("id")
      .eq("id", requirementId)
      .eq("task_id", id)
      .maybeSingle();

    if (!requirement) {
      return NextResponse.json(
        { error: "Requirement not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase.rpc(
      action === "sign_off" ? "sign_off_requirement" : "revoke_requirement_signoff",
      action === "sign_off"
        ? {
            p_requirement_id: requirementId,
            p_user_id: user.id,
            p_note: body.note?.trim() || null,
          }
        : { p_requirement_id: requirementId, p_user_id: user.id }
    );

    if (error) {
      console.error("Error updating requirement:", error);
      return NextResponse.json(
        { error: "Failed to update the requirement" },
        { status: 500 }
      );
    }

    // The RPC reports rule violations in its payload, not as a thrown error.
    if (!data?.success) {
      return NextResponse.json(
        { error: data?.error || "Could not update the requirement" },
        { status: 409 }
      );
    }

    const { data: requirements } = await supabase
      .from("task_completion_requirements")
      .select(
        "*, satisfied_user:users!task_completion_requirements_satisfied_by_fkey(id, name, avatar_url)"
      )
      .eq("task_id", id)
      .order("created_at");

    return NextResponse.json({ success: true, requirements: requirements || [] });
  } catch (error) {
    console.error("Requirements PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

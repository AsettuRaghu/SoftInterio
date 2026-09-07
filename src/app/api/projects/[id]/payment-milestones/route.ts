import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/payment-milestones - Get all payment milestones
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

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

    // Get user's role to determine what to show
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id, role_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    // Fetch milestones
    const { data: milestones, error } = await supabase
      .from("project_payment_milestones")
      .select(
        `
        *,
        linked_phase:project_phases!linked_phase_id(id, name, status)
      `
      )
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      log.error("Error fetching payment milestones", error);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    // TODO: Filter out amount fields based on user role
    // For now, return all data - implement role check in production

    return NextResponse.json({ payment_milestones: milestones || [] });
  } catch (error) {
    log.error("Payment milestones API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/payment-milestones - Add payment milestone
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

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

    const body = await request.json();
    const {
      name,
      description,
      percentage,
      amount,
      linked_phase_id,
      trigger_condition = "on_completion",
      due_date,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Milestone name is required" },
        { status: 400 }
      );
    }

    // If percentage provided but no amount, calculate from project quoted_amount
    let calculatedAmount = amount;
    if (!calculatedAmount && percentage) {
      const { data: project } = await supabase
        .from("projects")
        .select("quoted_amount")
        .eq("id", id)
        .single();

      if (project?.quoted_amount) {
        calculatedAmount = (project.quoted_amount * percentage) / 100;
      }
    }

    const { data: milestone, error } = await supabase
      .from("project_payment_milestones")
      .insert({
        project_id: id,
        name,
        description,
        percentage,
        amount: calculatedAmount,
        linked_phase_id,
        trigger_condition,
        due_date,
      })
      .select(
        `
        *,
        linked_phase:project_phases!linked_phase_id(id, name, status)
      `
      )
      .single();

    if (error) {
      log.error("Error creating payment milestone", error);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    return NextResponse.json({ payment_milestone: milestone }, { status: 201 });
  } catch (error) {
    log.error("Payment milestones API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

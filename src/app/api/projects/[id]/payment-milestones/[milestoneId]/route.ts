import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";

interface RouteParams {
  params: Promise<{ id: string; milestoneId: string }>;
}

// PATCH /api/projects/[id]/payment-milestones/[milestoneId] - Update milestone
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;

    const { id, milestoneId } = await params;
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
      trigger_condition,
      status,
      due_date,
    } = body;

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (percentage !== undefined) updateData.percentage = percentage;
    if (amount !== undefined) updateData.amount = amount;
    if (linked_phase_id !== undefined)
      updateData.linked_phase_id = linked_phase_id;
    if (trigger_condition !== undefined)
      updateData.trigger_condition = trigger_condition;
    if (status !== undefined) updateData.status = status;
    if (due_date !== undefined) updateData.due_date = due_date;

    const { data: milestone, error } = await supabase
      .from("project_payment_milestones")
      .update(updateData)
      .eq("id", milestoneId)
      .eq("project_id", id)
      .select(
        `
        *,
        linked_phase:project_phases!linked_phase_id(id, name, status)
      `
      )
      .single();

    if (error) {
      log.error("Error updating payment milestone", error);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    return NextResponse.json({ payment_milestone: milestone });
  } catch (error) {
    log.error("Payment milestone API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/payment-milestones/[milestoneId]/record-payment - Record payment
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;

    const { id, milestoneId } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    const body = await request.json();
    const { paid_amount, payment_reference, payment_method, notes } = body;

    if (!paid_amount || paid_amount <= 0) {
      return NextResponse.json(
        { error: "Valid payment amount is required" },
        { status: 400 }
      );
    }

    const { data: milestone, error } = await supabase
      .from("project_payment_milestones")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_amount,
        payment_reference,
        payment_method,
        notes,
      })
      .eq("id", milestoneId)
      .eq("project_id", id)
      .select(
        `
        *,
        linked_phase:project_phases!linked_phase_id(id, name, status)
      `
      )
      .single();

    if (error) {
      log.error("Error recording payment", error);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    return NextResponse.json({ payment_milestone: milestone });
  } catch (error) {
    log.error("Payment milestone API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/payment-milestones/[milestoneId] - Delete milestone
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;

    const { id, milestoneId } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    // Check if milestone has been paid
    const { data: milestone } = await supabase
      .from("project_payment_milestones")
      .select("status")
      .eq("id", milestoneId)
      .eq("project_id", id)
      .single();

    if (milestone?.status === "paid") {
      return NextResponse.json(
        { error: "Cannot delete a paid milestone" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("project_payment_milestones")
      .delete()
      .eq("id", milestoneId)
      .eq("project_id", id);

    if (error) {
      log.error("Error deleting payment milestone", error);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Payment milestone API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

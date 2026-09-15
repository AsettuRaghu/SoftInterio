/**
 * One payment milestone.
 *
 *   PATCH  /api/projects/:id/payment-milestones/:milestoneId   edit, or record payment
 *   DELETE /api/projects/:id/payment-milestones/:milestoneId
 *
 * Recording a payment is gated separately on finance.payments.record, because
 * saying money arrived is a different act from planning when it should. Anyone
 * who may write the project can reshape the schedule; only someone trusted with
 * receipts may mark an instalment settled.
 *
 * Lineage is proved the same way every other project sub-route does it: the
 * milestone must belong to the project in the URL, and the project must belong
 * to the caller's tenant. project_payment_milestones carries no tenant_id - it
 * is two joins from one - so pairing a project you may open with a milestone id
 * you may not would otherwise read and write another business's money.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";

interface RouteParams {
  params: Promise<{ id: string; milestoneId: string }>;
}

const STATUSES = ["pending", "due", "overdue", "paid", "waived"] as const;
type MilestoneStatus = (typeof STATUSES)[number];

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
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

    // Lineage: this milestone must be this project's.
    const { data: existing } = await supabase
      .from("project_payment_milestones")
      .select("id, project_id, name, status, amount")
      .eq("id", milestoneId)
      .maybeSingle();

    if (!existing || existing.project_id !== id) {
      return NextResponse.json(
        { error: "Payment milestone not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ("name" in body) {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json(
          { error: "Give the milestone a name" },
          { status: 400 }
        );
      }
      update.name = name;
    }
    if ("description" in body) update.description = body.description || null;
    if ("due_date" in body) update.due_date = body.due_date || null;
    if ("notes" in body) update.notes = body.notes || null;

    if ("percentage" in body) {
      const pct = body.percentage === null ? null : Number(body.percentage);
      if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
        return NextResponse.json(
          { error: "Percentage must be between 0 and 100" },
          { status: 400 }
        );
      }
      update.percentage = pct;
    }

    if ("amount" in body) {
      const amount = body.amount === null ? null : Number(body.amount);
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
        return NextResponse.json(
          { error: "Amount cannot be negative" },
          { status: 400 }
        );
      }
      update.amount = amount;
    }

    // Recording a payment is the gated part.
    const recordsPayment =
      body.status === "paid" ||
      "paid_amount" in body ||
      "payment_reference" in body ||
      "payment_method" in body;

    if (recordsPayment) {
      const mayRecord =
        user.isSuperAdmin || guard.permissions?.has("finance.payments.record");

      if (!mayRecord) {
        log.warn("Refused a payment record", {
          milestoneId,
          userId: user.id,
          permissionsResolved: guard.permissions?.size ?? 0,
        });
        return NextResponse.json(
          {
            error:
              "You do not have permission to record a payment. Ask someone who can.",
          },
          { status: 403 }
        );
      }
    }

    if ("status" in body) {
      if (!STATUSES.includes(body.status as MilestoneStatus)) {
        return NextResponse.json(
          { error: `Status must be one of: ${STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      update.status = body.status;

      // Marking it paid stamps when, unless the caller said otherwise. Moving
      // it back off paid clears the payment details, so a milestone never
      // reads as unpaid while still carrying a receipt.
      if (body.status === "paid") {
        update.paid_at = body.paid_at || new Date().toISOString();
        if (!("paid_amount" in body)) {
          update.paid_amount = existing.amount;
        }
      } else {
        update.paid_at = null;
        update.paid_amount = null;
        update.payment_reference = null;
        update.payment_method = null;
      }
    }

    if ("paid_amount" in body) {
      const paid = body.paid_amount === null ? null : Number(body.paid_amount);
      if (paid !== null && (!Number.isFinite(paid) || paid < 0)) {
        return NextResponse.json(
          { error: "Paid amount cannot be negative" },
          { status: 400 }
        );
      }
      update.paid_amount = paid;
    }
    if ("payment_reference" in body) {
      update.payment_reference = body.payment_reference || null;
    }
    if ("payment_method" in body) {
      update.payment_method = body.payment_method || null;
    }

    const { data: milestone, error } = await supabase
      .from("project_payment_milestones")
      .update(update)
      .eq("id", milestoneId)
      .select()
      .single();

    if (error) {
      log.error("Failed to update payment milestone", error);
      return NextResponse.json(
        { error: "Failed to update the milestone" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, milestone });
  } catch (error) {
    log.error("Error updating payment milestone", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
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

    const { data: existing } = await supabase
      .from("project_payment_milestones")
      .select("id, project_id, status, name")
      .eq("id", milestoneId)
      .maybeSingle();

    if (!existing || existing.project_id !== id) {
      return NextResponse.json(
        { error: "Payment milestone not found" },
        { status: 404 }
      );
    }

    // A paid milestone is a record that money changed hands. Deleting it would
    // quietly reduce what the project was paid; waive or amend it instead.
    if (existing.status === "paid") {
      return NextResponse.json(
        {
          error:
            "This milestone has been paid and cannot be deleted. Change its status first if it was recorded in error.",
          reason: "milestone_paid",
        },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("project_payment_milestones")
      .delete()
      .eq("id", milestoneId);

    if (error) {
      log.error("Failed to delete payment milestone", error);
      return NextResponse.json(
        { error: "Failed to delete the milestone" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting payment milestone", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

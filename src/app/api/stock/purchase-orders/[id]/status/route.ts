import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Valid status transitions for PO workflow with approval
// Draft → Pending Approval → Approved/Rejected → Sent to Vendor → Dispatched → Receive Goods → Closed
// NOTE: partially_received, fully_received, and closed are system-managed
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "rejected", "cancelled"], // Approver can approve or reject
  approved: ["sent_to_vendor", "draft", "cancelled"], // Edit sends back to draft
  rejected: [], // Terminal state - cannot transition
  sent_to_vendor: ["acknowledged", "dispatched", "cancelled"],
  acknowledged: ["dispatched", "cancelled"],
  dispatched: ["cancelled"], // Receive goods via embedded GRN
  partially_received: ["cancelled"], // System-managed via goods receipt
  fully_received: ["closed"], // Can close when fully paid
  closed: [], // Terminal state
  cancelled: [],
};

// Roles that can approve POs (configurable per tenant in future)
const APPROVER_ROLES = ["owner", "admin", "manager", "director", "po_approver"];

// PATCH /api/stock/purchase-orders/[id]/status - Update PO status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status: newStatus } = body;

    if (!newStatus) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // Get user's tenant_id first
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    console.log("[PO Status] User lookup:", {
      userId: user.id,
      userData,
      userError,
    });

    if (userError || !userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    // Get user's roles separately
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select(
        `
        roles (
          slug,
          hierarchy_level
        )
      `
      )
      .eq("user_id", user.id);

    // Extract role slugs
    const userRoles = (rolesData || [])
      .map((ur: any) => ur.roles?.slug)
      .filter(Boolean);

    console.log("[PO Status] User roles:", userRoles);

    // Get current PO with created_by info
    const { data: currentPO, error: fetchError } = await supabase
      .from("stock_purchase_orders")
      .select("id, status, tenant_id, created_by, total_amount, payment_status")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (fetchError || !currentPO) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    // Check if transition is valid
    const allowedTransitions = VALID_TRANSITIONS[currentPO.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from "${currentPO.status}" to "${newStatus}"`,
          allowedTransitions,
        },
        { status: 400 }
      );
    }

    // APPROVAL PERMISSION CHECK
    // If trying to approve or reject, check if user has approval permissions
    if (newStatus === "approved" || newStatus === "rejected") {
      const canApprove = APPROVER_ROLES.some((role) =>
        userRoles.includes(role)
      );

      // Self-approval prevention: creator cannot approve their own PO unless they are owner/admin
      const isCreator = currentPO.created_by === user.id;
      const isOwnerOrAdmin = userRoles.some((r: string) =>
        ["owner", "admin"].includes(r)
      );

      if (!canApprove) {
        return NextResponse.json(
          {
            error: `You do not have permission to ${
              newStatus === "approved" ? "approve" : "reject"
            } purchase orders`,
            requiredRoles: APPROVER_ROLES,
          },
          { status: 403 }
        );
      }

      if (isCreator && !isOwnerOrAdmin) {
        return NextResponse.json(
          {
            error: `You cannot ${
              newStatus === "approved" ? "approve" : "reject"
            } your own purchase order. Please have another approver review it.`,
          },
          { status: 403 }
        );
      }

      // Check approval thresholds (optional - can be enhanced later)
      if (newStatus === "approved") {
        const { data: approvalConfig } = await supabase
          .from("approval_configs")
          .select("*")
          .eq("tenant_id", userData.tenant_id)
          .eq("config_type", "purchase_order")
          .single();

        if (approvalConfig) {
          const poAmount = currentPO.total_amount || 0;

          // Check if user's role can approve this amount
          const hasLevel3Approval = userRoles.some((role: string) =>
            ["owner", "admin", approvalConfig.level3_role].includes(role)
          );
          if (poAmount > approvalConfig.level2_limit && !hasLevel3Approval) {
            return NextResponse.json(
              {
                error: `This PO amount (${poAmount}) requires ${approvalConfig.level3_role} approval`,
                requiredRole: approvalConfig.level3_role,
              },
              { status: 403 }
            );
          }
          const hasLevel2Approval = userRoles.some((role: string) =>
            [
              "owner",
              "admin",
              approvalConfig.level2_role,
              approvalConfig.level3_role,
            ].includes(role)
          );
          if (
            poAmount > approvalConfig.level1_limit &&
            poAmount <= approvalConfig.level2_limit &&
            !hasLevel2Approval
          ) {
            return NextResponse.json(
              {
                error: `This PO amount (${poAmount}) requires ${approvalConfig.level2_role} or higher approval`,
                requiredRole: approvalConfig.level2_role,
              },
              { status: 403 }
            );
          }
        }
      }
    }

    // CLOSE STATUS CHECK
    // Can only close if fully received AND fully paid
    if (newStatus === "closed") {
      if (currentPO.status !== "fully_received") {
        return NextResponse.json(
          { error: "PO can only be closed when fully received" },
          { status: 400 }
        );
      }
      if (currentPO.payment_status !== "fully_paid") {
        return NextResponse.json(
          { error: "PO can only be closed when fully paid" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Add timestamps for specific transitions
    if (newStatus === "pending_approval") {
      updateData.submitted_for_approval_at = new Date().toISOString();
    }

    if (newStatus === "approved") {
      updateData.approved_by = user.id;
      updateData.approved_at = new Date().toISOString();
    }

    if (newStatus === "rejected") {
      updateData.rejected_by = user.id;
      updateData.rejected_at = new Date().toISOString();
      // Store rejection reason if provided
      if (body.rejection_reason) {
        updateData.rejection_reason = body.rejection_reason;
      }
    }

    if (newStatus === "sent_to_vendor") {
      updateData.sent_to_vendor_at = new Date().toISOString();
    }

    if (newStatus === "acknowledged") {
      updateData.acknowledged_at = new Date().toISOString();
    }

    if (newStatus === "dispatched") {
      updateData.dispatched_at = new Date().toISOString();
    }

    if (newStatus === "fully_received") {
      updateData.fully_received_at = new Date().toISOString();
    }

    if (newStatus === "closed") {
      updateData.closed_at = new Date().toISOString();
      updateData.closed_by = user.id;
    }

    if (newStatus === "cancelled") {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_by = user.id;
    }

    // If going back to draft (edit after approval), clear approval
    if (newStatus === "draft" && currentPO.status === "approved") {
      updateData.approved_by = null;
      updateData.approved_at = null;
    }

    // Update PO
    const { data: purchaseOrder, error: updateError } = await supabase
      .from("stock_purchase_orders")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        vendor:stock_vendors(id, name, code, contact_person, email, phone, address_line1, address_line2, city, state, pincode, gst_number),
        items:stock_purchase_order_items(
          *,
          material:stock_materials(id, name, sku, unit_of_measure),
          project:projects(id, project_number, name)
        )
      `
      )
      .single();

    if (updateError) {
      console.error("Status update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log to approval history
    await supabase.from("po_approval_history").insert({
      po_id: id,
      action:
        newStatus === "pending_approval"
          ? "submitted"
          : newStatus === "approved"
          ? "approved"
          : newStatus === "cancelled"
          ? "cancelled"
          : newStatus,
      from_status: currentPO.status,
      to_status: newStatus,
      performed_by: user.id,
    });

    return NextResponse.json({
      purchaseOrder,
      message: `Status updated to "${newStatus}"`,
    });
  } catch (error) {
    console.error("Status update API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

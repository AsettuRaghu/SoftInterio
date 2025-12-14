import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/quotations/[id]/status - Update quotation status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const body = await request.json();
    const { status, notes } = body;

    // Validate status
    const validStatuses = [
      "draft",
      "sent",
      "viewed",
      "negotiating",
      "approved",
      "rejected",
      "expired",
      "cancelled",
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if quotation exists and belongs to user's tenant
    // Also check if the linked lead is closed (won/lost/disqualified)
    const { data: existingQuotation, error: fetchError } = await supabase
      .from("quotations")
      .select(`
        id, 
        tenant_id, 
        status, 
        quotation_number,
        lead:leads!lead_id(
          id,
          stage
        )
      `)
      .eq("id", id)
      .single();

    if (fetchError || !existingQuotation) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      );
    }

    // Check if lead is closed (won/lost/disqualified)
    const lead = existingQuotation.lead as { stage?: string } | null;
    if (lead?.stage && ["won", "lost", "disqualified"].includes(lead.stage)) {
      return NextResponse.json(
        { 
          error: "Cannot change status - quotation is linked to a closed lead",
          lead_stage: lead.stage 
        },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      status,
      updated_by: user.id,
    };

    // Set timestamp fields based on status
    if (status === "sent") {
      updateData.sent_at = new Date().toISOString();
    } else if (status === "approved") {
      updateData.approved_at = new Date().toISOString();
    } else if (status === "rejected") {
      updateData.rejected_at = new Date().toISOString();
      if (notes) {
        updateData.rejection_reason = notes;
      }
    }

    // If notes provided and it's cancelled, store it in notes field
    if (status === "cancelled" && notes) {
      updateData.notes = notes;
    }

    // Update quotation status
    const { data: updated, error: updateError } = await supabase
      .from("quotations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating quotation status:", updateError);
      return NextResponse.json(
        { error: "Failed to update status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      quotation: updated,
      message: `Quotation marked as ${status}`,
    });
  } catch (error) {
    console.error("Status update API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

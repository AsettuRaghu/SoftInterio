import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Client rejects/requests changes for quotation via token
 * POST /api/quotations/client/[token]/reject
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { reason } = body;

    const supabase = await createClient();

    // Find quotation by token
    const { data: quotation, error: findError } = await supabase
      .from("quotations")
      .select("id, status, quotation_number, client_access_expires_at")
      .eq("client_access_token", token)
      .single();

    if (findError || !quotation) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired link" },
        { status: 404 }
      );
    }

    // Check if expired
    if (quotation.client_access_expires_at) {
      const expiresAt = new Date(quotation.client_access_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { success: false, error: "Link has expired" },
          { status: 410 }
        );
      }
    }

    // Check if quotation can be rejected
    const validStatuses = ["sent", "viewed", "negotiating"];
    if (!validStatuses.includes(quotation.status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Quotation cannot be modified (current status: ${quotation.status})` 
        },
        { status: 400 }
      );
    }

    // Update quotation status to negotiating (not rejected - that's final)
    // This triggers the team to revise
    const { error: updateError } = await supabase
      .from("quotations")
      .update({
        status: "negotiating",
        rejection_reason: reason || "Client requested changes",
      })
      .eq("id", quotation.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to submit feedback" },
        { status: 500 }
      );
    }

    // Log activity
    try {
      await supabase.from("quotation_activities").insert({
        quotation_id: quotation.id,
        activity_type: "negotiating",
        title: "Client Requested Changes",
        description: reason || "Client requested changes to the quotation",
        metadata: { reason },
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        user_agent: request.headers.get("user-agent"),
      });
    } catch (e) {
      // Ignore activity logging errors
    }

    return NextResponse.json({
      success: true,
      message: "Feedback submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

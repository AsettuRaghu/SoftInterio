import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Client approves quotation via token
 * POST /api/quotations/client/[token]/approve
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
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

    // Check if quotation can be approved
    const validStatuses = ["sent", "viewed", "negotiating"];
    if (!validStatuses.includes(quotation.status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Quotation cannot be approved (current status: ${quotation.status})` 
        },
        { status: 400 }
      );
    }

    // Update quotation status
    const { error: updateError } = await supabase
      .from("quotations")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", quotation.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to approve quotation" },
        { status: 500 }
      );
    }

    // Log activity
    try {
      await supabase.from("quotation_activities").insert({
        quotation_id: quotation.id,
        activity_type: "approved",
        title: "Client Approved Quotation",
        description: "Quotation was approved by the client via portal",
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        user_agent: request.headers.get("user-agent"),
      });
    } catch (e) {
      // Ignore activity logging errors
    }

    return NextResponse.json({
      success: true,
      message: "Quotation approved successfully",
    });
  } catch (error) {
    console.error("Error approving quotation:", error);
    return NextResponse.json(
      { success: false, error: "Failed to approve quotation" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/quotations - List all quotations with lead data
export async function GET(request: NextRequest) {
  try {
    // Protect API route with user status check
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const leadId = searchParams.get("lead_id");
    const leadStatus = searchParams.get("lead_status") || "active"; // active or inactive
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Use the view that pulls client data from lead
    let query = supabase
      .from("quotations_with_lead")
      .select("*", { count: "exact" });

    // Filter by lead status (active leads vs inactive leads)
    if (leadStatus === "active") {
      // Active leads: exclude won, lost, disqualified
      query = query.not("lead_stage", "in", "(won,lost,disqualified)");
    } else if (leadStatus === "inactive") {
      // Inactive leads: only won, lost, disqualified
      query = query.in("lead_stage", ["won", "lost", "disqualified"]);
    }
    // If leadStatus is "all", no filter is applied

    // Filter by status
    if (status && status !== "all") {
      if (status === "active") {
        query = query.in("status", ["draft", "sent", "viewed", "negotiating"]);
      } else {
        query = query.eq("status", status);
      }
    }

    // Filter by lead
    if (leadId) {
      query = query.eq("lead_id", leadId);
    }

    // Order by created_at desc, then version desc
    query = query
      .order("created_at", { ascending: false })
      .order("version", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: quotations, error, count } = await query;

    if (error) {
      console.error("Error fetching quotations:", error);
      return NextResponse.json(
        { error: "Failed to fetch quotations" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      quotations: quotations || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Quotations API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST is not allowed - quotations are created automatically via trigger
// or via the create_quotation_revision function
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Quotations cannot be created directly. They are auto-created when a lead moves to Proposal Discussion stage.",
    },
    { status: 400 }
  );
}

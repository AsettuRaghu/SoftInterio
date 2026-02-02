import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/sales/leads/statistics - Get lead statistics
export async function GET(request: NextRequest) {
  console.log("[GET /api/sales/leads/statistics] Starting request");

  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    console.log(
      "[GET /api/sales/leads/statistics] User authenticated:",
      user.id
    );

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error(
        "[GET /api/sales/leads/statistics] Error fetching user data:",
        userError
      );
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 500 }
      );
    }

    if (!userData?.tenant_id) {
      console.log("[GET /api/sales/leads/statistics] User has no tenant");
      return NextResponse.json(
        { error: "User not found or no tenant" },
        { status: 404 }
      );
    }
    console.log(
      "[GET /api/sales/leads/statistics] Tenant ID:",
      userData.tenant_id
    );

    // Get statistics using the database function
    console.log("[GET /api/sales/leads/statistics] Fetching statistics");
    const { data: stats, error: statsError } = await supabase.rpc(
      "get_lead_statistics",
      { p_tenant_id: userData.tenant_id }
    );

    if (statsError) {
      console.warn(
        "[GET /api/sales/leads/statistics] RPC function not available:",
        statsError.message
      );

      // Fallback to manual query if function doesn't exist yet
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select(
          "stage, won_amount, created_at, won_at, last_activity_at"
        )
        .eq("tenant_id", userData.tenant_id);

      if (leadsError) {
        console.error(
          "[GET /api/sales/leads/statistics] Error fetching leads:",
          leadsError
        );

        // Check if table doesn't exist
        if (
          leadsError.code === "42P01" ||
          leadsError.message?.includes("does not exist")
        ) {
          console.log(
            "[GET /api/sales/leads/statistics] Leads table does not exist - returning empty stats"
          );
          const emptyStats = {
            total: 0,
            new: 0,
            qualified: 0,
            disqualified: 0,
            requirement_discussion: 0,
            proposal_discussion: 0,
            won: 0,
            lost: 0,
            pipeline_value: 0,
            won_value: 0,
            this_month_new: 0,
            this_month_won: 0,
            needs_followup: 0,
          };
          return NextResponse.json({ statistics: emptyStats });
        }

        return NextResponse.json(
          { error: "Failed to fetch statistics" },
          { status: 500 }
        );
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const statistics = {
        total: leads?.length || 0,
        new: leads?.filter((l) => l.stage === "new").length || 0,
        qualified: leads?.filter((l) => l.stage === "qualified").length || 0,
        disqualified:
          leads?.filter((l) => l.stage === "disqualified").length || 0,
        requirement_discussion:
          leads?.filter((l) => l.stage === "requirement_discussion").length ||
          0,
        proposal_discussion:
          leads?.filter(
            (l) =>
              l.stage === "proposal_discussion" || l.stage === "negotiation"
          ).length || 0,
        won: leads?.filter((l) => l.stage === "won").length || 0,
        lost: leads?.filter((l) => l.stage === "lost").length || 0,
        pipeline_value: 0, // Pipeline value based on won_amount for qualified leads
        won_value:
          leads
            ?.filter((l) => l.stage === "won")
            .reduce((sum, l) => sum + (l.won_amount || 0), 0) || 0,
        this_month_new:
          leads?.filter((l) => new Date(l.created_at) >= startOfMonth).length ||
          0,
        this_month_won:
          leads?.filter(
            (l) =>
              l.stage === "won" &&
              l.won_at &&
              new Date(l.won_at) >= startOfMonth
          ).length || 0,
        needs_followup:
          leads?.filter(
            (l) =>
              !["won", "lost", "disqualified"].includes(l.stage) &&
              new Date(l.last_activity_at) < threeDaysAgo
          ).length || 0,
      };

      console.log(
        "[GET /api/sales/leads/statistics] Calculated fallback statistics"
      );
      return NextResponse.json({ statistics });
    }

    console.log(
      "[GET /api/sales/leads/statistics] Successfully fetched stats from RPC"
    );
    return NextResponse.json({ statistics: stats });
  } catch (error) {
    console.error("[GET /api/sales/leads/statistics] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

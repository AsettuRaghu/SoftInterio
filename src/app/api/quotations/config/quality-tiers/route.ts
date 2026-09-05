import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

/**
 * The quality tiers this tenant actually uses.
 *
 * Read from the cost item catalogue rather than a fixed list, because the tier
 * recorded against a scope component has to match a real cost item for pricing
 * to pick the right one later. A hard-coded set drifted immediately: it offered
 * "luxury", which no cost item carries, while omitting "signature" and
 * "classic", which several do.
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("quotation_cost_items")
      .select("quality_tier")
      .eq("tenant_id", user.tenantId)
      .not("quality_tier", "is", null);

    if (error) {
      console.error("Error loading quality tiers:", error);
      return NextResponse.json(
        { error: "Failed to load quality tiers" },
        { status: 500 }
      );
    }

    // Counted so the tiers a business leans on appear first; a tier used once
    // is more likely a stray value than a real grade.
    const counts = new Map<string, number>();
    for (const row of data || []) {
      const tier = String(row.quality_tier || "").trim().toLowerCase();
      if (tier) counts.set(tier, (counts.get(tier) || 0) + 1);
    }

    const tiers = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({ tiers });
  } catch (error) {
    console.error("Quality tiers GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * The reasons a hold can carry, grouped by who owns the delay.
 *
 *   GET /api/delay-reasons
 *
 * Shipped defaults (tenant_id NULL) plus this tenant's own, active only,
 * in display order. RLS on delay_reasons already limits the rows to exactly
 * that, so this is a plain read through the session client.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request);
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delay_reasons")
    .select("id, tenant_id, owner, code, label, display_order")
    .eq("is_active", true)
    .order("owner")
    .order("display_order");

  if (error) {
    return NextResponse.json({ error: "Could not load the reasons" }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: data ?? [] });
}

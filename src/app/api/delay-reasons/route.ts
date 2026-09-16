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
    .select("id, tenant_id, owner, code, label, display_order, is_active")
    .order("owner")
    .order("display_order");
  // The hold dialog wants the usable list; the settings page wants everything
  // it may edit. ?all=1 keeps hidden rows.
  const all = request.nextUrl.searchParams.get("all") === "1";

  if (error) {
    return NextResponse.json({ error: "Could not load the reasons" }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: (data ?? []).filter((r) => all || r.is_active !== false) });
}

/**
 * Add a reason of this tenant's own. Shipped defaults are shared by every
 * business and cannot be edited or removed; a tenant adds beside them, or
 * hides one it never uses (PATCH below).
 *
 *   POST { owner, label }
 */
export async function POST(request: NextRequest) {
  const guard = await protectApiRoute(request, {
    loadPermissions: true,
    requiredPermissions: ["settings.company.update"],
  });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const body = await request.json().catch(() => ({}));
  const owner = String(body.owner ?? "");
  const label = String(body.label ?? "").trim();
  if (!["client", "vendor", "internal", "third_party"].includes(owner)) {
    return NextResponse.json({ error: "owner must be client, vendor, internal or third_party" }, { status: 400 });
  }
  if (!label) return NextResponse.json({ error: "Give the reason a name" }, { status: 400 });

  const code = `${owner}_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`.slice(0, 60);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delay_reasons")
    .insert({ tenant_id: guard.user.tenantId, owner, code, label, display_order: 50 })
    .select("id, tenant_id, owner, code, label, display_order")
    .single();
  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "A reason with that name already exists" : "Could not add the reason" },
      { status: error.code === "23505" ? 409 : 500 }
    );
  }
  return NextResponse.json({ success: true, data }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

/**
 * Who could have referred this lead.
 *
 *   GET /api/partners/referrers?type=architect
 *
 * **Why this is not `GET /api/partners?type=architect`.** That route is gated on
 * `partners.view`, which is Owner and Admin alone by decision, because the
 * partner list is the whole relationship book. The person filling in a new lead
 * is **Sales**, who holds no `partners.*` key - so the architect dropdown would
 * have been empty for exactly the people who need it.
 *
 * The same shape as `GET /api/partners/match`, and for the same stated reason:
 * the new-lead form depends on it. It is deliberately the narrowest thing that
 * fills a dropdown - **id, name and phone of one type** - and carries none of
 * what makes the book worth protecting: no addresses, no GST, no contacts, no
 * counts of who else they work with.
 */
export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request, {
    // Whoever may create or change a lead may say who sent it.
    requiredPermissions: ["leads.create", "leads.edit", "leads.edit_own", "partners.view"],
    requireAllPermissions: false,
  });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;

  const type = request.nextUrl.searchParams.get("type");
  if (!type) return NextResponse.json({ data: [] });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_type_links")
    .select("partner_id, partner:partners!inner(id, name, phone, status, tenant_id)")
    .eq("type_code", type);

  if (error) {
    console.error("[referrers] could not read partners", error.message);
    return NextResponse.json({ error: "Could not load the list" }, { status: 500 });
  }

  // Tenant-scoped in TypeScript as well as by RLS: this route is the one place
  // a lead-creator reads partners at all, so it says so explicitly.
  const rows = (data ?? [])
    .map((r) => (Array.isArray(r.partner) ? r.partner[0] : r.partner) as
      | { id: string; name: string; phone: string | null; status: string; tenant_id: string }
      | null)
    .filter((p): p is NonNullable<typeof p> => !!p && p.tenant_id === user.tenantId && p.status === "active")
    .map((p) => ({ id: p.id, name: p.name, phone: p.phone }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ data: rows });
}

/**
 * "Do we already know this person?"
 *
 *   GET /api/partners/match?phone=&email=
 *
 * Phone first, email second, within the tenant. Returns the partners that
 * match, with what they have been to us, so a form can offer "This is
 * Amulya - 2 previous projects - use her?" before creating a second record.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { identifiersOf } from "@/lib/partners/identity";

export async function GET(request: NextRequest) {
  // Asked by the new-lead form and the standalone-quotation dialog as much
  // as by Partners itself, so anyone who may create either may ask.
  const guard = await protectApiRoute(request, {
    requiredPermissions: ["partners.view", "leads.create", "quotations.create"],
    requireAllPermissions: false,
  });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const params = request.nextUrl.searchParams;
  const ids = identifiersOf({ phone: params.get("phone"), email: params.get("email") });
  if (ids.length === 0) return NextResponse.json({ success: true, data: [] });

  const supabase = await createClient();
  const phone = ids.find((i) => i.kind === "phone")?.value;
  const email = ids.find((i) => i.kind === "email")?.value;

  // Phone matches the partner's own number or any contact's - the couple who
  // share a home give either number.
  const byPhone = phone
    ? supabase.from("partners").select("id").or(`phone.like.%${phone}`).limit(10)
    : Promise.resolve({ data: [] as { id: string }[] });
  const byContactPhone = phone
    ? supabase.from("partner_contacts").select("partner_id").like("phone", `%${phone}`).limit(10)
    : Promise.resolve({ data: [] as { partner_id: string }[] });
  const byEmail = email
    ? supabase.from("partners").select("id").eq("email", email).limit(10)
    : Promise.resolve({ data: [] as { id: string }[] });
  const [a, b, c] = await Promise.all([byPhone, byContactPhone, byEmail]);
  const idSet = new Set<string>([
    ...((a.data ?? []) as { id: string }[]).map((r) => r.id),
    ...((b.data ?? []) as { partner_id: string }[]).map((r) => r.partner_id),
    ...((c.data ?? []) as { id: string }[]).map((r) => r.id),
  ]);
  if (idSet.size === 0) return NextResponse.json({ success: true, data: [] });

  const { data: partners } = await supabase
    .from("partners")
    .select("id, kind, name, phone, email, city, status, types:partner_type_links(type_code), clients:clients(id)")
    .in("id", [...idSet]);
  const clientIds = (partners ?? []).flatMap((p: any) => (p.clients ?? []).map((c: any) => c.id));
  const [{ data: leads }, { data: projects }] = clientIds.length
    ? await Promise.all([
        supabase.from("leads").select("client_id, stage").in("client_id", clientIds),
        supabase.from("projects").select("client_id, status").in("client_id", clientIds),
      ])
    : [{ data: [] }, { data: [] }];

  const data = (partners ?? []).map((p: any) => {
    const cids = new Set((p.clients ?? []).map((c: any) => c.id));
    return {
      id: p.id,
      kind: p.kind,
      name: p.name,
      phone: p.phone,
      email: p.email,
      city: p.city,
      status: p.status,
      types: (p.types ?? []).map((t: any) => t.type_code),
      client_id: (p.clients ?? [])[0]?.id ?? null,
      leads_count: (leads ?? []).filter((l: any) => cids.has(l.client_id)).length,
      projects_count: (projects ?? []).filter((x: any) => cids.has(x.client_id)).length,
      matched_on: [
        phone && (String(p.phone ?? "").endsWith(phone) || (b.data ?? []).some((r: any) => r.partner_id === p.id)) ? "phone" : null,
        email && p.email === email ? "email" : null,
      ].filter(Boolean),
    };
  });
  return NextResponse.json({ success: true, data });
}

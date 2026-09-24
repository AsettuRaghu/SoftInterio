import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { ENTRY_SELECT, shapeEntries } from "@/lib/library/shape";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/properties/[id]/scope/summary?lead=|project=
 *
 * The scope as a page for the CUSTOMER: room by room, what is planned in
 * each, the finishes they chose, the pictures they liked, the decisions
 * written down - and no prices and no internal notes.
 * It is the document a seller sends the evening after the showroom visit,
 * so the customer sees that the conversation was heard. Everything comes
 * from rows that already exist; nothing is stored for it.
 *
 *   spaces[]     name · size · pictures (starred first, up to 4)
 *     components[]  name · size · done_by · choices[] (category, name,
 *                   tier as a word) · provided (what the client brings)
 *     decisions[]   the thread's entries marked as decisions
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const tenantId = guard.user.tenantId;

  // The customer is on the lead or the project, not the property.
  const leadId = request.nextUrl.searchParams.get("lead");
  const projectId = request.nextUrl.searchParams.get("project");
  const [{ data: property }, { data: tenant }, { data: rows }, { data: lead }, { data: project }] = await Promise.all([
    supabase.from("properties").select("id, configuration, address_line1, city").eq("id", id).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("tenants").select("company_name, logo_url").eq("id", tenantId).maybeSingle(),
    supabase.from("property_scope_items").select("*").eq("property_id", id).eq("tenant_id", tenantId).order("display_order"),
    leadId ? supabase.from("leads").select("lead_number, client:clients!leads_client_id_fkey(name)").eq("id", leadId).eq("property_id", id).maybeSingle() : Promise.resolve({ data: null }),
    projectId ? supabase.from("projects").select("project_number, name, client:clients(name)").eq("id", projectId).eq("property_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });
  const clientName = ((lead?.client ?? project?.client) as unknown as { name: string } | null)?.name ?? "";
  const reference = lead?.lead_number ?? project?.project_number ?? null;

  type R = { id: string; parent_id: string | null; name: string; component_type_id: string | null; cost_item_id: string | null; choice_status: string | null; choice_quantity: number | null; scope_owner: string | null; scope_vendor_name: string | null; supplied_detail: string | null; length: number | null; width: number | null; height: number | null; measurement_unit: string; measurement_status: string | null; component_type?: { name: string } | null };
  const all = (rows ?? []) as R[];
  const spaces = all.filter((r) => !r.parent_id && !r.component_type_id && !r.cost_item_id && r.scope_owner !== "excluded");
  const components = all.filter((r) => r.component_type_id && !r.cost_item_id && r.scope_owner !== "excluded");
  const choices = all.filter((r) => r.cost_item_id && r.choice_status === "p1");
  const itemIds = [...new Set(choices.map((c) => c.cost_item_id as string))];
  const typeIds = [...new Set(components.map((c) => c.component_type_id as string))];
  const spaceIds = spaces.map((s) => s.id);
  const compIds = components.map((c) => c.id);
  const allIds = [...spaceIds, ...compIds];

  const [{ data: items }, { data: types }, { data: docs }, { data: pins }, { data: decisions }] = await Promise.all([
    itemIds.length ? supabase.from("quotation_cost_items").select("id, name, quality_tier, category:quotation_cost_item_categories(name, display_order)").in("id", itemIds) : Promise.resolve({ data: [] as unknown[] }),
    typeIds.length ? supabase.from("component_types").select("id, name").in("id", typeIds) : Promise.resolve({ data: [] as unknown[] }),
    allIds.length ? supabase.from("documents").select("id, linked_id, title, file_name, storage_path, file_type, is_starred, created_at").eq("linked_type", "scope_item").in("linked_id", allIds).ilike("file_type", "image/%").order("is_starred", { ascending: false }).order("created_at") : Promise.resolve({ data: [] as unknown[] }),
    allIds.length ? supabase.from("scope_item_library_pins").select("scope_item_id, library_entry_id, is_starred").in("scope_item_id", allIds) : Promise.resolve({ data: [] as unknown[] }),
    allIds.length ? supabase.from("scope_item_comments").select("scope_item_id, body, created_at").in("scope_item_id", allIds).eq("is_decision", true).order("created_at") : Promise.resolve({ data: [] as unknown[] }),
  ]);

  // Pictures: uploaded references (signed) and pinned library entries.
  const pinRows = (pins ?? []) as { scope_item_id: string; library_entry_id: string; is_starred: boolean }[];
  const entryIds = [...new Set(pinRows.map((p) => p.library_entry_id))];
  const entries = entryIds.length ? await shapeEntries((await supabase.from("library_entries").select(ENTRY_SELECT).in("id", entryIds)).data ?? []) : [];
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const docRows = (docs ?? []) as { id: string; linked_id: string; title: string | null; file_name: string; storage_path: string; is_starred: boolean }[];
  const signed = new Map<string, string | null>();
  await Promise.all(
    docRows.slice(0, 80).map(async (d) => {
      const { data } = await admin.storage.from("documents").createSignedUrl(d.storage_path, 3600);
      signed.set(d.id, data?.signedUrl ?? null);
    }),
  );
  const picturesOf = (scopeItemId: string) => {
    const uploaded = docRows.filter((d) => d.linked_id === scopeItemId).map((d) => ({ url: signed.get(d.id), title: d.title || d.file_name, starred: !!d.is_starred }));
    const pinned = pinRows.filter((p) => p.scope_item_id === scopeItemId).map((p) => ({ url: entryById.get(p.library_entry_id)?.cover_url ?? null, title: entryById.get(p.library_entry_id)?.title ?? "", starred: !!p.is_starred }));
    return [...uploaded, ...pinned].filter((p) => p.url).sort((a, b) => Number(b.starred) - Number(a.starred)).slice(0, 4);
  };

  // A picture of each chosen item, where the catalogue has one the customer
  // may see (Design Library entries under the item, visible_to_customer).
  const itemPicture = new Map<string, string>();
  if (itemIds.length) {
    const { data: ents } = await supabase.from("library_entries").select(ENTRY_SELECT).in("cost_item_id", itemIds).eq("visible_to_customer", true).order("created_at");
    for (const e of await shapeEntries(ents ?? [])) {
      if (e.cost_item_id && e.cover_url && !itemPicture.has(e.cost_item_id)) itemPicture.set(e.cost_item_id, e.cover_url);
    }
  }

  type Item = { id: string; name: string; quality_tier: string | null; category: { name: string; display_order: number | null } | null };
  const itemById = new Map(((items ?? []) as Item[]).map((i) => [i.id, i]));
  const typeById = new Map(((types ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]));
  const TIER: Record<string, string> = { basic: "Basic", standard: "Standard", premium: "Premium", luxury: "Luxury" };
  const size = (r: R, face: "floor" | "front") => {
    const a = face === "floor" ? r.length : r.width;
    const b = face === "floor" ? r.width : (r.height ?? r.length);
    if (!a && !b) return null;
    return `${a ?? "—"} × ${b ?? "—"} ${r.measurement_unit}${r.measurement_status === "rough" ? " (approx.)" : ""}`;
  };
  const OWNER: Record<string, string> = { client: "You provide", vendor: "Through your vendor" };
  const decisionRows = (decisions ?? []) as { scope_item_id: string; body: string; created_at: string }[];

  const data = {
    company: tenant?.company_name ?? "",
    logo_url: tenant?.logo_url ?? null,
    client: clientName,
    reference,
    address: [property.address_line1, property.city].filter(Boolean).join(", "),
    configuration: property.configuration ?? null,
    date: new Date().toISOString(),
    spaces: spaces.map((s) => ({
      name: s.name,
      size: size(s, "floor"),
      done_by: s.scope_owner && s.scope_owner !== "us" ? OWNER[s.scope_owner] ?? null : null,
      pictures: picturesOf(s.id),
      decisions: decisionRows.filter((d) => d.scope_item_id === s.id).map((d) => d.body),
      components: components
        .filter((c) => c.parent_id === s.id)
        .map((c) => ({
          name: c.name,
          type: typeById.get(c.component_type_id as string) ?? null,
          size: size(c, "front"),
          done_by: c.scope_owner && c.scope_owner !== "us" ? OWNER[c.scope_owner] ?? null : null,
          provided: c.supplied_detail ?? null,
          choices: choices
            .filter((x) => x.parent_id === c.id)
            .map((x) => ({ item: itemById.get(x.cost_item_id as string), quantity: x.choice_quantity }))
            .filter((x) => x.item)
            .sort((a, b) => (a.item!.category?.display_order ?? 999) - (b.item!.category?.display_order ?? 999))
            .map((x) => ({ category: x.item!.category?.name ?? "", name: x.item!.name, tier: x.item!.quality_tier ? TIER[x.item!.quality_tier.toLowerCase()] ?? null : null, quantity: x.quantity != null && Number(x.quantity) > 1 ? Number(x.quantity) : null, picture: itemPicture.get(x.item!.id) ?? null })),
          pictures: picturesOf(c.id),
          decisions: decisionRows.filter((d) => d.scope_item_id === c.id).map((d) => d.body),
        })),
    })),
  };
  return NextResponse.json({ data });
}

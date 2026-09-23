import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

/**
 * Packages: what a business sells as one thing.
 *
 * GET  ?all=1 for the inactive ones too -> [{ id, name, description, answers, is_active }]
 *      `answers` is how many entries it carries, which is the only number
 *      that says whether a package has been filled in yet.
 * POST { name, description?, from_tier? }
 *      `from_tier` fills every graded question on every component type that
 *      offers one, which is what turns an afternoon of authoring into a
 *      minute - the tenant then hand-picks only the by-kind questions.
 */
export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();

  let q = supabase.from("scope_packages").select("*").order("display_order").order("name");
  if (request.nextUrl.searchParams.get("all") !== "1") q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Could not load packages" }, { status: 500 });

  const ids = (data ?? []).map((p) => p.id as string);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: rows } = await supabase.from("scope_package_items").select("package_id").in("package_id", ids);
    for (const r of rows ?? []) counts.set(r.package_id as string, (counts.get(r.package_id as string) ?? 0) + 1);
  }
  return NextResponse.json({ data: (data ?? []).map((p) => ({ ...p, answers: counts.get(p.id as string) ?? 0 })) });
}

export async function POST(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "A name is required" }, { status: 400 });

  const { data: last } = await supabase
    .from("scope_packages").select("display_order").order("display_order", { ascending: false }).limit(1).maybeSingle();
  const { data: pkg, error } = await supabase
    .from("scope_packages")
    .insert({
      tenant_id: user.tenantId,
      name,
      description: String(body.description ?? "").trim() || null,
      display_order: (last?.display_order ?? -1) + 1,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error || !pkg) return NextResponse.json({ error: "Could not create the package" }, { status: 500 });

  const seeded = body.from_tier ? await seedFromTier(supabase, user.tenantId, pkg.id as string, String(body.from_tier)) : 0;
  return NextResponse.json({ data: { ...pkg, answers: seeded } }, { status: 201 });
}

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Every graded question, answered at one tier. Only where the family really
 * is graded - two or more different tiers among the items a component type
 * offers in that category - so a single-answer question is never filled in
 * as though it were a ladder.
 */
async function seedFromTier(supabase: Db, tenantId: string, packageId: string, tier: string): Promise<number> {
  const want = tier.trim().toLowerCase();
  const [{ data: offers }, { data: items }] = await Promise.all([
    supabase.from("component_type_offers").select("component_type_id, cost_item_id, quantity_key, auto, ask_as").eq("tenant_id", tenantId),
    supabase.from("quotation_cost_items").select("id, category_id, quality_tier, is_active").eq("tenant_id", tenantId),
  ]);
  const tierOf = new Map<string, string | null>();
  for (const i of items ?? []) if (i.is_active !== false) tierOf.set(i.id as string, ((i.quality_tier as string | null) ?? null));
  const catOf = new Map<string, string | null>();
  for (const i of items ?? []) catOf.set(i.id as string, (i.category_id as string | null) ?? null);

  // type -> category -> the items offered there
  const buckets = new Map<string, Map<string, string[]>>();
  for (const o of offers ?? []) {
    const id = o.cost_item_id as string;
    if (o.auto || !tierOf.has(id)) continue;
    const cat = catOf.get(id);
    if (!cat) continue;
    const t = o.component_type_id as string;
    const inner = buckets.get(t) ?? new Map<string, string[]>();
    inner.set(cat, [...(inner.get(cat) ?? []), id]);
    buckets.set(t, inner);
  }

  const rows: Record<string, unknown>[] = [];
  for (const [componentTypeId, cats] of buckets) {
    for (const [, ids] of cats) {
      const tiers = new Set(ids.map((i) => (tierOf.get(i) ?? "").toLowerCase()).filter(Boolean));
      if (tiers.size < 2) continue;
      const match = ids.find((i) => (tierOf.get(i) ?? "").toLowerCase() === want);
      if (match) rows.push({ tenant_id: tenantId, package_id: packageId, component_type_id: componentTypeId, cost_item_id: match, quantity: null });
    }
  }
  if (!rows.length) return 0;
  const { error } = await supabase.from("scope_package_items").insert(rows);
  if (error) { console.error("[packages] seed failed", error.message); return 0; }
  return rows.length;
}

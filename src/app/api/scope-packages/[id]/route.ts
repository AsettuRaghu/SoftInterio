import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { Offer } from "@/lib/scope/options";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * One package, and what it says.
 *
 * GET   -> { package, entries, catalogue }
 *          `catalogue` is every component type with what it offers, already
 *          shaped - the editor asks the same questions the Scope Sheet does,
 *          because a package is answers to those questions and nothing else.
 * PATCH { name?, description?, is_active?, entries? }
 *          `entries` replaces the lot: [{ component_type_id, cost_item_id, quantity? }].
 * DELETE  removes it; a preset pointing at it is left pointing at nothing,
 *          which is the right outcome - the preset still lays rooms down.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id } = await params;
  const supabase = await createClient();

  const { data: pkg } = await supabase.from("scope_packages").select("*").eq("id", id).eq("tenant_id", user.tenantId).maybeSingle();
  if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });

  const [{ data: entries }, { data: types }, { data: offers }, { data: items }] = await Promise.all([
    supabase.from("scope_package_items").select("component_type_id, cost_item_id, quantity").eq("package_id", id),
    supabase.from("component_types").select("id, name").eq("tenant_id", user.tenantId).eq("is_active", true).order("name"),
    supabase.from("component_type_offers").select("component_type_id, cost_item_id, quantity_key, auto, ask_as").eq("tenant_id", user.tenantId),
    supabase
      .from("quotation_cost_items")
      .select("id, name, category_id, unit_code, quality_tier, is_active, category:quotation_cost_item_categories(id, name, question, decision, display_order)")
      .eq("tenant_id", user.tenantId)
      .eq("is_active", true),
  ]);

  const itemById = new Map((items ?? []).map((i) => [i.id as string, i]));
  const byType = new Map<string, Offer[]>();
  for (const o of offers ?? []) {
    if (!itemById.has(o.cost_item_id as string)) continue;
    const k = o.component_type_id as string;
    byType.set(k, [...(byType.get(k) ?? []), { cost_item_id: o.cost_item_id as string, quantity_key: (o.quantity_key as string | null) ?? null, auto: !!o.auto, ask_as: (o.ask_as as string | null) ?? null }]);
  }

  const catalogue = (types ?? [])
    .map((t) => ({
      id: t.id as string,
      name: t.name as string,
      offers: (byType.get(t.id as string) ?? []).map((o) => {
        const i = itemById.get(o.cost_item_id)!;
        const cat = i.category as unknown as { id: string; name: string; question: string | null; decision: string | null; display_order: number | null } | null;
        return {
          cost_item_id: o.cost_item_id,
          name: i.name as string,
          unit_code: i.unit_code as string,
          quality_tier: (i.quality_tier as string | null) ?? null,
          quantity_key: o.quantity_key,
          auto: o.auto,
          category_id: (i.category_id as string | null) ?? null,
          category: cat?.name ?? null,
          question: cat?.question ?? null,
          decision: cat?.decision ?? null,
          category_order: cat?.display_order ?? 999,
        };
      }),
    }))
    .filter((t) => t.offers.length > 0);

  return NextResponse.json({ data: { package: pkg, entries: entries ?? [], catalogue } });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const { data: pkg } = await supabase.from("scope_packages").select("id").eq("id", id).eq("tenant_id", user.tenantId).maybeSingle();
  if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "A name is required" }, { status: 400 });
    patch.name = name;
  }
  if ("description" in body) patch.description = String(body.description ?? "").trim() || null;
  if ("is_active" in body) patch.is_active = !!body.is_active;
  if (Object.keys(patch).length > 1) {
    const { error } = await supabase.from("scope_packages").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: "Could not save the package" }, { status: 500 });
  }

  if (Array.isArray(body.entries)) {
    // Replaced wholesale: the editor holds the whole package on screen, so a
    // partial write would let a removed answer survive a save.
    const rows = (body.entries as { component_type_id?: string; cost_item_id?: string; quantity?: number | null }[])
      .filter((e) => e.component_type_id && e.cost_item_id)
      .map((e) => ({
        tenant_id: user.tenantId,
        package_id: id,
        component_type_id: e.component_type_id as string,
        cost_item_id: e.cost_item_id as string,
        quantity: e.quantity == null || !Number.isFinite(Number(e.quantity)) ? null : Math.max(1, Math.round(Number(e.quantity))),
      }));
    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      const k = `${r.component_type_id}:${r.cost_item_id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    await supabase.from("scope_package_items").delete().eq("package_id", id);
    if (unique.length) {
      const { error } = await supabase.from("scope_package_items").insert(unique);
      if (error) {
        console.error("[packages] entries failed", error.message);
        return NextResponse.json({ error: "Could not save what the package says" }, { status: 500 });
      }
    }
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.delete"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("scope_packages").delete().eq("id", id).eq("tenant_id", user.tenantId);
  if (error) return NextResponse.json({ error: "Could not delete the package" }, { status: 500 });
  return NextResponse.json({ success: true });
}

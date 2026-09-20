import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { readCosting, validateCosting, type ComponentCosting } from "@/lib/costing/component-costing";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * A component type's page: how it is measured (the costing rule on
 * `component_types.config_schema`) and WHAT IT OFFERS on the Scope room
 * sheet (`component_type_offers`) - the one place either is decided. The
 * builder reads the same offers to know what a line is priced per.
 *
 * GET  -> { costing, lines: [{ cost_item_id, name, unit_code, category, category_id, quantity_key }],
 *           catalogue: [{ id, name, unit_code, category, category_id }] }
 * PUT  { costing?, lines?: [{ cost_item_id, quantity_key | null }], add?: [cost_item_id], remove?: [cost_item_id] }
 *         The rule is validated; a line's quantity_key must be one of its
 *         quantities.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();

  const { data: type } = await supabase.from("component_types").select("id, name, config_schema").eq("id", id).eq("tenant_id", guard.user.tenantId).maybeSingle();
  if (!type) return NextResponse.json({ error: "Component type not found" }, { status: 404 });

  const [{ data: offers }, { data: catalogue }] = await Promise.all([
    supabase
      .from("component_type_offers")
      .select("cost_item_id, quantity_key, display_order, cost_item:quotation_cost_items(id, name, unit_code, category_id, is_active, category:quotation_cost_item_categories(name, display_order))")
      .eq("component_type_id", id)
      .order("display_order"),
    supabase
      .from("quotation_cost_items")
      .select("id, name, unit_code, category_id, category:quotation_cost_item_categories(name, display_order)")
      .eq("tenant_id", guard.user.tenantId)
      .eq("is_active", true)
      .order("name"),
  ]);

  type Cat = { name: string; display_order: number | null } | null;
  const lines = (offers ?? [])
    .map((o) => {
      const ci = o.cost_item as unknown as { id: string; name: string; unit_code: string; category_id: string | null; is_active: boolean; category: Cat } | null;
      if (!ci || ci.is_active === false) return null;
      return { cost_item_id: ci.id, name: ci.name, unit_code: ci.unit_code, category: ci.category?.name ?? null, category_id: ci.category_id, category_order: ci.category?.display_order ?? 999, quantity_key: (o.quantity_key as string | null) ?? null };
    })
    .filter(Boolean) as { cost_item_id: string; name: string; unit_code: string; category: string | null; category_id: string | null; category_order: number; quantity_key: string | null }[];

  return NextResponse.json({
    data: {
      id: type.id,
      name: type.name,
      costing: readCosting(type.config_schema),
      lines: lines.sort((a, b) => a.category_order - b.category_order || (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name)),
      catalogue: (catalogue ?? []).map((c) => {
        const cat = c.category as unknown as Cat;
        return { id: c.id as string, name: c.name as string, unit_code: c.unit_code as string, category_id: (c.category_id as string | null) ?? null, category: cat?.name ?? null, category_order: cat?.display_order ?? 999 };
      }),
    },
  });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const { data: type } = await supabase.from("component_types").select("id, name, config_schema").eq("id", id).eq("tenant_id", guard.user.tenantId).maybeSingle();
  if (!type) return NextResponse.json({ error: "Component type not found" }, { status: 404 });

  let costing: ComponentCosting = readCosting(type.config_schema);
  if (body.costing) {
    costing = {
      fields: (Array.isArray(body.costing.fields) ? body.costing.fields : []).map((f: Record<string, unknown>) => ({
        key: String(f.key ?? "").trim(),
        label: String(f.label ?? "").trim(),
        kind: f.kind === "count" || f.kind === "number" ? f.kind : "length",
        hint: String(f.hint ?? "").trim() || undefined,
      })),
      quantities: (Array.isArray(body.costing.quantities) ? body.costing.quantities : []).map((q: Record<string, unknown>) => ({
        key: String(q.key ?? "").trim(),
        label: String(q.label ?? "").trim(),
        unit_code: String(q.unit_code ?? "nos").trim() || "nos",
        formula: String(q.formula ?? "").trim(),
      })),
    };
    const problems = validateCosting(costing);
    if (problems.length) return NextResponse.json({ error: problems[0], problems }, { status: 400 });
    const { error } = await supabase.from("component_types").update({ config_schema: costing, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: "Could not save the rule" }, { status: 500 });
  }

  const add = Array.isArray(body.add) ? (body.add as string[]).filter(Boolean) : [];
  const remove = Array.isArray(body.remove) ? (body.remove as string[]).filter(Boolean) : [];

  if (add.length) {
    const [{ data: items }, { data: present }] = await Promise.all([
      supabase.from("quotation_cost_items").select("id").eq("tenant_id", guard.user.tenantId).in("id", add),
      supabase.from("component_type_offers").select("cost_item_id, display_order").eq("component_type_id", id),
    ]);
    const have = new Set((present ?? []).map((p) => p.cost_item_id as string));
    let order = Math.max(0, ...(present ?? []).map((p) => Number(p.display_order) || 0));
    const rows = (items ?? []).filter((i) => !have.has(i.id as string)).map((i) => ({ tenant_id: guard.user.tenantId, component_type_id: id, cost_item_id: i.id, display_order: ++order, quantity_key: null as string | null }));
    if (rows.length) {
      const { error } = await supabase.from("component_type_offers").insert(rows);
      if (error) return NextResponse.json({ error: "Could not add to the offer" }, { status: 500 });
    }
  }
  if (remove.length) {
    const { error } = await supabase.from("component_type_offers").delete().eq("component_type_id", id).in("cost_item_id", remove);
    if (error) return NextResponse.json({ error: "Could not remove from the offer" }, { status: 500 });
  }

  if (Array.isArray(body.lines)) {
    const known = new Set(costing.quantities.map((q) => q.key));
    for (const l of body.lines as { cost_item_id?: string; quantity_key?: string | null }[]) {
      if (!l.cost_item_id) continue;
      const key = l.quantity_key && known.has(l.quantity_key) ? l.quantity_key : null;
      if (l.quantity_key && !key) return NextResponse.json({ error: `"${l.quantity_key}" is not a quantity of this component type` }, { status: 400 });
      const { error } = await supabase.from("component_type_offers").update({ quantity_key: key }).eq("component_type_id", id).eq("cost_item_id", l.cost_item_id);
      if (error) return NextResponse.json({ error: "Could not save the line" }, { status: 500 });
    }
  }
  return NextResponse.json({ success: true });
}

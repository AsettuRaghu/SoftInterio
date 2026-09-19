import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { readCosting, validateCosting, type ComponentCosting } from "@/lib/costing/component-costing";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * A component type's costing rule, and how the templates price against it.
 *
 * GET  -> { costing, lines: [{ cost_item_id, name, unit_code, category, quantity_key, template_count }] }
 *         `lines` are the distinct cost items the tenant's templates put on
 *         this component type, with the quantity each is priced per.
 * PUT  { costing?, lines?: [{ cost_item_id, quantity_key | null }] }
 *         The rule is validated (keys, formulas, references); a line's
 *         quantity_key must be one of the rule's quantities. Setting a line
 *         applies to every template line for that cost item on this type.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();

  const { data: type } = await supabase.from("component_types").select("id, name, config_schema").eq("id", id).eq("tenant_id", guard.user.tenantId).maybeSingle();
  if (!type) return NextResponse.json({ error: "Component type not found" }, { status: 404 });

  const { data: tl } = await supabase
    .from("quotation_template_line_items")
    .select("cost_item_id, quantity_key, cost_item:quotation_cost_items(id, name, unit_code, category:quotation_cost_item_categories(name))")
    .eq("component_type_id", id)
    .not("cost_item_id", "is", null);

  const byItem = new Map<string, { cost_item_id: string; name: string; unit_code: string; category: string | null; quantity_key: string | null; template_count: number }>();
  for (const l of tl ?? []) {
    const ci = l.cost_item as unknown as { id: string; name: string; unit_code: string; category: { name: string } | null } | null;
    if (!ci) continue;
    const cur = byItem.get(ci.id) ?? { cost_item_id: ci.id, name: ci.name, unit_code: ci.unit_code, category: ci.category?.name ?? null, quantity_key: l.quantity_key ?? null, template_count: 0 };
    cur.template_count += 1;
    if (!cur.quantity_key && l.quantity_key) cur.quantity_key = l.quantity_key;
    byItem.set(ci.id, cur);
  }
  return NextResponse.json({
    data: {
      id: type.id,
      name: type.name,
      costing: readCosting(type.config_schema),
      lines: [...byItem.values()].sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name)),
    },
  });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const { data: type } = await supabase.from("component_types").select("id, config_schema").eq("id", id).eq("tenant_id", guard.user.tenantId).maybeSingle();
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

  if (Array.isArray(body.lines)) {
    const known = new Set(costing.quantities.map((q) => q.key));
    for (const l of body.lines as { cost_item_id?: string; quantity_key?: string | null }[]) {
      if (!l.cost_item_id) continue;
      const key = l.quantity_key && known.has(l.quantity_key) ? l.quantity_key : null;
      if (l.quantity_key && !key) return NextResponse.json({ error: `"${l.quantity_key}" is not a quantity of this component type` }, { status: 400 });
      const { error } = await supabase
        .from("quotation_template_line_items")
        .update({ quantity_key: key })
        .eq("component_type_id", id)
        .eq("cost_item_id", l.cost_item_id);
      if (error) return NextResponse.json({ error: "Could not save the line" }, { status: 500 });
    }
  }
  return NextResponse.json({ success: true });
}

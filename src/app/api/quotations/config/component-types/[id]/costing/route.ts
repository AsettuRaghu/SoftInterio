import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { readCosting, validateCosting, type ComponentCosting } from "@/lib/costing/component-costing";
import { menuOf } from "@/lib/scope/options";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * A component type's page: how it is measured (the costing rule) and WHAT
 * IT OFFERS on the Scope room sheet - the one place either is decided.
 *
 * The offer is stored as the lines of the type's "Room sheet menu"
 * template (`quotation_templates.is_options_menu`); this route creates that
 * template the first time an item is added and the page never mentions it.
 * A type with no menu template shows, as its offer, every active template's
 * lines for it - the same fallback the room sheet uses.
 *
 * GET  -> { costing, lines: [{ cost_item_id, name, unit_code, category, category_id, quantity_key }],
 *           has_menu, catalogue: [{ id, name, unit_code, category, category_id }] }
 * PUT  { costing?, lines?: [{ cost_item_id, quantity_key | null }], add?: [cost_item_id], remove?: [cost_item_id] }
 *         The rule is validated; a line's quantity_key must be one of its
 *         quantities and is applied to every template line for that item on
 *         this type, so the builder and the sheet price alike.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();

  const { data: type } = await supabase.from("component_types").select("id, name, config_schema").eq("id", id).eq("tenant_id", guard.user.tenantId).maybeSingle();
  if (!type) return NextResponse.json({ error: "Component type not found" }, { status: 404 });

  const [{ data: tl }, { data: catalogue }] = await Promise.all([
    supabase
      .from("quotation_template_line_items")
      .select("cost_item_id, quantity_key, template:quotation_templates!inner(is_active, is_options_menu), cost_item:quotation_cost_items(id, name, unit_code, category_id, category:quotation_cost_item_categories(name, display_order))")
      .eq("component_type_id", id)
      .not("cost_item_id", "is", null),
    supabase
      .from("quotation_cost_items")
      .select("id, name, unit_code, category_id, category:quotation_cost_item_categories(name, display_order)")
      .eq("tenant_id", guard.user.tenantId)
      .eq("is_active", true)
      .order("name"),
  ]);

  type Row = { cost_item_id: string; quantity_key: string | null; template: { is_active?: boolean; is_options_menu?: boolean } | null; cost_item: { id: string; name: string; unit_code: string; category_id: string | null; category: { name: string; display_order: number | null } | null } | null };
  const rows = ((tl ?? []) as unknown as Row[]).filter((r) => r.cost_item);
  const menu = menuOf(rows);
  const byItem = new Map<string, { cost_item_id: string; name: string; unit_code: string; category: string | null; category_id: string | null; category_order: number; quantity_key: string | null }>();
  for (const l of menu) {
    const ci = l.cost_item!;
    const cur = byItem.get(ci.id) ?? { cost_item_id: ci.id, name: ci.name, unit_code: ci.unit_code, category: ci.category?.name ?? null, category_id: ci.category_id, category_order: ci.category?.display_order ?? 999, quantity_key: l.quantity_key ?? null };
    if (!cur.quantity_key && l.quantity_key) cur.quantity_key = l.quantity_key;
    byItem.set(ci.id, cur);
  }
  return NextResponse.json({
    data: {
      id: type.id,
      name: type.name,
      costing: readCosting(type.config_schema),
      has_menu: rows.some((r) => r.template?.is_options_menu && r.template?.is_active !== false),
      lines: [...byItem.values()].sort((a, b) => a.category_order - b.category_order || (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name)),
      catalogue: (catalogue ?? []).map((c) => {
        const cat = c.category as unknown as { name: string; display_order: number | null } | null;
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

  // The menu template, made on first use so the page never has to ask.
  const menuId = async (create: boolean): Promise<string | null> => {
    // The flagged template that already carries this type's lines, whatever
    // it is called; else the one named for it; else, when asked, a new one.
    const { data: viaLines } = await supabase
      .from("quotation_template_line_items")
      .select("template_id, template:quotation_templates!inner(is_active, is_options_menu)")
      .eq("component_type_id", id)
      .eq("template.is_options_menu", true)
      .eq("template.is_active", true)
      .limit(1);
    if (viaLines?.[0]) return viaLines[0].template_id as string;
    const { data: existing } = await supabase
      .from("quotation_templates")
      .select("id")
      .eq("tenant_id", guard.user.tenantId)
      .eq("is_options_menu", true)
      .eq("is_active", true)
      .eq("level", "component")
      .eq("name", `${type.name} - Options Menu`)
      .maybeSingle();
    if (existing || !create) return existing?.id ?? null;
    const { data: made, error } = await supabase
      .from("quotation_templates")
      .insert({
        tenant_id: guard.user.tenantId,
        name: `${type.name} - Options Menu`,
        description: "What this component offers on the Scope room sheet. Edited from Settings → Catalogue → Components.",
        template_data: {},
        is_active: true,
        level: "component",
        is_options_menu: true,
      })
      .select("id")
      .single();
    if (error || !made) return null;
    return made.id as string;
  };

  if (add.length) {
    const tpl = await menuId(true);
    if (!tpl) return NextResponse.json({ error: "Could not set up the menu" }, { status: 500 });
    const { data: items } = await supabase.from("quotation_cost_items").select("id").eq("tenant_id", guard.user.tenantId).in("id", add);
    const { data: present } = await supabase.from("quotation_template_line_items").select("cost_item_id, display_order").eq("template_id", tpl);
    const have = new Set((present ?? []).map((p) => p.cost_item_id as string));
    let order = Math.max(0, ...(present ?? []).map((p) => Number(p.display_order) || 0));
    const rows = (items ?? []).filter((i) => !have.has(i.id as string)).map((i) => ({ template_id: tpl, component_type_id: id, cost_item_id: i.id, display_order: ++order, measurement_unit: "ft", quantity_key: null as string | null }));
    if (rows.length) {
      const { error } = await supabase.from("quotation_template_line_items").insert(rows);
      if (error) return NextResponse.json({ error: "Could not add to the menu" }, { status: 500 });
    }
  }
  if (remove.length) {
    const tpl = await menuId(false);
    if (tpl) {
      const { error } = await supabase.from("quotation_template_line_items").delete().eq("template_id", tpl).in("cost_item_id", remove);
      if (error) return NextResponse.json({ error: "Could not remove from the menu" }, { status: 500 });
    }
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

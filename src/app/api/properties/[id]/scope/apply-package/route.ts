import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { applyChoices, componentsInRange, type ComponentPlan } from "@/lib/scope/apply-choices";
import { loadOfferMenu, scopeRowsOf } from "@/lib/scope/blanket";
import { packagePlans } from "@/lib/scope/package";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Apply a package - the business's own "Standard wardrobe" - to a component,
 * a room, or the whole scope.
 *
 * POST { package_id, scope_item_id?, replace? }
 * -> { components, answered, kept, unanswered, package }
 *
 * The same writer as a grade, because the difference between the two is only
 * where the list of answers comes from.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id: propertyId } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const packageId = String(body.package_id ?? "").trim();
  if (!packageId) return NextResponse.json({ error: "Which package?" }, { status: 400 });

  const { data: pkg } = await supabase
    .from("scope_packages")
    .select("id, name, is_active")
    .eq("id", packageId)
    .eq("tenant_id", user.tenantId)
    .maybeSingle();
  if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });

  const rows = await scopeRowsOf(supabase, propertyId);
  if (rows.length === 0) return NextResponse.json({ error: "Nothing in this scope yet" }, { status: 400 });
  const components = componentsInRange(rows, body.scope_item_id ? String(body.scope_item_id) : null);
  if (components.length === 0) return NextResponse.json({ error: "No components of ours to set" }, { status: 400 });

  const [{ data: entries }, menu] = await Promise.all([
    supabase.from("scope_package_items").select("component_type_id, cost_item_id, quantity").eq("package_id", packageId),
    loadOfferMenu(supabase, components.map((c) => c.component_type_id as string)),
  ]);

  const plans: ComponentPlan[] = packagePlans({
    components: components.map((c) => ({ id: c.id, component_type_id: c.component_type_id as string })),
    entries: (entries ?? []).map((e) => ({
      component_type_id: e.component_type_id as string,
      cost_item_id: e.cost_item_id as string,
      quantity: e.quantity == null ? null : Number(e.quantity),
    })),
    offersByType: menu.offersByType,
    items: menu.items,
  });
  if (plans.length === 0) return NextResponse.json({ error: `"${pkg.name}" says nothing about these components` }, { status: 400 });

  try {
    const out = await applyChoices(supabase, {
      tenantId: user.tenantId, userId: user.id, propertyId, plans, rows, names: menu.names, replace: body.replace === true,
    });
    return NextResponse.json({ data: { ...out, package: pkg.name } });
  } catch (e) {
    console.error("[scope] apply-package failed", (e as Error).message);
    return NextResponse.json({ error: "Could not apply the package" }, { status: 500 });
  }
}

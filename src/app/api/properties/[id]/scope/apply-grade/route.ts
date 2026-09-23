import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { gradeChoices } from "@/lib/scope/grade";
import { applyChoices, componentsInRange, type ComponentPlan } from "@/lib/scope/apply-choices";
import { loadOfferMenu, scopeRowsOf } from "@/lib/scope/blanket";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * "Make this Standard" - answers every graded question on a component, a
 * room, or the whole scope.
 *
 * POST { tier, scope_item_id?, replace? }
 *   tier          basic | standard | premium | luxury, or whatever words the
 *                 tenant's ladder uses - `quality_tier` is text, and a
 *                 business defines what it sells.
 *   scope_item_id a component (just it), a space (its components), or absent
 *                 (every component of ours on the property).
 *   replace       false by default; see `applyChoices`.
 *   preference    p1 answers the questions, p2 records the alternative.
 *
 * -> { components, answered, kept, unanswered }. A grade cannot choose a
 *    shutter finish, so `unanswered` is what the screen must still say.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id: propertyId } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const tier = String(body.tier ?? "").trim();
  if (!tier) return NextResponse.json({ error: "Which grade?" }, { status: 400 });

  const rows = await scopeRowsOf(supabase, propertyId);
  if (rows.length === 0) return NextResponse.json({ error: "Nothing in this scope yet" }, { status: 400 });
  const components = componentsInRange(rows, body.scope_item_id ? String(body.scope_item_id) : null);
  if (components.length === 0) return NextResponse.json({ error: "No components of ours to grade" }, { status: 400 });

  const menu = await loadOfferMenu(supabase, components.map((c) => c.component_type_id as string));
  if (menu.offersByType.size === 0) return NextResponse.json({ error: "These components offer nothing to choose" }, { status: 400 });

  const plans: ComponentPlan[] = [];
  for (const c of components) {
    const lines = menu.offersByType.get(c.component_type_id as string) ?? [];
    if (lines.length === 0) continue;
    const plan = gradeChoices(lines, lines.map((l) => menu.items.get(l.cost_item_id)!).filter(Boolean), tier);
    plans.push({ componentId: c.id, pick: plan.pick, counted: [], unanswered: plan.ungraded });
  }

  try {
    const out = await applyChoices(supabase, {
      tenantId: user.tenantId, userId: user.id, propertyId, plans, rows, names: menu.names,
      replace: body.replace === true,
      // "p2" records the alternative instead of the answer, which is how a
      // customer is shown two levels: Standard as the ①, Budget as the ②,
      // then Option 2 builds the whole second quotation from the ②s.
      preference: body.preference === "p2" ? "p2" : "p1",
    });
    return NextResponse.json({ data: out });
  } catch (e) {
    console.error("[scope] apply-grade failed", (e as Error).message);
    return NextResponse.json({ error: "Could not apply the grade" }, { status: 500 });
  }
}

/**
 * The vocabulary the library links to, in one read: the catalogue (space
 * types, component types, cost categories and items, quality tiers) and
 * the stages of the business's committed project playbooks. No prices -
 * the library never shows money.
 *
 *   GET /api/library/catalogue
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();

  const [spaces, components, categories, items, tiers, playbooks] = await Promise.all([
    supabase.from("space_types").select("id, name, slug").eq("is_active", true).order("display_order").order("name"),
    supabase.from("component_types").select("id, name, slug").eq("is_active", true).order("display_order").order("name"),
    supabase.from("quotation_cost_item_categories").select("id, name, display_order").eq("is_active", true).order("display_order").order("name"),
    supabase.from("quotation_cost_items").select("id, name, category_id, quality_tier").eq("is_active", true).order("display_order").order("name"),
    supabase.from("quotation_cost_items").select("quality_tier").eq("is_active", true).not("quality_tier", "is", null),
    supabase
      .from("procedure_definitions")
      .select("id, name, steps:procedure_step_definitions(step_key, title, display_order, parent_step_id, is_current)")
      .eq("status", "committed")
      .eq("applies_to", "project"),
  ]);

  const tierOrder = ["basic", "standard", "premium", "luxury"];
  const tierSet = [...new Set((tiers.data ?? []).map((t: any) => String(t.quality_tier)))];
  tierSet.sort((a, b) => (tierOrder.indexOf(a) === -1 ? 99 : tierOrder.indexOf(a)) - (tierOrder.indexOf(b) === -1 ? 99 : tierOrder.indexOf(b)));

  // Stages: the top-level steps of every committed project playbook, by
  // step_key so the link survives a revision.
  const stages: { key: string; title: string; playbook: string }[] = [];
  for (const pb of (playbooks.data ?? []) as any[]) {
    const tops = (pb.steps ?? []).filter((s: any) => s.is_current && !s.parent_step_id).sort((a: any, b: any) => a.display_order - b.display_order);
    for (const s of tops) stages.push({ key: s.step_key, title: s.title, playbook: pb.name });
  }

  return NextResponse.json({
    success: true,
    data: {
      space_types: spaces.data ?? [],
      component_types: components.data ?? [],
      cost_categories: categories.data ?? [],
      cost_items: items.data ?? [],
      quality_tiers: tierSet,
      stages,
    },
  });
}

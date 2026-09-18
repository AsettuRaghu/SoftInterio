import type { SupabaseClient } from "@supabase/supabase-js";
import { namesOf, notify } from "@/lib/notifications/notify";

/**
 * After a scope row changes: put the person's reason on the history row the
 * trigger wrote, and - once the property's project has been kicked off - tell
 * its project manager, once a day per project, that the scope moved under
 * them. Decided 2026-09-18: anyone with edit may change the scope after
 * kick-off; every change is logged and the PM hears about it. Best effort;
 * the change itself has already succeeded.
 */
export async function afterScopeChange(
  supabase: SupabaseClient,
  args: {
    propertyId: string;
    itemId: string;
    itemName: string;
    reason: string;
    actor: string;
    tenantId: string;
    changed: string[];
  },
): Promise<void> {
  try {
    if (args.reason) {
      const { data: row } = await supabase
        .from("property_scope_item_history")
        .select("id")
        .eq("scope_item_id", args.itemId)
        .eq("changed_by", args.actor)
        .is("reason", null)
        .order("changed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (row) await supabase.from("property_scope_item_history").update({ reason: args.reason }).eq("id", row.id);
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id, name, project_manager_id, kicked_off_at")
      .eq("property_id", args.propertyId)
      .not("kicked_off_at", "is", null)
      .in("status", ["in_progress", "on_hold"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!project?.project_manager_id || project.project_manager_id === args.actor) return;

    const nameOf = await namesOf(supabase, [args.actor]);
    const day = new Date().toISOString().slice(0, 10);
    await notify(supabase, {
      tenantId: args.tenantId,
      to: [project.project_manager_id],
      actor: args.actor,
      kind: "scope_changed",
      title: "Scope changed after kick-off",
      message: `${nameOf(args.actor)} changed ${args.itemName} on ${project.name || "your project"}${
        args.reason ? ` - "${args.reason}"` : ""
      }. Does the quotation or the plan need to follow?`,
      entity: { type: "project", id: project.id },
      actionUrl: `/dashboard/projects/${project.id}?tab=scope`,
      priority: "high",
      dedupeKey: `scope_changed:${project.id}:${day}`,
    });
  } catch (e) {
    console.error("[scope] after-change failed", e);
  }
}

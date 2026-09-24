import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { scopeDrift } from "@/lib/quotations/scope-drift";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/quotations/[id]/to-scope - "Add to the scope".
 *
 * The other direction, and the only writing it does: cost items priced on
 * this quotation that the Scope Sheet does not list become chosen
 * choices on the matching scope component. A quotation may be ahead of the
 * scope as easily as behind it - somebody adds a line in the builder - and
 * until now nothing said so, let alone offered to put it right.
 *
 * It only ever ADDS, mirroring the pull the other way: nothing on the Scope
 * Sheet is changed or removed.
 *
 * **It can now create the component too**, which is what made it useful. A
 * whole component added in the builder - a Study Table somebody priced after
 * the customer asked late - has no scope row, so every one of its lines used to
 * be filtered out here and the button reported "nothing could be matched",
 * having done nothing (2026-09-24). Where the SPACE is on the sheet, the
 * component is created under it from the quotation's own name, type and size,
 * and the items hang off that. Where the space is not there either, there is
 * genuinely nowhere to put it and a person has to add the room first.
 *
 * `component_ids` narrows it to the components named, which is how the builder
 * offers this for the one thing just added rather than sweeping up every
 * divergence at once.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id } = await params;
  const supabase = await createClient();

  const body = await request.json().catch(() => ({}));
  const only: string[] | null = Array.isArray(body?.component_ids) && body.component_ids.length
    ? body.component_ids.map(String)
    : null;

  const { data: quotation } = await supabase.from("quotations").select("id, lead_id, project_id").eq("id", id).eq("tenant_id", user.tenantId).maybeSingle();
  if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

  const drift = await scopeDrift(supabase, user.tenantId, id, quotation.lead_id, quotation.project_id);
  const scoped = only
    ? drift.not_in_scope.filter((l) => l.component_id && only.includes(l.component_id))
    : drift.not_in_scope;
  const wanted = scoped.filter((l) => l.cost_item_id && (l.scope_item_id || l.space_scope_id));
  if (wanted.length === 0) {
    const blocked = scoped.filter((l) => l.cost_item_id && !l.scope_item_id && !l.space_scope_id);
    if (blocked.length) {
      const rooms = [...new Set(blocked.map((b) => b.component))].slice(0, 3).join(", ");
      return NextResponse.json({
        success: true,
        added: 0,
        message: `The room itself is not on the Scope Sheet yet (${rooms}). Add the room there first.`,
      });
    }
    return NextResponse.json({ success: true, added: 0, message: "Everything priced here is already on the Scope Sheet." });
  }

  /**
   * Components with no scope row of their own get one, under the space's row.
   * Created before the items, because the items need a parent - and keyed by
   * the quotation component id so two lines on the same new component share it.
   */
  const needComponent = [...new Map(
    wanted.filter((w) => !w.scope_item_id && w.space_scope_id && w.component_id).map((w) => [w.component_id!, w])
  ).values()];
  const madeComponent = new Map<string, string>();
  if (needComponent.length) {
    const { data: spaceRows } = await supabase
      .from("property_scope_items")
      .select("id, property_id")
      .eq("tenant_id", user.tenantId)
      .in("id", needComponent.map((w) => w.space_scope_id as string));
    const propertyOf = new Map((spaceRows ?? []).map((r) => [r.id as string, r.property_id as string]));
    const { data: qComps } = await supabase
      .from("quotation_components")
      // The unit is in metadata, not a column of its own.
      .select("id, width, height, metadata")
      .in("id", needComponent.map((w) => w.component_id as string));
    const sizeOf = new Map((qComps ?? []).map((c) => [c.id as string, c]));

    for (const w of needComponent) {
      const property_id = propertyOf.get(w.space_scope_id!);
      if (!property_id) continue;
      const q = sizeOf.get(w.component_id!);
      const { data: made, error } = await supabase
        .from("property_scope_items")
        .insert({
          tenant_id: user.tenantId,
          property_id,
          parent_id: w.space_scope_id,
          name: w.component_name ?? "Component",
          component_type_id: w.component_type_id,
          width: q?.width ?? null,
          height: q?.height ?? null,
          // The rule's OTHER fields as well as the size, or the two disagree the
          // moment the row exists: a Study Table with exposed_sides 2 on the
          // quotation and nothing on the sheet reported itself as "resized"
          // straight after being added, which is a silly thing to be told.
          // width and height live in their own columns either side of this, and
          // `metadata.measures` already excludes them.
          measures: (q?.metadata as { measures?: Record<string, number> } | null)?.measures ?? null,
          measurement_unit: (q?.metadata as { measurement_unit?: string } | null)?.measurement_unit ?? "mm",
          scope_owner: "us",
          display_order: 999,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) {
        console.error("[to-scope] could not create the component row", error.message);
        continue;
      }
      madeComponent.set(w.component_id!, made.id as string);
      // The quotation line now has a home on the sheet, so record the link -
      // the same provenance pointer the pull the other way writes.
      await supabase
        .from("quotation_components")
        .update({ metadata: { ...(q?.metadata ?? {}), scope_item_id: made.id } })
        .eq("id", w.component_id!);
    }
  }

  /** Where each wanted line's items should hang: its own row, or the one just made. */
  const parentFor = (w: (typeof wanted)[number]) =>
    w.scope_item_id ?? (w.component_id ? madeComponent.get(w.component_id) ?? null : null);

  const parentIds = [...new Set(wanted.map(parentFor).filter(Boolean) as string[])];
  const [{ data: items }, { data: parents }] = await Promise.all([
    supabase.from("quotation_cost_items").select("id, name").eq("tenant_id", user.tenantId).in("id", wanted.map((w) => w.cost_item_id as string)),
    parentIds.length
      ? supabase.from("property_scope_items").select("id, property_id").eq("tenant_id", user.tenantId).in("id", parentIds)
      : Promise.resolve({ data: [] as { id: string; property_id: string }[] }),
  ]);
  const itemById = new Map((items ?? []).map((i) => [i.id as string, i.name as string]));
  const parentById = new Map((parents ?? []).map((p) => [p.id as string, p.property_id as string]));

  const rows = wanted
    .filter((w) => itemById.has(w.cost_item_id!) && parentById.has(parentFor(w) ?? ""))
    .map((w) => ({
      tenant_id: user.tenantId,
      property_id: parentById.get(parentFor(w)!)!,
      parent_id: parentFor(w),
      cost_item_id: w.cost_item_id,
      choice_status: "p1" as const,
      name: itemById.get(w.cost_item_id!)!,
      display_order: 0,
      created_by: user.id,
    }));
  if (rows.length === 0) return NextResponse.json({ success: true, added: 0, message: "Nothing could be matched to a room on the sheet." });

  /**
   * **Read what is there, then insert - do NOT upsert.**
   *
   * This used `onConflict: "parent_id,cost_item_id"`, and
   * `property_scope_items_one_choice` is a **partial** index
   * (`WHERE cost_item_id IS NOT NULL`), which PostgREST cannot infer: every call
   * came back "there is no unique or exclusion constraint matching the ON
   * CONFLICT specification" and the route answered "Could not add these to the
   * scope". So **"Add to the scope" had never once worked** - it failed on
   * anything it was asked to add (found 2026-09-24). Same trap as
   * `notifications.dedupe_key`, which was written up and then walked into again
   * here.
   *
   * Filtering first is also the more honest shape: it lets the reply say what
   * was already there rather than silently counting it as added.
   */
  const { data: existing } = await supabase
    .from("property_scope_items")
    .select("parent_id, cost_item_id")
    .in("parent_id", parentIds)
    .not("cost_item_id", "is", null);
  const have = new Set((existing ?? []).map((e) => `${e.parent_id}::${e.cost_item_id}`));
  const fresh = rows.filter((r) => !have.has(`${r.parent_id}::${r.cost_item_id}`));

  if (fresh.length === 0 && madeComponent.size === 0) {
    return NextResponse.json({ success: true, added: 0, message: "Already on the Scope Sheet." });
  }

  let inserted: { id: string }[] = [];
  if (fresh.length) {
    const { data, error } = await supabase.from("property_scope_items").insert(fresh).select("id");
    if (error) {
      // 23505 is the partial index doing its job on a concurrent add, which is
      // the outcome we wanted anyway.
      if (error.code !== "23505") {
        console.error("[to-scope] insert failed", error.message);
        return NextResponse.json({ error: "Could not add these to the Scope Sheet" }, { status: 500 });
      }
    } else {
      inserted = (data ?? []) as { id: string }[];
    }
  }
  const added = inserted?.length ?? 0;
  const made = madeComponent.size;
  const parts: string[] = [];
  if (made) parts.push(`${made} component${made === 1 ? "" : "s"}`);
  if (added) parts.push(`${added} item${added === 1 ? "" : "s"}`);
  return NextResponse.json({
    success: true,
    added,
    components_added: made,
    message: parts.length ? `Added ${parts.join(" and ")} to the Scope Sheet.` : "Already on the Scope Sheet.",
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { notify, namesOf } from "@/lib/notifications/notify";

type RouteParams = { params: Promise<{ id: string; commentId: string }> };

/**
 * POST { related_type: "lead" | "project", related_id, assigned_to?, due_date? }
 *
 * Turns a discussion entry into a task on the lead or project - "needs
 * rework" becomes work with an owner. The comment keeps the task id so the
 * thread shows where it went. Needs tasks.create, because it creates one.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["tasks.create"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id, commentId } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  if (!["lead", "project"].includes(body.related_type) || !body.related_id) {
    return NextResponse.json({ error: "related_type and related_id are required" }, { status: 400 });
  }

  const { data: comment } = await supabase
    .from("scope_item_comments")
    .select("id, body, task_id, scope_item_id, item:property_scope_items(name)")
    .eq("id", commentId)
    .eq("property_id", id)
    .maybeSingle();
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (comment.task_id) return NextResponse.json({ error: "This already has a task" }, { status: 409 });

  const itemName = (comment.item as unknown as { name?: string } | null)?.name;
  const firstLine = comment.body.split("\n")[0].trim();
  const title = `${itemName ? `${itemName}: ` : ""}${firstLine.length > 90 ? `${firstLine.slice(0, 87)}…` : firstLine}`;

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      tenant_id: user.tenantId,
      title,
      description: comment.body,
      status: "todo",
      priority: "medium",
      related_type: body.related_type,
      related_id: body.related_id,
      assigned_to: body.assigned_to || null,
      due_date: body.due_date || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id, title, assigned_to")
    .single();
  if (error || !task) {
    console.error("[scope] task from comment failed", error?.message);
    return NextResponse.json({ error: "Could not create the task" }, { status: 500 });
  }

  await supabase.from("scope_item_comments").update({ task_id: task.id, needs_rework: true }).eq("id", commentId);

  if (task.assigned_to && task.assigned_to !== user.id) {
    const nameOf = await namesOf(supabase, [user.id]);
    await notify(supabase, {
      tenantId: user.tenantId,
      to: [task.assigned_to],
      actor: user.id,
      kind: "task_assigned",
      title: "New task for you",
      message: `${nameOf(user.id)} assigned you "${task.title}"`,
      entity: { type: "task", id: task.id },
      actionUrl: `/dashboard/tasks/${task.id}`,
    });
  }
  return NextResponse.json({ data: { task_id: task.id, title: task.title } }, { status: 201 });
}

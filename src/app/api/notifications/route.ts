import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

/**
 * A person's own notifications. RLS returns only rows where user_id is the
 * caller, so the session client is the whole access rule here.
 *
 * GET    ?page=&limit=&unread=true      list + unread_count
 * PATCH  { notification_ids } | { mark_all: true }   mark read
 * DELETE ?id=<uuid> | ?read=true         remove one, or everything already read
 *
 * The actor's name comes from tenant_directory, not a users embed - through
 * the session client a users row is visible only to its owner, so the embed
 * came back null for every colleague.
 */

export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request);
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const supabase = await createClient();

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "20", 10) || 20));
  const unreadOnly = sp.get("unread") === "true";
  const offset = (page - 1) * limit;

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (unreadOnly) query = query.eq("is_read", false);

  const [{ data: rows, error, count }, { count: unreadCount }] = await Promise.all([
    query,
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false),
  ]);
  if (error) {
    console.error("[notifications] list failed", error.message);
    return NextResponse.json({ error: "Could not load notifications" }, { status: 500 });
  }

  const actorIds = Array.from(
    new Set((rows ?? []).map((r) => r.triggered_by).filter(Boolean) as string[]),
  );
  const { data: people } = actorIds.length
    ? await supabase.from("tenant_directory").select("id, name, avatar_url").in("id", actorIds)
    : { data: [] as { id: string; name: string; avatar_url: string | null }[] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  const notifications = (rows ?? []).map((r) => ({
    ...r,
    triggered_user: r.triggered_by ? byId.get(r.triggered_by) ?? null : null,
  }));

  return NextResponse.json({
    notifications,
    unread_count: unreadCount ?? 0,
    total_count: count ?? 0,
    has_more: (count ?? 0) > offset + limit,
    page,
    limit,
  });
}

export async function PATCH(request: NextRequest) {
  const guard = await protectApiRoute(request);
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const supabase = await createClient();

  const body = await request.json().catch(() => ({}));
  const stamp = { is_read: true, read_at: new Date().toISOString() };

  let q = supabase.from("notifications").update(stamp).eq("user_id", user.id).eq("is_read", false);
  if (body.mark_all) {
    // everything
  } else if (Array.isArray(body.notification_ids) && body.notification_ids.length > 0) {
    q = q.in("id", body.notification_ids);
  } else {
    return NextResponse.json({ error: "notification_ids or mark_all is required" }, { status: 400 });
  }
  const { error } = await q;
  if (error) {
    console.error("[notifications] mark read failed", error.message);
    return NextResponse.json({ error: "Could not mark as read" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const guard = await protectApiRoute(request);
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const supabase = await createClient();

  const sp = request.nextUrl.searchParams;
  let q = supabase.from("notifications").delete().eq("user_id", user.id);
  if (sp.get("id")) q = q.eq("id", sp.get("id")!);
  else if (sp.get("read") === "true") q = q.eq("is_read", true);
  else return NextResponse.json({ error: "id or read=true is required" }, { status: 400 });

  const { error } = await q;
  if (error) {
    console.error("[notifications] delete failed", error.message);
    return NextResponse.json({ error: "Could not remove" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

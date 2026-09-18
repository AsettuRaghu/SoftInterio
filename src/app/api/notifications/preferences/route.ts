import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { NOTIFICATION_KIND_LIST, isNotificationKind } from "@/lib/notifications/kinds";

/**
 * Which kinds a person wants in-app. Every kind is on by default; a row in
 * notification_preferences exists only to turn one off, so the answer is
 * "all kinds, minus the rows that say in_app = false".
 *
 * GET  -> { preferences: { [kind]: boolean } }
 * PUT  { kind, in_app }  -> the same shape after the change
 *
 * Email and push columns exist on the table and are not offered: there is
 * no send path for either.
 */

async function current(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("notification_preferences")
    .select("notification_type, in_app")
    .eq("user_id", userId);
  const off = new Set((data ?? []).filter((r) => r.in_app === false).map((r) => r.notification_type));
  return Object.fromEntries(NOTIFICATION_KIND_LIST.map((k) => [k, !off.has(k)]));
}

export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request);
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();
  return NextResponse.json({ preferences: await current(supabase, guard.user.id) });
}

export async function PUT(request: NextRequest) {
  const guard = await protectApiRoute(request);
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  if (!isNotificationKind(body.kind) || typeof body.in_app !== "boolean") {
    return NextResponse.json({ error: "kind and in_app are required" }, { status: 400 });
  }
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: guard.user.id,
      notification_type: body.kind,
      in_app: body.in_app,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,notification_type" },
  );
  if (error) {
    console.error("[notifications] preference save failed", error.message);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
  return NextResponse.json({ preferences: await current(supabase, guard.user.id) });
}

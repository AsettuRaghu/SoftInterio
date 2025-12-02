import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/types/notifications";

// GET /api/notifications - Get user's notifications
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const unreadOnly = searchParams.get("unread") === "true";

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("notifications")
      .select(
        `
        *,
        triggered_user:triggered_by(id, name, avatar_url)
      `,
        { count: "exact" }
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data: notifications, error, count } = await query;

    if (error) {
      console.error("[Notifications] Error fetching:", error);
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 }
      );
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: unreadCount || 0,
      total_count: count || 0,
      has_more: (count || 0) > offset + limit,
      page,
      limit,
    });
  } catch (error) {
    console.error("[Notifications] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { notification_ids, mark_all } = body;

    if (mark_all) {
      // Mark all as read
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) {
        console.error("[Notifications] Error marking all as read:", error);
        return NextResponse.json(
          { error: "Failed to mark notifications as read" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "All notifications marked as read",
      });
    }

    if (
      !notification_ids ||
      !Array.isArray(notification_ids) ||
      notification_ids.length === 0
    ) {
      return NextResponse.json(
        { error: "notification_ids array is required" },
        { status: 400 }
      );
    }

    // Mark specific notifications as read
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .in("id", notification_ids);

    if (error) {
      console.error("[Notifications] Error marking as read:", error);
      return NextResponse.json(
        { error: "Failed to mark notifications as read" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Notifications marked as read",
    });
  } catch (error) {
    console.error("[Notifications] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

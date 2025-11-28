/**
 * Current User API Route
 * GET /api/auth/me - Get the current authenticated user
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Get current user from auth
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get user details from users table
    const { data: userData, error: userError } = await adminClient
      .from("users")
      .select("id, name, email, tenant_id, is_super_admin, status")
      .eq("id", authUser.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: userData,
    });
  } catch (error: any) {
    console.error("[AUTH/ME] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get current user" },
      { status: 500 }
    );
  }
}

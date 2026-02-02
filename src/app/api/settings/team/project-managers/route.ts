import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/settings/team/project-managers - Get users with project_manager role
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Get current user's tenant
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      console.error("[PM API] User not found error:", userError);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    console.log("[PM API] Fetching project managers for tenant:", userData.tenant_id);

    // Step 1: Get project_manager role FOR THIS TENANT
    // All roles are tied to a specific tenant_id (no system-wide roles)
    const { data: pmRoles, error: rolesError } = await supabase
      .from("roles")
      .select("id")
      .eq("slug", "project_manager")
      .eq("tenant_id", userData.tenant_id);

    if (rolesError) {
      console.error("[PM API] Error fetching project_manager role:", rolesError);
      return NextResponse.json(
        { error: "Failed to fetch project_manager role" },
        { status: 500 }
      );
    }

    if (!pmRoles || pmRoles.length === 0) {
      console.warn("[PM API] No project_manager role found for tenant", userData.tenant_id);
      return NextResponse.json([]);
    }

    const pmRoleIds = pmRoles.map((r: any) => r.id);
    console.log("[PM API] Found project_manager role IDs:", pmRoleIds);

    // Step 2: Get all user_roles records with any of these role_ids
    const { data: allUserRoles, error: allUserRolesError } = await supabase
      .from("user_roles")
      .select("*")
      .in("role_id", pmRoleIds);

    if (allUserRolesError) {
      console.error("[PM API] Error fetching user_roles:", allUserRolesError);
      return NextResponse.json(
        { error: "Failed to fetch user_roles" },
        { status: 500 }
      );
    }

    console.log("[PM API] Total user_roles with project_manager role:", allUserRoles?.length || 0);
    console.log("[PM API] User role records:", allUserRoles);

    if (!allUserRoles || allUserRoles.length === 0) {
      console.warn("[PM API] No users with project_manager role found");
      return NextResponse.json([]);
    }

    // Step 3: Get the user_ids from user_roles
    const userIds = allUserRoles.map((ur: any) => ur.user_id);
    console.log("[PM API] User IDs with PM role:", userIds);

    // Step 4: Fetch users with these IDs from the tenant
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, email, avatar_url, tenant_id")
      .in("id", userIds)
      .eq("tenant_id", userData.tenant_id);

    if (usersError) {
      console.error("[PM API] Error fetching users:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    console.log("[PM API] Users found in tenant:", users?.length || 0);
    console.log("[PM API] Users data:", users);

    // Step 5: Map to response format
    const response = (users || []).map((u: any) => ({
      id: u.id,
      full_name: u.name,
      email: u.email,
      avatar_url: u.avatar_url,
      role: "project_manager"
    }));

    console.log("[PM API] Final response count:", response.length);
    console.log("[PM API] Final response:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[PM API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

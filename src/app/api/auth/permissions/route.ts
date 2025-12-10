import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/auth/permissions - Get current user's permissions and role info
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Get user's roles
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select(
        `
        role:roles(
          id,
          name,
          slug,
          hierarchy_level
        )
      `
      )
      .eq("user_id", user.id);

    if (rolesError) {
      console.error("[Permissions] Error fetching roles:", rolesError);
      return NextResponse.json(
        { error: "Failed to fetch user roles" },
        { status: 500 }
      );
    }

    const roles = userRoles?.map((ur) => ur.role).filter(Boolean) || [];
    const roleSlugs = roles.map((r: any) => r.slug);
    const minHierarchyLevel = Math.min(
      ...roles.map((r: any) => r.hierarchy_level || 999)
    );

    // Determine permissions based on roles
    const permissions = {
      // Sales permissions
      can_move_lead_to_won: roleSlugs.some((slug: string) =>
        ["owner", "admin", "manager", "sales-manager"].includes(slug)
      ),
      can_assign_leads: roleSlugs.some((slug: string) =>
        ["owner", "admin", "manager", "sales-manager"].includes(slug)
      ),
      can_view_all_leads: roleSlugs.some((slug: string) =>
        ["owner", "admin", "manager", "sales-manager", "finance"].includes(slug)
      ),
      can_delete_leads: roleSlugs.some((slug: string) =>
        ["owner", "admin"].includes(slug)
      ),

      // General permissions
      is_owner: roleSlugs.includes("owner"),
      is_admin: roleSlugs.some((slug: string) =>
        ["owner", "admin"].includes(slug)
      ),
      is_manager: minHierarchyLevel <= 2,

      // Hierarchy level for comparison
      hierarchy_level: minHierarchyLevel,
    };

    return NextResponse.json({
      user_id: user.id,
      roles,
      role_slugs: roleSlugs,
      permissions,
    });
  } catch (error) {
    console.error("[Permissions] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

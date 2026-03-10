/**
 * Billing Capability Check API
 * POST /api/billing/can-add - Check if tenant can perform an action
 */

import { NextRequest, NextResponse } from "next/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import {
  canAddUser,
  canAddProject,
  canUploadDocument,
} from "@/lib/billing/usage";

interface CapabilityCheckRequest {
  type: "user" | "project" | "document";
  fileSizeBytes?: number; // Required for document type
}

// POST /api/billing/can-add
// Check if tenant can add a resource
export async function POST(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await (await import("@/lib/supabase/server")).createClient();

    // Get user's tenant
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    const body: CapabilityCheckRequest = await request.json();
    const { type, fileSizeBytes } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Type is required (user, project, or document)" },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case "user":
        result = await canAddUser(userData.tenant_id);
        break;

      case "project":
        result = await canAddProject(userData.tenant_id);
        break;

      case "document":
        if (!fileSizeBytes) {
          return NextResponse.json(
            { error: "fileSizeBytes is required for document type" },
            { status: 400 }
          );
        }
        result = await canUploadDocument(userData.tenant_id, fileSizeBytes);
        break;

      default:
        return NextResponse.json(
          { error: "Invalid type. Must be user, project, or document" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[BILLING CAPABILITY API] Error:", error);
    return NextResponse.json(
      { error: "Failed to check capability" },
      { status: 500 }
    );
  }
}

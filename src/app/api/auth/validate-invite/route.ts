/**
 * Validate Invite API Route
 * GET /api/auth/validate-invite
 * Validates an invitation token for existing users
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  console.log("[VALIDATE-INVITE API] GET /api/auth/validate-invite");

  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (!token || !email) {
      return NextResponse.json(
        { success: false, error: "Missing token or email" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Find the invitation by token
    const { data: invitation, error: inviteError } = await adminClient
      .from("user_invitations")
      .select(
        `
        id,
        email,
        status,
        expires_at,
        role_id,
        metadata,
        tenant:tenants(id, name)
      `
      )
      .eq("token", token)
      .ilike("email", email.toLowerCase())
      .single();

    if (inviteError || !invitation) {
      console.log("[VALIDATE-INVITE API] Invitation not found:", inviteError);
      return NextResponse.json(
        { success: false, error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Check invitation status
    if (invitation.status === "accepted") {
      return NextResponse.json(
        { success: false, error: "This invitation has already been accepted" },
        { status: 400 }
      );
    }

    if (invitation.status === "cancelled") {
      return NextResponse.json(
        { success: false, error: "This invitation has been cancelled" },
        { status: 400 }
      );
    }

    // Check if expired
    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: "This invitation has expired. Please request a new one.",
        },
        { status: 400 }
      );
    }

    console.log("[VALIDATE-INVITE API] Invitation valid:", invitation.id);

    return NextResponse.json({
      success: true,
      data: {
        email: invitation.email,
        companyName: (invitation.tenant as any)?.name || "the organization",
        expiresAt: invitation.expires_at,
      },
    });
  } catch (error: any) {
    console.error("[VALIDATE-INVITE API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to validate invitation",
      },
      { status: 500 }
    );
  }
}

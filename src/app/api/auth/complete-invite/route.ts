/**
 * Complete Invite API Route
 * POST /api/auth/complete-invite
 * Updates user status to 'active' after they set their password
 * (User record and roles are already created at invite time)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  console.log("[COMPLETE-INVITE API] POST /api/auth/complete-invite");

  try {
    const body = await request.json();
    const { userId, email, invitationId } = body;

    console.log("[COMPLETE-INVITE API] Request:", {
      userId,
      email,
      invitationId,
    });

    if (!userId || !email) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Update user status from 'invited' to 'active'
    const { data: updatedUser, error: updateError } = await adminClient
      .from("users")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      console.error(
        "[COMPLETE-INVITE API] Failed to update user status:",
        updateError
      );
    } else {
      console.log(
        "[COMPLETE-INVITE API] User status updated to 'active':",
        updatedUser?.id
      );
    }

    // Update invitation status to accepted
    if (invitationId) {
      console.log("[COMPLETE-INVITE API] Updating invitation status...");

      const { error: inviteError } = await adminClient
        .from("user_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitationId);

      if (inviteError) {
        console.error(
          "[COMPLETE-INVITE API] Invitation update error:",
          inviteError
        );
      } else {
        console.log("[COMPLETE-INVITE API] Invitation marked as accepted");
      }
    }

    return NextResponse.json({
      success: true,
      message: "User activated successfully",
    });
  } catch (error: any) {
    console.error("[COMPLETE-INVITE API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to complete setup" },
      { status: 500 }
    );
  }
}

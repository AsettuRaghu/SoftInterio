/**
 * Sign Out API Route
 * POST /api/auth/signout
 * Signs out the current user
 */

import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/lib/auth/service";

export async function POST(request: NextRequest) {
  console.log("[SIGNOUT API] POST /api/auth/signout - Request received");

  try {
    await signOut();
    console.log("[SIGNOUT API] User signed out successfully");

    return NextResponse.json(
      {
        success: true,
        message: "Signed out successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[SIGNOUT API] Sign out error:", error);
    console.error(
      "[SIGNOUT API] Error details:",
      JSON.stringify(error, null, 2)
    );

    return NextResponse.json(
      { success: false, error: "Failed to sign out. Please try again." },
      { status: 500 }
    );
  }
}

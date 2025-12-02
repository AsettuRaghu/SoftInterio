/**
 * Auth Confirm Route
 * Handles Supabase email confirmation links (invite, magic link, recovery)
 *
 * Supabase sends links in format:
 * /auth/confirm?token_hash=xxx&type=invite (or email, recovery)
 */

import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  console.log("[Auth Confirm] Received:", {
    token_hash: token_hash ? "present" : "missing",
    type,
    next,
    fullUrl: request.url,
  });

  if (!token_hash || !type) {
    console.error("[Auth Confirm] Missing token_hash or type");
    return NextResponse.redirect(
      new URL(
        "/auth/signin?error=Missing+verification+parameters",
        requestUrl.origin
      )
    );
  }

  const supabase = await createClient();

  // Verify the OTP token
  console.log("[Auth Confirm] Verifying OTP token...");
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  });

  if (error) {
    console.error("[Auth Confirm] Verification error:", error);
    return NextResponse.redirect(
      new URL(
        `/auth/signin?error=${encodeURIComponent(error.message)}`,
        requestUrl.origin
      )
    );
  }

  console.log("[Auth Confirm] Token verified successfully:", {
    email: data.user?.email,
    metadata: data.user?.user_metadata,
  });

  // Redirect based on the type
  if (type === "invite") {
    console.log("[Auth Confirm] Redirecting to setup-password for invite");
    return NextResponse.redirect(
      new URL("/auth/setup-password", requestUrl.origin)
    );
  }

  if (type === "recovery") {
    console.log("[Auth Confirm] Redirecting to reset-password for recovery");
    return NextResponse.redirect(
      new URL("/auth/reset-password", requestUrl.origin)
    );
  }

  if (type === "signup" || type === "email") {
    console.log("[Auth Confirm] Email confirmed, redirecting to:", next);
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  // Default: go to the next URL or dashboard
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

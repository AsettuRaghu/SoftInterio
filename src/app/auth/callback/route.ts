/**
 * Auth Callback Route
 * Handles Supabase auth redirects (magic links, invite links, OAuth, etc.)
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const error = requestUrl.searchParams.get("error");
  const error_description = requestUrl.searchParams.get("error_description");

  console.log("[Auth Callback] Received:", {
    code: code ? "present" : "missing",
    token_hash: token_hash ? "present" : "missing",
    type,
    next,
    error,
    fullUrl: request.url,
  });

  // Handle errors from Supabase
  if (error) {
    console.error("[Auth Callback] Error:", error, error_description);
    return NextResponse.redirect(
      new URL(
        `/auth/signin?error=${encodeURIComponent(error_description || error)}`,
        requestUrl.origin
      )
    );
  }

  const supabase = await createClient();

  // Handle PKCE code exchange (most common flow)
  if (code) {
    console.log("[Auth Callback] Exchanging code for session...");
    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("[Auth Callback] Code exchange error:", exchangeError);
      return NextResponse.redirect(
        new URL(
          `/auth/signin?error=${encodeURIComponent(exchangeError.message)}`,
          requestUrl.origin
        )
      );
    }

    console.log("[Auth Callback] Session established for:", data.user?.email);
    console.log("[Auth Callback] User metadata:", data.user?.user_metadata);

    // For invite type, redirect to password setup
    if (type === "invite" || type === "signup") {
      console.log(
        "[Auth Callback] Redirecting to setup-password for invite/signup"
      );
      return NextResponse.redirect(
        new URL("/auth/setup-password", requestUrl.origin)
      );
    }

    // For password recovery
    if (type === "recovery") {
      console.log("[Auth Callback] Redirecting to reset-password for recovery");
      return NextResponse.redirect(
        new URL("/auth/reset-password", requestUrl.origin)
      );
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  // Handle token hash (older flow)
  if (token_hash) {
    console.log("[Auth Callback] Verifying token hash...");
    const { data: verifyData, error: verifyError } =
      await supabase.auth.verifyOtp({
        token_hash,
        type: (type as any) || "email",
      });

    if (verifyError) {
      console.error("[Auth Callback] Token verification error:", verifyError);
      return NextResponse.redirect(
        new URL(
          `/auth/signin?error=${encodeURIComponent(verifyError.message)}`,
          requestUrl.origin
        )
      );
    }

    console.log("[Auth Callback] Token verified for:", verifyData?.user?.email);

    // For invite type, redirect to password setup
    if (type === "invite") {
      console.log("[Auth Callback] Redirecting to setup-password for invite");
      return NextResponse.redirect(
        new URL("/auth/setup-password", requestUrl.origin)
      );
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  // No code or token_hash, check if user is already authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    console.log("[Auth Callback] User already authenticated:", user.email);
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  console.log(
    "[Auth Callback] No code, token, or user - redirecting to signin"
  );
  // Fallback to signin
  return NextResponse.redirect(new URL("/auth/signin", requestUrl.origin));
}

/**
 * Supabase Middleware Helper
 * Handles automatic session refresh and cookie management
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Skip middleware for API routes, static files, and other special paths
  const path = request.nextUrl.pathname;
  if (
    path.startsWith("/api/") ||
    path.startsWith("/_next/") ||
    path.startsWith("/favicon.ico")
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes logic
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    request.nextUrl.pathname !== "/"
  ) {
    // Redirect to sign in if not authenticated
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signin";
    return NextResponse.redirect(url);
  }

  // For authenticated users accessing dashboard, verify their membership is active
  if (user && request.nextUrl.pathname.startsWith("/dashboard")) {
    // Check if user has active membership in their tenant
    const { data: userData } = await supabase
      .from("users")
      .select("id, tenant_id, status")
      .eq("id", user.id)
      .single();

    // If user status is disabled/deleted, sign them out
    if (userData?.status === "disabled" || userData?.status === "deleted") {
      console.log("[MIDDLEWARE] User account disabled, signing out:", user.id);
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/auth/signin";
      url.searchParams.set("error", "account_deactivated");
      return NextResponse.redirect(url);
    }

    // Check tenant_users for active membership (if table exists and user has tenant)
    if (userData?.tenant_id) {
      const { data: membership, error: membershipError } = await supabase
        .from("tenant_users")
        .select("is_active")
        .eq("user_id", user.id)
        .eq("tenant_id", userData.tenant_id)
        .single();

      // If tenant_users exists and membership is inactive, sign them out
      if (!membershipError && membership && !membership.is_active) {
        console.log(
          "[MIDDLEWARE] User membership inactive, signing out:",
          user.id
        );
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/auth/signin";
        url.searchParams.set("error", "access_revoked");
        return NextResponse.redirect(url);
      }
    }
  }

  // Redirect authenticated users away from auth pages (except setup-password, reset-password, accept-invite, confirm, and callback)
  if (
    user &&
    request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/auth/setup-password") &&
    !request.nextUrl.pathname.startsWith("/auth/reset-password") &&
    !request.nextUrl.pathname.startsWith("/auth/accept-invite") &&
    !request.nextUrl.pathname.startsWith("/auth/callback") &&
    !request.nextUrl.pathname.startsWith("/auth/confirm")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Also redirect from home page if authenticated
  if (user && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}

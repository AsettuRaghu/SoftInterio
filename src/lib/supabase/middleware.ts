/**
 * Supabase Middleware Helper
 * Handles automatic session refresh and cookie management
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSubscriptionStatus, hasAccessToplatform, getAccessBlockedMessage } from "@/lib/billing/subscription-status";
import type { TenantSubscriptionData } from "@/lib/billing/subscription-status";
import { accessLogger } from "@/lib/activity-logger";
import {
  routePermissions,
  type RoutePermission,
} from "@/config/route-permissions";

// ============================================
// ROUTE PERMISSION CONFIGURATION
// ============================================
//
// This list used to be copied out into this file "to work with Edge Runtime".
// It then drifted from src/config/route-permissions.ts, which is the copy that
// looks authoritative and was in fact read by nothing: four pages listed there
// - the quotation config, print and terms libraries, and Settings -> Config -
// were never gated at all, while this copy still guarded
// /dashboard/settings/roles, a page that does not exist, behind
// settings.roles.view, a permission that does not exist.
//
// The config module is types and a literal array with no Node dependencies, so
// Edge imports it perfectly well and there is one list again.

/**
 * Match route against pattern
 */
function matchRoute(pathname: string, pattern: string): boolean {
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    return pathname === prefix || pathname.startsWith(prefix + "/");
  }
  return pathname === pattern;
}

/**
 * Get permission requirement for a route
 */
function getRoutePermissionForPath(pathname: string): RoutePermission | null {
  for (const route of routePermissions) {
    if (matchRoute(pathname, route.pattern)) {
      return route;
    }
  }
  return null;
}

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

  let user = null;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch (error) {
    // Handle network errors gracefully - allow request to proceed
    // User will be checked on the client side
    console.log("[MIDDLEWARE] Error getting user session:", error);
  }

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
    try {
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

      // Check subscription status
      if (userData?.tenant_id) {
        const { data: subscription, error: subscriptionError } = await supabase
          .from("tenant_subscriptions")
          .select("id, status, is_trial, trial_start_date, trial_end_date, subscription_start_date, subscription_end_date, current_period_start, current_period_end, last_payment_date, grace_period_days, grace_period_end")
          .eq("tenant_id", userData.tenant_id)
          .single();

        if (!subscriptionError && subscription) {
          // Use new subscription status utility
          const subscriptionStatus = getSubscriptionStatus(subscription as TenantSubscriptionData);
          
          // Block access if user doesn't have access to platform
          if (!subscriptionStatus.isActive) {
            console.log(
              "[MIDDLEWARE] Access blocked for user:",
              user.id,
              "Reason:",
              subscriptionStatus.state
            );
            
            // Log access denied
            if (subscriptionStatus.state === 'expired-no-payment') {
              await accessLogger.blockedTrialExpired(userData.tenant_id, user.id);
            } else if (subscriptionStatus.state === 'expired-subscription') {
              await accessLogger.blockedSubscriptionExpired(userData.tenant_id, user.id);
            } else {
              await accessLogger.blockedInactiveAccount(userData.tenant_id, user.id);
            }
            
            await supabase.auth.signOut();
            const url = request.nextUrl.clone();
            url.pathname = "/auth/signin";
            url.searchParams.set("error", subscriptionStatus.state);
            return NextResponse.redirect(url);
          }
        }
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

        // Check subscription status - ensure tenant has access
        const { data: subscription, error: subscriptionError } = await supabase
          .from("tenant_subscriptions")
          .select("id, status, is_trial, trial_start_date, trial_end_date, subscription_start_date, subscription_end_date, current_period_start, current_period_end, last_payment_date, grace_period_days, grace_period_end")
          .eq("tenant_id", userData.tenant_id)
          .single();

        if (!subscriptionError && subscription) {
          // Use new subscription status utility
          const subscriptionStatus = getSubscriptionStatus(subscription as TenantSubscriptionData);
          
          // Block access if user doesn't have access to platform
          if (!subscriptionStatus.isActive) {
            console.log(
              "[MIDDLEWARE] Access blocked for tenant:",
              userData.tenant_id,
              "Reason:",
              subscriptionStatus.state
            );
            await supabase.auth.signOut();
            const url = request.nextUrl.clone();
            url.pathname = "/auth/signin";
            url.searchParams.set("error", subscriptionStatus.state);
            return NextResponse.redirect(url);
          }
        }

        // ============================================
        // ROUTE-LEVEL PERMISSION CHECK
        // ============================================
        const pathname = request.nextUrl.pathname;
        
        // Get route permission requirement
        const routePermission = getRoutePermissionForPath(pathname);
        
        if (routePermission) {
          // Fetch user's permissions from database
          const { data: userRolesData, error: rolesError } = await supabase
            .from("user_roles")
            .select(`
              roles (
                slug,
                role_permissions (
                  granted,
                  permissions (
                    key
                  )
                )
              )
            `)
            .eq("user_id", user.id);

          // Check if user is super admin
          const { data: userRecord, error: userRecordError } = await supabase
            .from("users")
            .select("is_super_admin")
            .eq("id", user.id)
            .single();

          // If either lookup failed we do not KNOW what this user may do, and
          // "unknown" is not the same as "not allowed".
          //
          // These queries reuse the session that supabase.auth.getUser() just
          // refreshed. After a long idle period the old access token has
          // expired, and a refresh that is still in flight (or a transient
          // network failure reaching Supabase) makes them return an error with
          // data undefined. The previous code discarded the error, so
          // userRecord became undefined -> isSuperAdmin false, userRolesData
          // became undefined -> zero permissions -> access_denied. A network
          // blip logged people out of the page they were on, super admins
          // included.
          //
          // Skipping the check here is safe: this gate is a UX affordance, not
          // the security boundary. protectApiRoute() guards all 98 API routes
          // and RLS guards every table, so a user who genuinely lacks
          // permission still sees no data - they just are not bounced to the
          // dashboard on an infrastructure hiccup.
          // !userRecord is checked explicitly, not just the error. RLS on
          // user_roles is USING (user_id = auth.uid()), so an expired token
          // makes auth.uid() NULL and that query returns an EMPTY ARRAY WITH
          // NO ERROR - which would read as "this user has no permissions".
          // The users .single() lookup does error in that situation, but
          // relying on that side effect would be fragile.
          if (rolesError || userRecordError || !userRecord) {
            console.log(
              "[MIDDLEWARE] Could not resolve permissions, allowing through:",
              pathname,
              rolesError?.message ||
                userRecordError?.message ||
                "no user record returned"
            );
            return supabaseResponse;
          }

          const isSuperAdmin = userRecord?.is_super_admin === true;

          // Super admins have access to everything
          if (!isSuperAdmin) {
            // Extract permission keys from user's roles
            const userPermissions = new Set<string>();
            userRolesData?.forEach((ur: any) => {
              ur.roles?.role_permissions?.forEach((rp: any) => {
                if (rp.granted && rp.permissions?.key) {
                  userPermissions.add(rp.permissions.key);
                }
              });
            });

            // Check if user has required permissions
            const { permissions, requireAll } = routePermission;
            const hasAccess = requireAll
              ? permissions.every((p) => userPermissions.has(p))
              : permissions.some((p) => userPermissions.has(p));

            if (!hasAccess) {
              console.log(
                "[MIDDLEWARE] Access denied for route:",
                pathname,
                "User:",
                user.id,
                "Required:",
                permissions,
                "Has:",
                Array.from(userPermissions)
              );
              // Redirect to dashboard with access denied error
              const url = request.nextUrl.clone();
              url.pathname = "/dashboard";
              url.searchParams.set("error", "access_denied");
              return NextResponse.redirect(url);
            }
          }
        }
      }
    } catch (error) {
      // Handle database query errors gracefully
      console.log("[MIDDLEWARE] Error checking user permissions:", error);
      // Allow request to proceed - user will see limited functionality
      // but won't be completely blocked due to network issues
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

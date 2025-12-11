/**
 * Supabase Middleware Helper
 * Handles automatic session refresh and cookie management
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ============================================
// ROUTE PERMISSION CONFIGURATION
// Inline to work with Edge Runtime
// ============================================

interface RoutePermission {
  pattern: string;
  permissions: string[];
  requireAll?: boolean;
}

/**
 * Protected routes configuration
 * Routes are checked in order - first match wins
 */
const routePermissions: RoutePermission[] = [
  // Settings routes
  { pattern: "/dashboard/settings/team/*", permissions: ["settings.team.view"] },
  { pattern: "/dashboard/settings/team", permissions: ["settings.team.view"] },
  { pattern: "/dashboard/settings/company", permissions: ["settings.company.view"] },
  { pattern: "/dashboard/settings/billing", permissions: ["settings.billing"] },
  { pattern: "/dashboard/settings/roles/*", permissions: ["settings.roles.view"] },
  { pattern: "/dashboard/settings/roles", permissions: ["settings.roles.view"] },
  { pattern: "/dashboard/settings/quotations-config", permissions: ["quotations.view"] },
  
  // Sales routes
  { pattern: "/dashboard/sales/leads/*", permissions: ["leads.view"] },
  { pattern: "/dashboard/sales/leads", permissions: ["leads.view"] },
  { pattern: "/dashboard/sales/pipeline", permissions: ["leads.view"] },
  { pattern: "/dashboard/sales/clients/*", permissions: ["clients.view"] },
  { pattern: "/dashboard/sales/clients", permissions: ["clients.view"] },
  { pattern: "/dashboard/sales", permissions: ["leads.view", "clients.view"], requireAll: false },
  
  // Projects routes
  { pattern: "/dashboard/projects/*", permissions: ["projects.view"] },
  { pattern: "/dashboard/projects", permissions: ["projects.view"] },
  
  // Quotations routes
  { pattern: "/dashboard/quotations/templates/*", permissions: ["quotations.templates.view"] },
  { pattern: "/dashboard/quotations/templates", permissions: ["quotations.templates.view"] },
  { pattern: "/dashboard/quotations/new", permissions: ["quotations.create"] },
  { pattern: "/dashboard/quotations/*", permissions: ["quotations.view"] },
  { pattern: "/dashboard/quotations", permissions: ["quotations.view"] },
  
  // Stock routes
  { pattern: "/dashboard/stock/inventory/*", permissions: ["materials.view"] },
  { pattern: "/dashboard/stock/inventory", permissions: ["materials.view"] },
  { pattern: "/dashboard/stock/purchase-orders/*", permissions: ["po.view"] },
  { pattern: "/dashboard/stock/purchase-orders", permissions: ["po.view"] },
  { pattern: "/dashboard/stock/vendors/*", permissions: ["vendors.view"] },
  { pattern: "/dashboard/stock/vendors", permissions: ["vendors.view"] },
  { pattern: "/dashboard/stock/brands/*", permissions: ["brands.view"] },
  { pattern: "/dashboard/stock/brands", permissions: ["brands.view"] },
  { pattern: "/dashboard/stock", permissions: ["stock.view", "stock.overview"], requireAll: false },
  
  // Finance routes
  { pattern: "/dashboard/finance/invoices/*", permissions: ["finance.invoices.view"] },
  { pattern: "/dashboard/finance/invoices", permissions: ["finance.invoices.view"] },
  { pattern: "/dashboard/finance/payments/*", permissions: ["finance.payments.view"] },
  { pattern: "/dashboard/finance/payments", permissions: ["finance.payments.view"] },
  { pattern: "/dashboard/finance/expenses/*", permissions: ["finance.expenses.view"] },
  { pattern: "/dashboard/finance/expenses", permissions: ["finance.expenses.view"] },
  { pattern: "/dashboard/finance", permissions: ["finance.view"] },
  
  // Tasks routes
  { pattern: "/dashboard/tasks/templates/*", permissions: ["tasks.templates.view"] },
  { pattern: "/dashboard/tasks/templates", permissions: ["tasks.templates.view"] },
  { pattern: "/dashboard/tasks/*", permissions: ["tasks.view"] },
  { pattern: "/dashboard/tasks", permissions: ["tasks.view"] },
  
  // Other routes
  { pattern: "/dashboard/calendar", permissions: ["calendar.view"] },
  { pattern: "/dashboard/documents/*", permissions: ["documents.view"] },
  { pattern: "/dashboard/documents", permissions: ["documents.view"] },
  { pattern: "/dashboard/library/*", permissions: ["library.view"] },
  { pattern: "/dashboard/library", permissions: ["library.view"] },
  { pattern: "/dashboard/reports/*", permissions: ["reports.view"] },
  { pattern: "/dashboard/reports", permissions: ["reports.view"] },
  
  // Clients (standalone)
  { pattern: "/dashboard/clients/*", permissions: ["clients.view"] },
  { pattern: "/dashboard/clients", permissions: ["clients.view"] },
];

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

      // Check subscription status - ensure tenant has active subscription or valid trial
      const { data: subscription, error: subscriptionError } = await supabase
        .from("tenant_subscriptions")
        .select("id, status, is_trial, trial_end_date, current_period_end, grace_period_end")
        .eq("tenant_id", userData.tenant_id)
        .single();

      if (!subscriptionError && subscription) {
        const now = new Date();
        const isTrialExpired = subscription.is_trial && subscription.trial_end_date && new Date(subscription.trial_end_date) < now;
        const isSubscriptionExpired = subscription.current_period_end && new Date(subscription.current_period_end) < now;
        const isGracePeriodExpired = subscription.grace_period_end && new Date(subscription.grace_period_end) < now;
        
        // Check if subscription is cancelled, expired, or suspended
        const inactiveStatuses = ['cancelled', 'expired', 'suspended'];
        const isInactiveStatus = inactiveStatuses.includes(subscription.status);

        // Block access if:
        // 1. On trial and trial has expired, OR
        // 2. Subscription status is inactive AND grace period has passed
        if (subscription.is_trial && isTrialExpired) {
          console.log(
            "[MIDDLEWARE] Trial expired for tenant:",
            userData.tenant_id
          );
          await supabase.auth.signOut();
          const url = request.nextUrl.clone();
          url.pathname = "/auth/signin";
          url.searchParams.set("error", "trial_expired");
          return NextResponse.redirect(url);
        }

        if (isInactiveStatus && (isGracePeriodExpired || (!subscription.grace_period_end && isSubscriptionExpired))) {
          console.log(
            "[MIDDLEWARE] Subscription expired for tenant:",
            userData.tenant_id
          );
          await supabase.auth.signOut();
          const url = request.nextUrl.clone();
          url.pathname = "/auth/signin";
          url.searchParams.set("error", "subscription_expired");
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
        const { data: userRolesData } = await supabase
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
        const { data: userRecord } = await supabase
          .from("users")
          .select("is_super_admin")
          .eq("id", user.id)
          .single();

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

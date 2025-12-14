/**
 * Route Permission Configuration
 * Maps protected routes to their required permissions
 * Used by middleware for server-side route protection
 */

export interface RoutePermission {
  /** The route pattern (supports exact match and prefix match with *) */
  pattern: string;
  /** Required permission key(s) - user must have at least one */
  permissions: string[];
  /** If true, user must have ALL permissions; if false, ANY permission suffices */
  requireAll?: boolean;
  /** Description for documentation */
  description?: string;
}

/**
 * Protected routes configuration
 * Routes are checked in order - first match wins
 * Use more specific patterns before general ones
 */
export const routePermissions: RoutePermission[] = [
  // ============================================
  // SETTINGS ROUTES
  // ============================================
  {
    pattern: "/dashboard/settings/team/*",
    permissions: ["settings.team.view"],
    description: "Team management pages",
  },
  {
    pattern: "/dashboard/settings/team",
    permissions: ["settings.team.view"],
    description: "Team management",
  },
  {
    pattern: "/dashboard/settings/company",
    permissions: ["settings.company.view"],
    description: "Company settings",
  },
  {
    pattern: "/dashboard/settings/billing",
    permissions: ["settings.billing"],
    description: "Billing and subscription",
  },
  {
    pattern: "/dashboard/settings/roles/*",
    permissions: ["settings.roles.view"],
    description: "Roles management pages",
  },
  {
    pattern: "/dashboard/settings/roles",
    permissions: ["settings.roles.view"],
    description: "Roles management",
  },
  // Profile is accessible to everyone - no restriction needed
  // {
  //   pattern: "/dashboard/settings/profile",
  //   permissions: ["settings.profile"],
  //   description: "User profile - accessible to all authenticated users",
  // },

  // ============================================
  // SALES ROUTES
  // ============================================
  {
    pattern: "/dashboard/sales/leads/*",
    permissions: ["leads.view"],
    description: "Lead detail pages",
  },
  {
    pattern: "/dashboard/sales/leads",
    permissions: ["leads.view"],
    description: "Leads list",
  },
  {
    pattern: "/dashboard/sales/pipeline",
    permissions: ["leads.view"],
    description: "Sales pipeline",
  },
  {
    pattern: "/dashboard/sales/clients/*",
    permissions: ["clients.view"],
    description: "Client detail pages",
  },
  {
    pattern: "/dashboard/sales/clients",
    permissions: ["clients.view"],
    description: "Clients list",
  },
  {
    pattern: "/dashboard/sales",
    permissions: ["leads.view", "clients.view"],
    requireAll: false, // ANY of these permissions
    description: "Sales overview",
  },

  // ============================================
  // PROJECTS ROUTES
  // ============================================
  {
    pattern: "/dashboard/projects/*",
    permissions: ["projects.view"],
    description: "Project detail pages",
  },
  {
    pattern: "/dashboard/projects",
    permissions: ["projects.view"],
    description: "Projects list",
  },

  // ============================================
  // QUOTATIONS ROUTES
  // ============================================
  {
    pattern: "/dashboard/quotations/config",
    permissions: ["quotations.view"],
    description: "Quotation config (spaces, components, cost items)",
  },
  {
    pattern: "/dashboard/quotations/templates/*",
    permissions: ["quotations.templates.view"],
    description: "Quotation template detail",
  },
  {
    pattern: "/dashboard/quotations/templates",
    permissions: ["quotations.templates.view"],
    description: "Quotation templates list",
  },
  {
    pattern: "/dashboard/quotations/new",
    permissions: ["quotations.create"],
    description: "Create new quotation",
  },
  {
    pattern: "/dashboard/quotations/*",
    permissions: ["quotations.view"],
    description: "Quotation detail pages",
  },
  {
    pattern: "/dashboard/quotations",
    permissions: ["quotations.view"],
    description: "Quotations list",
  },

  // ============================================
  // STOCK & PROCUREMENT ROUTES
  // ============================================

  {
    pattern: "/dashboard/stock/inventory/*",
    permissions: ["materials.view"],
    description: "Material detail pages",
  },
  {
    pattern: "/dashboard/stock/inventory",
    permissions: ["materials.view"],
    description: "Materials/Inventory list",
  },
  {
    pattern: "/dashboard/stock/purchase-orders/*",
    permissions: ["po.view"],
    description: "Purchase order detail",
  },
  {
    pattern: "/dashboard/stock/purchase-orders",
    permissions: ["po.view"],
    description: "Purchase orders list",
  },
  {
    pattern: "/dashboard/stock/vendors/*",
    permissions: ["vendors.view"],
    description: "Vendor detail pages",
  },
  {
    pattern: "/dashboard/stock/vendors",
    permissions: ["vendors.view"],
    description: "Vendors list",
  },
  {
    pattern: "/dashboard/stock/brands/*",
    permissions: ["brands.view"],
    description: "Brand detail pages",
  },
  {
    pattern: "/dashboard/stock/brands",
    permissions: ["brands.view"],
    description: "Brands list",
  },
  {
    pattern: "/dashboard/stock",
    permissions: ["stock.view", "stock.overview"],
    requireAll: false,
    description: "Stock overview",
  },

  // ============================================
  // FINANCE ROUTES
  // ============================================
  {
    pattern: "/dashboard/finance/invoices/*",
    permissions: ["finance.invoices.view"],
    description: "Invoice detail pages",
  },
  {
    pattern: "/dashboard/finance/invoices",
    permissions: ["finance.invoices.view"],
    description: "Invoices list",
  },
  {
    pattern: "/dashboard/finance/payments/*",
    permissions: ["finance.payments.view"],
    description: "Payment detail pages",
  },
  {
    pattern: "/dashboard/finance/payments",
    permissions: ["finance.payments.view"],
    description: "Payments list",
  },
  {
    pattern: "/dashboard/finance/expenses/*",
    permissions: ["finance.expenses.view"],
    description: "Expense detail pages",
  },
  {
    pattern: "/dashboard/finance/expenses",
    permissions: ["finance.expenses.view"],
    description: "Expenses list",
  },
  {
    pattern: "/dashboard/finance",
    permissions: ["finance.view"],
    description: "Finance overview",
  },

  // ============================================
  // TASKS ROUTES
  // ============================================
  {
    pattern: "/dashboard/tasks/templates/*",
    permissions: ["tasks.templates.view"],
    description: "Task template detail",
  },
  {
    pattern: "/dashboard/tasks/templates",
    permissions: ["tasks.templates.view"],
    description: "Task templates list",
  },
  {
    pattern: "/dashboard/tasks/*",
    permissions: ["tasks.view"],
    description: "Task detail pages",
  },
  {
    pattern: "/dashboard/tasks",
    permissions: ["tasks.view"],
    description: "Tasks list",
  },

  // ============================================
  // OTHER ROUTES
  // ============================================
  {
    pattern: "/dashboard/calendar",
    permissions: ["calendar.view"],
    description: "Calendar",
  },
  {
    pattern: "/dashboard/documents/*",
    permissions: ["documents.view"],
    description: "Document detail pages",
  },
  {
    pattern: "/dashboard/documents",
    permissions: ["documents.view"],
    description: "Documents",
  },
  {
    pattern: "/dashboard/library/*",
    permissions: ["library.view"],
    description: "Library item detail",
  },
  {
    pattern: "/dashboard/library",
    permissions: ["library.view"],
    description: "Library",
  },
  {
    pattern: "/dashboard/reports/*",
    permissions: ["reports.view"],
    description: "Report detail pages",
  },
  {
    pattern: "/dashboard/reports",
    permissions: ["reports.view"],
    description: "Reports",
  },

  // ============================================
  // CLIENTS (standalone route)
  // ============================================
  {
    pattern: "/dashboard/clients/*",
    permissions: ["clients.view"],
    description: "Client detail pages",
  },
  {
    pattern: "/dashboard/clients",
    permissions: ["clients.view"],
    description: "Clients list",
  },
];

/**
 * Check if a route matches a pattern
 * Supports:
 * - Exact match: "/dashboard/settings/team"
 * - Prefix match with wildcard: "/dashboard/settings/team/*"
 */
export function matchRoute(pathname: string, pattern: string): boolean {
  // Handle wildcard patterns
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2); // Remove /*
    return pathname === prefix || pathname.startsWith(prefix + "/");
  }
  
  // Exact match
  return pathname === pattern;
}

/**
 * Get the permission requirement for a given route
 * Returns null if route is not protected (publicly accessible to authenticated users)
 */
export function getRoutePermission(pathname: string): RoutePermission | null {
  for (const route of routePermissions) {
    if (matchRoute(pathname, route.pattern)) {
      return route;
    }
  }
  return null;
}

/**
 * Check if user has required permissions for a route
 */
export function hasRouteAccess(
  pathname: string,
  userPermissions: string[],
  isSuperAdmin: boolean = false
): { allowed: boolean; requiredPermissions?: string[] } {
  // Super admins have access to everything
  if (isSuperAdmin) {
    return { allowed: true };
  }

  const routeConfig = getRoutePermission(pathname);
  
  // If route is not in our protected list, allow access
  if (!routeConfig) {
    return { allowed: true };
  }

  const { permissions, requireAll = false } = routeConfig;
  
  // Check if user has required permissions
  const hasAccess = requireAll
    ? permissions.every((p) => userPermissions.includes(p))
    : permissions.some((p) => userPermissions.includes(p));

  return {
    allowed: hasAccess,
    requiredPermissions: permissions,
  };
}

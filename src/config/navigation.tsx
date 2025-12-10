import { ReactNode } from "react";

// Icons as components for cleaner code
export const Icons = {
  dashboard: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
      />
    </svg>
  ),
  sales: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  ),
  projects: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  ),
  quotations: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  ),
  stock: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  ),
  finance: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  tasks: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </svg>
  ),
  calendar: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  ),
  documents: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  ),
  library: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
      />
    </svg>
  ),
  reports: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  ),
  settings: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
  chevronDown: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  ),
  chevronRight: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  ),
};

export interface NavigationSubItem {
  name: string;
  href: string;
  permission?: string; // Optional - if not specified, uses parent permission
}

export interface NavigationItem {
  name: string;
  href: string;
  icon: ReactNode;
  permission: string; // Required permission to view this menu
  badge?: string;
  subItems?: NavigationSubItem[];
}

// Main navigation configuration
// Permission format: module.view (minimum permission to see the menu)
export const navigationConfig: NavigationItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Icons.dashboard,
    permission: "dashboard.view",
  },
  {
    name: "Sales",
    href: "/dashboard/sales",
    icon: Icons.sales,
    permission: "sales.view",
    subItems: [
      {
        name: "Leads",
        href: "/dashboard/sales/leads",
        permission: "sales.leads.view",
      },
      {
        name: "Reports",
        href: "/dashboard/sales/reports",
        permission: "sales.reports.view",
      },
    ],
  },
  {
    name: "Projects",
    href: "/dashboard/projects",
    icon: Icons.projects,
    permission: "projects.view",
    subItems: [
      {
        name: "All Projects",
        href: "/dashboard/projects",
        permission: "projects.view",
      },
      {
        name: "Reports",
        href: "/dashboard/projects/reports",
        permission: "projects.reports.view",
      },
    ],
  },
  {
    name: "Quotations",
    href: "/dashboard/quotations",
    icon: Icons.quotations,
    permission: "quotations.view",
    subItems: [
      {
        name: "Quotation List",
        href: "/dashboard/quotations",
        permission: "quotations.view",
      },
      {
        name: "Templates",
        href: "/dashboard/quotations/templates",
        // Uses quotations.view for now; can change to quotations.templates.view after running migration 010
        permission: "quotations.view",
      },
    ],
  },
  {
    name: "Stock & Procurement",
    href: "/dashboard/stock",
    icon: Icons.stock,
    permission: "stock.view",
    subItems: [
      {
        name: "Overview",
        href: "/dashboard/stock",
        permission: "stock.overview",
      },
      {
        name: "Materials",
        href: "/dashboard/stock/inventory",
        permission: "materials.view",
      },
      {
        name: "Purchase Orders",
        href: "/dashboard/stock/purchase-orders",
        permission: "po.view",
      },
      {
        name: "Vendors",
        href: "/dashboard/stock/vendors",
        permission: "vendors.view",
      },
      {
        name: "Brands",
        href: "/dashboard/stock/brands",
        permission: "brands.view",
      },
    ],
  },
  {
    name: "Finance",
    href: "/dashboard/finance",
    icon: Icons.finance,
    permission: "finance.view",
    subItems: [
      { name: "Invoices", href: "/dashboard/finance/invoices" },
      { name: "Payments", href: "/dashboard/finance/payments" },
      { name: "Expenses", href: "/dashboard/finance/expenses" },
    ],
  },
  {
    name: "Tasks",
    href: "/dashboard/tasks",
    icon: Icons.tasks,
    permission: "tasks.view",
    subItems: [
      {
        name: "Task List",
        href: "/dashboard/tasks",
        permission: "tasks.view",
      },
      {
        name: "Task Templates",
        href: "/dashboard/tasks/templates",
        permission: "tasks.templates.view",
      },
    ],
  },
  {
    name: "Calendar",
    href: "/dashboard/calendar",
    icon: Icons.calendar,
    permission: "calendar.view",
  },
  {
    name: "Documents",
    href: "/dashboard/documents",
    icon: Icons.documents,
    permission: "documents.view",
  },
  {
    name: "Library",
    href: "/dashboard/library",
    icon: Icons.library,
    permission: "library.view",
  },
  {
    name: "Reports",
    href: "/dashboard/reports",
    icon: Icons.reports,
    permission: "reports.view",
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Icons.settings,
    permission: "settings.profile", // Everyone can access their profile
    subItems: [
      {
        name: "My Profile",
        href: "/dashboard/settings/profile",
        permission: "settings.profile",
      },
      {
        name: "Company",
        href: "/dashboard/settings/company",
        permission: "settings.company.view",
      },
      {
        name: "Team",
        href: "/dashboard/settings/team",
        permission: "settings.team.view",
      },
      {
        name: "Quotations Config",
        href: "/dashboard/settings/quotations-config",
        permission: "quotations.view",
      },
      {
        name: "Subscription",
        href: "/dashboard/settings/billing",
        permission: "settings.billing",
      },
    ],
  },
];

// Helper to filter navigation based on permissions
export function filterNavigationByPermissions(
  items: NavigationItem[],
  hasPermission: (permission: string) => boolean,
  showDisabled: boolean = true // If true, show greyed out; if false, hide completely
): (NavigationItem & {
  disabled: boolean;
  subItems?: (NavigationSubItem & { disabled: boolean })[];
})[] {
  return items
    .map((item) => {
      const hasAccess = hasPermission(item.permission);

      // Filter sub-items if they exist
      let filteredSubItems:
        | (NavigationSubItem & { disabled: boolean })[]
        | undefined;
      if (item.subItems) {
        filteredSubItems = item.subItems
          .map((subItem) => ({
            ...subItem,
            disabled: !hasPermission(subItem.permission || item.permission),
          }))
          .filter((subItem) => showDisabled || !subItem.disabled);
      }

      return {
        ...item,
        disabled: !hasAccess,
        subItems: filteredSubItems,
      };
    })
    .filter((item) => showDisabled || !item.disabled);
}

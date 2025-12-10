# SoftInterio - Complete Architecture Flow from Root URL

## Overview

This document traces the complete request path from typing `https://localhost:3000/` through authentication, authorization, and finally to the dashboard rendering.

---

## 1. REQUEST ENTRY POINT: `https://localhost:3000/`

```
User types URL in browser
         ↓
Browser initiates HTTP GET request
         ↓
Next.js Server receives request
         ↓
MIDDLEWARE INTERCEPTS (src/middleware.ts)
```

---

## 2. MIDDLEWARE LAYER: `src/middleware.ts`

### What Happens:

```typescript
// middleware.ts
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}
```

**Middleware runs on EVERY request** (except static files, images, etc.)

### Key Configuration:

```typescript
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

Matches all routes EXCEPT:

- `/_next/static` (JS/CSS bundles)
- `/_next/image` (image optimization)
- `/favicon.ico`
- Image files (png, jpg, gif, webp)

---

## 3. SESSION UPDATE IN MIDDLEWARE: `src/lib/supabase/middleware.ts`

### Flow:

```
middleware.ts calls updateSession(request)
         ↓
Creates server-side Supabase client
         ↓
Calls supabase.auth.getUser()
         ↓
Checks if user is authenticated
         ↓
```

### Decision Tree:

```
┌─────────────────────────────────────────────────────────────────┐
│  Is user authenticated (session exists)?                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
            YES (user exists)       NO (no session)
                │                       │
                ▼                       ▼
        ┌──────────────┐        ┌──────────────────────┐
        │ Check status │        │ Is path protected?   │
        └──────────────┘        └──────────────────────┘
                │                       │
                ▼                       ▼
        Is user DISABLED?   ┌───────────┴──────────────┐
         or DELETED?        ▼                          ▼
                │        YES (protected)          NO (public)
        ┌───────┴────┐  │                          │
        ▼             ▼  ▼                          ▼
       YES            Redirect to              ALLOW
     (Sign out)      /auth/signin          (Continue)
     Redirect to   (with error param)
     /auth/signin
```

### For Root URL (`/`):

**Check in middleware:**

```typescript
if (
  !user &&
  !request.nextUrl.pathname.startsWith("/auth") &&
  request.nextUrl.pathname !== "/"
) {
  // Redirect unauthenticated users to /auth/signin
  // BUT root "/" is allowed for unauthenticated users
}

if (user && request.nextUrl.pathname === "/") {
  // Redirect authenticated users to /dashboard
  const url = request.nextUrl.clone();
  url.pathname = "/dashboard";
  return NextResponse.redirect(url);
}
```

**Result:**

- **Unauthenticated user on `/`:** ✅ ALLOWED (continues to home page)
- **Authenticated user on `/`:** 🔄 REDIRECTED to `/dashboard`

---

## 4. RENDERING ROOT PAGE: `src/app/page.tsx`

### What Gets Rendered (if unauthenticated):

```tsx
export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with navigation */}
      <header>
        <nav>
          <Logo />
          <div>
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main>
        <h1>Interior Design ERP System</h1>
        <p>Streamline your interior design business...</p>

        {/* CTA Buttons */}
        <Link href="/auth/signin">
          <Button>Access Dashboard</Button>
        </Link>
        <Link href="/auth/signup">
          <Button>Start Free Trial</Button>
        </Link>
      </main>
    </div>
  );
}
```

### Layout Wrapper: `src/app/layout.tsx`

```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children} {/* HomePage component rendered here */}
      </body>
    </html>
  );
}
```

---

## 5. USER CLICKS "Access Dashboard" BUTTON

```
User clicks <Link href="/auth/signin">
         ↓
Browser navigates to /auth/signin
         ↓
MIDDLEWARE INTERCEPTS (again)
         ↓
Check: Is user authenticated?
       NO → /auth/signin is allowed ✅
       YES → Redirect to /dashboard 🔄
         ↓
/auth/signin page loads
```

---

## 6. SIGNIN PAGE FLOW: `src/app/auth/signin/page.tsx`

### Layout: `src/app/auth/layout.tsx`

```tsx
import { AuthLayout } from "@/modules/auth/components/AuthLayout";

export default function AuthPageLayout({ children }) {
  return <AuthLayout>{children}</AuthLayout>;
}
```

### SignIn Page Component:

```tsx
"use client";

import { SignInForm } from "@/modules/auth/components/SignInForm";

export default function SignInPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SignInForm />
    </Suspense>
  );
}
```

---

## 7. SIGNIN FORM LOGIC: `src/modules/auth/components/SignInForm.tsx`

### User Interaction:

```
User enters email & password
         ↓
Clicks "Sign In" button
         ↓
handleSubmit() called
         ↓
POST request to /api/auth/signin
```

### Form Component:

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  const response = await fetch("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (data.success) {
    router.push("/dashboard");
    router.refresh(); // Refresh to update auth state
  } else {
    setError(data.error);
  }
};
```

---

## 8. SIGNIN API ROUTE: `src/app/api/auth/signin/route.ts`

### Endpoint: `POST /api/auth/signin`

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Validate input
    if (!body.email || !body.password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // 2. Call authentication service
    const { user, session } = await signInWithEmail(body.email, body.password);

    // 3. Return response
    if (user && session) {
      return NextResponse.json(
        {
          success: true,
          message: "Signed in successfully",
          data: { user: { id: user.id, email: user.email } },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Invalid email or password" },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to sign in" },
      { status: 500 }
    );
  }
}
```

---

## 9. AUTH SERVICE LOGIC: `src/lib/auth/service.ts`

### `signInWithEmail()` Function:

```typescript
export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient(); // Client-side Supabase

  // Call Supabase Auth API
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  // Verify user record exists and is active
  const { data: userData } = await supabase
    .from("users")
    .select("id, status, tenant_id")
    .eq("id", data.user.id)
    .single();

  if (!userData || userData.status !== "active") {
    throw new Error("Account not found or deactivated");
  }

  return {
    user: data.user,
    session: data.session,
  };
}
```

### What Happens Behind the Scenes:

```
API Route calls signInWithEmail()
         ↓
Supabase.auth.signInWithPassword()
         ↓
Sends credentials to Supabase Auth API
         ↓
Supabase validates credentials against auth.users table
         ↓
If valid:
  ├── Creates JWT session token
  ├── Returns user ID & session
  └── Browser cookie stores session
         ↓
If invalid:
  └── Throws error "Invalid email or password"
         ↓
Verify user record in "users" table
         ↓
Check status = "active"
```

---

## 10. SESSION ESTABLISHED & REDIRECT

```
API returns { success: true }
         ↓
Browser stores auth session in cookies
         ↓
SignInForm executes:
  router.push("/dashboard")
  router.refresh()
         ↓
Browser navigates to /dashboard
```

---

## 11. MIDDLEWARE RE-RUNS ON /DASHBOARD

```
Request to /dashboard
         ↓
MIDDLEWARE INTERCEPTS
         ↓
supabase.auth.getUser()
         ↓
✅ User IS authenticated (session exists in cookies)
         ↓
Check: Is path /dashboard?
       YES → Verify user account status
         ↓
Check user record in "users" table:
  ├── Is status = "disabled" or "deleted"? NO ✅
  └── Is tenant_users.is_active = true? YES ✅
         ↓
ALLOW ACCESS ✅
```

---

## 12. DASHBOARD LAYOUT LOADS: `src/app/dashboard/layout.tsx`

```tsx
import { DashboardLayout } from "@/modules/dashboard/components/DashboardLayout";

export default function DashboardPageLayout({ children }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
```

---

## 13. DASHBOARD COMPONENT: `src/modules/dashboard/components/DashboardLayout.tsx`

### Component Structure:

```tsx
"use client";

export function DashboardLayout({ children }) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Fixed Header */}
      <Header />

      {/* Sidebar + Main Content */}
      <div className="flex">
        <Sidebar
          isExpanded={isSidebarExpanded}
          setIsExpanded={setIsSidebarExpanded}
        />

        <main className="flex-1 min-h-screen pt-20 ...">
          <div className="p-3">{children}</div>
        </main>
      </div>
    </div>
  );
}
```

---

## 14. HEADER COMPONENT: `src/components/layout/Header.tsx`

### Features:

```tsx
export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-white/98 backdrop-blur-lg border-b border-slate-200">
        {/* Gradient accent */}
        <div className="h-1 bg-linear-to-r from-blue-500 via-indigo-500 to-blue-600"></div>

        <div className="flex items-center justify-between px-6 py-4">
          {/* Left: Logo */}
          <Logo />

          {/* Center: Navigation (if needed) */}

          {/* Right: Subscription Warning + Notifications + User Menu */}
          <div className="flex items-center gap-4">
            <SubscriptionWarningInline />
            <NotificationDropdown />
            <UserProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  );
}
```

### Subscription Status Hook:

```typescript
const { warnings, isTrial, trialDaysRemaining, subscriptionDaysRemaining } =
  useSubscriptionStatus();

// Returns:
// {
//   warnings: { showTrialWarning, showSubscriptionWarning, showPayButton },
//   isTrial: boolean,
//   trialDaysRemaining: number | null,
//   subscriptionDaysRemaining: number | null
// }
```

---

## 15. SIDEBAR COMPONENT: `src/components/layout/SidebarNew.tsx`

### Navigation Configuration: `src/config/navigation.tsx`

```typescript
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
  },
  // ... more menu items
];
```

### Permission Checking in Sidebar:

```tsx
"use client";

export function Sidebar({ isExpanded, setIsExpanded }) {
  const { hasPermission, isLoading } = useUserPermissions();

  return (
    <aside className="fixed left-0 top-20 h-[calc(100vh-5rem)] ...">
      <nav className="space-y-2 p-4">
        {navigationConfig.map((item) => {
          // Only show if user has permission
          if (!hasPermission(item.permission)) {
            return null;
          }

          return (
            <Link href={item.href} key={item.name}>
              {item.icon}
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

---

## 16. PERMISSIONS LOADING: `src/hooks/useUserPermissions.ts`

### Hook Logic:

```typescript
export function useUserPermissions() {
  const [state, setState] = useState({
    permissions: [],
    roles: [],
    isLoading: true,
    error: null,
  });

  const supabase = createClient();

  useEffect(() => {
    const fetchPermissions = async () => {
      // 1. Get authenticated user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 2. Query user_roles with joined roles
      const { data: userRolesData } = await supabase
        .from("user_roles")
        .select("role_id, roles(id, slug, name, hierarchy_level)")
        .eq("user_id", user.id);

      // 3. Extract role slugs (e.g., "staff", "admin")
      const roles = userRolesData?.map((ur) => ur.roles.slug) || [];

      // 4. Query role_permissions with joined permissions
      const { data: permissionsData } = await supabase
        .from("role_permissions")
        .select("permissions(key)")
        .in("role_id", roleIds)
        .eq("granted", true);

      // 5. Extract permission keys (e.g., "dashboard.view", "sales.view")
      const permissions =
        permissionsData?.map((rp) => rp.permissions.key) || [];

      setState({ permissions, roles, isLoading: false, error: null });
    };

    fetchPermissions();
  }, [supabase]);

  return {
    ...state,
    hasPermission: (permission: string) =>
      state.permissions.includes(permission),
    isOwner: state.roles.includes("owner"),
    isAdmin: state.roles.includes("admin"),
  };
}
```

### Database Queries Made:

```sql
-- Query 1: Get user's roles
SELECT user_id, role_id, roles.id, roles.slug, roles.name, roles.hierarchy_level
FROM user_roles
JOIN roles ON roles.id = user_roles.role_id
WHERE user_roles.user_id = $1;

-- Query 2: Get role permissions
SELECT role_id, permissions.key
FROM role_permissions
JOIN permissions ON permissions.id = role_permissions.permission_id
WHERE role_id IN ($1, $2, $3) AND granted = true;
```

---

## 17. DASHBOARD PAGE RENDERS: `src/app/dashboard/page.tsx`

```tsx
import { DashboardOverview } from "@/modules/dashboard/components/DashboardOverview";

export default function DashboardPage() {
  return <DashboardOverview />;
}
```

### DashboardOverview Component:

```tsx
"use client";

export function DashboardOverview() {
  const stats = [
    { title: "Total Projects", value: "24", change: "+12%" },
    { title: "Active Clients", value: "18", change: "+5%" },
    // ...
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Dashboard</h1>
        <p className="text-slate-600">
          Welcome back! Here's what's happening...
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.title} className="bg-white rounded-lg border ...">
            {/* Stat Card */}
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-xl border border-slate-200">
        <h2 className="text-lg font-semibold">Recent Projects</h2>
        {/* Project List */}
      </div>
    </div>
  );
}
```

---

## Complete Request Timeline

```
1ms:    User types https://localhost:3000/
10ms:   Browser sends GET request to server
15ms:   Next.js receives request
20ms:   Middleware runs (updateSession)
30ms:   supabase.auth.getUser() called
150ms:  Auth check complete → User not authenticated
160ms:  Middleware allows access to / (public route)
170ms:  Root layout.tsx loads
180ms:  HomePage component renders
200ms:  Hero section displays with "Access Dashboard" button
250ms:  Page fully rendered and interactive

--- User clicks "Access Dashboard" ---

251ms:  Browser navigates to /auth/signin
255ms:  Middleware runs again
260ms:  Auth check → No session found
270ms:  SignInPage loads
300ms:  SignInForm renders with email/password inputs
350ms:  Page ready for user input

--- User enters credentials and clicks Sign In ---

351ms:  Form submits POST /api/auth/signin
355ms:  API route receives request
360ms:  signInWithEmail() called
365ms:  Supabase Auth API called
450ms:  Auth API returns JWT session token
460ms:  User record verified in database
470ms:  API returns { success: true }
475ms:  Browser stores JWT in cookies
480ms:  router.push("/dashboard") triggered
485ms:  Browser navigates to /dashboard
490ms:  Middleware runs (with authenticated session)
495ms:  supabase.auth.getUser() returns user
500ms:  Check user status → "active" ✅
510ms:  Check tenant membership → is_active = true ✅
520ms:  Allow access to /dashboard
530ms:  DashboardLayout loads
535ms:  Header renders with user menu
540ms:  Sidebar loads and queries permissions
550ms:  useUserPermissions hook fetches:
         - user_roles table
         - role_permissions table
600ms:  Permissions loaded → filter navigation menu
620ms:  Sidebar renders with filtered menu items
630ms:  DashboardOverview loads
650ms:  Stats and recent projects display
700ms:  Dashboard fully rendered and interactive
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                              │
│                                                                     │
│  https://localhost:3000/                                           │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────┐                                           │
│  │  Home Page          │                                           │
│  │  - Hero Section     │                                           │
│  │  - CTA Buttons      │                                           │
│  │  - Sign In / Sign Up│                                           │
│  └──────────┬──────────┘                                           │
│             │                                                      │
│             └─── Click "Access Dashboard"                          │
│                                 │                                  │
│                                 ▼                                  │
│                        ┌─────────────────────┐                     │
│                        │  Sign In Page       │                     │
│                        │  - Email input      │                     │
│                        │  - Password input   │                     │
│                        │  - Sign In button   │                     │
│                        └──────────┬──────────┘                     │
│                                   │                                │
│                                   └─── POST /api/auth/signin        │
└───────────────────────────────────┼────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌──────────────────────┐      ┌─────────────────────────┐
        │  Next.js Server      │      │   Supabase Backend      │
        │                      │      │                         │
        │  Middleware:         │      │  - Auth Service         │
        │  - Check session     │◄────►│  - JWT validation       │
        │  - Verify user       │      │  - user records         │
        │  - Check permissions │      │  - role permissions     │
        │                      │      │                         │
        │  API Routes:         │      │  PostgreSQL:            │
        │  - /auth/signin      │      │  - users table          │
        │  - /auth/signup      │      │  - user_roles table     │
        │  - /auth/logout      │      │  - roles table          │
        │  - /auth/*           │      │  - role_permissions     │
        │                      │      │  - tenant_users         │
        │  Server Components:  │      │                         │
        │  - Dashboard layout  │      │                         │
        │  - Pages structure   │      │                         │
        └──────────┬───────────┘      └─────────────────────────┘
                   │
                   │ Session established
                   │
                   ▼
        ┌──────────────────────────────────────────┐
        │  Dashboard Route /dashboard              │
        │                                          │
        │  ┌────────────────────────────────────┐  │
        │  │  Header Component                  │  │
        │  │  - Logo                            │  │
        │  │  - Subscription Status             │  │
        │  │  - Notifications                   │  │
        │  │  - User Profile Dropdown           │  │
        │  └────────────────────────────────────┘  │
        │                                          │
        │  ┌──────────────┬──────────────────────┐ │
        │  │   Sidebar    │  Main Content        │ │
        │  │              │                      │ │
        │  │ Navigation   │  Dashboard Overview  │ │
        │  │ (filtered    │  - Stats Grid        │ │
        │  │  by perms)   │  - Recent Projects   │ │
        │  │              │  - Activities        │ │
        │  └──────────────┴──────────────────────┘ │
        │                                          │
        └──────────────────────────────────────────┘
```

---

## Key Files Reference

| File                                                     | Purpose                            |
| -------------------------------------------------------- | ---------------------------------- |
| `src/middleware.ts`                                      | Entry point for all requests       |
| `src/lib/supabase/middleware.ts`                         | Session management & routing logic |
| `src/app/page.tsx`                                       | Root home page (public)            |
| `src/app/auth/signin/page.tsx`                           | Sign in page                       |
| `src/modules/auth/components/SignInForm.tsx`             | Sign in form component             |
| `src/app/api/auth/signin/route.ts`                       | Sign in API endpoint               |
| `src/lib/auth/service.ts`                                | Authentication business logic      |
| `src/app/dashboard/layout.tsx`                           | Dashboard layout wrapper           |
| `src/modules/dashboard/components/DashboardLayout.tsx`   | Dashboard main layout              |
| `src/components/layout/Header.tsx`                       | Top navigation bar                 |
| `src/components/layout/SidebarNew.tsx`                   | Left sidebar navigation            |
| `src/config/navigation.tsx`                              | Navigation menu configuration      |
| `src/hooks/useUserPermissions.ts`                        | Permission checking logic          |
| `src/app/dashboard/page.tsx`                             | Dashboard home page                |
| `src/modules/dashboard/components/DashboardOverview.tsx` | Dashboard content                  |

---

## Data Flow Summary

```
Authentication Flow:
  Credentials → SignIn API → Supabase Auth → JWT Session → Cookies

Authorization Flow:
  User ID → user_roles query → roles query → role_permissions query → Permissions list

Navigation Flow:
  User permissions → Filter navigationConfig → Render menu items → User can click

Session Check Flow:
  On every request → Middleware → supabase.auth.getUser() → Verify status → Allow/Deny
```

This is the complete architecture from the root URL through to the fully rendered dashboard!

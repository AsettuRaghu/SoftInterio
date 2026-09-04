"use client";

import { Suspense, useEffect, useState } from "react";
import { FollowUpsWidget } from "@/components/dashboard/FollowUpsWidget";
import { useSearchParams, useRouter } from "next/navigation";
import {
  XMarkIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

/**
 * Reads the ?error=access_denied flag set by the middleware redirect.
 * useSearchParams() opts a component out of static prerendering, so it lives
 * in its own component behind Suspense - otherwise the whole page fails to
 * prerender at build time.
 */
function AccessDeniedBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "access_denied") {
      setShowAccessDenied(true);
      // Clear the error from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      router.replace(url.pathname, { scroll: false });
    }
  }, [searchParams, router]);

  if (!showAccessDenied) return null;

  return (
    <>
      {(
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4 max-w-md flex items-start gap-3">
            <div className="shrink-0">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-800">
                Access Denied
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                You don&apos;t have permission to access that page. Please
                contact your administrator if you believe this is an error.
              </p>
            </div>
            <button
              onClick={() => setShowAccessDenied(false)}
              className="shrink-0 p-1 rounded-lg hover:bg-amber-100 text-amber-600 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="p-4 space-y-4">
      <Suspense fallback={null}>
        <AccessDeniedBanner />
      </Suspense>

      <div>
        <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">
          What needs your attention today
        </p>
      </div>

      {/* The first thing a salesperson should see each morning. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <FollowUpsWidget />
      </div>
    </div>
  );
}

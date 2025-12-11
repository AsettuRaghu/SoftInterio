"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Global 404 handler - redirects all unmatched routes to dashboard
 * This ensures users never see a 404 page and are gracefully redirected
 */
export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard for any unmatched route
    router.replace("/dashboard");
  }, [router]);

  // Show a brief loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600 text-sm">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}

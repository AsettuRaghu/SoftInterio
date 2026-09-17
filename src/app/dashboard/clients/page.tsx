"use client";

/**
 * Clients moved under Partners on 2026-09-17 - a customer is a partner
 * wearing the "customer" hat, and one home per record is the point of the
 * module. This route only forwards, so an old link still lands somewhere.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClientsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/partners/t/customer");
  }, [router]);
  return null;
}

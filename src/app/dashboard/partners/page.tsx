"use client";

/**
 * /dashboard/partners forwards to the one type offered today. When more
 * types are enabled this becomes the "all partners" list again
 * (PartnersList with no type).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PartnersPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/partners/t/customer");
  }, [router]);
  return null;
}

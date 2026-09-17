"use client";

/**
 * "Quotation Config" became Settings → Catalogue on 2026-09-18: space types,
 * component types, categories and cost items are the business's vocabulary
 * for what it builds and sells - the quotation reads them, the Spaces tab
 * reads them, the Design Library reads them. This route only forwards.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function QuotationConfigRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/settings/catalogue");
  }, [router]);
  return null;
}

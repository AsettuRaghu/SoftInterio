"use client";

/**
 * Revise a quotation, from wherever it is shown.
 *
 * A revision is an act on a quotation and nothing else: the route reads the
 * quotation, copies it forward and returns the new one. It has no opinion about
 * whether a lead or a project is on screen - the only lead-specific thing it
 * does is write a timeline entry when `lead_id` happens to be set.
 *
 * This lived inside `useLeadDetail`, which is why the project's Quotations tab
 * had no Revise button: the table has accepted `onReviseQuotation` all along
 * and the project page simply had nothing to pass it. Leads and projects render
 * the same `QuotationTableReusable`; they now drive it with the same handler.
 *
 * Navigates to the new revision in edit mode, because a revision exists to be
 * changed - landing on a read-only copy of the old price is never the point.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { uiLogger } from "@/lib/logger";

export function useReviseQuotation() {
  const router = useRouter();
  const [revisingId, setRevisingId] = useState<string | null>(null);

  const revise = useCallback(
    async (quotationId: string) => {
      if (revisingId) return;

      try {
        setRevisingId(quotationId);
        const response = await fetch(
          `/api/quotations/${quotationId}/revision`,
          { method: "POST" }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create revision");
        }

        const data = await response.json();
        /*
         * The route replies { quotation }, not the quotation itself. Reading
         * data.id gave undefined, so this navigated to
         * /dashboard/quotations/undefined and the page reported "Failed to
         * fetch quotation" - while the revision had in fact been created.
         */
        const newId = data.quotation?.id;
        if (!newId) {
          throw new Error("The revision was created but could not be opened.");
        }
        router.push(`/dashboard/quotations/${newId}?edit=1`);
      } catch (err) {
        uiLogger.error("Error creating revision", err);
        throw err;
      } finally {
        setRevisingId(null);
      }
    },
    [revisingId, router]
  );

  return { revise, revisingId };
}

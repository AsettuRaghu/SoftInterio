import { createClient } from "@/lib/supabase/server";

type QuotationEvent =
  | "quotation_created"
  | "quotation_revised"
  | "quotation_status_changed";

interface LogArgs {
  quotation: {
    id: string;
    tenant_id: string;
    lead_id?: string | null;
    project_id?: string | null;
    quotation_number?: string | null;
    version?: number | null;
  };
  type: QuotationEvent;
  title: string;
  description?: string;
  userId: string;
}

/**
 * Records a quotation event on whichever timeline the quotation belongs to.
 *
 * A quotation hangs off a lead before it is won and a project afterwards, and
 * the two have separate activity tables. Callers should not have to know which
 * - they know what happened, not where it should appear.
 *
 * Logging never fails the action it describes. A quotation that saved but did
 * not get a timeline entry is a small loss; a save rejected because the
 * timeline write failed is a large one.
 */
export async function logQuotationActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { quotation, type, title, description, userId }: LogArgs
): Promise<void> {
  try {
    if (quotation.project_id) {
      // No tenant_id here, unlike lead_activities - project_activities scopes
      // through its project. Passing one makes the insert fail.
      await supabase.from("project_activities").insert({
        project_id: quotation.project_id,
        activity_type: type,
        title,
        description: description || null,
        created_by: userId,
      });
      return;
    }

    if (quotation.lead_id) {
      await supabase.from("lead_activities").insert({
        lead_id: quotation.lead_id,
        tenant_id: quotation.tenant_id,
        activity_type: type,
        title,
        description: description || null,
        created_by: userId,
      });
      return;
    }

    // A standalone quotation belongs to no timeline; there is nowhere to put
    // this, and that is not an error.
  } catch (error) {
    console.error("Failed to log quotation activity:", error);
  }
}

/** "QT-20251216-001 v2", the way people refer to a quotation out loud. */
export function quotationLabel(q: {
  quotation_number?: string | null;
  version?: number | null;
}): string {
  return `${q.quotation_number || "Quotation"}${q.version ? ` v${q.version}` : ""}`;
}

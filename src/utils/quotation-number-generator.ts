import { createClient } from "@/lib/supabase/server";

/**
 * A new quotation gets a new number. Always.
 *
 * Until 2026-09-17 this reused the lead's or project's existing number and
 * bumped the version, so "a new quotation for the false ceiling" on a project
 * that already had a kitchen quotation came out as v3 of the kitchen - and
 * approving it superseded the kitchen. A new VERSION comes only from Revise
 * (create_quotation_revision), which keeps the number and increments the
 * version. Same split as playbooks: save is a save, revise is a version.
 *
 * Format: QT-YYYYMMDD-XXX, XXX sequential for the day within the tenant.
 * The lead/project parameters are kept so the callers read as before; they
 * no longer change the answer.
 */
export async function getQuotationNumberAndVersion(
  tenantId: string,
  _leadId?: string | null,
  _projectId?: string | null
): Promise<{ quotationNumber: string; nextVersion: number }> {
  const supabase = await createClient();

  const today = new Date();
  const datePrefix = `QT-${today.getFullYear()}${String(
    today.getMonth() + 1
  ).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-`;

  // The highest suffix issued today, not a count of rows: a count breaks the
  // moment a number is deleted or a version is cancelled.
  const { data: last } = await supabase
    .from("quotations")
    .select("quotation_number")
    .eq("tenant_id", tenantId)
    .like("quotation_number", `${datePrefix}%`)
    .order("quotation_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastSeq = last?.quotation_number
    ? parseInt(last.quotation_number.slice(datePrefix.length), 10) || 0
    : 0;
  const quotationNumber = `${datePrefix}${String(lastSeq + 1).padStart(3, "0")}`;

  return { quotationNumber, nextVersion: 1 };
}

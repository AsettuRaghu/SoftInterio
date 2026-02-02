import { createClient } from "@/lib/supabase/server";

/**
 * Generate or retrieve quotation number for a lead/project
 * 
 * Rules:
 * - For a given lead_id: All quotations share the same number, only version increments
 * - For a given project_id (without lead): All quotations share the same number, only version increments
 * - For standalone quotations (no lead/project): Generate new number each time
 * 
 * @param tenantId - Tenant ID
 * @param leadId - Lead ID (optional)
 * @param projectId - Project ID (optional)
 * @returns { quotationNumber, nextVersion }
 */
export async function getQuotationNumberAndVersion(
  tenantId: string,
  leadId?: string | null,
  projectId?: string | null
): Promise<{ quotationNumber: string; nextVersion: number }> {
  const supabase = await createClient();

  // If this is for a lead, check if quotation already exists for this lead
  if (leadId) {
    const { data: existingQuotation } = await supabase
      .from("quotations")
      .select("quotation_number, version")
      .eq("lead_id", leadId)
      .eq("tenant_id", tenantId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (existingQuotation) {
      // Quotation exists for this lead - reuse number, increment version
      console.log(`[QUOTATION NUMBER GEN] Found existing quotation for lead ${leadId}: ${existingQuotation.quotation_number} v${existingQuotation.version}`);
      return {
        quotationNumber: existingQuotation.quotation_number,
        nextVersion: existingQuotation.version + 1,
      };
    }
    console.log(`[QUOTATION NUMBER GEN] No existing quotation for lead ${leadId}, generating new number`);
  }

  // If this is for a project (without lead), check if quotation exists for this project
  if (projectId && !leadId) {
    const { data: existingQuotation } = await supabase
      .from("quotations")
      .select("quotation_number, version")
      .eq("project_id", projectId)
      .eq("tenant_id", tenantId)
      .is("lead_id", null) // Only match project-only quotations
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (existingQuotation) {
      // Quotation exists for this project - reuse number, increment version
      return {
        quotationNumber: existingQuotation.quotation_number,
        nextVersion: existingQuotation.version + 1,
      };
    }
  }

  // No existing quotation - generate new quotation number
  // Format: QT-YYYYMMDD-XXX where XXX is sequential for the day
  const today = new Date();
  const datePrefix = `QT-${today.getFullYear()}${String(
    today.getMonth() + 1
  ).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-`;

  const { count } = await supabase
    .from("quotations")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("version", 1) // Only count first versions
    .like("quotation_number", `${datePrefix}%`);

  const sequentialNumber = String((count || 0) + 1).padStart(3, "0");
  const quotationNumber = `${datePrefix}${sequentialNumber}`;

  console.log(`[QUOTATION NUMBER GEN] Generated new quotation number: ${quotationNumber} (count was ${count}, new number is ${sequentialNumber})`);

  return {
    quotationNumber,
    nextVersion: 1,
  };
}

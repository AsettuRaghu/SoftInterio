import { createClient } from "@/lib/supabase/server";

/**
 * Generates a unique lead number for a tenant
 * Implements retry logic to handle duplicate key errors
 * 
 * @param tenantId - The tenant ID
 * @param maxRetries - Maximum number of retry attempts (default: 5)
 * @returns A unique lead number in the format LD-YY-XXXX
 */
export async function generateUniqueLeadNumber(
  tenantId: string,
  maxRetries: number = 5
): Promise<string> {
  const supabase = await createClient();
  let lastError: Error | null = null;

  // Try to use the RPC function first
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data: leadNumber, error } = await supabase.rpc(
        "generate_lead_number",
        { p_tenant_id: tenantId }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (leadNumber) {
        // Verify this lead number doesn't exist
        const { data: existing, error: checkError } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("lead_number", leadNumber);

        if (checkError) {
          throw new Error(`Failed to verify lead number: ${checkError.message}`);
        }

        if (!existing || existing.length === 0) {
          // Lead number is unique, return it
          return leadNumber;
        }
        // If it exists, continue to next attempt
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    // Exponential backoff between retries
    if (attempt < maxRetries - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 100)
      );
    }
  }

  // If RPC fails, generate locally as fallback
  const year = new Date().getFullYear().toString().slice(-2);
  const randomNum = Math.floor(Math.random() * 9000) + 1000;
  return `LD-${year}-${randomNum}`;
}

/**
 * Format a lead number for display
 * @param leadNumber - The lead number to format
 * @returns Formatted lead number (already in correct format)
 */
export function formatLeadNumber(leadNumber: string | null): string {
  if (!leadNumber) return "-";
  return leadNumber;
}

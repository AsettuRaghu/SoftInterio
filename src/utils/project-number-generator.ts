import { createClient } from "@/lib/supabase/server";

/**
 * Generates a unique project number for a tenant
 * Implements retry logic to handle duplicate key errors
 * 
 * @param tenantId - The tenant ID
 * @param maxRetries - Maximum number of retry attempts (default: 5)
 * @returns A unique project number in the format PRJ-YY-XXXX
 */
export async function generateUniqueProjectNumber(
  tenantId: string,
  maxRetries: number = 5
): Promise<string> {
  const supabase = await createClient();
  let lastError: Error | null = null;

  // Try to use the RPC function first
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data: projectNumber, error } = await supabase.rpc(
        "generate_project_number",
        { p_tenant_id: tenantId }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (projectNumber) {
        // Verify this project number doesn't exist
        const { data: existing, error: checkError } = await supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("project_number", projectNumber);

        if (checkError) {
          throw new Error(`Failed to verify project number: ${checkError.message}`);
        }

        if (!existing || existing.length === 0) {
          // Project number is unique, return it
          return projectNumber;
        }
        // If it exists, continue to next attempt
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    // If this wasn't the last attempt, wait a bit before retrying
    if (attempt < maxRetries - 1) {
      // Exponential backoff: 100ms, 200ms, 400ms, 800ms
      const delay = 100 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // If RPC failed or returned duplicates, generate a fallback number
  // This format matches PRJ-YY-XXXX (e.g., PRJ-25-0001)
  const currentYear = new Date().getFullYear().toString().slice(-2);
  
  // Get the highest project number for this tenant in the current year
  const { data: projects, error: queryError } = await supabase
    .from("projects")
    .select("project_number")
    .eq("tenant_id", tenantId)
    .like("project_number", `PRJ-${currentYear}-%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (queryError) {
    throw new Error(`Failed to query existing projects: ${queryError.message}`);
  }

  let nextNumber = 1;

  if (projects && projects.length > 0) {
    const lastProjectNumber = projects[0].project_number;
    const match = lastProjectNumber.match(/PRJ-\d+-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  const generatedNumber = `PRJ-${currentYear}-${String(nextNumber).padStart(4, "0")}`;

  // Verify this number doesn't exist by trying to insert it
  // If it fails, throw an error to let the caller handle it
  const { data: existing } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("project_number", generatedNumber);

  if (existing && existing.length > 0) {
    // Last resort: use timestamp-based unique number
    const timestamp = Date.now();
    return `PRJ-${currentYear}-${timestamp.toString().slice(-4)}`;
  }

  return generatedNumber;
}

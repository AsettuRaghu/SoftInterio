import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tenant policy on where projects may come from.
 *
 * The normal route is a won lead, which carries the client, property,
 * quotation and scope across. A project typed into a blank form starts with
 * none of that, so direct creation is a capability a tenant opts into rather
 * than the default.
 *
 * Lives on tenant_settings beside auto_create_project_on_won - the existing
 * home for project-flow policy.
 */
export async function allowsDirectProjectCreate(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("tenant_settings")
    .select("allow_direct_project_create")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  // A tenant with no settings row has not opted in. Closed by default: the
  // safe answer when the policy is unknown is the restrictive one.
  return data?.allow_direct_project_create === true;
}

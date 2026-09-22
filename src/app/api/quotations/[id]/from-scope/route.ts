import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { copyScopeToQuotation } from "@/lib/quotations/scope-to-quotation";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/quotations/[id]/from-scope - "Bring in from scope".
 *
 * Adds to a draft whatever the property's scope has that the quotation does
 * not: new rooms, new components, with their sizes. Never changes or removes
 * a line, never brings in what is not ours to price. Pull on demand, as
 * decided; a quotation that is sent, approved or otherwise settled is not a
 * draft and is refused.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id } = await params;
  const supabase = await createClient();

  const { data: quotation } = await supabase
    .from("quotations")
    .select("id, status, lead_id, project_id")
    .eq("id", id)
    .eq("tenant_id", user.tenantId)
    .maybeSingle();
  if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (quotation.status !== "draft") {
    return NextResponse.json({ error: "Only a draft can take rooms from the scope. Revise it first." }, { status: 409 });
  }
  if (!quotation.lead_id && !quotation.project_id) {
    return NextResponse.json({ error: "This quotation is not on a lead or project, so there is no scope to read." }, { status: 400 });
  }

  const result = await copyScopeToQuotation(supabase, user.tenantId, id, quotation.lead_id, quotation.project_id);
  const added = result.spaces + result.components + result.lines;
  const message =
    added === 0
      ? result.skipped
        ? `Nothing new to bring in; ${result.skipped} row${result.skipped === 1 ? " is" : "s are"} not ours to price.`
        : "Nothing new - the quotation already has everything in the scope."
      : `Brought in ${result.spaces} space${result.spaces === 1 ? "" : "s"}, ${result.components} component${result.components === 1 ? "" : "s"} and ${result.lines} chosen item${result.lines === 1 ? "" : "s"}${
          result.skipped ? `; ${result.skipped} left out as not ours` : ""
        }.`;
  const note = result.unsized.length
    ? ` ${result.unsized.length} line${result.unsized.length === 1 ? "" : "s"} priced at nothing - a measurement is missing: ${result.unsized.slice(0, 3).join(", ")}${result.unsized.length > 3 ? "…" : ""}.`
    : "";
  return NextResponse.json({ success: true, result, message: message + note });
}

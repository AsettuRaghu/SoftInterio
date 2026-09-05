import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { withCoverUrls } from "../../route";
import { nextAvailableCopyName } from "@/utils/quotations/helpers";

/**
 * Duplicate a print format.
 *
 * Most formats a tenant needs are small variations on one another - the client
 * version and the site-team version differ by two settings - so starting from
 * a copy is the normal way to make the second one.
 *
 * Naming follows the existing quotation template duplicate: "<name>_copy".
 */

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    // RLS scopes this to the caller's tenant.
    const { data: original } = await supabase
      .from("quotation_print_formats")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!original) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: siblings } = await supabase
      .from("quotation_print_formats")
      .select("name");

    const taken = new Set(
      (siblings || []).map((s: { name: string }) => s.name.toLowerCase())
    );

    // Everything except identity, ownership and the default flag. A copy must
    // not inherit is_default: only one format per tenant may hold it, and
    // silently moving the default would change what every quotation prints
    // with.
    const {
      id: _id,
      tenant_id: _tenantId,
      name: _name,
      is_default: _isDefault,
      created_by: _createdBy,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ...settings
    } = original as Record<string, unknown>;

    const { data, error } = await supabase
      .from("quotation_print_formats")
      .insert({
        ...settings,
        name: nextAvailableCopyName(original.name, taken),
        tenant_id: user.tenantId,
        created_by: user.id,
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error duplicating print format:", error);
      return NextResponse.json(
        { error: "Failed to duplicate print format" },
        { status: 500 }
      );
    }

    const [withUrl] = await withCoverUrls([data]);
    return NextResponse.json({ format: withUrl }, { status: 201 });
  } catch (error) {
    console.error("Print format duplicate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

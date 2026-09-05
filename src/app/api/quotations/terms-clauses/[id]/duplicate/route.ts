import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { nextAvailableCopyName } from "@/utils/quotations/helpers";

/**
 * Duplicate a terms & conditions clause.
 *
 * Useful for near-identical wording that differs by trade or project type -
 * a warranty clause for modular work and one for on-site carpentry, say.
 *
 * Naming matches the print format duplicate and the existing quotation
 * template duplicate: "<title>_copy".
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
      .from("quotation_terms_clauses")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!original) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: siblings } = await supabase
      .from("quotation_terms_clauses")
      .select("title");

    const taken = new Set(
      (siblings || []).map((s: { title: string }) => s.title.toLowerCase())
    );

    // A copy is never a default, even though several clauses may be.
    // Duplicating is how you start a variant, and having both the original and
    // an unedited copy attach themselves to every new quotation is not what
    // anyone means by "copy this".
    const { data, error } = await supabase
      .from("quotation_terms_clauses")
      .insert({
        title: nextAvailableCopyName(original.title, taken),
        content: original.content,
        category: original.category,
        display_order: original.display_order,
        is_active: original.is_active,
        is_default: false,
        tenant_id: user.tenantId,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error duplicating clause:", error);
      return NextResponse.json(
        { error: "Failed to duplicate clause" },
        { status: 500 }
      );
    }

    return NextResponse.json({ clause: data }, { status: 201 });
  } catch (error) {
    console.error("Clause duplicate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

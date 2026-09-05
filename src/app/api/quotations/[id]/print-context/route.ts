import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

/**
 * What the print dialog needs to say which format produced the document.
 *
 * Separate from the PDF route because that one returns a binary body - there
 * is nowhere to put this alongside it, and the dialog wants both at once.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);

    const { id } = await params;
    const supabase = await createClient();

    const { data: quotation } = await supabase
      .from("quotations")
      .select("tenant_id")
      .eq("id", id)
      .maybeSingle();

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    const [{ data: formats }, { data: clauses }] = await Promise.all([
      // Every active format, so the dialog can offer the choice rather than
      // only naming the one it happened to use.
      supabase
        .from("quotation_print_formats")
        .select("id, name, description, itemise_to, price_at, is_default")
        .eq("tenant_id", quotation.tenant_id)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("quotation_terms_clauses")
        .select("title")
        .eq("tenant_id", quotation.tenant_id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("display_order", { ascending: true })
        .limit(1),
    ]);

    return NextResponse.json({
      formats: formats || [],
      defaultFormatId:
        (formats || []).find((f) => f.is_default)?.id || formats?.[0]?.id || null,
      terms: clauses?.[0] || null,
    });
  } catch (error) {
    console.error("Error building print context:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

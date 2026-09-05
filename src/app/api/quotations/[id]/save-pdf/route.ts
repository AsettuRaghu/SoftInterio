import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

const STORAGE_BUCKET = "documents";

/**
 * Keeps a copy of the printed quotation in Documents.
 *
 * The PDF is generated fresh from the current quotation rather than uploaded
 * from the browser: the file that gets filed should be the one the server
 * produces, not whatever the client happened to be holding.
 *
 * Filed against the quotation, and against its lead as well when it has one,
 * so it turns up where people look for it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);

    const { id } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: quotation } = await supabase
      .from("quotations")
      .select("id, tenant_id, quotation_number, version, lead_id")
      .eq("id", id)
      .maybeSingle();

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    // Re-render through the PDF route so there is exactly one place that knows
    // how a quotation becomes a document - and with the same format that was
    // previewed, or the filed copy would not be the one anyone looked at.
    const body = await request.json().catch(() => ({}));
    const pdfUrl = new URL(`/api/quotations/${id}/pdf`, request.nextUrl.origin);
    if (body?.format_id) pdfUrl.searchParams.set("format_id", body.format_id);

    const pdfResponse = await fetch(pdfUrl, {
      headers: { cookie: request.headers.get("cookie") || "" },
    });

    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: "Could not generate the PDF to save" },
        { status: 502 }
      );
    }

    const bytes = Buffer.from(await pdfResponse.arrayBuffer());
    const stamp = new Date().toISOString().slice(0, 10);
    const originalName = `${quotation.quotation_number}-v${quotation.version || 1}-${stamp}.pdf`;
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
    const storagePath = `${quotation.tenant_id}/quotation/${id}/${fileName}`;

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "Failed to store the PDF" }, { status: 500 });
    }

    const { data: document, error: dbError } = await admin
      .from("documents" as any)
      .insert({
        tenant_id: quotation.tenant_id,
        linked_type: "quotation",
        linked_id: id,
        file_name: fileName,
        original_name: originalName,
        file_type: "application/pdf",
        file_extension: ".pdf",
        file_size: bytes.length,
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        category: "proposal",
        title: `${quotation.quotation_number} v${quotation.version || 1}`,
        tags: ["quotation", "printed"],
        uploaded_by: guard.user.id,
      } as any)
      .select("id, original_name")
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: "Failed to file the document" }, { status: 500 });
    }

    return NextResponse.json({ success: true, document });
  } catch (error) {
    console.error("Error saving quotation PDF:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Quotation Print Library.
 *
 * A print format is a named, reusable answer to three separate questions - how
 * far to itemise, where to show money, and how verbose to be - plus cover and
 * theme settings. Kept apart from quotation_templates, which are *content*
 * templates: what goes into a quotation, rather than how it is presented.
 */

/** Fields a caller may set. Anything else in the body is ignored. */
const WRITABLE = [
  "name",
  "description",
  "cover_enabled",
  "cover_image_path",
  "itemise_to",
  "price_at",
  "show_descriptions",
  "show_specifications",
  "show_dimensions",
  "show_quantities",
  "show_company_details",
  "show_bank_details",
  "show_payment_terms",
  "show_terms",
  "header_color",
  "footer_text",
  "is_default",
  "is_active",
  "display_order",
] as const;

export function pickWritable(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of WRITABLE) {
    if (key in body) out[key] = body[key];
  }
  return out;
}

/**
 * Only one format per tenant may be the default, enforced by a partial unique
 * index. Clearing the previous one first turns what would be a constraint
 * violation into the behaviour users expect: setting a new default moves it.
 */
export async function clearOtherDefaults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  exceptId?: string
) {
  let query = supabase
    .from("quotation_print_formats")
    .update({ is_default: false })
    .eq("tenant_id", tenantId)
    .eq("is_default", true);
  if (exceptId) query = query.neq("id", exceptId);
  await query;
}

const STORAGE_BUCKET = "documents";

/** Attaches a short-lived signed URL for each format that has a cover image. */
export async function withCoverUrls<T extends { cover_image_path?: string | null }>(
  formats: T[]
): Promise<(T & { cover_preview_url: string | null })[]> {
  const admin = createAdminClient();
  return Promise.all(
    formats.map(async (f) => {
      if (!f.cover_image_path) return { ...f, cover_preview_url: null };
      const { data } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(f.cover_image_path, 3600);
      return { ...f, cover_preview_url: data?.signedUrl || null };
    })
  );
}

// GET /api/quotations/print-formats
export async function GET(request: NextRequest) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const supabase = await createClient();
    const includeInactive =
      request.nextUrl.searchParams.get("include_inactive") === "true";

    let query = supabase
      .from("quotation_print_formats")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!includeInactive) query = query.eq("is_active", true);

    const { data, error } = await query;

    if (error) {
      console.error("Error loading print formats:", error);
      return NextResponse.json(
        { error: "Failed to load print formats" },
        { status: 500 }
      );
    }

    // The bucket is private, so a viewable URL has to be minted per request.
    // Signing here keeps every caller from having to know that.
    return NextResponse.json({ formats: await withCoverUrls(data || []) });
  } catch (error) {
    console.error("Print formats GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/quotations/print-formats
export async function POST(request: NextRequest) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const values = pickWritable(body);

    if (values.is_default) {
      await clearOtherDefaults(supabase, user.tenantId);
    }

    const { data, error } = await supabase
      .from("quotation_print_formats")
      .insert({
        ...values,
        name: String(body.name).trim(),
        tenant_id: user.tenantId,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      // 23505 is the unique index on (tenant_id, lower(name)).
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A print format with that name already exists" },
          { status: 409 }
        );
      }
      console.error("Error creating print format:", error);
      return NextResponse.json(
        { error: "Failed to create print format" },
        { status: 500 }
      );
    }

    return NextResponse.json({ format: data }, { status: 201 });
  } catch (error) {
    console.error("Print formats POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

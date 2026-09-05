import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

/**
 * Quotation T&C Library.
 *
 * Reusable clauses a quotation assembles from, rather than one boilerplate
 * blob per tenant - the clauses that actually vary are vertical-specific
 * (drawing ownership for an architect, retention for a contractor, site
 * readiness for an interior vendor).
 *
 * Several clauses can be marked default; they are the ones pre-selected on a
 * new quotation. That differs from print formats, where exactly one default
 * applies.
 */

const WRITABLE = [
  "title",
  "content",
  "category",
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

// GET /api/quotations/terms-clauses
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
      .from("quotation_terms_clauses")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!includeInactive) query = query.eq("is_active", true);

    const { data, error } = await query;

    if (error) {
      console.error("Error loading terms clauses:", error);
      return NextResponse.json(
        { error: "Failed to load clauses" },
        { status: 500 }
      );
    }

    return NextResponse.json({ clauses: data || [] });
  } catch (error) {
    console.error("Terms clauses GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/quotations/terms-clauses
export async function POST(request: NextRequest) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const body = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!body.content?.trim()) {
      return NextResponse.json(
        { error: "Clause text is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("quotation_terms_clauses")
      .insert({
        ...pickWritable(body),
        title: String(body.title).trim(),
        content: String(body.content).trim(),
        tenant_id: user.tenantId,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A clause with that title already exists" },
          { status: 409 }
        );
      }
      console.error("Error creating clause:", error);
      return NextResponse.json(
        { error: "Failed to create clause" },
        { status: 500 }
      );
    }

    return NextResponse.json({ clause: data }, { status: 201 });
  } catch (error) {
    console.error("Terms clauses POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

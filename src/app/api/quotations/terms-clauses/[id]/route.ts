import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { pickWritable } from "../route";

/** Read, update and delete a single T&C clause. */

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("quotation_terms_clauses")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ clause: data });
  } catch (error) {
    console.error("Clause GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { data: existing } = await supabase
      .from("quotation_terms_clauses")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if ("title" in body && !body.title?.trim()) {
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 }
      );
    }
    if ("content" in body && !body.content?.trim()) {
      return NextResponse.json(
        { error: "Clause text cannot be empty" },
        { status: 400 }
      );
    }

    const values = pickWritable(body);
    if (typeof values.title === "string") values.title = values.title.trim();
    if (typeof values.content === "string")
      values.content = values.content.trim();

    const { data, error } = await supabase
      .from("quotation_terms_clauses")
      .update(values)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A clause with that title already exists" },
          { status: 409 }
        );
      }
      console.error("Error updating clause:", error);
      return NextResponse.json(
        { error: "Failed to update clause" },
        { status: 500 }
      );
    }

    return NextResponse.json({ clause: data });
  } catch (error) {
    console.error("Clause PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("quotation_terms_clauses")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Safe to hard delete: quotations snapshot their terms text rather than
    // referencing clauses, so removing one cannot alter an issued quotation.
    const { error } = await supabase
      .from("quotation_terms_clauses")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting clause:", error);
      return NextResponse.json(
        { error: "Failed to delete clause" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clause DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

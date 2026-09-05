import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { pickWritable, clearOtherDefaults, withCoverUrls } from "../route";

/** Read, update and delete a single print format. */

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

    // RLS scopes this to the caller's tenant, so a miss means "not found or
    // not yours" - both answer 404.
    const { data, error } = await supabase
      .from("quotation_print_formats")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [withUrl] = await withCoverUrls([data]);
    return NextResponse.json({ format: withUrl });
  } catch (error) {
    console.error("Print format GET error:", error);
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

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { data: existing } = await supabase
      .from("quotation_print_formats")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if ("name" in body && !body.name?.trim()) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      );
    }

    const values = pickWritable(body);
    if (typeof values.name === "string") values.name = values.name.trim();

    // Promoting this one demotes whichever held the flag before.
    if (values.is_default) {
      await clearOtherDefaults(supabase, user.tenantId, id);
    }

    const { data, error } = await supabase
      .from("quotation_print_formats")
      .update(values)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A print format with that name already exists" },
          { status: 409 }
        );
      }
      console.error("Error updating print format:", error);
      return NextResponse.json(
        { error: "Failed to update print format" },
        { status: 500 }
      );
    }

    return NextResponse.json({ format: data });
  } catch (error) {
    console.error("Print format PATCH error:", error);
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
      .from("quotation_print_formats")
      .select("id, is_default")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Removing the default would leave quotations with nothing to print with,
    // so the user has to nominate a replacement first.
    if (existing.is_default) {
      return NextResponse.json(
        {
          error:
            "This is the default print format. Make another one the default before deleting it.",
        },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("quotation_print_formats")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting print format:", error);
      return NextResponse.json(
        { error: "Failed to delete print format" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Print format DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

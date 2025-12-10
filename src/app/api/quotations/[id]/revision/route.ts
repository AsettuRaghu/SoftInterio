import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/quotations/[id]/revision - Create a new revision of a quotation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    // Call the database function to create revision
    const { data, error } = await supabase.rpc("create_quotation_revision", {
      p_quotation_id: id,
      p_user_id: user.id,
    });

    if (error) {
      console.error("Error creating revision:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create revision" },
        { status: 500 }
      );
    }

    // Fetch the newly created quotation
    const { data: newQuotation, error: fetchError } = await supabase
      .from("quotations_with_lead")
      .select("*")
      .eq("id", data)
      .single();

    if (fetchError) {
      console.error("Error fetching new revision:", fetchError);
      return NextResponse.json(
        { error: "Revision created but failed to fetch details" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      quotation: newQuotation,
      message: `Created revision v${newQuotation.version}`,
    });
  } catch (error) {
    console.error("Create revision API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

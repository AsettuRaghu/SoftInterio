import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Get user info
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the original quotation
    const { data: original, error: fetchError } = await supabase
      .from("quotations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !original) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      );
    }

    // Generate new quotation number
    const today = new Date();
    const datePrefix = `QT${today.getFullYear()}${String(
      today.getMonth() + 1
    ).padStart(2, "0")}`;

    // Get the count of quotations created today to generate sequential number
    const { count } = await supabase
      .from("quotations")
      .select("*", { count: "exact", head: true })
      .like("quotation_number", `${datePrefix}%`);

    const sequentialNumber = String((count || 0) + 1).padStart(4, "0");
    const newQuotationNumber = `${datePrefix}${sequentialNumber}`;

    // Create new quotation as a copy
    const duplicateData = {
      organization_id: original.organization_id,
      lead_id: original.lead_id,
      quotation_number: newQuotationNumber,
      version: 1,
      status: "draft" as const,
      title: original.title ? `${original.title} (Copy)` : "Quotation (Copy)",
      client_name: original.client_name,
      client_email: original.client_email,
      client_phone: original.client_phone,
      client_address: original.client_address,
      property_name: original.property_name,
      property_type: original.property_type,
      property_address: original.property_address,
      carpet_area: original.carpet_area,
      spaces: original.spaces || [],
      subtotal: original.subtotal,
      discount_type: original.discount_type,
      discount_value: original.discount_value,
      discount_amount: original.discount_amount,
      tax_rate: original.tax_rate,
      tax_amount: original.tax_amount,
      grand_total: original.grand_total,
      terms_and_conditions: original.terms_and_conditions,
      notes: original.notes,
      valid_until: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(), // 30 days from now
      created_by: user.id,
      assignee_id: user.id,
    };

    const { data: newQuotation, error: createError } = await supabase
      .from("quotations")
      .insert(duplicateData)
      .select()
      .single();

    if (createError) {
      console.error("Error creating duplicate quotation:", createError);
      return NextResponse.json(
        { error: "Failed to duplicate quotation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      quotation: newQuotation,
      message: "Quotation duplicated successfully",
    });
  } catch (err) {
    console.error("Duplicate quotation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

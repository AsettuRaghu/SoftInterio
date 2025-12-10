import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Get tenant_id from user
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const materialId = searchParams.get("material_id");
    const vendorId = searchParams.get("vendor_id");

    if (!materialId && !vendorId) {
      return NextResponse.json(
        { error: "Either material_id or vendor_id is required" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("stock_vendor_materials")
      .select(
        `
        *,
        vendor:stock_vendors!stock_vendor_materials_vendor_id_fkey(
          id,
          name,
          code,
          email,
          phone
        ),
        material:stock_materials!stock_vendor_materials_material_id_fkey(
          id,
          name,
          sku
        )
      `
      )
      .eq("tenant_id", userData.tenant_id)
      .order("is_preferred", { ascending: false })
      .order("unit_price", { ascending: true });

    if (materialId) {
      query = query.eq("material_id", materialId);
    }

    if (vendorId) {
      query = query.eq("vendor_id", vendorId);
    }

    const { data: vendorMaterials, error } = await query;

    if (error) {
      console.error("Error fetching vendor materials:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ vendorMaterials: vendorMaterials || [] });
  } catch (error) {
    console.error("Error in material-vendors API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Get tenant_id from user
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.vendor_id || !body.material_id) {
      return NextResponse.json(
        { error: "vendor_id and material_id are required" },
        { status: 400 }
      );
    }

    // Check for existing record
    const { data: existing } = await supabase
      .from("stock_vendor_materials")
      .select("id")
      .eq("tenant_id", userData.tenant_id)
      .eq("vendor_id", body.vendor_id)
      .eq("material_id", body.material_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "This vendor-material association already exists" },
        { status: 400 }
      );
    }

    // If this is marked as preferred, unset other preferred for this material
    if (body.is_preferred) {
      await supabase
        .from("stock_vendor_materials")
        .update({ is_preferred: false })
        .eq("tenant_id", userData.tenant_id)
        .eq("material_id", body.material_id);
    }

    const { data: vendorMaterial, error } = await supabase
      .from("stock_vendor_materials")
      .insert({
        tenant_id: userData.tenant_id,
        vendor_id: body.vendor_id,
        material_id: body.material_id,
        vendor_sku: body.vendor_sku || null,
        vendor_item_name: body.vendor_item_name || null,
        unit_price: body.unit_price || 0,
        currency: body.currency || "INR",
        price_valid_from: body.price_valid_from || null,
        price_valid_to: body.price_valid_to || null,
        min_order_qty: body.min_order_qty || 1,
        lead_time_days: body.lead_time_days || 0,
        is_preferred: body.is_preferred || false,
        is_active: true,
        notes: body.notes || null,
      })
      .select(
        `
        *,
        vendor:stock_vendors!stock_vendor_materials_vendor_id_fkey(
          id,
          name,
          code
        )
      `
      )
      .single();

    if (error) {
      console.error("Error creating vendor material:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(vendorMaterial, { status: 201 });
  } catch (error) {
    console.error("Error in material-vendors API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

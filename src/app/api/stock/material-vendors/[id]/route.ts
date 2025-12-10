import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
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

    const { data: vendorMaterial, error } = await supabase
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
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (error) {
      console.error("Error fetching vendor material:", error);
      return NextResponse.json(
        { error: "Vendor material not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(vendorMaterial);
  } catch (error) {
    console.error("Error in material-vendors API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
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

    // Get the current record to know the material_id
    const { data: currentRecord } = await supabase
      .from("stock_vendor_materials")
      .select("material_id")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (!currentRecord) {
      return NextResponse.json(
        { error: "Vendor material not found" },
        { status: 404 }
      );
    }

    // If setting as preferred, unset other preferred for this material
    if (body.is_preferred === true) {
      await supabase
        .from("stock_vendor_materials")
        .update({ is_preferred: false })
        .eq("tenant_id", userData.tenant_id)
        .eq("material_id", currentRecord.material_id)
        .neq("id", id);
    }

    const { data: vendorMaterial, error } = await supabase
      .from("stock_vendor_materials")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
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
      console.error("Error updating vendor material:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(vendorMaterial);
  } catch (error) {
    console.error("Error in material-vendors API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
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

    const { error } = await supabase
      .from("stock_vendor_materials")
      .delete()
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id);

    if (error) {
      console.error("Error deleting vendor material:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Vendor material deleted successfully",
    });
  } catch (error) {
    console.error("Error in material-vendors API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/stock/vendor-brands - Get vendor-brand associations
// Query params: vendor_id (required) or brand_id
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const vendorId = searchParams.get("vendor_id");
    const brandId = searchParams.get("brand_id");

    if (!vendorId && !brandId) {
      return NextResponse.json(
        { error: "Either vendor_id or brand_id is required" },
        { status: 400 }
      );
    }

    // Query with RLS handling tenant filtering automatically
    let query = supabase.from("stock_vendor_brands").select(
      `
        *,
        brand:stock_brands!brand_id (
          id,
          code,
          name,
          logo_url,
          quality_tier,
          is_active,
          is_preferred
        ),
        vendor:stock_vendors!vendor_id (
          id,
          code,
          name,
          display_name,
          is_active,
          is_preferred
        )
      `
    );

    if (vendorId) {
      query = query.eq("vendor_id", vendorId);
    }
    if (brandId) {
      query = query.eq("brand_id", brandId);
    }

    const { data: vendorBrands, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching vendor brands:", error);
      return NextResponse.json(
        { error: "Failed to fetch vendor brands" },
        { status: 500 }
      );
    }

    // Return empty array if no data (not an error)
    return NextResponse.json({ vendorBrands: vendorBrands || [] });
  } catch (error) {
    console.error("Error in GET /api/stock/vendor-brands:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/stock/vendor-brands - Create vendor-brand association
export async function POST(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Get user's tenant from users table
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
    const {
      vendor_id,
      brand_id,
      is_authorized_dealer,
      discount_percent,
      notes,
    } = body;

    if (!vendor_id || !brand_id) {
      return NextResponse.json(
        { error: "vendor_id and brand_id are required" },
        { status: 400 }
      );
    }

    // Check if association already exists
    const { data: existing } = await supabase
      .from("stock_vendor_brands")
      .select("id")
      .eq("vendor_id", vendor_id)
      .eq("brand_id", brand_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "This vendor-brand association already exists" },
        { status: 409 }
      );
    }

    // Create the association
    const { data: vendorBrand, error } = await supabase
      .from("stock_vendor_brands")
      .insert({
        tenant_id: userData.tenant_id,
        vendor_id,
        brand_id,
        is_authorized_dealer: is_authorized_dealer || false,
        discount_percent: discount_percent || 0,
        notes: notes || null,
      })
      .select(
        `
        *,
        brand:stock_brands!brand_id (
          id,
          code,
          name,
          logo_url,
          quality_tier,
          is_active,
          is_preferred
        )
      `
      )
      .single();

    if (error) {
      console.error("Error creating vendor brand:", error);
      return NextResponse.json(
        { error: "Failed to create vendor brand association" },
        { status: 500 }
      );
    }

    return NextResponse.json({ vendorBrand }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/stock/vendor-brands:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/stock/vendor-brands - Update vendor-brand association
export async function PUT(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const body = await request.json();
    const { id, is_authorized_dealer, discount_percent, notes } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (is_authorized_dealer !== undefined)
      updates.is_authorized_dealer = is_authorized_dealer;
    if (discount_percent !== undefined)
      updates.discount_percent = discount_percent;
    if (notes !== undefined) updates.notes = notes;

    // RLS will handle tenant filtering
    const { data: vendorBrand, error } = await supabase
      .from("stock_vendor_brands")
      .update(updates)
      .eq("id", id)
      .select(
        `
        *,
        brand:stock_brands!brand_id (
          id,
          code,
          name,
          logo_url,
          quality_tier,
          is_active,
          is_preferred
        )
      `
      )
      .single();

    if (error) {
      console.error("Error updating vendor brand:", error);
      return NextResponse.json(
        { error: "Failed to update vendor brand association" },
        { status: 500 }
      );
    }

    return NextResponse.json({ vendorBrand });
  } catch (error) {
    console.error("Error in PUT /api/stock/vendor-brands:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/stock/vendor-brands - Delete vendor-brand association
export async function DELETE(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // RLS will handle tenant filtering
    const { error } = await supabase
      .from("stock_vendor_brands")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting vendor brand:", error);
      return NextResponse.json(
        { error: "Failed to delete vendor brand association" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/stock/vendor-brands:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

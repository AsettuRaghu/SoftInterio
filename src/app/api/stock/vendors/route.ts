import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { VendorFilters, CreateVendorInput } from "@/types/stock";

// GET /api/stock/vendors - List vendors with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const isActive = searchParams.get("is_active");
    const isPreferred = searchParams.get("is_preferred");
    const city = searchParams.get("city");
    const categoryId = searchParams.get("category_id");
    const minRating = searchParams.get("min_rating");
    const sortBy = searchParams.get("sort_by") || "name";
    const sortOrder = searchParams.get("sort_order") || "asc";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase.from("stock_vendors").select("*", { count: "exact" });

    // Active filter
    if (isActive !== null) {
      query = query.eq("is_active", isActive === "true");
    }

    // Preferred filter
    if (isPreferred !== null) {
      query = query.eq("is_preferred", isPreferred === "true");
    }

    // City filter
    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    // Category filter (vendors that supply this category)
    if (categoryId) {
      query = query.contains("category_ids", [categoryId]);
    }

    // Rating filter
    if (minRating) {
      query = query.gte("rating", parseInt(minRating));
    }

    // Search
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,code.ilike.%${search}%,contact_person.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`
      );
    }

    // Sorting
    const ascending = sortOrder === "asc";
    query = query.order(sortBy, { ascending, nullsFirst: false });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: vendors, error, count } = await query;

    if (error) {
      console.error("Vendors fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      vendors: vendors || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Vendors API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/stock/vendors - Create a new vendor
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateVendorInput = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: "Vendor name is required" },
        { status: 400 }
      );
    }

    // Get user's tenant_id
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

    // Generate code if not provided
    let code = body.code;
    if (!code) {
      // Generate vendor code: VND-XXXX
      const { count } = await supabase
        .from("stock_vendors")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", userData.tenant_id);

      code = `VND-${String((count || 0) + 1).padStart(4, "0")}`;
    }

    // Create vendor
    const { data: vendor, error } = await supabase
      .from("stock_vendors")
      .insert({
        tenant_id: userData.tenant_id,
        code,
        name: body.name,
        display_name: body.display_name || body.name,
        contact_person: body.contact_person,
        email: body.email,
        phone: body.phone,
        alternate_phone: body.alternate_phone,
        website: body.website,
        address_line1: body.address_line1,
        address_line2: body.address_line2,
        city: body.city,
        state: body.state,
        pincode: body.pincode,
        country: body.country || "India",
        gst_number: body.gst_number,
        pan_number: body.pan_number,
        payment_terms: body.payment_terms,
        credit_days: body.credit_days || 0,
        credit_limit: body.credit_limit,
        category_ids: body.category_ids || [],
        bank_name: body.bank_name,
        bank_account_number: body.bank_account_number,
        bank_ifsc: body.bank_ifsc,
        rating: body.rating,
        notes: body.notes,
        created_by: user.id,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Create vendor error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ vendor }, { status: 201 });
  } catch (error) {
    console.error("Create Vendor API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

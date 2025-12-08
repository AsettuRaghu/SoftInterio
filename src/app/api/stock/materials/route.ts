import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] GET /api/stock/materials - Starting request`);

  try {
    const supabase = await createClient();

    // Get current user and their tenant
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error(`[${requestId}] Auth error:`, userError);
      return NextResponse.json(
        { error: "Authentication failed", details: userError.message },
        { status: 401 }
      );
    }

    if (!user) {
      console.log(`[${requestId}] No user found in session`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[${requestId}] User authenticated: ${user.id}`);

    // Get tenant_id from user
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userDataError) {
      console.error(`[${requestId}] Error fetching user data:`, userDataError);
      return NextResponse.json(
        { error: "Failed to fetch user data", details: userDataError.message },
        { status: 500 }
      );
    }

    if (!userData?.tenant_id) {
      console.log(
        `[${requestId}] User ${user.id} not associated with a tenant`
      );
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] Tenant ID: ${userData.tenant_id}`);

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const itemType = searchParams.get("item_type") || "";
    const brandId = searchParams.get("brand_id") || "";
    const stockStatus = searchParams.get("stock_status") || "";
    const sortBy = searchParams.get("sort_by") || "name";
    const sortOrder = searchParams.get("sort_order") || "asc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Validate sort field to prevent injection
    const validSortFields = [
      "name",
      "sku",
      "category",
      "current_quantity",
      "unit_cost",
      "created_at",
    ];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "name";
    const safeSortOrder = sortOrder === "desc" ? false : true;

    console.log(`[${requestId}] Query params:`, {
      search,
      category,
      itemType,
      brandId,
      stockStatus,
      sortBy: safeSortBy,
      sortOrder: safeSortOrder ? "asc" : "desc",
      page,
      limit,
    });

    // Build the query - query materials first, then we'll check if brand relationship exists
    // Note: brand_id column may not exist if migration 024 wasn't run
    let query = supabase
      .from("stock_materials")
      .select(
        `
        *,
        preferred_vendor:stock_vendors!preferred_vendor_id(
          id,
          name,
          code
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", userData.tenant_id)
      .order(safeSortBy, { ascending: safeSortOrder });

    // Apply filters
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (itemType) {
      query = query.eq("item_type", itemType);
    }

    // Brand filter - only apply if brand_id column exists
    // Note: This filter may fail if migration 024 wasn't run
    if (brandId) {
      console.log(
        `[${requestId}] Applying brand filter - this may fail if brand_id column doesn't exist`
      );
      query = query.eq("brand_id", brandId);
    }

    // Stock status filter
    if (stockStatus === "out_of_stock") {
      query = query.eq("current_quantity", 0);
    } else if (stockStatus === "low_stock") {
      query = query
        .gt("current_quantity", 0)
        .lte("current_quantity", supabase.rpc("get_minimum_quantity"));
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    console.log(`[${requestId}] Executing materials query...`);
    const { data: materials, error, count } = await query;

    if (error) {
      console.error(`[${requestId}] Error fetching materials:`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        {
          error: "Failed to fetch materials",
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    console.log(
      `[${requestId}] Found ${
        materials?.length || 0
      } materials, total: ${count}`
    );

    // Get categories for filter options
    const { data: categories, error: categoriesError } = await supabase
      .from("stock_materials")
      .select("category")
      .eq("company_id", userData.tenant_id)
      .not("category", "is", null);

    if (categoriesError) {
      console.warn(
        `[${requestId}] Error fetching categories:`,
        categoriesError
      );
    }

    const uniqueCategories = Array.from(
      new Set(categories?.map((c) => c.category).filter(Boolean))
    );

    console.log(`[${requestId}] Request completed successfully`);

    return NextResponse.json({
      materials: materials || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      filters: {
        categories: uniqueCategories,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[materials-api] Unhandled error:`, {
      message: errorMessage,
      stack: errorStack,
      error,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user and their tenant
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    if (!body.name || !body.sku) {
      return NextResponse.json(
        { error: "Name and SKU are required" },
        { status: 400 }
      );
    }

    // Check for duplicate SKU
    const { data: existingMaterial } = await supabase
      .from("stock_materials")
      .select("id")
      .eq("company_id", userData.tenant_id)
      .eq("sku", body.sku)
      .single();

    if (existingMaterial) {
      return NextResponse.json(
        { error: "A material with this SKU already exists" },
        { status: 400 }
      );
    }

    // Create the material
    const { data: material, error } = await supabase
      .from("stock_materials")
      .insert({
        company_id: userData.tenant_id,
        name: body.name,
        sku: body.sku,
        description: body.description,
        category: body.category,
        item_type: body.item_type || "raw_material",
        unit_of_measure: body.unit_of_measure || "pcs",
        current_quantity: body.current_quantity || 0,
        minimum_quantity: body.minimum_quantity || 0,
        reorder_quantity: body.reorder_quantity || 0,
        unit_cost: body.unit_cost || 0,
        selling_price: body.selling_price,
        preferred_vendor_id: body.preferred_vendor_id,
        brand_id: body.brand_id,
        storage_location: body.storage_location,
        specifications: body.specifications || {},
        notes: body.notes,
        is_active: true,
        created_by: user.id,
      })
      .select(
        `
        *,
        preferred_vendor:stock_vendors!preferred_vendor_id(
          id,
          name,
          code
        )
      `
      )
      .single();

    if (error) {
      console.error("Error creating material:", {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return NextResponse.json(
        { error: "Failed to create material", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error in materials API (POST):", errorMessage, error);
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}

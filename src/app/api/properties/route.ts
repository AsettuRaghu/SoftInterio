import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { CreatePropertyInput } from "@/types/properties";

// GET /api/properties - List properties with filters
export async function GET(request: NextRequest) {
  console.log("[GET /api/properties] Starting request");

  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    console.log("[GET /api/properties] User authenticated:", user!.id);

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error("[GET /api/properties] Error fetching user data:", userError);
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 500 }
      );
    }

    if (!userData?.tenant_id) {
      console.log("[GET /api/properties] User has no tenant");
      return NextResponse.json(
        { error: "User not found or no tenant" },
        { status: 404 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const propertyType = searchParams.get("property_type");
    const status = searchParams.get("status");
    const city = searchParams.get("city");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") || "desc";

    // Build query
    let query = supabase
      .from("properties")
      .select("*", { count: "exact" })
      .eq("tenant_id", userData.tenant_id);

    // Apply filters
    if (category) {
      query = query.eq("category", category);
    }

    if (propertyType) {
      query = query.eq("property_type", propertyType);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    if (search) {
      query = query.or(
        `property_name.ilike.%${search}%,address_line1.ilike.%${search}%,city.ilike.%${search}%,locality.ilike.%${search}%,unit_number.ilike.%${search}%`
      );
    }

    // Apply sorting
    const validSortColumns = [
      "created_at",
      "updated_at",
      "property_name",
      "category",
      "property_type",
      "city",
      "carpet_area",
    ];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "created_at";
    query = query.order(sortColumn, { ascending: sortOrder === "asc" });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: properties, error, count } = await query;

    if (error) {
      console.error("[GET /api/properties] Error fetching properties:", error);
      return NextResponse.json(
        { error: "Failed to fetch properties" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      properties,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/properties] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/properties - Create a new property
export async function POST(request: NextRequest) {
  console.log("[POST /api/properties] Starting request");

  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not found or no tenant" },
        { status: 404 }
      );
    }

    // Parse request body
    const body: CreatePropertyInput = await request.json();

    // Validate required fields
    if (!body.property_name && !body.city) {
      return NextResponse.json(
        { error: "Property name or city is required" },
        { status: 400 }
      );
    }

    // Prepare property data - mapping to database columns (only using CreatePropertyInput fields)
    const propertyData = {
      tenant_id: userData.tenant_id,
      created_by: user.id,

      // Identification
      property_name: body.property_name || null,
      unit_number: body.unit_number || null,

      // Category and Type
      category: body.category || "residential",
      property_type: body.property_type || "apartment",
      property_subtype: body.property_subtype || null,

      // Address
      address_line1: body.address_line1 || null,
      city: body.city || "Unknown",  // city is NOT NULL in database
      pincode: body.pincode || null,

      // Area Details
      carpet_area: body.carpet_area || null,
    };

    // Insert property
    const { data: property, error: insertError } = await supabase
      .from("properties")
      .insert(propertyData)
      .select()
      .single();

    if (insertError) {
      console.error("[POST /api/properties] Error creating property:", insertError);
      return NextResponse.json(
        { error: "Failed to create property" },
        { status: 500 }
      );
    }

    console.log("[POST /api/properties] Property created:", property.id);

    return NextResponse.json(
      { property, message: "Property created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/properties] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { CreateBrandInput, UpdateBrandInput } from "@/types/stock";

// GET /api/stock/brands - List brands with filters
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const isActive = searchParams.get("is_active");
    const isPreferred = searchParams.get("is_preferred");
    const qualityTier = searchParams.get("quality_tier");
    const category = searchParams.get("category");
    const country = searchParams.get("country");
    const sortBy = searchParams.get("sort_by") || "name";
    const sortOrder = searchParams.get("sort_order") || "asc";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase.from("stock_brands").select("*", { count: "exact" });

    // Active filter
    if (isActive !== null) {
      query = query.eq("is_active", isActive === "true");
    }

    // Preferred filter
    if (isPreferred !== null) {
      query = query.eq("is_preferred", isPreferred === "true");
    }

    // Quality tier filter
    if (qualityTier) {
      query = query.eq("quality_tier", qualityTier);
    }

    // Category filter (brands that deal in this category)
    if (category) {
      query = query.contains("categories", [category]);
    }

    // Country filter
    if (country) {
      query = query.ilike("country", `%${country}%`);
    }

    // Search
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,code.ilike.%${search}%,display_name.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    // Sorting
    const ascending = sortOrder === "asc";
    query = query.order(sortBy, { ascending, nullsFirst: false });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: brands, error, count } = await query;

    if (error) {
      console.error("Brands fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      brands: brands || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Brands API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/stock/brands - Create a new brand
export async function POST(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Get user's tenant
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

    const body: CreateBrandInput = await request.json();

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Brand name is required" },
        { status: 400 }
      );
    }

    // Generate code if not provided
    let code = body.code;
    if (!code) {
      // Generate code from name (e.g., "Century Ply" -> "CENTUR")
      const baseCode = body.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .substring(0, 6);

      // Check for uniqueness and add number if needed
      const { data: existing } = await supabase
        .from("stock_brands")
        .select("code")
        .eq("tenant_id", userData.tenant_id)
        .ilike("code", `${baseCode}%`);

      if (existing && existing.length > 0) {
        code = `${baseCode}${existing.length + 1}`;
      } else {
        code = baseCode;
      }
    }

    // Create brand
    const { data: brand, error } = await supabase
      .from("stock_brands")
      .insert({
        tenant_id: userData.tenant_id,
        code,
        name: body.name.trim(),
        display_name: body.display_name?.trim() || null,
        logo_url: body.logo_url?.trim() || null,
        website: body.website?.trim() || null,
        country: body.country?.trim() || "India",
        description: body.description?.trim() || null,
        categories: body.categories || [],
        quality_tier: body.quality_tier || "standard",
        is_preferred: body.is_preferred || false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Brand create error:", error);
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A brand with this code already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ brand }, { status: 201 });
  } catch (error) {
    console.error("Brand create API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/stock/brands - Update a brand
export async function PUT(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const brandId = searchParams.get("id");

    if (!brandId) {
      return NextResponse.json(
        { error: "Brand ID is required" },
        { status: 400 }
      );
    }

    const body: UpdateBrandInput = await request.json();

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.display_name !== undefined)
      updates.display_name = body.display_name?.trim() || null;
    if (body.logo_url !== undefined)
      updates.logo_url = body.logo_url?.trim() || null;
    if (body.website !== undefined)
      updates.website = body.website?.trim() || null;
    if (body.country !== undefined)
      updates.country = body.country?.trim() || null;
    if (body.description !== undefined)
      updates.description = body.description?.trim() || null;
    if (body.categories !== undefined) updates.categories = body.categories;
    if (body.quality_tier !== undefined)
      updates.quality_tier = body.quality_tier;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.is_preferred !== undefined)
      updates.is_preferred = body.is_preferred;

    const { data: brand, error } = await supabase
      .from("stock_brands")
      .update(updates)
      .eq("id", brandId)
      .select()
      .single();

    if (error) {
      console.error("Brand update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ brand });
  } catch (error) {
    console.error("Brand update API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/stock/brands - Delete a brand
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
    const brandId = searchParams.get("id");

    if (!brandId) {
      return NextResponse.json(
        { error: "Brand ID is required" },
        { status: 400 }
      );
    }

    // Check if brand is used by any materials
    const { data: materials } = await supabase
      .from("stock_materials")
      .select("id")
      .eq("brand_id", brandId)
      .limit(1);

    if (materials && materials.length > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete brand that is assigned to materials. Please remove the brand from all materials first.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("stock_brands")
      .delete()
      .eq("id", brandId);

    if (error) {
      console.error("Brand delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Brand delete API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

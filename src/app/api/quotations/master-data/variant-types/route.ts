import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/quotations/master-data/variant-types - Get variant types, optionally filtered by component
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const componentTypeId = searchParams.get("component_type_id");

    let query = supabase
      .from("component_variant_types")
      .select(
        `
        *,
        component_type:component_types(id, name, slug)
      `
      )
      .eq("tenant_id", user!.tenantId)
      .eq("is_active", true);

    // Filter by component type if provided
    if (componentTypeId) {
      query = query.eq("component_type_id", componentTypeId);
    }

    query = query.order("display_order", { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching variant types:", error);
      return NextResponse.json(
        { error: "Failed to fetch variant types" },
        { status: 500 }
      );
    }

    return NextResponse.json({ variant_types: data || [] });
  } catch (error) {
    console.error("Variant types API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/quotations/master-data/variant-types - Create a new variant type
export async function POST(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const body = await request.json();

    const {
      component_type_id,
      name,
      slug,
      description,
      cost_config,
      default_width,
      default_height,
      default_depth,
      base_rate_per_sqft,
      quality_tier,
    } = body;

    if (!component_type_id || !name) {
      return NextResponse.json(
        { error: "component_type_id and name are required" },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    const generatedSlug =
      slug ||
      name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

    const { data, error } = await supabase
      .from("component_variant_types")
      .insert({
        tenant_id: user!.tenantId,
        component_type_id,
        name,
        slug: generatedSlug,
        description,
        cost_config: cost_config || { attributes: [] },
        default_width,
        default_height,
        default_depth,
        base_rate_per_sqft,
        quality_tier: quality_tier || "standard",
        is_active: true,
        is_system: false,
      })
      .select(
        `
        *,
        component_type:component_types(id, name, slug)
      `
      )
      .single();

    if (error) {
      console.error("Error creating variant type:", error);
      return NextResponse.json(
        { error: "Failed to create variant type" },
        { status: 500 }
      );
    }

    return NextResponse.json({ variant_type: data }, { status: 201 });
  } catch (error) {
    console.error("Create variant type error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

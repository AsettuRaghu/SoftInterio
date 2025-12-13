import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { UpdatePropertyInput } from "@/types/properties";

// GET /api/properties/[id] - Get a single property
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log("[GET /api/properties/:id] Starting request for:", id);

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

    // Fetch property
    const { data: property, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (error) {
      console.error("[GET /api/properties/:id] Error fetching property:", error);
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Property not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch property" },
        { status: 500 }
      );
    }

    return NextResponse.json({ property });
  } catch (error) {
    console.error("[GET /api/properties/:id] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/properties/[id] - Update a property
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log("[PUT /api/properties/:id] Starting request for:", id);

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

    // Check property exists and belongs to tenant
    const { data: existing, error: checkError } = await supabase
      .from("properties")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    // Parse request body
    const body: UpdatePropertyInput = await request.json();

    // Prepare update data (no updated_by column in properties table)
    const updateData = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    // Update property
    const { data: property, error: updateError } = await supabase
      .from("properties")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .select()
      .single();

    if (updateError) {
      console.error("[PUT /api/properties/:id] Error updating property:", updateError);
      return NextResponse.json(
        { error: "Failed to update property" },
        { status: 500 }
      );
    }

    console.log("[PUT /api/properties/:id] Property updated:", property.id);

    return NextResponse.json({
      property,
      message: "Property updated successfully",
    });
  } catch (error) {
    console.error("[PUT /api/properties/:id] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/properties/[id] - Delete a property
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log("[DELETE /api/properties/:id] Starting request for:", id);

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

    // Check if property is linked to any leads
    const { data: linkedLeads, error: linkCheckError } = await supabase
      .from("leads")
      .select("id")
      .eq("property_id", id)
      .limit(1);

    if (linkCheckError) {
      console.error("[DELETE /api/properties/:id] Error checking links:", linkCheckError);
      return NextResponse.json(
        { error: "Failed to check property links" },
        { status: 500 }
      );
    }

    if (linkedLeads && linkedLeads.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete property that is linked to leads. Remove the links first." },
        { status: 400 }
      );
    }

    // Delete property
    const { error: deleteError } = await supabase
      .from("properties")
      .delete()
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id);

    if (deleteError) {
      console.error("[DELETE /api/properties/:id] Error deleting property:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete property" },
        { status: 500 }
      );
    }

    console.log("[DELETE /api/properties/:id] Property deleted:", id);

    return NextResponse.json({
      message: "Property deleted successfully",
    });
  } catch (error) {
    console.error("[DELETE /api/properties/:id] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

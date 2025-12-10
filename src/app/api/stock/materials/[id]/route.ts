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

    const { data: material, error } = await supabase
      .from("stock_materials")
      .select(
        `
        *,
        preferred_vendor:stock_vendors!preferred_vendor_id(
          id,
          name,
          code,
          email,
          phone
        )
      `
      )
      .eq("id", id)
      .eq("company_id", userData.tenant_id)
      .single();

    if (error) {
      console.error("Error fetching material:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        { error: "Material not found", details: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(material);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error in material API:", errorMessage, error);
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
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
    console.log(
      `[material-update] Received update for material ${id}:`,
      Object.keys(body)
    );

    // If SKU is being changed, check for duplicates
    if (body.sku) {
      const { data: existingMaterial } = await supabase
        .from("stock_materials")
        .select("id")
        .eq("company_id", userData.tenant_id)
        .eq("sku", body.sku)
        .neq("id", id)
        .single();

      if (existingMaterial) {
        return NextResponse.json(
          { error: "A material with this SKU already exists" },
          { status: 400 }
        );
      }
    }

    // Define allowed fields that exist in the stock_materials table
    // This prevents errors from unknown columns
    const allowedFields = [
      "name",
      "sku",
      "description",
      "category",
      "item_type",
      "unit_of_measure",
      "current_quantity",
      "minimum_quantity",
      "reorder_quantity",
      "unit_cost",
      "selling_price",
      "preferred_vendor_id",
      "storage_location",
      "notes",
      "is_active",
    ];

    // Optional fields that may not exist if migrations weren't run
    const optionalFields = ["brand_id", "specifications"];

    // Build update object with only allowed fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    // Try to include optional fields - they may fail if columns don't exist
    for (const field of optionalFields) {
      if (field in body && body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    console.log(
      `[material-update] Updating with fields:`,
      Object.keys(updateData)
    );

    const { data: material, error } = await supabase
      .from("stock_materials")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", userData.tenant_id)
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
      console.error("[material-update] Error updating material:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      // Check if error is about unknown column
      if (error.message?.includes("column") || error.code === "42703") {
        // Retry without optional fields
        console.log("[material-update] Retrying without optional fields...");
        const basicUpdateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        for (const field of allowedFields) {
          if (field in body) {
            basicUpdateData[field] = body[field];
          }
        }

        const { data: retryMaterial, error: retryError } = await supabase
          .from("stock_materials")
          .update(basicUpdateData)
          .eq("id", id)
          .eq("company_id", userData.tenant_id)
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

        if (retryError) {
          console.error("[material-update] Retry also failed:", retryError);
          return NextResponse.json(
            { error: "Failed to update material", details: retryError.message },
            { status: 500 }
          );
        }

        console.log(
          "[material-update] Retry successful (without brand_id/specifications)"
        );
        return NextResponse.json(retryMaterial);
      }

      return NextResponse.json(
        { error: "Failed to update material", details: error.message },
        { status: 500 }
      );
    }

    console.log("[material-update] Update successful");
    return NextResponse.json(material);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[material-update] Unhandled error:", errorMessage, error);
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
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

    // Check if material is used in any PO items or stock movements
    const { data: poItems } = await supabase
      .from("stock_po_items")
      .select("id")
      .eq("material_id", id)
      .limit(1);

    if (poItems && poItems.length > 0) {
      // Soft delete by marking as inactive
      const { error } = await supabase
        .from("stock_materials")
        .update({ is_active: false })
        .eq("id", id)
        .eq("company_id", userData.tenant_id);

      if (error) {
        console.error("Error deactivating material:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        message: "Material deactivated (has related records)",
      });
    }

    // Hard delete if no related records
    const { error } = await supabase
      .from("stock_materials")
      .delete()
      .eq("id", id)
      .eq("company_id", userData.tenant_id);

    if (error) {
      console.error("Error deleting material:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Material deleted successfully" });
  } catch (error) {
    console.error("Error in material API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

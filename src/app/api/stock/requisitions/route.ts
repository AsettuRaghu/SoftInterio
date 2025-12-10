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
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const priority = searchParams.get("priority") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build the query
    let query = supabase
      .from("stock_material_requisitions")
      .select(
        `
        *,
        requested_by_user:users!stock_material_requisitions_requested_by_fkey(
          id,
          name,
          email
        ),
        approved_by_user:users!stock_material_requisitions_approved_by_fkey(
          id,
          name,
          email
        ),
        project:projects!stock_material_requisitions_project_id_fkey(
          id,
          name
        ),
        items:stock_mr_items(
          id,
          material_id,
          quantity_requested,
          quantity_approved,
          notes,
          material:stock_materials(
            id,
            name,
            sku,
            unit_of_measure
          )
        )
      `,
        { count: "exact" }
      )
      .eq("tenant_id", userData.tenant_id)
      .order("created_at", { ascending: false });

    // Apply filters
    if (search) {
      query = query.ilike("mr_number", `%${search}%`);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (priority) {
      query = query.eq("priority", priority);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: requisitions, error, count } = await query;

    if (error) {
      console.error("Error fetching requisitions:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      requisitions: requisitions || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in requisitions API:", error);
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
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

    // Generate MR number
    const { data: lastMR } = await supabase
      .from("stock_material_requisitions")
      .select("mr_number")
      .eq("tenant_id", userData.tenant_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    if (lastMR?.mr_number) {
      const match = lastMR.mr_number.match(/MR-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const mrNumber = `MR-${nextNumber.toString().padStart(5, "0")}`;

    // Create the requisition
    const { data: requisition, error } = await supabase
      .from("stock_material_requisitions")
      .insert({
        tenant_id: userData.tenant_id,
        mr_number: mrNumber,
        project_id: body.project_id,
        requested_by: user.id,
        required_date: body.required_date,
        priority: body.priority || "normal",
        status: "draft",
        notes: body.notes,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating requisition:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Insert items
    const items = body.items.map((item: any) => ({
      requisition_id: requisition.id,
      material_id: item.material_id,
      quantity_requested: item.quantity_requested,
      notes: item.notes,
    }));

    const { error: itemsError } = await supabase
      .from("stock_mr_items")
      .insert(items);

    if (itemsError) {
      console.error("Error creating MR items:", itemsError);
      // Rollback the requisition
      await supabase
        .from("stock_material_requisitions")
        .delete()
        .eq("id", requisition.id);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json(requisition, { status: 201 });
  } catch (error) {
    console.error("Error in requisitions API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

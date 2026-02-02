import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { UpdateClientInput } from "@/types/clients";

// GET /api/clients/[id] - Get a single client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log("[GET /api/clients/:id] Starting request for:", id);

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

    // Fetch client with details view if available
    const { data: client, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (error) {
      console.error("[GET /api/clients/:id] Error fetching client:", error);
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch client" },
        { status: 500 }
      );
    }

    // Get additional stats
    const { data: leadStats } = await supabase
      .from("leads")
      .select("id, stage, won_amount")
      .eq("client_id", id)
      .eq("tenant_id", userData.tenant_id);

    const stats = {
      lead_count: leadStats?.length || 0,
      won_lead_count: leadStats?.filter((l) => l.stage === "won").length || 0,
      total_business_value:
        leadStats
          ?.filter((l) => l.stage === "won")
          .reduce((sum, l) => sum + (l.won_amount || 0), 0) || 0,
    };

    return NextResponse.json({ client: { ...client, ...stats } });
  } catch (error) {
    console.error("[GET /api/clients/:id] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/clients/[id] - Update a client
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log("[PUT /api/clients/:id] Starting request for:", id);

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

    // Check client exists and belongs to tenant
    const { data: existing, error: checkError } = await supabase
      .from("clients")
      .select("id, phone")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Parse request body
    const body: UpdateClientInput = await request.json();

    // Check for duplicate phone if phone is being changed
    if (body.phone && body.phone !== existing.phone) {
      const { data: duplicateClient, error: duplicateError } = await supabase
        .from("clients")
        .select("id, name")
        .eq("tenant_id", userData.tenant_id)
        .eq("phone", body.phone)
        .neq("id", id)
        .maybeSingle();

      if (duplicateError) {
        console.error("[PUT /api/clients/:id] Error checking duplicate:", duplicateError);
      }

      if (duplicateClient) {
        return NextResponse.json(
          {
            error: `A client with this phone number already exists: ${duplicateClient.name}`,
            existingClientId: duplicateClient.id,
          },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const updateData = {
      ...body,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    // Update client
    const { data: client, error: updateError } = await supabase
      .from("clients")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .select()
      .single();

    if (updateError) {
      console.error("[PUT /api/clients/:id] Error updating client:", updateError);
      return NextResponse.json(
        { error: "Failed to update client" },
        { status: 500 }
      );
    }

    console.log("[PUT /api/clients/:id] Client updated:", client.id);

    return NextResponse.json({
      client,
      message: "Client updated successfully",
    });
  } catch (error) {
    console.error("[PUT /api/clients/:id] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/[id] - Delete a client
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log("[DELETE /api/clients/:id] Starting request for:", id);

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

    // Check if client is linked to any leads
    const { data: linkedLeads, error: linkCheckError } = await supabase
      .from("leads")
      .select("id")
      .eq("client_id", id)
      .limit(1);

    if (linkCheckError) {
      console.error("[DELETE /api/clients/:id] Error checking links:", linkCheckError);
      return NextResponse.json(
        { error: "Failed to check client links" },
        { status: 500 }
      );
    }

    if (linkedLeads && linkedLeads.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete client that is linked to leads. Remove the links first." },
        { status: 400 }
      );
    }

    // Delete client
    const { error: deleteError } = await supabase
      .from("clients")
      .delete()
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id);

    if (deleteError) {
      console.error("[DELETE /api/clients/:id] Error deleting client:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete client" },
        { status: 500 }
      );
    }

    console.log("[DELETE /api/clients/:id] Client deleted:", id);

    return NextResponse.json({
      message: "Client deleted successfully",
    });
  } catch (error) {
    console.error("[DELETE /api/clients/:id] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

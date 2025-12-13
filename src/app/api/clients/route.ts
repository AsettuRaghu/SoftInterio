import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { CreateClientInput } from "@/types/clients";

// GET /api/clients - List clients with filters
export async function GET(request: NextRequest) {
  console.log("[GET /api/clients] Starting request");

  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    console.log("[GET /api/clients] User authenticated:", user!.id);

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error("[GET /api/clients] Error fetching user data:", userError);
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 500 }
      );
    }

    if (!userData?.tenant_id) {
      console.log("[GET /api/clients] User has no tenant");
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
    const clientType = searchParams.get("client_type");
    const status = searchParams.get("status");
    const city = searchParams.get("city");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") || "desc";

    // Build query
    let query = supabase
      .from("clients")
      .select("*", { count: "exact" })
      .eq("tenant_id", userData.tenant_id);

    // Apply filters
    if (clientType) {
      query = query.eq("client_type", clientType);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,display_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`
      );
    }

    // Apply sorting
    const validSortColumns = [
      "created_at",
      "updated_at",
      "name",
      "client_type",
      "status",
      "city",
    ];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "created_at";
    query = query.order(sortColumn, { ascending: sortOrder === "asc" });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: clients, error, count } = await query;

    if (error) {
      console.error("[GET /api/clients] Error fetching clients:", error);
      return NextResponse.json(
        { error: "Failed to fetch clients" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clients,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/clients] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create a new client
export async function POST(request: NextRequest) {
  console.log("[POST /api/clients] Starting request");

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
    const body: CreateClientInput = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }

    if (!body.phone) {
      return NextResponse.json(
        { error: "Client phone is required" },
        { status: 400 }
      );
    }

    // Check for duplicate phone number
    const { data: existingClient, error: duplicateError } = await supabase
      .from("clients")
      .select("id, name")
      .eq("tenant_id", userData.tenant_id)
      .eq("phone", body.phone)
      .maybeSingle();

    if (duplicateError) {
      console.error("[POST /api/clients] Error checking duplicate:", duplicateError);
    }

    if (existingClient) {
      return NextResponse.json(
        { 
          error: `A client with this phone number already exists: ${existingClient.name}`,
          existingClientId: existingClient.id 
        },
        { status: 409 }
      );
    }

    // Prepare client data
    const clientData = {
      tenant_id: userData.tenant_id,
      created_by: user.id,
      updated_by: user.id,

      // Required fields
      name: body.name,
      phone: body.phone,

      // Type and Status
      client_type: body.client_type || "individual",
      status: body.status || "active",

      // Contact Info
      display_name: body.display_name || null,
      phone_secondary: body.phone_secondary || null,
      email: body.email || null,
      email_secondary: body.email_secondary || null,

      // Company Details
      company_name: body.company_name || null,
      gst_number: body.gst_number || null,
      pan_number: body.pan_number || null,

      // Contact Person
      contact_person_name: body.contact_person_name || null,
      contact_person_phone: body.contact_person_phone || null,
      contact_person_email: body.contact_person_email || null,
      contact_person_designation: body.contact_person_designation || null,

      // Address
      address_line1: body.address_line1 || null,
      address_line2: body.address_line2 || null,
      landmark: body.landmark || null,
      locality: body.locality || null,
      city: body.city || null,
      state: body.state || null,
      pincode: body.pincode || null,
      country: body.country || "India",

      // Additional Info
      date_of_birth: body.date_of_birth || null,
      anniversary_date: body.anniversary_date || null,
      occupation: body.occupation || null,
      company_industry: body.company_industry || null,

      // Referral
      referred_by_client_id: body.referred_by_client_id || null,
      referral_source: body.referral_source || null,
      referral_notes: body.referral_notes || null,

      // Preferences
      preferred_contact_method: body.preferred_contact_method || null,
      preferred_contact_time: body.preferred_contact_time || null,
      communication_language: body.communication_language || "English",

      // Notes
      notes: body.notes || null,
      internal_notes: body.internal_notes || null,

      // Tags
      tags: body.tags || [],
    };

    // Insert client
    const { data: client, error: insertError } = await supabase
      .from("clients")
      .insert(clientData)
      .select()
      .single();

    if (insertError) {
      console.error("[POST /api/clients] Error creating client:", insertError);
      return NextResponse.json(
        { error: "Failed to create client" },
        { status: 500 }
      );
    }

    console.log("[POST /api/clients] Client created:", client.id);

    return NextResponse.json(
      { client, message: "Client created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/clients] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/projects - List projects
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const is_active = searchParams.get("is_active");

    let query = supabase
      .from("projects")
      .select("*", { count: "exact" })
      .eq("tenant_id", userData.tenant_id)
      .order("created_at", { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(
        `project_number.ilike.%${search}%,name.ilike.%${search}%,client_name.ilike.%${search}%`
      );
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (is_active !== null && is_active !== "") {
      query = query.eq("is_active", is_active === "true");
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: projects, error, count } = await query;

    if (error) {
      console.error("Error fetching projects:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      projects,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Projects API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const body = await request.json();
    const {
      name,
      description,
      client_name,
      client_email,
      client_phone,
      site_address,
      city,
      state,
      pincode,
      project_type,
      start_date,
      expected_end_date,
      quoted_amount,
      budget_amount,
      project_manager_id,
      notes,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    // Generate project number
    const { data: projectNumber } = await supabase.rpc(
      "generate_project_number",
      { p_tenant_id: userData.tenant_id }
    );

    // Create project
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        tenant_id: userData.tenant_id,
        project_number: projectNumber || `PRJ-${Date.now()}`,
        name,
        description,
        client_name,
        client_email,
        client_phone,
        site_address,
        city,
        state,
        pincode,
        project_type: project_type || "residential",
        start_date,
        expected_end_date,
        quoted_amount: quoted_amount || 0,
        budget_amount: budget_amount || 0,
        project_manager_id,
        notes,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating project:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Projects API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

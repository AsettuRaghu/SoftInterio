import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/tasks/tags - List task tags
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const { data: tags, error } = await supabase
      .from("task_tags")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching tags:", error);
      return NextResponse.json(
        { error: "Failed to fetch tags" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tags: tags || [] });
  } catch (error) {
    console.error("List tags API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/tasks/tags - Create a new tag
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

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    // Get user's tenant
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User tenant not found" },
        { status: 404 }
      );
    }

    const { data: tag, error: createError } = await supabase
      .from("task_tags")
      .insert({
        tenant_id: userData.tenant_id,
        name: body.name.trim(),
        color: body.color || "#6B7280",
        description: body.description?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating tag:", createError);
      if (createError.code === "23505") {
        return NextResponse.json(
          { error: "A tag with this name already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create tag" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    console.error("Create tag API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CreateTaskTemplateInput } from "@/types/tasks";

// GET /api/tasks/templates - List task templates
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("active_only") !== "false";
    const search = searchParams.get("search");

    let query = supabase
      .from("task_templates")
      .select(
        `
        *,
        created_user:users!task_templates_created_by_fkey(id, name),
        items:task_template_items(count)
      `
      )
      .order("name", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error("Error fetching templates:", error);
      return NextResponse.json(
        { error: "Failed to fetch templates" },
        { status: 500 }
      );
    }

    // Get item counts
    const templatesWithCounts = await Promise.all(
      (templates || []).map(async (template) => {
        const { count } = await supabase
          .from("task_template_items")
          .select("*", { count: "exact", head: true })
          .eq("template_id", template.id);

        return {
          ...template,
          item_count: count || 0,
          created_by_name: template.created_user?.name,
        };
      })
    );

    return NextResponse.json({ templates: templatesWithCounts });
  } catch (error) {
    console.error("List templates API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/tasks/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateTaskTemplateInput = await request.json();

    // Validate
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Template name is required" },
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

    // Create template
    const { data: template, error: createError } = await supabase
      .from("task_templates")
      .insert({
        tenant_id: userData.tenant_id,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        category: body.category || "general",
        default_priority: body.default_priority || "medium",
        is_protected: body.is_protected || false,
        is_active: true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating template:", createError);
      if (createError.code === "23505") {
        return NextResponse.json(
          { error: "A template with this name already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create template" },
        { status: 500 }
      );
    }

    // Create template items if provided
    if (body.items && body.items.length > 0) {
      await createTemplateItems(supabase, template.id, body.items, null);
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Create template API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper to recursively create template items
async function createTemplateItems(
  supabase: any,
  templateId: string,
  items: any[],
  parentItemId: string | null,
  sortOrderStart: number = 0
) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { data: createdItem } = await supabase
      .from("task_template_items")
      .insert({
        template_id: templateId,
        parent_item_id: parentItemId,
        title: item.title,
        description: item.description || null,
        priority: item.priority || "medium",
        relative_due_days: item.relative_due_days || null,
        estimated_hours: item.estimated_hours || null,
        assign_to_role: item.assign_to_role || null,
        assign_to_user_id: item.assign_to_user_id || null,
        sort_order: sortOrderStart + i,
      })
      .select()
      .single();

    // Recursively create children
    if (item.children && item.children.length > 0 && createdItem) {
      await createTemplateItems(
        supabase,
        templateId,
        item.children,
        createdItem.id,
        0
      );
    }
  }
}

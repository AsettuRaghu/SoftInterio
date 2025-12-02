import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UpdateTaskTemplateInput } from "@/types/tasks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/tasks/templates/[id] - Get single template with items
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get template
    const { data: template, error: templateError } = await supabase
      .from("task_templates")
      .select(
        `
        *,
        created_user:users!task_templates_created_by_fkey(id, name)
      `
      )
      .eq("id", id)
      .single();

    if (templateError) {
      if (templateError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching template:", templateError);
      return NextResponse.json(
        { error: "Failed to fetch template" },
        { status: 500 }
      );
    }

    // Get template items
    const { data: items } = await supabase
      .from("task_template_items")
      .select(
        `
        *,
        assigned_user:users(id, name)
      `
      )
      .eq("template_id", id)
      .order("sort_order", { ascending: true });

    // Organize items into hierarchy
    const itemMap = new Map();
    const rootItems: any[] = [];

    (items || []).forEach((item) => {
      itemMap.set(item.id, { ...item, children: [] });
    });

    (items || []).forEach((item) => {
      const mappedItem = itemMap.get(item.id);
      if (item.parent_item_id && itemMap.has(item.parent_item_id)) {
        itemMap.get(item.parent_item_id).children.push(mappedItem);
      } else {
        rootItems.push(mappedItem);
      }
    });

    return NextResponse.json({
      template: {
        ...template,
        created_by_name: template.created_user?.name,
        items: rootItems,
        item_count: items?.length || 0,
      },
    });
  } catch (error) {
    console.error("Get template API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/templates/[id] - Update template
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: UpdateTaskTemplateInput = await request.json();

    // Check template exists
    const { data: existingTemplate, error: fetchError } = await supabase
      .from("task_templates")
      .select("id, is_protected")
      .eq("id", id)
      .single();

    if (fetchError || !existingTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_by: user.id,
    };

    const allowedFields = [
      "name",
      "description",
      "category",
      "default_priority",
      "is_active",
      "is_protected",
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field as keyof UpdateTaskTemplateInput];
      }
    }

    // Update template
    const { data: template, error: updateError } = await supabase
      .from("task_templates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating template:", updateError);
      if (updateError.code === "23505") {
        return NextResponse.json(
          { error: "A template with this name already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Update template API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/templates/[id] - Delete template
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check template exists
    const { data: existingTemplate, error: fetchError } = await supabase
      .from("task_templates")
      .select("id, is_protected")
      .eq("id", id)
      .single();

    if (fetchError || !existingTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Delete template (cascade will handle items)
    const { error: deleteError } = await supabase
      .from("task_templates")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting template:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete template API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/debug/phase-templates - Check what phase templates exist (DEV ONLY)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    // Check phase categories
    const { data: categories, error: catError } = await supabase
      .from("project_phase_categories")
      .select("*")
      .order("display_order");

    // Check phase templates
    const { data: templates, error: tmpError } = await supabase
      .from("project_phase_templates")
      .select(
        `
        *,
        category:project_phase_categories(name, code)
      `
      )
      .order("display_order");

    // Check sub-phase templates
    const { data: subTemplates, error: subError } = await supabase
      .from("project_sub_phase_templates")
      .select("*")
      .limit(50);

    // Check dependency templates
    const { data: depTemplates, error: depError } = await supabase
      .from("project_phase_dependency_templates")
      .select("*")
      .limit(20);

    return NextResponse.json({
      tenant_id: userData?.tenant_id,
      phase_categories: {
        count: categories?.length || 0,
        data: categories,
        error: catError?.message,
      },
      phase_templates: {
        count: templates?.length || 0,
        data: templates,
        error: tmpError?.message,
      },
      sub_phase_templates: {
        count: subTemplates?.length || 0,
        sample: subTemplates?.slice(0, 10),
        error: subError?.message,
      },
      dependency_templates: {
        count: depTemplates?.length || 0,
        data: depTemplates,
        error: depError?.message,
      },
    });
  } catch (error) {
    console.error("Debug API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/debug/check-function - Check if RPC function exists
export async function GET() {
  try {
    const supabase = await createClient();

    // Try to check if function exists by querying pg_proc
    const { data, error } = await supabase.rpc("initialize_project_phases_v2", {
      p_project_id: "00000000-0000-0000-0000-000000000000",
      p_tenant_id: "00000000-0000-0000-0000-000000000000",
      p_project_category: "test",
    });

    if (error) {
      return NextResponse.json({
        functionExists: false,
        error: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
        solution:
          "Run migration 042_initialize_phases_v2.sql in Supabase SQL Editor",
      });
    }

    return NextResponse.json({
      functionExists: true,
      result: data,
    });
  } catch (error) {
    return NextResponse.json({
      error: "Exception",
      details: error instanceof Error ? error.message : "Unknown",
    });
  }
}

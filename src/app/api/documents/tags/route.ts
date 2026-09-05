import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

/**
 * GET /api/documents/tags
 *
 * Every tag already used anywhere in the tenant, most-used first.
 *
 * Document tags are free text in a text[] column rather than rows in a table,
 * which keeps them cheap but means nothing stops "site photo", "site-photo" and
 * "sitephoto" existing side by side. Offering what already exists as the user
 * types is what prevents that, so this list is the whole reason tagging stays
 * usable past the first month.
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("documents")
      .select("tags")
      .eq("tenant_id", user.tenantId)
      .not("tags", "is", null);

    if (error) {
      console.error("Error loading document tags:", error);
      return NextResponse.json(
        { error: "Failed to load tags" },
        { status: 500 }
      );
    }

    // Counted rather than merely de-duplicated: the tags a team actually uses
    // should surface above one-offs someone typed once.
    const counts = new Map<string, number>();
    for (const row of data || []) {
      for (const tag of (row.tags as string[] | null) || []) {
        const clean = tag.trim();
        if (clean) counts.set(clean, (counts.get(clean) || 0) + 1);
      }
    }

    const tags = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Document tags GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

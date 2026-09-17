/**
 * A project's photos, for bringing into the library from inside it.
 *
 *   GET /api/library/project-photos?project_id=   images on the project or
 *       its tasks, with signed URLs and whether each is already in the library
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const projectId = request.nextUrl.searchParams.get("project_id") || "";
  if (!projectId) return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("documents")
    .select("id, original_name, title, file_type, storage_path, created_at, tags, linked_type, linked_id, parent_linked_type, parent_linked_id")
    .or(`and(linked_type.eq.project,linked_id.eq.${projectId}),and(parent_linked_type.eq.project,parent_linked_id.eq.${projectId})`)
    .like("file_type", "image/%")
    .order("created_at", { ascending: false });
  const ids = (docs ?? []).map((d) => d.id);
  const { data: used } = ids.length ? await supabase.from("library_entry_images").select("document_id").in("document_id", ids) : { data: [] };
  const inLibrary = new Set((used ?? []).map((u: any) => u.document_id));
  const admin = createAdminClient();
  const { data: signed } = ids.length ? await admin.storage.from("documents").createSignedUrls((docs ?? []).map((d) => d.storage_path), 3600) : { data: [] };
  const urlByPath = new Map((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl]));
  return NextResponse.json({
    success: true,
    data: (docs ?? []).map((d) => ({
      id: d.id,
      name: d.title || d.original_name,
      url: urlByPath.get(d.storage_path) ?? null,
      tags: d.tags ?? [],
      created_at: d.created_at,
      in_library: inLibrary.has(d.id),
    })),
  });
}

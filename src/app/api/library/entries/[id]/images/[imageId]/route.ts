/** DELETE /api/library/entries/:id/images/:imageId - the last image cannot go; delete the entry instead. */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id, imageId } = await params;
  const supabase = await createClient();
  const { data: images } = await supabase.from("library_entry_images").select("id, storage_path, document_id").eq("entry_id", id);
  const target = (images ?? []).find((i) => i.id === imageId);
  if (!target) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  if ((images ?? []).length <= 1) return NextResponse.json({ error: "An entry keeps at least one image. Delete the entry instead." }, { status: 409 });
  if (!target.document_id) await createAdminClient().storage.from("documents").remove([target.storage_path]);
  await supabase.from("library_entry_images").delete().eq("id", imageId);
  return NextResponse.json({ success: true });
}

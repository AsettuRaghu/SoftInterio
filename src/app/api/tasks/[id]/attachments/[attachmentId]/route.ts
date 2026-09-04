/**
 * DELETE /api/tasks/[id]/attachments/[attachmentId]
 *
 * Removes the storage object and the row. The row goes last: if the object
 * delete fails we stop, because a row without its file is recoverable
 * (re-upload) while a file with no row is invisible and bills against the
 * tenant's quota forever.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string; attachmentId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id, attachmentId } = await params;
    const supabase = await createClient();

    // RLS scopes this to the caller's tenant, so a miss is "not found or not
    // yours" - both answer 404.
    const { data: attachment } = await supabase
      .from("documents")
      .select("id, original_name, storage_bucket, storage_path")
      .eq("id", attachmentId)
      .eq("linked_type", "task")
      .eq("linked_id", id)
      .maybeSingle();

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    const admin = createAdminClient();

    if (attachment.storage_path) {
      const { error: storageError } = await admin.storage
        .from(attachment.storage_bucket || "documents")
        .remove([attachment.storage_path]);

      if (storageError) {
        console.error("Failed to remove stored file:", storageError);
        return NextResponse.json(
          { error: "Failed to delete the file" },
          { status: 500 }
        );
      }
    }

    const { error: dbError } = await admin
      .from("documents")
      .delete()
      .eq("id", attachmentId);

    if (dbError) {
      console.error("Failed to delete attachment row:", dbError);
      return NextResponse.json(
        { error: "Failed to delete the attachment" },
        { status: 500 }
      );
    }

    // storage_used_bytes is corrected by the trigger on documents.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Task attachment DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

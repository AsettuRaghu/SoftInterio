import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

/**
 * Upload a cover image for a print format.
 *
 * Returns the storage path, not a URL. The only bucket is private, so its URLs
 * are signed and short-lived - storing one on the format would leave a broken
 * cover within the hour. The path is stable and gets signed on demand.
 */

const STORAGE_BUCKET = "documents";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export async function POST(request: NextRequest) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: "Cover must be a PNG, JPG or WebP image" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Cover image must be under 10MB" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    // Tenant-scoped path, matching how documents are laid out.
    const path = `${user.tenantId}/print-covers/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Cover upload failed:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload cover image" },
        { status: 500 }
      );
    }

    const { data: signed } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 3600);

    return NextResponse.json({
      path,
      preview_url: signed?.signedUrl || null,
    });
  } catch (error) {
    console.error("Cover upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

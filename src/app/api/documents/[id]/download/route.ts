import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

const STORAGE_BUCKET = "documents";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/documents/[id]/download - Get download URL for a document
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // Get user's tenant
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get document
    // Note: Using 'as any' until database types are regenerated after running migration 033
    const { data: document, error } = await supabaseAdmin
      .from("documents" as any)
      .select("storage_path, original_name")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (error || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Generate signed download URL with content-disposition header
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(document.storage_path, 3600, {
        download: document.original_name, // This sets content-disposition for download
      });

    if (urlError || !urlData?.signedUrl) {
      console.error("Error creating signed URL:", urlError);
      return NextResponse.json(
        { error: "Failed to generate download URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      download_url: urlData.signedUrl,
      file_name: document.original_name,
    });
  } catch (error) {
    console.error("Error in GET /api/documents/[id]/download:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

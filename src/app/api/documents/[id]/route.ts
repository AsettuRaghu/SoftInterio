import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { DocumentCategory, UpdateDocumentInput } from "@/types/documents";

const STORAGE_BUCKET = "documents";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/documents/[id] - Get single document with signed URL
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
      .select(
        `
        *,
        uploaded_user:users!documents_uploaded_by_fkey(id, name, avatar_url)
      `
      )
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (error || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Generate signed URL
    const { data: urlData } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(document.storage_path, 3600);

    return NextResponse.json({
      document: {
        ...document,
        signed_url: urlData?.signedUrl || null,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/documents/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/documents/[id] - Update document metadata
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    // Parse body
    const body = await request.json();
    const updateData: UpdateDocumentInput = {};

    if (body.category !== undefined) {
      updateData.category = body.category as DocumentCategory;
    }
    if (body.title !== undefined) {
      updateData.title = body.title;
    }
    if (body.description !== undefined) {
      updateData.description = body.description;
    }
    if (body.tags !== undefined) {
      updateData.tags = body.tags;
    }

    // Update document
    // Note: Using 'as any' until database types are regenerated after running migration 033
    const { data: document, error } = await supabaseAdmin
      .from("documents" as any)
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .select(
        `
        *,
        uploaded_user:users!documents_uploaded_by_fkey(id, name, avatar_url)
      `
      )
      .single();

    if (error) {
      console.error("Error updating document:", error);
      return NextResponse.json(
        { error: "Failed to update document" },
        { status: 500 }
      );
    }

    // Generate signed URL
    const { data: urlData } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(document.storage_path, 3600);

    return NextResponse.json({
      document: {
        ...document,
        signed_url: urlData?.signedUrl || null,
      },
    });
  } catch (error) {
    console.error("Error in PATCH /api/documents/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/[id] - Delete document
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Get document first to get storage path
    // Note: Using 'as any' until database types are regenerated after running migration 033
    const { data: document, error: fetchError } = await supabaseAdmin
      .from("documents" as any)
      .select("storage_path")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete from storage
    const { error: storageError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove([document.storage_path]);

    if (storageError) {
      console.error("Error deleting from storage:", storageError);
      // Continue to delete DB record even if storage deletion fails
    }

    // Delete from database
    // Note: Using 'as any' until database types are regenerated after running migration 033
    const { error: dbError } = await supabaseAdmin
      .from("documents" as any)
      .delete()
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id);

    if (dbError) {
      console.error("Error deleting document record:", dbError);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/documents/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

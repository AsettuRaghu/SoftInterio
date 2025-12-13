import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type {
  DocumentLinkedType,
  DocumentCategory,
} from "@/types/documents";

const STORAGE_BUCKET = "documents";

// GET /api/documents - List documents with filters
export async function GET(request: NextRequest) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
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

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const linkedType = searchParams.get("linked_type") as DocumentLinkedType | null;
    const linkedId = searchParams.get("linked_id");
    const category = searchParams.get("category") as DocumentCategory | null;
    const searchQuery = searchParams.get("search");

    // Build query
    // Note: Using 'as any' until database types are regenerated after running migration 033
    let query = supabaseAdmin
      .from("documents" as any)
      .select(
        `
        *,
        uploaded_user:users!documents_uploaded_by_fkey(id, name, avatar_url)
      `
      )
      .eq("tenant_id", userData.tenant_id)
      .eq("is_latest", true)
      .order("created_at", { ascending: false });

    // Apply filters
    if (linkedType) {
      query = query.eq("linked_type", linkedType);
    }
    if (linkedId) {
      query = query.eq("linked_id", linkedId);
    }
    if (category) {
      query = query.eq("category", category);
    }
    if (searchQuery) {
      query = query.or(
        `original_name.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
      );
    }

    const { data: documents, error } = await query;

    if (error) {
      console.error("Error fetching documents:", error);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    // Generate signed URLs and fetch linked entity names
    const documentsWithUrls = await Promise.all(
      (documents || []).map(async (doc) => {
        const { data: urlData } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(doc.storage_path, 3600); // 1 hour expiry

        // Fetch linked entity name based on linked_type
        let linked_name: string | null = null;
        if (doc.linked_id) {
          if (doc.linked_type === 'lead') {
            const { data: leadData } = await supabaseAdmin
              .from('leads')
              .select('lead_number, client:clients!leads_client_id_fkey(name)')
              .eq('id', doc.linked_id)
              .single();
            if (leadData) {
              const clientName = (leadData.client as any)?.name || 'Unknown';
              linked_name = leadData.lead_number ? `${leadData.lead_number} - ${clientName}` : clientName;
            }
          } else if (doc.linked_type === 'project') {
            const { data: projectData } = await supabaseAdmin
              .from('projects')
              .select('project_number, name')
              .eq('id', doc.linked_id)
              .single();
            if (projectData) {
              linked_name = projectData.project_number 
                ? `${projectData.project_number} - ${projectData.name}` 
                : projectData.name;
            }
          }
        }

        return {
          ...doc,
          signed_url: urlData?.signedUrl || null,
          linked_name,
        };
      })
    );

    return NextResponse.json({ documents: documentsWithUrls });
  } catch (error) {
    console.error("Error in GET /api/documents:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/documents - Upload a new document
export async function POST(request: NextRequest) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const linkedType = formData.get("linked_type") as DocumentLinkedType;
    const linkedId = formData.get("linked_id") as string;
    const category = (formData.get("category") as DocumentCategory) || "other";
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const tagsStr = formData.get("tags") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }
    if (!linkedType || !linkedId) {
      return NextResponse.json(
        { error: "linked_type and linked_id are required" },
        { status: 400 }
      );
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 100MB limit" },
        { status: 400 }
      );
    }

    // Generate unique file name
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf("."))
      : "";
    const fileName = `${timestamp}_${randomStr}${extension}`;
    const storagePath = `${userData.tenant_id}/${linkedType}/${linkedId}/${fileName}`;

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Parse tags
    const tags = tagsStr ? tagsStr.split(",").map((t) => t.trim()) : null;

    // Create document record
    // Note: Using 'as any' until database types are regenerated after running migration 033
    const documentData = {
      tenant_id: userData.tenant_id,
      linked_type: linkedType,
      linked_id: linkedId,
      file_name: fileName,
      original_name: file.name,
      file_type: file.type || null,
      file_extension: extension || null,
      file_size: file.size,
      storage_bucket: STORAGE_BUCKET,
      storage_path: storagePath,
      category: category,
      title: title || null,
      description: description || null,
      tags: tags,
      uploaded_by: user.id,
    };

    const { data: document, error: dbError } = await supabaseAdmin
      .from("documents" as any)
      .insert(documentData as any)
      .select(
        `
        *,
        uploaded_user:users!documents_uploaded_by_fkey(id, name, avatar_url)
      `
      )
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      // Try to clean up uploaded file
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to save document record" },
        { status: 500 }
      );
    }

    // Generate signed URL
    const { data: urlData } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600);

    return NextResponse.json({
      document: {
        ...document,
        signed_url: urlData?.signedUrl || null,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/documents:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

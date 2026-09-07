import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import {
  requireProjectAccess,
  requirePhaseLineage,
} from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";

// GET /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId]/attachments
export async function GET(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; phaseId: string; subPhaseId: string }> }
) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;

    const { id: projectId, phaseId, subPhaseId } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId,
      user,
      permissions: guard.permissions,
      mode: "read",
    });
    if (!gate.ok) return gate.response;

    const lineage = await requirePhaseLineage(supabase, {
      projectId,
      phaseId,
      subPhaseId,
    });
    if (!lineage.ok) return lineage.response;

    const { data: attachments, error } = await supabase
      .from("project_phase_attachments")
      .select(
        `
        *,
        uploaded_by:users!project_phase_attachments_uploaded_by_fkey(id, name)
      `
      )
      .eq("project_sub_phase_id", subPhaseId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      log.error("Error fetching attachments", error);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    return NextResponse.json({ attachments });
  } catch (error) {
    log.error("Error in get attachments API", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId]/attachments
export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; phaseId: string; subPhaseId: string }> }
) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: projectId, phaseId, subPhaseId } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId,
      user,
      permissions: guard.permissions,
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    const lineage = await requirePhaseLineage(supabase, {
      projectId,
      phaseId,
      subPhaseId,
    });
    if (!lineage.ok) return lineage.response;

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const attachmentType =
      (formData.get("attachment_type") as string) || "document";
    const description = formData.get("description") as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const uploadedAttachments = [];

    for (const file of files) {
      // Upload to Supabase Storage
      const fileName = `${Date.now()}_${file.name.replace(
        /[^a-zA-Z0-9.-]/g,
        "_"
      )}`;
      const filePath = `projects/${projectId}/phases/${phaseId}/sub-phases/${subPhaseId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        log.error("Error uploading file", uploadError);
        continue; // Skip this file and continue with others
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("project-files")
        .getPublicUrl(filePath);

      // Create attachment record
      const { data: attachment, error: dbError } = await supabase
        .from("project_phase_attachments")
        .insert({
          project_id: projectId,
          project_phase_id: phaseId,
          project_sub_phase_id: subPhaseId,
          file_name: file.name,
          file_type: file.type,
          file_url: urlData.publicUrl,
          file_size: file.size,
          attachment_type: attachmentType,
          description: description,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (dbError) {
        log.error("Error creating attachment record", dbError);
        continue;
      }

      uploadedAttachments.push(attachment);
    }

    if (uploadedAttachments.length === 0) {
      return NextResponse.json(
        { error: "Failed to upload any files" },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("project_phase_activity_log").insert({
      project_id: projectId,
      project_phase_id: phaseId,
      project_sub_phase_id: subPhaseId,
      activity_type: "file_uploaded",
      description: `Uploaded ${uploadedAttachments.length} file(s)`,
      new_value: { files: uploadedAttachments.map((a) => a.file_name) },
      performed_by: user.id,
    });

    return NextResponse.json({
      success: true,
      attachments: uploadedAttachments,
    });
  } catch (error) {
    log.error("Error in upload attachments API", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId]/attachments/[attachmentId]
// Note: This would need a separate route file

/**
 * Task Attachments
 * GET  /api/tasks/[id]/attachments  - list, with short-lived signed URLs
 * POST /api/tasks/[id]/attachments  - upload a file
 *
 * These write to the DOCUMENTS table, not task_attachments. A file uploaded on
 * a task is a document like any other - it belongs in the Documents module,
 * in document search, and on the parent lead/project's Documents tab. It is
 * stored as:
 *     linked_type = 'task', linked_id = task id
 *     parent_linked_type / parent_linked_id = the task's lead or project
 * so one row appears in both places.
 *
 * Storage lives in the private `documents` bucket under
 *   {tenant_id}/tasks/{task_id}/{timestamp}_{rand}{ext}
 * Because the bucket is private we never persist a URL - the row keeps
 * storage_bucket + storage_path and reads mint a signed URL on demand.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

const STORAGE_BUCKET = "documents";
const SIGNED_URL_TTL = 3600; // 1 hour

// The bucket itself rejects anything larger. The documents route validates
// against 100MB and then fails at the bucket for anything above 20MB; matching
// the real limit here means the user gets a clear message instead.
const MAX_FILE_SIZE = 20 * 1024 * 1024;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Confirm the task is visible to this caller, and return its tenant. */
async function loadTask(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string
) {
  const { data } = await supabase
    .from("tasks")
    .select("id, title, tenant_id, related_type, related_id")
    .eq("id", taskId)
    .maybeSingle();
  return data;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const supabase = await createClient();

    const task = await loadTask(supabase, id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const { data: attachments, error } = await supabase
      .from("documents")
      .select(
        "*, uploaded_user:users!documents_uploaded_by_fkey(id, name, avatar_url)"
      )
      .eq("linked_type", "task")
      .eq("linked_id", id)
      .eq("is_latest", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing task attachments:", error);
      return NextResponse.json(
        { error: "Failed to load attachments" },
        { status: 500 }
      );
    }

    // Signing needs the admin client; RLS above already proved the caller may
    // see these rows.
    const admin = createAdminClient();
    const withUrls = await Promise.all(
      (attachments || []).map(async (a: any) => {
        if (!a.storage_path) {
          return { ...a, file_name: a.original_name || a.file_name, signed_url: null };
        }
        const { data: signed } = await admin.storage
          .from(a.storage_bucket || STORAGE_BUCKET)
          .createSignedUrl(a.storage_path, SIGNED_URL_TTL);
        return {
          ...a,
          // The UI shows the name the user recognises, not the stored one.
          file_name: a.original_name || a.file_name,
          signed_url: signed?.signedUrl ?? null,
        };
      })
    );

    return NextResponse.json({ attachments: withUrls });
  } catch (error) {
    console.error("Task attachments GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();

    const task = await loadTask(supabase, id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const description = (formData.get("description") as string | null)?.trim();

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "A file is required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File is ${(file.size / 1048576).toFixed(1)}MB. The limit is ${
            MAX_FILE_SIZE / 1048576
          }MB.`,
        },
        { status: 400 }
      );
    }

    // Storage quota. tenant_usage.storage_used_bytes is now maintained by a
    // database trigger, so this compares against a real number.
    const { data: usage } = await admin
      .from("tenant_usage")
      .select("storage_used_bytes")
      .eq("tenant_id", task.tenant_id)
      .maybeSingle();

    const { data: sub } = await admin
      .from("tenant_subscriptions")
      .select("plan:subscription_plans(max_storage_gb)")
      .eq("tenant_id", task.tenant_id)
      .maybeSingle();

    const limitGb = (sub?.plan as { max_storage_gb?: number } | null)
      ?.max_storage_gb;
    if (limitGb && limitGb > 0) {
      const limitBytes = limitGb * 1073741824;
      const used = usage?.storage_used_bytes || 0;
      if (used + file.size > limitBytes) {
        return NextResponse.json(
          {
            error: `Storage limit reached (${limitGb}GB). Free up space or upgrade your plan.`,
            upsellRequired: true,
          },
          { status: 403 }
        );
      }
    }

    // Everything used to land as "other", so a site photo was indistinguishable
    // from a contract in the Documents module. The MIME type already tells us.
    const category =
      (formData.get("category") as string | null) ||
      (file.type?.startsWith("image/") ? "photo" : "other");

    const extension = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf("."))
      : "";
    const storedName = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}${extension}`;
    const storagePath = `${task.tenant_id}/tasks/${id}/${storedName}`;

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      console.error("Task attachment upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload the file" },
        { status: 500 }
      );
    }

    const { data: attachment, error: dbError } = await admin
      .from("documents")
      .insert({
        tenant_id: task.tenant_id,
        linked_type: "task",
        linked_id: id,
        // Carries the file onto the task's lead/project Documents tab too.
        parent_linked_type: task.related_type || null,
        parent_linked_id: task.related_id || null,
        file_name: storedName,
        original_name: file.name,
        file_type: file.type || null,
        file_extension: extension || null,
        file_size: file.size,
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        category,
        description: description || null,
        uploaded_by: user.id,
      })
      .select(
        "*, uploaded_user:users!documents_uploaded_by_fkey(id, name, avatar_url)"
      )
      .single();

    if (dbError || !attachment) {
      // Do not leave an orphaned object behind in the bucket.
      await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
      console.error("Task attachment insert error:", dbError);
      return NextResponse.json(
        { error: "Failed to save the attachment" },
        { status: 500 }
      );
    }

    const { data: signed } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL);

    // Mirror onto the linked entity's timeline, as the other task actions do.
    if (task.related_id) {
      const payload = {
        activity_type: "document_uploaded",
        title: "File attached to task",
        description: `"${file.name}" attached to task "${task.title}"`,
        created_by: user.id,
      };
      if (task.related_type === "lead") {
        await supabase
          .from("lead_activities")
          .insert({ lead_id: task.related_id, ...payload });
      } else if (task.related_type === "project") {
        await supabase
          .from("project_activities")
          .insert({ project_id: task.related_id, ...payload });
      }
    }

    return NextResponse.json(
      {
        attachment: {
          ...attachment,
          file_name: attachment.original_name,
          signed_url: signed?.signedUrl ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Task attachments POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

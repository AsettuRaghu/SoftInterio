import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";

/**
 * Copy a playbook so a tenant can adapt it.
 *
 * This is what makes "SoftInterio proposes the best practice, the tenant
 * decides how they actually work" true rather than aspirational. A protected
 * playbook cannot be edited in place - editing it would change the process
 * under every business using it - so adapting one means taking a copy you own.
 *
 * The copy is unprotected, inactive until the tenant is ready, and starts back
 * at version 1: it is a new contract, not a revision of somebody else's.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["tasks.templates.create"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json().catch(() => ({}));

    const { data: source } = await supabase
      .from("procedure_definitions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!source) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
    }

    const { data: copy, error: copyError } = await supabase
      .from("procedure_definitions")
      .insert({
        tenant_id: user.tenantId,
        name: (body.name as string)?.trim() || `${source.name} (copy)`,
        description: source.description,
        applies_to: source.applies_to,
        tenant_type: source.tenant_type,
        enforce_order: source.enforce_order,
        // The copy belongs to this tenant, so it is theirs to edit and theirs
        // to switch on when they are ready.
        is_protected: false,
        is_active: false,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id, name")
      .single();

    if (copyError || !copy) {
      log.error("Failed to copy playbook", copyError, { sourceId: id });
      return NextResponse.json(
        { error: "Failed to copy the playbook" },
        { status: 500 }
      );
    }

    const { data: steps } = await supabase
      .from("procedure_step_definitions")
      .select("*")
      .eq("definition_id", id)
      .eq("is_current", true)
      .order("display_order");

    // Parents before children, so a child always has a parent to point at.
    const newIdByOldId = new Map<string, string>();
    const ordered = [
      ...(steps ?? []).filter((s) => !s.parent_step_id),
      ...(steps ?? []).filter((s) => s.parent_step_id),
    ];

    for (const step of ordered) {
      const { id: _oldId, definition_id: _d, created_at: _c, updated_at: _u,
              parent_step_id, ...rest } = step;
      const { data: made, error } = await supabase
        .from("procedure_step_definitions")
        .insert({
          ...rest,
          definition_id: copy.id,
          parent_step_id: parent_step_id
            ? newIdByOldId.get(parent_step_id) ?? null
            : null,
        })
        .select("id")
        .single();

      if (error || !made) {
        // Leave nothing half-copied behind.
        await supabase.from("procedure_definitions").delete().eq("id", copy.id);
        log.error("Failed to copy a playbook step", error, { sourceId: id });
        return NextResponse.json(
          { error: "Failed to copy the playbook" },
          { status: 500 }
        );
      }
      newIdByOldId.set(step.id, made.id);
    }

    log.info("Playbook copied", {
      sourceId: id,
      newId: copy.id,
      steps: ordered.length,
    });

    return NextResponse.json(
      { procedure: copy, stepCount: ordered.length },
      { status: 201 }
    );
  } catch (error) {
    log.error("Unhandled error copying a playbook", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

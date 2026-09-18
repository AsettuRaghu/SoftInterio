/**
 * The one way an in-app notification is written.
 *
 * Called from the route that performed the change, with the people it
 * concerns. The route already decided those people may know - it assigned
 * them the task, named them project manager, owns the lead - so nothing
 * here widens what anyone can see. There is deliberately no "notify a
 * role": a role is not an audience.
 *
 * Rules applied for every caller:
 *   - the actor is never told about their own action;
 *   - a person who has switched the kind off in Settings → Notifications
 *     is skipped (a preference row exists only to say no);
 *   - failures are logged and swallowed - a notice that did not land must
 *     never fail the change it describes.
 *
 * Works with the session client (RLS: insert allowed within the tenant) and
 * with the admin client (the client portal has no session).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { NotificationKind } from "./kinds";

export interface NotifyInput {
  tenantId: string;
  /** Who should hear. Duplicates and the actor are removed. */
  to: Array<string | null | undefined>;
  kind: NotificationKind;
  title: string;
  message: string;
  /** What it is about, for the bell's link. */
  entity?: { type: "task" | "lead" | "project" | "quotation"; id: string };
  actionUrl?: string | null;
  /** The person whose action this is; they are not notified. */
  actor?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  /** With the recipient, makes the notice unique - a repeat writes nothing. */
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}

export async function notify(
  supabase: SupabaseClient,
  input: NotifyInput,
): Promise<void> {
  try {
    const recipients = Array.from(
      new Set(
        input.to.filter(
          (id): id is string => !!id && id !== (input.actor ?? null),
        ),
      ),
    );
    if (recipients.length === 0) return;

    // Preferences: only rows that say "not in-app" matter.
    const { data: offRows } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .in("user_id", recipients)
      .eq("notification_type", input.kind)
      .eq("in_app", false);
    const off = new Set((offRows ?? []).map((r) => r.user_id as string));
    const wanted = recipients.filter((id) => !off.has(id));
    if (wanted.length === 0) return;

    const rows = wanted.map((userId) => ({
      tenant_id: input.tenantId,
      user_id: userId,
      type: input.kind,
      title: input.title,
      message: input.message,
      priority: input.priority ?? "normal",
      entity_type: input.entity?.type ?? null,
      entity_id: input.entity?.id ?? null,
      action_url: input.actionUrl ?? null,
      triggered_by: input.actor ?? null,
      metadata: input.metadata ?? {},
      dedupe_key: input.dedupeKey ?? crypto.randomUUID(),
    }));

    // Insert-or-ignore: a dedupe_key already written for that person is a
    // no-op rather than an error that would mask a real failure.
    const { error } = await supabase
      .from("notifications")
      .upsert(rows, {
        onConflict: "user_id,dedupe_key",
        ignoreDuplicates: true,
      });
    if (error) console.error("[notify] insert failed", error.message, input.kind);
  } catch (e) {
    console.error("[notify] failed", e);
  }
}

/** Names for the sentence, from the directory. Unknown ids read as "Someone". */
export async function namesOf(
  supabase: SupabaseClient,
  ids: Array<string | null | undefined>,
): Promise<(id: string | null | undefined) => string> {
  const wanted = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (wanted.length === 0) return () => "Someone";
  const { data } = await supabase
    .from("tenant_directory")
    .select("id, name")
    .in("id", wanted);
  const map = new Map((data ?? []).map((r) => [r.id as string, r.name as string]));
  return (id) => (id && map.get(id)) || "Someone";
}

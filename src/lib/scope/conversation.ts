import type { SupabaseClient } from "@supabase/supabase-js";
import { namesOf } from "@/lib/notifications/notify";

export const COMMENT_COLUMNS =
  "id, property_id, scope_item_id, body, is_decision, needs_rework, task_id, created_by, created_at, updated_at";

/** Author names from the directory, for the thread. */
export async function withAuthors<T extends { created_by: string | null }>(supabase: SupabaseClient, rows: T[]) {
  const nameOf = await namesOf(supabase, rows.map((r) => r.created_by));
  return rows.map((r) => ({ ...r, author_name: r.created_by ? nameOf(r.created_by) : "Someone" }));
}

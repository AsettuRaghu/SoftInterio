import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Timeline logging for leads and projects.
 *
 * Every user action on a lead or project should leave a trace, so the timeline
 * can answer "who changed this, and when". Before this existed only creation
 * events were recorded; edits, deletions and follow-up resolutions vanished.
 *
 * Two rules hold everywhere in here:
 *
 *  1. Logging never fails the action it describes. If the timeline insert
 *     breaks, the note was still saved and the user must still get a 200. All
 *     failures are swallowed and logged to the server console.
 *
 *  2. Leads and projects have parallel-but-different tables. lead_activities
 *     requires tenant_id; project_activities has no such column. That
 *     difference lives here and nowhere else.
 */

type Db = SupabaseClient<any, any, any>;

interface BaseEntry {
  /** Enum member of lead_activity_type_enum / project_activity_type_enum. */
  type: string;
  /** Short headline, e.g. "Note updated". */
  title: string;
  /** Optional detail line, e.g. the field-level diff. */
  description?: string | null;
  /** Acting user. Both tables require created_by. */
  userId: string;
  /** Ties the entry back to the note it describes, when there is one. */
  linkedNoteId?: string | null;
}

export async function logLeadActivity(
  supabase: Db,
  entry: BaseEntry & { leadId: string; tenantId: string }
): Promise<void> {
  try {
    const { error } = await supabase.from("lead_activities").insert({
      lead_id: entry.leadId,
      tenant_id: entry.tenantId,
      activity_type: entry.type,
      title: entry.title,
      description: entry.description ?? null,
      created_by: entry.userId,
      linked_note_id: entry.linkedNoteId ?? null,
    });
    if (error) console.error("[activity] lead log failed:", error.message);
  } catch (error) {
    console.error("[activity] lead log threw:", error);
  }
}

export async function logProjectActivity(
  supabase: Db,
  entry: BaseEntry & { projectId: string }
): Promise<void> {
  try {
    const { error } = await supabase.from("project_activities").insert({
      project_id: entry.projectId,
      activity_type: entry.type,
      title: entry.title,
      description: entry.description ?? null,
      created_by: entry.userId,
      linked_note_id: entry.linkedNoteId ?? null,
    });
    if (error) console.error("[activity] project log failed:", error.message);
  } catch (error) {
    console.error("[activity] project log threw:", error);
  }
}

/** Human-readable labels for the lead fields an edit can touch. */
export const LEAD_FIELD_LABELS: Record<string, string> = {
  client_name: "Client name",
  phone: "Phone",
  email: "Email",
  service_type: "Service type",
  lead_source: "Lead source",
  target_start_date: "Target start date",
  target_end_date: "Target end date",
  budget_range: "Budget range",
  assigned_to: "Assigned to",
  won_amount: "Won amount",
  contract_signed_date: "Contract signed date",
  expected_project_start: "Expected project start",
  priority: "Priority",
  property_name: "Property name",
  unit_number: "Unit number",
  property_category: "Property category",
  property_type: "Property type",
  property_subtype: "Property subtype",
  carpet_area: "Carpet area",
  property_address: "Property address",
  property_city: "City",
  property_pincode: "Pincode",
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

/**
 * Builds a "Budget range: 5L-10L to 10L-15L, Priority: empty to high" summary
 * from a before/after pair, skipping fields the request did not actually
 * change. Returns null when nothing really changed - the caller should then
 * write no timeline entry at all, rather than a meaningless "Lead updated".
 *
 * `resolve` lets a caller substitute a readable value for an opaque one, which
 * is how a user id becomes a person's name.
 */
export function describeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>,
  resolve?: (field: string, value: unknown) => string | undefined
): string | null {
  const parts: string[] = [];

  for (const [field, next] of Object.entries(after)) {
    if (!(field in before)) continue;
    const prev = before[field];

    // Normalise so null/undefined/"" all compare equal - an untouched optional
    // field often arrives as "" where the database holds null.
    const a = prev === null || prev === undefined ? "" : String(prev);
    const b = next === null || next === undefined ? "" : String(next);
    if (a === b) continue;

    const label = labels[field] ?? field;
    const from = resolve?.(field, prev) ?? display(prev);
    const to = resolve?.(field, next) ?? display(next);
    parts.push(`${label}: ${from} → ${to}`);
  }

  return parts.length ? parts.join(", ") : null;
}

/** First line of a note, trimmed for use as a timeline description. */
export function noteExcerpt(content: string, max = 100): string {
  const clean = content.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

/**
 * Describes what an edit did to a note, as timeline entries.
 *
 * Leads and projects keep notes in separate tables but the meaning of an edit
 * is the same in both, so the decision of *what to say* lives here and each
 * route only supplies *where to write it* via `write`.
 *
 * A follow-up change is reported as its own activity rather than folded into a
 * generic "note updated", because scheduling, completing and cancelling a
 * follow-up are what a manager scans the timeline for. An edit that changes
 * both the text and the follow-up produces both entries.
 */
export async function logNoteChange(
  write: (entry: {
    type: string;
    title: string;
    description?: string | null;
  }) => Promise<void>,
  args: {
    before: {
      content?: string | null;
      follow_up_at?: string | null;
      follow_up_done_at?: string | null;
    };
    after: {
      content?: string | null;
      follow_up_at?: string | null;
      follow_up_done_at?: string | null;
    };
  }
): Promise<void> {
  const { before, after } = args;

  if ((before.content || "") !== (after.content || "")) {
    await write({
      type: "note_updated",
      title: "Note updated",
      description: noteExcerpt(after.content || ""),
    });
  }

  const wasDone = !!before.follow_up_done_at;
  const isDone = !!after.follow_up_done_at;
  const prevDate = before.follow_up_at || null;
  const nextDate = after.follow_up_at || null;

  if (!wasDone && isDone) {
    await write({
      type: "follow_up_completed",
      title: "Follow-up completed",
      description: nextDate ? `Follow-up due ${nextDate} marked done` : null,
    });
  } else if (prevDate !== nextDate) {
    if (!nextDate) {
      await write({
        type: "follow_up_cancelled",
        title: "Follow-up removed",
        description: prevDate ? `Was due ${prevDate}` : null,
      });
    } else {
      await write({
        type: "follow_up_scheduled",
        title: prevDate ? "Follow-up rescheduled" : "Follow-up scheduled",
        description: prevDate ? `${prevDate} → ${nextDate}` : `Due ${nextDate}`,
      });
    }
  } else if (wasDone && !isDone) {
    // Reopened without moving the date.
    await write({
      type: "follow_up_scheduled",
      title: "Follow-up reopened",
      description: nextDate ? `Due ${nextDate}` : null,
    });
  }
}

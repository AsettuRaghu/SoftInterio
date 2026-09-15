"use client";

/**
 * The two "what is going on with this record" cells, shared by the leads list
 * and the projects list.
 *
 * Last Activity says what just happened; Follow-up says what is owed next. They
 * were written inline in LeadsTable and asked for on the projects list in the
 * same shape, and a second copy would have drifted - the leads version had
 * already been refined three times. So they live here, take the enrichment the
 * two list APIs both produce (`recent_activities`, `upcoming_items`), and draw
 * the same icons from `activity-icons`.
 *
 * The label maps are passed in rather than imported, because a lead activity
 * type and a project activity type are different enums that happen to overlap.
 */

import { ActivityGlyph, iconForActivity, iconForUpcoming } from "./activity-icons";

export interface RecentActivity {
  type?: string | null;
  detail?: string | null;
  at: string;
}

export interface UpcomingItem {
  kind: string;
  label: string;
  at: string;
}

/** Whole days between then and now. Null when there is no date at all. */
export function daysSince(dateString?: string | null): number | null {
  if (!dateString) return null;
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

function dayMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** "Today", "Yesterday", "5d", "3w" - said the way someone would say it. */
function whenShort(iso: string): string {
  const d = daysSince(iso);
  if (d === null) return "";
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  return `${Math.floor(d / 365)}y`;
}

/**
 * When something last happened, what it was, and what came before it.
 *
 * Three bands only for the headline: green means acted on, orange means going
 * cold, red means abandoned. More gradations than that stop reading as a signal
 * and start reading as decoration.
 */
export function LastActivityCell({
  at,
  type,
  detail,
  recent,
  labels,
}: {
  at?: string | null;
  type?: string | null;
  detail?: string | null;
  recent?: RecentActivity[];
  labels: Record<string, string>;
}) {
  const days = daysSince(at);
  const { label, tone } =
    days === null
      ? { label: "Never", tone: "text-red-600" }
      : days === 0
        ? { label: "Today", tone: "text-emerald-600" }
        : days === 1
          ? { label: "Yesterday", tone: "text-emerald-600" }
          : days <= 15
            ? { label: `${days}d ago`, tone: "text-orange-600" }
            : { label: `${days}d ago`, tone: "text-red-600" };

  const earlier = (recent || []).slice(1);
  const typeLabel = (t?: string | null) => (t ? labels[t] || t : "");

  return (
    <div>
      <p className={`text-sm font-medium ${tone}`}>{label}</p>
      {/* The activity's own words where we have them; the type label is the
          fallback. Shown in full, never cropped - half a sentence is worse
          than none. The icon says what kind of thing it was. */}
      {(detail || type) && (
        <p
          className="flex items-start gap-1.5 text-xs text-slate-500 break-words whitespace-normal leading-snug"
          title={detail ? `${typeLabel(type) || "Activity"} — ${detail}` : undefined}
        >
          <ActivityGlyph icon={iconForActivity(type)} className="mt-0.5" />
          <span className="min-w-0">{detail || typeLabel(type)}</span>
        </p>
      )}
      {/* What came before it. Texture for the eye, not something to read word
          for word - the point is whether anything has been happening. */}
      {earlier.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {earlier.map((a, i) => (
            <p
              key={i}
              className="flex items-center gap-1.5 text-[11px] text-slate-400"
              title={a.detail || undefined}
            >
              <ActivityGlyph icon={iconForActivity(a.type)} className="opacity-70" />
              <span className="shrink-0 tabular-nums">{whenShort(a.at)}</span>
              <span className="truncate">{a.detail || typeLabel(a.type)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * What is owed next: follow-ups, open tasks and booked meetings, soonest first,
 * with overdue ones at the top in red. The icon carries the kind so the date can
 * keep carrying the urgency.
 */
export function FollowUpCell({
  items,
  fallbackAt,
}: {
  items?: UpcomingItem[];
  /** A bare next_follow_up_at, for a record with a date but nothing itemised. */
  fallbackAt?: string | null;
}) {
  const list = items || [];
  const today = new Date().toISOString().slice(0, 10);

  const toneFor = (iso: string) => {
    const due = iso.slice(0, 10);
    if (due < today) return "text-red-600";
    if (due === today) return "text-amber-600";
    return "text-slate-700";
  };
  const labelFor = (iso: string) => {
    const due = iso.slice(0, 10);
    if (due < today) return `${daysSince(iso) ?? 0}d late`;
    if (due === today) return "Today";
    return dayMonth(iso);
  };

  if (!list.length && !fallbackAt) {
    return <span className="text-sm text-slate-300">—</span>;
  }
  if (!list.length) {
    return (
      <p className={`text-sm font-medium ${toneFor(fallbackAt!)}`}>
        {labelFor(fallbackAt!)}
      </p>
    );
  }

  const [next, ...rest] = list;
  return (
    <div>
      <p className={`text-sm font-medium ${toneFor(next.at)}`}>{labelFor(next.at)}</p>
      <p
        className="flex items-start gap-1.5 text-xs text-slate-500 break-words whitespace-normal leading-snug"
        title={`${iconForUpcoming(next.kind).name}: ${next.label}`}
      >
        <ActivityGlyph icon={iconForUpcoming(next.kind)} className="mt-0.5" />
        <span className="min-w-0">{next.label}</span>
      </p>
      {rest.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {rest.map((item, i) => (
            <p
              key={i}
              className="flex items-center gap-1.5 text-[11px] text-slate-400"
              title={`${iconForUpcoming(item.kind).name}: ${item.label}`}
            >
              <ActivityGlyph icon={iconForUpcoming(item.kind)} className="opacity-70" />
              <span
                className={`shrink-0 tabular-nums ${
                  item.at.slice(0, 10) < today ? "text-red-400" : "text-slate-400"
                }`}
              >
                {labelFor(item.at)}
              </span>
              <span className="truncate">{item.label}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

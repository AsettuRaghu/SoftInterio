"use client";

/**
 * "Who do I chase today?" — the morning queue.
 *
 * Three buckets because they warrant different reactions: overdue is a broken
 * promise, today is the plan, and gone quiet is the lead nobody remembered to
 * set a date on. That last group is the point — it catches neglect from
 * sellers who never use the follow-up field at all.
 *
 * Rows are of two kinds: leads to chase, and tasks assigned to you that are
 * due. A task with a due date is already a reminder, so it belongs in the same
 * queue rather than in a widget of its own — the question the user is asking
 * is "what do I have to do today", not "what kind of record is it".
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

interface QueueLead {
  kind: "lead";
  id: string;
  lead_number: string;
  stage: string;
  next_follow_up_at?: string | null;
  last_activity_at?: string | null;
  client?: { id: string; name: string; phone?: string | null } | null;
  property?: { property_name?: string | null } | null;
}

interface QueueTask {
  kind: "task";
  id: string;
  title: string;
  due_date?: string | null;
  priority?: string | null;
  status?: string | null;
  related_type?: string | null;
  related_id?: string | null;
}

type QueueItem = QueueLead | QueueTask;

interface Queue {
  quiet_days: number;
  counts: { overdue: number; today: number; gone_quiet: number; total: number };
  overdue: QueueItem[];
  today: QueueItem[];
  gone_quiet: QueueItem[];
}

/**
 * A task opens where the work is: on its lead or project if it belongs to one,
 * otherwise on the standalone task page.
 */
const taskHref = (task: QueueTask) => {
  if (task.related_type === "lead" && task.related_id) {
    return `/dashboard/sales/leads/${task.related_id}`;
  }
  if (task.related_type === "project" && task.related_id) {
    return `/dashboard/projects/${task.related_id}`;
  }
  return `/dashboard/tasks`;
};

type Bucket = "overdue" | "today" | "gone_quiet";

const BUCKETS: {
  key: Bucket;
  label: string;
  tone: string;
  dot: string;
}[] = [
  { key: "overdue", label: "Overdue", tone: "text-red-600", dot: "bg-red-500" },
  { key: "today", label: "Today", tone: "text-amber-600", dot: "bg-amber-500" },
  { key: "gone_quiet", label: "Gone quiet", tone: "text-slate-500", dot: "bg-slate-400" },
];

const daysAgo = (iso?: string | null) => {
  if (!iso) return null;
  const diff = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86400000
  );
  return diff;
};

export function FollowUpsWidget() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [active, setActive] = useState<Bucket>("overdue");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/sales/leads/follow-ups");
      if (response.ok) setQueue(await response.json());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Open on the bucket that actually has something in it, so the widget is
  // never a dead-looking empty tab when work is waiting elsewhere.
  useEffect(() => {
    if (!queue) return;
    const first = BUCKETS.find((b) => queue.counts[b.key] > 0);
    if (first) setActive(first.key);
  }, [queue]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <p className="text-sm text-slate-400">Loading follow-ups...</p>
      </div>
    );
  }

  if (!queue || queue.counts.total === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-medium text-slate-700">
          Follow-ups &amp; tasks
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Nothing due. No tasks are waiting on you, and every active lead has
          been touched in the last {queue?.quiet_days ?? 3} days.
        </p>
      </div>
    );
  }

  const rows = queue[active];

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">
          Follow-ups &amp; tasks
          <span className="ml-1.5 text-xs font-normal text-slate-400">
            {queue.counts.total} waiting
          </span>
        </h3>
        <Link
          href="/dashboard/sales/leads"
          className="text-xs text-blue-600 hover:underline"
        >
          All leads
        </Link>
      </div>

      <div className="px-4 pt-2 flex gap-1">
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setActive(b.key)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              active === b.key
                ? "bg-slate-100 text-slate-800"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${b.dot}`} />
            {b.label}
            <span className={`ml-1 ${b.tone}`}>{queue.counts[b.key]}</span>
          </button>
        ))}
      </div>

      <div className="p-2">
        {rows.length === 0 ? (
          <p className="px-2 py-3 text-xs text-slate-400">
            Nothing in this group.
          </p>
        ) : (
          <div className="space-y-0.5">
            {rows.slice(0, 8).map((item) => {
              if (item.kind === "task") {
                const overdueBy =
                  active === "overdue" ? daysAgo(item.due_date) : null;
                return (
                  <Link
                    key={`task-${item.id}`}
                    href={taskHref(item)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
                  >
                    {/* Marks the row as a task at a glance, without a legend. */}
                    <CheckCircleIcon className="w-3.5 h-3.5 shrink-0 text-slate-300" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-medium text-slate-800 truncate">
                        {item.title}
                      </span>
                      <span className="block text-[10px] text-slate-400 truncate">
                        Task
                        {item.related_type === "lead"
                          ? " · on a lead"
                          : item.related_type === "project"
                          ? " · on a project"
                          : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums">
                      {overdueBy !== null ? (
                        <span className="text-red-600">{overdueBy}d overdue</span>
                      ) : (
                        <span className="text-amber-600">due today</span>
                      )}
                    </span>
                  </Link>
                );
              }

              const lead = item;
              const overdueBy =
                active === "overdue" && lead.next_follow_up_at
                  ? daysAgo(lead.next_follow_up_at)
                  : null;
              const quietFor =
                active === "gone_quiet" ? daysAgo(lead.last_activity_at) : null;

              return (
                <Link
                  key={`lead-${lead.id}`}
                  href={`/dashboard/sales/leads/${lead.id}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
                >
                  <UserCircleIcon className="w-3.5 h-3.5 shrink-0 text-slate-300" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-slate-800 truncate">
                      {lead.client?.name || lead.lead_number}
                    </span>
                    <span className="block text-[10px] text-slate-400 truncate">
                      {lead.lead_number}
                      {lead.property?.property_name
                        ? ` · ${lead.property.property_name}`
                        : ""}
                    </span>
                  </span>

                  <span className="shrink-0 text-[10px] tabular-nums">
                    {overdueBy !== null && (
                      <span className="text-red-600">
                        {overdueBy}d overdue
                      </span>
                    )}
                    {quietFor !== null && (
                      <span className="text-slate-400">
                        {quietFor === null ? "never" : `${quietFor}d quiet`}
                      </span>
                    )}
                    {active === "today" && (
                      <span className="text-amber-600">due today</span>
                    )}
                  </span>
                </Link>
              );
            })}

            {rows.length > 8 && (
              <p className="px-2 pt-1 text-[10px] text-slate-400">
                and {rows.length - 8} more
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FollowUpsWidget;

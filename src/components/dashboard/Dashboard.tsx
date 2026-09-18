"use client";

/**
 * The first page of the day.
 *
 * Built to answer, in the order a person asks them: how am I doing (the
 * momentum strip), what is on today (the focus list, worst first), what is
 * around it (the day's schedule, quotations that need a hand, leads going
 * cold), and what am I carrying (my projects, the pipeline, this week's
 * wins).
 *
 * Every figure comes from the module's own list API - /api/tasks,
 * /api/calendar, /api/sales/leads, /api/projects, /api/quotations - each of
 * which already applies the caller's permissions and scope (own / team /
 * all). The dashboard adds no data path of its own: it composes what those
 * answer, and a block whose API refuses (403) or whose permission the
 * caller lacks is simply not drawn. Nothing here can show a person more
 * than the module itself would.
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { cn } from "@/utils/cn";
import { StatusPill, Chip } from "@/components/ui/list-cells";
import { Toast } from "@/components/ui/Toast";
import TaskTableReusable from "@/components/tasks/TaskTableReusable";
import { EditTaskModal } from "@/components/tasks/EditTaskModal";
import type { Task } from "@/types/tasks";
import { QuotationStatusLabels, type QuotationStatus } from "@/types/quotations";
import { LeadStageLabels, type LeadStage } from "@/types/leads";
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  FireIcon,
  MapPinIcon,
  PhoneIcon,
  DocumentTextIcon,
  BuildingOffice2Icon,
  ArrowRightIcon,
  SparklesIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

/* ------------------------------------------------------------------ types */

interface TaskLite {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  assigned_to: { id: string } | string | null;
  related_type: string | null;
  related_id: string | null;
  related_name?: string | null;
  is_plan_step?: boolean;
  stage_title?: string | null;
  parent_task_id?: string | null;
  subtasks?: TaskLite[];
}
interface EventLite {
  id: string;
  title: string;
  scheduled_at: string;
  end_at?: string;
  is_all_day?: boolean;
  is_completed: boolean;
  location: string | null;
  meeting_type: string | null;
  activity_type: string;
  source_type: "lead" | "project" | "standalone";
  source_id: string | null;
  source_name: string | null;
}
interface LeadLite {
  id: string;
  lead_number: string;
  stage: string;
  assigned_to: string | null;
  won_at?: string | null;
  won_amount?: number | null;
  created_at: string;
  last_activity_at?: string | null;
  next_follow_up_at?: string | null;
  client?: { name: string } | null;
  property?: { property_name?: string | null; city?: string | null } | null;
  upcoming_items?: { kind: string; label: string; at: string }[];
}
interface ProjectLite {
  id: string;
  name: string;
  client_name?: string | null;
  status: string;
  overall_progress?: number | null;
  expected_end_date?: string | null;
  agreed_end_date?: string | null;
  hold_owner?: string | null;
  project_manager_id?: string | null;
  stage_summary?: { active: { name: string }[]; next?: string | null } | null;
}
interface QuotationLite {
  id: string;
  quotation_number: string;
  version: number;
  status: QuotationStatus;
  grand_total: number | null;
  valid_until: string | null;
  client_name?: string | null;
  approved_at?: string | null;
  sent_at?: string | null;
  created_by?: string | null;
  owner?: { id: string; name: string } | null;
}

/* ---------------------------------------------------------------- helpers */

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const keyOf = (iso: string) => dayKey(new Date(iso));
const todayKey = () => dayKey(new Date());
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", "").toLowerCase();
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const money = (n: number | null | undefined) => (n == null ? "" : `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`);
const daysUntil = (iso: string) => Math.round((new Date(iso.slice(0, 10) + "T00:00:00").getTime() - new Date(todayKey() + "T00:00:00").getTime()) / 86400000);
const OPEN = new Set(["todo", "in_progress", "on_hold", "blocked"]);
const assigneeId = (t: TaskLite) => (typeof t.assigned_to === "string" ? t.assigned_to : t.assigned_to?.id ?? null);

function greeting(name: string) {
  const h = new Date().getHours();
  const part = h < 5 ? "Burning the midnight oil" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Late one";
  return `${part}, ${name.split(" ")[0]}`;
}

/* ----------------------------------------------------------------- shell */

export function Dashboard() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();

  const canLeads = hasPermission("leads.view") || hasPermission("leads.view_own");
  const canProjects = hasPermission("projects.view") || hasPermission("projects.view_all") || hasPermission("projects.view_own");
  const canQuotations = hasPermission("quotations.view");
  const canApprove = hasPermission("quotations.approve");
  const canTasks = hasPermission("tasks.view");

  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [events, setEvents] = useState<EventLite[]>([]);
  const [overdueEvents, setOverdueEvents] = useState<EventLite[]>([]);
  const [leads, setLeads] = useState<LeadLite[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [quotations, setQuotations] = useState<QuotationLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  useEffect(() => {
    if (permsLoading) return;
    let alive = true;
    const start = daysAgo(14).toISOString();
    const end = daysAgo(-7).toISOString();
    const get = async (url: string) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    };
    (async () => {
      const [t, c, l, p, q] = await Promise.all([
        canTasks ? get("/api/tasks?limit=200") : Promise.resolve(null),
        get(`/api/calendar?start=${start}&end=${end}`),
        canLeads ? get("/api/sales/leads?limit=100") : Promise.resolve(null),
        canProjects ? get("/api/projects?limit=100") : Promise.resolve(null),
        canQuotations ? get("/api/quotations?limit=100") : Promise.resolve(null),
      ]);
      if (!alive) return;
      // The list returns every row in scope and ALSO nests subtasks under
      // their parents, so a step can arrive twice; keep one of each.
      const seen = new Map<string, TaskLite>();
      for (const row of (t?.tasks ?? []) as TaskLite[]) {
        if (!seen.has(row.id)) seen.set(row.id, row);
        for (const st of row.subtasks ?? []) if (!seen.has(st.id)) seen.set(st.id, { ...st, related_name: st.related_name ?? row.related_name });
      }
      setTasks([...seen.values()]);
      setEvents(c?.events ?? []);
      setOverdueEvents(c?.overdueEvents ?? []);
      setLeads(l?.leads ?? []);
      setProjects(p?.projects ?? []);
      setQuotations(q?.quotations ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [permsLoading, canTasks, canLeads, canProjects, canQuotations, reloadTick]);

  const me = user?.id ?? "";
  const today = todayKey();

  /* ------------------------------------------------ what today asks of me */
  const mine = useMemo(() => tasks.filter((t) => assigneeId(t) === me), [tasks, me]);
  const myOpen = useMemo(() => mine.filter((t) => OPEN.has(t.status)), [mine]);
  const overdueTasks = useMemo(() => myOpen.filter((t) => t.due_date && t.due_date.slice(0, 10) < today).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1)), [myOpen, today]);
  const dueToday = useMemo(() => myOpen.filter((t) => t.due_date && t.due_date.slice(0, 10) === today), [myOpen, today]);
  const running = useMemo(() => myOpen.filter((t) => t.status === "in_progress"), [myOpen]);
  const todaysEvents = useMemo(() => events.filter((e) => keyOf(e.scheduled_at) === today && !e.is_completed).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)), [events, today]);
  const followUps = useMemo(() => {
    const out: { lead: LeadLite; at: string; label: string }[] = [];
    for (const l of leads) {
      if (["won", "lost", "disqualified"].includes(l.stage)) continue;
      const items = (l.upcoming_items ?? []).filter((i) => i.kind === "follow_up" && daysUntil(i.at) <= 0);
      for (const i of items) out.push({ lead: l, at: i.at, label: i.label });
    }
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }, [leads]);
  const coldLeads = useMemo(
    () =>
      leads
        .filter((l) => !["won", "lost", "disqualified"].includes(l.stage) && l.last_activity_at && daysUntil(l.last_activity_at) <= -7)
        .sort((a, b) => (a.last_activity_at! < b.last_activity_at! ? -1 : 1))
        .slice(0, 5),
    [leads]
  );
  const expiringQuotes = useMemo(
    () => quotations.filter((q) => (q.status === "sent" || q.status === "draft") && q.valid_until && daysUntil(q.valid_until) <= 3).sort((a, b) => (a.valid_until! < b.valid_until! ? -1 : 1)),
    [quotations]
  );
  const awaitingApproval = useMemo(() => (canApprove ? quotations.filter((q) => q.status === "sent") : []), [quotations, canApprove]);
  const myDrafts = useMemo(() => quotations.filter((q) => q.status === "draft" && (q.owner?.id === me || q.created_by === me)), [quotations, me]);

  /* ------------------------------------------------------------ momentum */
  const doneByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of mine) if (t.status === "completed" && t.completed_at) m.set(keyOf(t.completed_at), (m.get(keyOf(t.completed_at)) ?? 0) + 1);
    return m;
  }, [mine]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => daysAgo(6 - i)).map((d) => ({ d, n: doneByDay.get(dayKey(d)) ?? 0 })), [doneByDay]);
  const streak = useMemo(() => {
    let n = 0;
    for (let i = 1; i <= 60; i++) {
      if ((doneByDay.get(dayKey(daysAgo(i))) ?? 0) > 0) n++;
      else break;
    }
    return (doneByDay.get(today) ?? 0) > 0 ? n + 1 : n;
  }, [doneByDay, today]);
  const doneToday = doneByDay.get(today) ?? 0;
  const doneYesterday = doneByDay.get(dayKey(daysAgo(1))) ?? 0;
  const todayTotal = doneToday + dueToday.length + overdueTasks.length;
  const ringPct = todayTotal === 0 ? 0 : Math.round((doneToday / todayTotal) * 100);

  const weekStart = daysAgo(new Date().getDay());
  const wins = useMemo(
    () => ({
      steps: mine.filter((t) => t.status === "completed" && t.completed_at && new Date(t.completed_at) >= weekStart).length,
      leadsWon: leads.filter((l) => l.stage === "won" && l.won_at && new Date(l.won_at) >= weekStart).length,
      wonValue: leads.filter((l) => l.stage === "won" && l.won_at && new Date(l.won_at) >= weekStart).reduce((s, l) => s + (l.won_amount ?? 0), 0),
      approved: quotations.filter((q) => q.status === "approved" && q.approved_at && new Date(q.approved_at) >= weekStart).length,
      meetings: events.filter((e) => e.is_completed && new Date(e.scheduled_at) >= weekStart).length,
    }),
    [mine, leads, quotations, events, weekStart]
  );

  /* --------------------------------------------------------- the focus list */
  // The steps for today, in the order they bite: overdue first, then running,
  // then due today. Drawn by the same task table as the Plan tab and the
  // Tasks page, so a step behaves here exactly as it does there.
  const focusTasks = useMemo<Task[]>(() => {
    const seen = new Set<string>();
    const out: TaskLite[] = [];
    for (const t of [...overdueTasks, ...running, ...dueToday]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out as unknown as Task[];
  }, [overdueTasks, running, dueToday]);

  // What else today asks for, besides steps: meetings, follow-ups, and
  // quotations whose validity is ending.
  type Aside = { key: string; kind: "event" | "followup" | "quote"; title: string; context: string; when: string; tone: "red" | "amber" | "blue"; href: string };
  const asides = useMemo<Aside[]>(() => {
    const out: Aside[] = [];
    for (const f of followUps) out.push({ key: `f${f.lead.id}${f.at}`, kind: "followup", title: f.label || "Follow up", context: `${f.lead.client?.name ?? f.lead.lead_number} · ${LeadStageLabels[f.lead.stage as LeadStage] ?? f.lead.stage}`, when: daysUntil(f.at) < 0 ? `${-daysUntil(f.at)}d overdue` : "today", tone: daysUntil(f.at) < 0 ? "red" : "amber", href: `/dashboard/sales/leads/${f.lead.id}` });
    for (const e of todaysEvents) out.push({ key: `e${e.id}`, kind: "event", title: e.title, context: [e.source_name, e.location].filter(Boolean).join(" · "), when: e.is_all_day ? "all day" : timeOf(e.scheduled_at), tone: "blue", href: "/dashboard/calendar" });
    for (const q of expiringQuotes) out.push({ key: `q${q.id}`, kind: "quote", title: `${q.quotation_number} v${q.version}${q.client_name ? ` · ${q.client_name}` : ""}`, context: `${QuotationStatusLabels[q.status]} · ${money(q.grand_total)}`, when: daysUntil(q.valid_until!) < 0 ? "validity over" : daysUntil(q.valid_until!) === 0 ? "valid till today" : `valid ${daysUntil(q.valid_until!)}d more`, tone: daysUntil(q.valid_until!) <= 0 ? "red" : "amber", href: `/dashboard/quotations/${q.id}` });
    return out;
  }, [followUps, todaysEvents, expiringQuotes]);

  /* ------------------------------------------------------------ projects */
  const myProjects = useMemo(
    () =>
      projects
        .filter((p) => ["in_progress", "on_hold"].includes(p.status))
        .sort((a, b) => (a.project_manager_id === me ? -1 : 1) - (b.project_manager_id === me ? -1 : 1) || (a.expected_end_date ?? "").localeCompare(b.expected_end_date ?? ""))
        .slice(0, 6),
    [projects, me]
  );
  const pipeline = useMemo(() => {
    const stages: LeadStage[] = ["new", "qualified", "requirement_discussion", "proposal_discussion"];
    return stages.map((s) => ({ stage: s, n: leads.filter((l) => l.stage === s).length }));
  }, [leads]);

  const name = user?.firstName || user?.fullName || "there";
  const dateLine = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  if (permsLoading || loading) {
    return (
      <div className="-m-3 min-h-[calc(100vh-80px)] bg-linear-to-br from-indigo-50 via-white to-amber-50 p-6 space-y-5 animate-pulse">
        <div className="h-24 bg-white/60 rounded-xl" />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 h-72 bg-white/60 rounded-xl" />
          <div className="h-72 bg-white/60 rounded-xl" />
        </div>
      </div>
    );
  }

  const nothingToday = focusTasks.length === 0 && asides.length === 0;

  return (
    // The whole page is the canvas: a soft gradient with a few colour washes
    // behind everything, cards sitting on it as frosted glass. The shell
    // pads content by p-3, so the wrapper pulls out to the edges first.
    <div className="relative -m-3 min-h-[calc(100vh-80px)] overflow-hidden bg-linear-to-br from-indigo-50 via-white to-amber-50">
      <div className="pointer-events-none absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full bg-violet-200/50 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-32 w-[30rem] h-[30rem] rounded-full bg-sky-200/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 w-[26rem] h-[26rem] rounded-full bg-amber-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-1/4 w-[22rem] h-[22rem] rounded-full bg-emerald-200/40 blur-3xl" />

      <div className="relative p-6 space-y-5">
      {/* ------------------------------------------------------- hero */}
      {/* No box: the greeting floats on the page, the ring and the streak as
          glass chips beside it, the week line under them. */}
      <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[260px]">
              <p className="text-sm font-medium text-indigo-600/80">{dateLine}</p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">{greeting(name)}.</h1>
              <p className="text-sm text-slate-600 mt-1.5">
                {nothingToday
                  ? "Nothing is due and nothing is overdue. A clean slate - make something of it."
                  : [
                      overdueTasks.length ? `${overdueTasks.length} overdue` : null,
                      dueToday.length ? `${dueToday.length} due today` : null,
                      todaysEvents.length ? `${todaysEvents.length} meeting${todaysEvents.length === 1 ? "" : "s"}` : null,
                      followUps.length ? `${followUps.length} follow-up${followUps.length === 1 ? "" : "s"}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </p>
            </div>

            <div className="flex items-center gap-4 rounded-2xl bg-white/70 backdrop-blur-md shadow-lg shadow-indigo-100/60 ring-1 ring-white/70 px-5 py-3.5">
              <Ring pct={ringPct} label={`${doneToday}/${todayTotal || 0}`} dark={false} />
              <div className="text-sm">
                <p className="font-semibold text-slate-900">Today</p>
                <p className="text-slate-600">{todayTotal === 0 ? "no steps on the clock" : `${doneToday} done of ${todayTotal}`}</p>
                {doneYesterday > 0 && <p className="text-slate-400 text-xs mt-0.5">yesterday you closed {doneYesterday}</p>}
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl bg-white/70 backdrop-blur-md shadow-lg shadow-amber-100/60 ring-1 ring-white/70 px-5 py-3.5">
              <div className="flex items-end gap-1">
                {week.map(({ d, n }) => (
                  <div key={dayKey(d)} className="flex flex-col items-center gap-1" title={`${d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })} · ${n} done`}>
                    <span className={cn("w-3 rounded-sm transition-all", n === 0 ? "h-1.5 bg-slate-200" : n < 3 ? "h-4 bg-emerald-400" : "h-6 bg-emerald-500")} />
                    <span className="text-[9px] text-slate-400">{d.toLocaleDateString("en-IN", { weekday: "narrow" })}</span>
                  </div>
                ))}
              </div>
              <div className="text-sm">
                <p className="font-semibold text-slate-900 flex items-center gap-1">
                  <FireIcon className={cn("w-4 h-4", streak > 0 ? "text-orange-500" : "text-slate-400")} />
                  {streak > 0 ? `${streak}-day streak` : "Start a streak"}
                </p>
                <p className="text-slate-500 text-xs">{streak > 0 ? "finish one thing today to keep it" : "finish one thing today"}</p>
              </div>
            </div>
          </div>

        {/* This week - the summary that earns its place, as a line of text. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-700">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900"><SparklesIcon className="w-4 h-4 text-amber-500" /> This week</span>
          {wins.steps + wins.meetings + wins.leadsWon + wins.approved === 0 ? (
            <span className="text-slate-500">nothing closed yet - the week is young</span>
          ) : (
            <>
              {wins.steps > 0 && <span><b className="tabular-nums">{wins.steps}</b> step{wins.steps === 1 ? "" : "s"} finished</span>}
              {wins.meetings > 0 && <span><b className="tabular-nums">{wins.meetings}</b> meeting{wins.meetings === 1 ? "" : "s"} held</span>}
              {wins.leadsWon > 0 && <span><b className="tabular-nums">{wins.leadsWon}</b> lead{wins.leadsWon === 1 ? "" : "s"} won{wins.wonValue ? ` · ${money(wins.wonValue)}` : ""}</span>}
              {wins.approved > 0 && <span><b className="tabular-nums">{wins.approved}</b> quotation{wins.approved === 1 ? "" : "s"} approved</span>}
            </>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* --------------------------------------------------- focus */}
        <section className="xl:col-span-2 space-y-4">
          <div className="rounded-xl bg-white/80 backdrop-blur-md shadow-sm ring-1 ring-white/80">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <BoltIcon className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-900">Your steps today</h2>
              <span className="text-xs text-slate-500">overdue first, then running, then due</span>
              <span className="flex-1" />
              {running.length > 0 && <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">{running.length} running</span>}
              <Link href="/dashboard/tasks" className="text-xs text-blue-600 hover:underline">All tasks</Link>
            </div>
            {focusTasks.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <CheckCircleIcon className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                <p className="text-sm font-medium text-slate-800">No steps owed today.</p>
                <p className="text-xs text-slate-500 mt-1">Pick something up early - the plan is on each project, your list under Tasks.</p>
              </div>
            ) : user ? (
              // The same table as the Plan tab and the Tasks page: the timer
              // buttons, the status, the assignee, the dates, Edit - nothing
              // different to learn here.
              <TaskTableReusable
                currentUserId={user.id}
                externalTasks={focusTasks as never[]}
                showHeader={false}
                compact
                showTabs={false}
                showCreateButton={false}
                showLinkedColumn
                preserveOrder
                initialPageSize={50}
                onTaskClick={(t) => setEditingTask(t as unknown as Task)}
                onRefresh={reload}
              />
            ) : null}
          </div>

          {asides.length > 0 && (
            <div className="rounded-xl bg-white/80 backdrop-blur-md shadow-sm ring-1 ring-white/80">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Also today</h2>
                <span className="text-xs text-slate-500">meetings, follow-ups and quotations that need a hand</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {asides.map((f) => (
                  <li key={f.key}>
                    <button type="button" onClick={() => router.push(f.href)} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-left group">
                      <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", f.tone === "red" ? "bg-red-50 text-red-600" : f.tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600")}>
                        {f.kind === "event" ? <CalendarDaysIcon className="w-4 h-4" /> : f.kind === "followup" ? <PhoneIcon className="w-4 h-4" /> : <DocumentTextIcon className="w-4 h-4" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-900 truncate">{f.title}</span>
                        {f.context && <span className="block text-xs text-slate-500 truncate">{f.context}</span>}
                      </span>
                      <span className={cn("text-xs tabular-nums whitespace-nowrap", f.tone === "red" ? "text-red-600 font-medium" : f.tone === "amber" ? "text-amber-700" : "text-slate-500")}>{f.when}</span>
                      <ArrowRightIcon className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* --------------------------------------------------- side */}
        <div className="space-y-4">
          <section className="rounded-xl bg-white/80 backdrop-blur-md shadow-sm ring-1 ring-white/80">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <CalendarDaysIcon className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-900">Today’s schedule</h2>
              <span className="flex-1" />
              <Link href="/dashboard/calendar" className="text-xs text-blue-600 hover:underline">Calendar</Link>
            </div>
            {todaysEvents.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-400">No meetings booked today.</p>
            ) : (
              <ul className="px-4 py-2">
                {todaysEvents.map((e, i) => (
                  <li key={e.id} className="relative pl-5 py-2">
                    <span className={cn("absolute left-0 top-3.5 w-2.5 h-2.5 rounded-full border-2 border-white ring-1 ring-indigo-300", i === 0 ? "bg-indigo-600" : "bg-indigo-300")} />
                    {i < todaysEvents.length - 1 && <span className="absolute left-[4px] top-6 bottom-0 w-px bg-slate-200" />}
                    <p className="text-xs text-slate-500 tabular-nums">{e.is_all_day ? "All day" : timeOf(e.scheduled_at)}{e.end_at && !e.is_all_day ? ` – ${timeOf(e.end_at)}` : ""}</p>
                    <p className="text-sm font-medium text-slate-800 leading-snug">{e.title}</p>
                    {(e.source_name || e.location) && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                        {e.location && <MapPinIcon className="w-3 h-3" />}
                        {[e.source_name, e.location].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {overdueEvents.length > 0 && (
              <p className="px-4 py-2 border-t border-slate-100 text-xs text-red-600">
                {overdueEvents.length} past meeting{overdueEvents.length === 1 ? "" : "s"} not marked done - <Link href="/dashboard/calendar" className="underline">close or rebook</Link>
              </p>
            )}
          </section>

          {canQuotations && (awaitingApproval.length > 0 || myDrafts.length > 0) && (
            <section className="rounded-xl bg-white/80 backdrop-blur-md shadow-sm ring-1 ring-white/80">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5 text-indigo-600" />
                <h2 className="text-sm font-semibold text-slate-900">Quotations</h2>
                <span className="flex-1" />
                <Link href="/dashboard/quotations" className="text-xs text-blue-600 hover:underline">All</Link>
              </div>
              <ul className="divide-y divide-slate-100">
                {awaitingApproval.slice(0, 4).map((q) => (
                  <li key={q.id}>
                    <Link href={`/dashboard/quotations/${q.id}`} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-900 truncate">{q.client_name || q.quotation_number}</span>
                        <span className="block text-xs text-slate-500">{q.quotation_number} v{q.version} · with the client{q.sent_at ? ` since ${dayMonth(q.sent_at)}` : ""}</span>
                      </span>
                      <span className="text-sm tabular-nums text-slate-800">{money(q.grand_total)}</span>
                    </Link>
                  </li>
                ))}
                {myDrafts.slice(0, 3).map((q) => (
                  <li key={q.id}>
                    <Link href={`/dashboard/quotations/${q.id}`} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-900 truncate">{q.client_name || q.quotation_number}</span>
                        <span className="block text-xs text-slate-500">{q.quotation_number} v{q.version} · your draft</span>
                      </span>
                      <StatusPill label="Draft" tone="slate" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {canLeads && coldLeads.length > 0 && (
            <section className="rounded-xl bg-white/80 backdrop-blur-md shadow-sm ring-1 ring-white/80">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <PhoneIcon className="w-5 h-5 text-indigo-600" />
                <h2 className="text-sm font-semibold text-slate-900">Going cold</h2>
                <span className="text-xs text-slate-500">no activity in a week</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {coldLeads.map((l) => (
                  <li key={l.id}>
                    <Link href={`/dashboard/sales/leads/${l.id}`} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-900 truncate">{l.client?.name || l.lead_number}</span>
                        <span className="block text-xs text-slate-500 truncate">{LeadStageLabels[l.stage as LeadStage] ?? l.stage}{l.property?.city ? ` · ${l.property.city}` : ""}</span>
                      </span>
                      <span className="text-xs text-amber-700 tabular-nums whitespace-nowrap">{-daysUntil(l.last_activity_at!)}d quiet</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* ------------------------------------------------- carrying */}
      {(canProjects && myProjects.length > 0) || (canLeads && leads.length > 0) ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {canProjects && myProjects.length > 0 && (
            <section className="xl:col-span-2 rounded-xl bg-white/80 backdrop-blur-md shadow-sm ring-1 ring-white/80">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <BuildingOffice2Icon className="w-5 h-5 text-indigo-600" />
                <h2 className="text-sm font-semibold text-slate-900">Projects under way</h2>
                <span className="flex-1" />
                <Link href="/dashboard/projects" className="text-xs text-blue-600 hover:underline">All projects</Link>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-slate-100">
                {myProjects.map((p) => {
                  const pct = Math.round(p.overall_progress ?? 0);
                  const slip = p.agreed_end_date && p.expected_end_date ? daysUntil(p.expected_end_date) - daysUntil(p.agreed_end_date) : null;
                  return (
                    <li key={p.id} className="md:border-b md:border-r md:[&:nth-child(2n)]:border-r-0 border-slate-100">
                      <Link href={`/dashboard/projects/${p.id}`} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50">
                        <Ring pct={pct} label={`${pct}%`} size={44} dark={false} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-slate-900 truncate">{p.client_name || p.name}</span>
                          <span className="block text-xs text-slate-500 truncate">
                            {p.status === "on_hold" ? `On hold${p.hold_owner ? ` · waiting on ${p.hold_owner.replace("_", " ")}` : ""}` : p.stage_summary?.active?.length ? p.stage_summary.active.map((s) => s.name).join(" + ") : p.stage_summary?.next ? `Next: ${p.stage_summary.next}` : "In progress"}
                          </span>
                          {p.expected_end_date && (
                            <span className={cn("block text-[11px] tabular-nums", slip && slip > 0 ? "text-red-600" : slip && slip < 0 ? "text-emerald-600" : "text-slate-400")}>
                              ends {dayMonth(p.expected_end_date)}{slip ? ` · ${Math.abs(slip)}d ${slip > 0 ? "behind" : "ahead of"} the agreed plan` : ""}
                            </span>
                          )}
                        </span>
                        {p.project_manager_id === me && <Chip label="yours" tone="blue" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {canLeads && leads.length > 0 && (
            <section className="rounded-xl bg-white/80 backdrop-blur-md shadow-sm ring-1 ring-white/80">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Pipeline</h2>
                <span className="text-xs text-slate-500">open leads by stage</span>
                <span className="flex-1" />
                <Link href="/dashboard/sales/leads" className="text-xs text-blue-600 hover:underline">Leads</Link>
              </div>
              <div className="p-4 space-y-2.5">
                {(() => {
                  const max = Math.max(1, ...pipeline.map((p) => p.n));
                  return pipeline.map((p) => (
                    <div key={p.stage}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-700">{LeadStageLabels[p.stage]}</span>
                        <span className="tabular-nums text-slate-500">{p.n}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-linear-to-r from-indigo-500 to-blue-500 transition-all" style={{ width: `${(p.n / max) * 100}%` }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </section>
          )}
        </div>
      ) : null}

      <EditTaskModal
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => {
          setEditingTask(null);
          reload();
        }}
        onUpdate={() => {
          setEditingTask(null);
          reload();
        }}
      />
      <Toast message={notice?.message ?? null} variant={notice?.variant ?? "error"} onDismiss={() => setNotice(null)} />
      </div>
    </div>
  );
}

/** A progress ring: done over due, drawn to the value. */
function Ring({ pct, label, size = 64, dark = true }: { pct: number; label: string; size?: number; dark?: boolean }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? "rgba(255,255,255,0.15)" : "#e2e8f0"} strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={pct >= 100 ? "#34d399" : dark ? "#a5b4fc" : "#4f46e5"}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className={cn("tabular-nums font-semibold", dark ? "fill-white" : "fill-slate-800")} style={{ fontSize: size < 50 ? 11 : 13 }}>
        {label}
      </text>
    </svg>
  );
}

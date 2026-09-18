"use client";

/**
 * The kick-off checklist.
 *
 * One screen, five sections, one Confirm. Where a new project's plan is made:
 * the project manager reads what Sales handed over, chooses the playbook, puts
 * an owner and dates on every stage, an expected date on everything the
 * client or a vendor must do, and confirms with a note. Confirming records
 * the agreed plan and moves the project to In Progress - see
 * docs/plans/project-lifecycle-and-delay-ledger.md.
 *
 * A checklist rather than a wizard because it is re-openable: until the
 * Confirm is pressed it simply shows the state of the hand-off, and anyone
 * can come back to the bit they were missing.
 *
 * The server decides what is missing (`missing[]` from GET, and again inside
 * kick_off_project on Confirm); this only draws it.
 */

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { formatDate } from "@/modules/projects/utils";
import { StepOwnerLabels } from "@/types/playbooks";

interface Stage {
  id: string;
  title: string;
  assigned_to: string | null;
  assigned_name: string | null;
  start_date: string | null;
  due_date: string | null;
  estimated_hours: number | null;
}

interface Dependency {
  id: string;
  task_id: string | null;
  owner_type: "client" | "vendor";
  counterpart: string | null;
  description: string;
  expected_by: string | null;
  raised_at: string;
  resolved_at: string | null;
}

interface Checklist {
  status: string;
  kicked_off_at: string | null;
  handover_reviewed_at: string | null;
  committed: { start: string | null; end: string | null };
  expected: { start: string | null; end: string | null };
  handover: {
    client: { name: string; phone?: string; email?: string } | null;
    property: {
      property_name?: string;
      city?: string;
      property_type?: string;
      category?: string;
      carpet_area?: number;
    } | null;
    quotation: { quotation_number: string; version: number; status: string } | null;
    lead: {
      lead_number?: string;
      service_type?: string;
      expected_project_start?: string;
      target_end_date?: string;
    } | null;
    note_count: number;
    space_count: number;
  };
  playbook: { runId: string; definitionId: string; name: string; version: number } | null;
  suggested_playbook: { id: string; name: string; version: number } | null;
  stages: Stage[];
  dependencies: Dependency[];
  missing: string[];
}

interface Playbook {
  id: string;
  name: string;
  version: number;
  description?: string | null;
  step_count?: number;
  status: string;
}

interface TeamMember {
  id: string;
  name: string;
}

interface Props {
  projectId: string;
  teamMembers: TeamMember[];
  /** Whether this person may change anything here (project write). */
  canEdit: boolean;
  /** Called after Confirm succeeds and after anything that changes the plan. */
  onChanged: () => void;
  onKickedOff: (message: string) => void;
  onError: (message: string) => void;
}

const MISSING_LABEL: Record<string, string> = {
  handover_review: "Mark the handover as reviewed",
  playbook: "Choose a playbook",
  stage_owners: "Give every stage an owner",
  stage_dates: "Give every stage a start and end date",
  ask_dates: "Put an expected date on everything you are waiting for",
  note: "Write a kick-off note",
};

export function KickoffChecklist({
  projectId,
  teamMembers,
  canEdit,
  onChanged,
  onKickedOff,
  onError,
}: Props) {
  const [data, setData] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [newAsk, setNewAsk] = useState({ owner_type: "client", description: "", expected_by: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/kickoff`);
      const json = await res.json();
      if (res.ok && json.data) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The playbook picker only matters until one is running.
  useEffect(() => {
    if (!data || data.playbook) return;
    fetch("/api/playbooks?applies_to=project")
      .then((r) => (r.ok ? r.json() : { playbooks: [] }))
      .then((j) => setPlaybooks((j.playbooks || []).filter((p: Playbook) => p.status === "committed")))
      .catch(() => setPlaybooks([]));
  }, [data?.playbook, data]);

  /** Run a change, re-read the checklist, and surface the server's own reason on failure. */
  const act = async (key: string, fn: () => Promise<Response>) => {
    setBusy(key);
    try {
      const res = await fn();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(json.error || "That did not save");
        return false;
      }
      await load();
      onChanged();
      return true;
    } catch {
      onError("Could not reach the server");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const review = () =>
    act("review", () => fetch(`/api/projects/${projectId}/kickoff/review`, { method: "POST" }));

  const startPlaybook = (definitionId: string) =>
    act(`start:${definitionId}`, () =>
      fetch(`/api/playbooks/${definitionId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ related_type: "project", related_id: projectId }),
      })
    );

  const patchStage = (taskId: string, body: Record<string, unknown>) =>
    act(`stage:${taskId}`, () =>
      fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );

  const patchAsk = (depId: string, body: Record<string, unknown>) =>
    act(`ask:${depId}`, () =>
      fetch(`/api/projects/${projectId}/dependencies/${depId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );

  const removeAsk = (depId: string) =>
    act(`ask:${depId}`, () =>
      fetch(`/api/projects/${projectId}/dependencies/${depId}`, { method: "DELETE" })
    );

  const addAsk = async () => {
    if (!newAsk.description.trim()) return;
    const ok = await act("ask:new", () =>
      fetch(`/api/projects/${projectId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_type: newAsk.owner_type,
          description: newAsk.description.trim(),
          expected_by: newAsk.expected_by || null,
        }),
      })
    );
    if (ok) setNewAsk({ owner_type: "client", description: "", expected_by: "" });
  };

  const confirm = async () => {
    setBusy("confirm");
    try {
      const res = await fetch(`/api/projects/${projectId}/kickoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const list: string[] = json.missing ?? [];
        onError(
          list.length
            ? `Not yet: ${list.map((m) => MISSING_LABEL[m] ?? m).join("; ")}.`
            : json.error || "Could not kick off the project"
        );
        await load();
        return;
      }
      onKickedOff("Kicked off. The plan is agreed and the project is in progress.");
    } catch {
      onError("Could not reach the server");
    } finally {
      setBusy(null);
    }
  };

  if (loading || !data) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-400">Loading the kick-off checklist…</div>;
  }

  const missing = new Set(data.missing);
  if (!note.trim()) missing.add("note");
  const open = data.dependencies.filter((d) => !d.resolved_at);
  const ready = canEdit && data.missing.length === 0 && note.trim().length > 0;
  const readyCount = [
    !!data.handover_reviewed_at,
    !!data.playbook,
    !!data.playbook && !missing.has("stage_owners") && !missing.has("stage_dates"),
    !missing.has("ask_dates"),
  ].filter(Boolean).length;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Kick-off</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Take the project from Sales, plan it, and start it. Five things, then Confirm.
          </p>
        </div>
        <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
          {readyCount} of 4 ready
        </span>
      </div>

      {/* 1. Handover */}
      <Section
        n={1}
        title="Handover from Sales"
        done={!!data.handover_reviewed_at}
        doneText={data.handover_reviewed_at ? `Reviewed ${formatDate(data.handover_reviewed_at)}` : undefined}
      >
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
          <Fact label="Client" value={data.handover.client?.name} sub={data.handover.client?.phone} />
          <Fact
            label="Property"
            value={data.handover.property?.property_name}
            sub={[data.handover.property?.city, data.handover.property?.category, data.handover.property?.carpet_area ? `${data.handover.property.carpet_area} sq ft` : null].filter(Boolean).join(" · ")}
          />
          <Fact
            label="Quotation"
            value={data.handover.quotation ? `${data.handover.quotation.quotation_number} v${data.handover.quotation.version}` : "None attached"}
            sub={data.handover.quotation?.status}
          />
          <Fact
            label="From lead"
            value={data.handover.lead?.lead_number ?? "Created directly"}
            sub={data.handover.lead?.service_type}
          />
          <Fact
            label="Promised to the client"
            value={`${formatDate(data.expected.start)} → ${formatDate(data.expected.end)}`}
            sub="Kept as the sales commitment once you confirm"
          />
          <Fact label="Also handed over" value={`${data.handover.space_count} space(s), ${data.handover.note_count} note(s)`} sub="On the Scope and Notes tabs" />
        </dl>
        {!data.handover_reviewed_at && canEdit && (
          <button
            type="button"
            disabled={busy === "review"}
            onClick={() => void review()}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
          >
            {busy === "review" ? "Saving…" : "I have reviewed the handover"}
          </button>
        )}
      </Section>

      {/* 2. Playbook */}
      <Section
        n={2}
        title="Playbook"
        done={!!data.playbook}
        doneText={data.playbook ? `${data.playbook.name} v${data.playbook.version}` : undefined}
      >
        {data.playbook ? (
          <p className="text-xs text-slate-500">
            The plan below follows this playbook. To use a different one, stop it from the panel above and start another.
          </p>
        ) : playbooks.length === 0 ? (
          <p className="text-xs text-slate-500">
            No committed playbook applies to projects yet. Write one under Settings → Playbooks.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {playbooks.map((p) => {
              const suggested = data.suggested_playbook?.id === p.id;
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3 py-2",
                    suggested ? "border-blue-200 bg-blue-50/60" : "border-slate-200"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-800 truncate">
                      {p.name}
                      <span className="ml-1.5 text-[10px] text-slate-400">v{p.version}</span>
                      {suggested && (
                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          Suggested for this service type
                        </span>
                      )}
                    </span>
                    {p.description && (
                      <span className="block text-xs text-slate-500 truncate">{p.description}</span>
                    )}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={busy?.startsWith("start:")}
                      onClick={() => void startPlaybook(p.id)}
                      className={cn(buttonVariants({ size: "sm", variant: suggested ? "default" : "outline" }))}
                    >
                      {busy === `start:${p.id}` ? "Starting…" : "Use this"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* 3. Stages */}
      <Section
        n={3}
        title="Dates and owners"
        done={!!data.playbook && !missing.has("stage_owners") && !missing.has("stage_dates")}
        doneText={data.stages.length ? `${data.stages.length} stage(s)` : undefined}
      >
        {!data.playbook ? (
          <p className="text-xs text-slate-500">Choose a playbook first; its stages appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-1 pr-3 font-medium">Stage</th>
                  <th className="py-1 pr-3 font-medium">Owner</th>
                  <th className="py-1 pr-3 font-medium">Start</th>
                  <th className="py-1 pr-3 font-medium">End</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.stages.map((s) => {
                  const rowBusy = busy === `stage:${s.id}`;
                  return (
                    <tr key={s.id} className={rowBusy ? "opacity-60" : ""}>
                      <td className="py-1.5 pr-3 text-slate-800 whitespace-nowrap">{s.title}</td>
                      <td className="py-1.5 pr-3">
                        <select
                          value={s.assigned_to ?? ""}
                          disabled={!canEdit || rowBusy}
                          onChange={(e) => void patchStage(s.id, { assigned_to: e.target.value || null })}
                          className={cn(
                            "rounded border px-1.5 py-1 bg-white",
                            s.assigned_to ? "border-slate-200" : "border-amber-300 bg-amber-50"
                          )}
                        >
                          <option value="">Unassigned</option>
                          {teamMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 pr-3">
                        <DateInput
                          value={s.start_date}
                          disabled={!canEdit || rowBusy}
                          onChange={(v) => void patchStage(s.id, { start_date: v })}
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <DateInput
                          value={s.due_date}
                          disabled={!canEdit || rowBusy}
                          onChange={(v) => void patchStage(s.id, { due_date: v })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 4. Waiting on */}
      <Section
        n={4}
        title="What the client (or a vendor) must do"
        done={!missing.has("ask_dates")}
        doneText={open.length ? `${open.length} open` : "Nothing outstanding"}
      >
        <p className="text-xs text-slate-500 mb-2">
          Everything the project waits on someone else for. Steps marked “Client” or “Vendor” in the
          playbook are listed automatically; add anything else. Each needs an expected date - lateness
          against it is counted against them, not us.
        </p>
        {open.length > 0 && (
          <ul className="divide-y divide-slate-100 mb-2">
            {open.map((d) => {
              const rowBusy = busy === `ask:${d.id}`;
              return (
                <li key={d.id} className={cn("flex flex-wrap items-center gap-2 py-1.5 text-xs", rowBusy && "opacity-60")}>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium",
                      d.owner_type === "client" ? "bg-amber-100 text-amber-800" : "bg-violet-100 text-violet-800"
                    )}
                  >
                    {StepOwnerLabels[d.owner_type]}
                  </span>
                  <span className="flex-1 min-w-[10rem] text-slate-800">
                    {d.description}
                    {d.task_id && <span className="ml-1 text-slate-400">· playbook step</span>}
                  </span>
                  <span className="text-slate-400">by</span>
                  <DateInput
                    value={d.expected_by}
                    disabled={!canEdit || rowBusy}
                    highlight={!d.expected_by}
                    onChange={(v) => void patchAsk(d.id, { expected_by: v })}
                  />
                  {canEdit && !d.task_id && (
                    <button
                      type="button"
                      disabled={rowBusy}
                      onClick={() => void removeAsk(d.id)}
                      className="text-slate-300 hover:text-red-600 px-1"
                      title="Remove"
                    >
                      ×
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={newAsk.owner_type}
              onChange={(e) => setNewAsk((a) => ({ ...a, owner_type: e.target.value }))}
              className="rounded border border-slate-200 bg-white px-1.5 py-1"
            >
              <option value="client">Client</option>
              <option value="vendor">Vendor</option>
            </select>
            <input
              type="text"
              value={newAsk.description}
              onChange={(e) => setNewAsk((a) => ({ ...a, description: e.target.value }))}
              placeholder="e.g. Society NOC for civil work"
              className="flex-1 min-w-[12rem] rounded border border-slate-200 px-2 py-1"
            />
            <DateInput value={newAsk.expected_by || null} onChange={(v) => setNewAsk((a) => ({ ...a, expected_by: v ?? "" }))} />
            <button
              type="button"
              disabled={busy === "ask:new" || !newAsk.description.trim()}
              onClick={() => void addAsk()}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Add
            </button>
          </div>
        )}
      </Section>

      {/* 5. Confirm */}
      <div className="px-4 py-4">
        <div className="flex items-start gap-2 mb-2">
          <StepMark n={5} done={false} />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-slate-800">Confirm</h4>
            <p className="text-xs text-slate-500">
              A note for the timeline - what was agreed, and with whom. This becomes “Kicked off” on the
              project’s history, and the dates above become the agreed plan.
            </p>
          </div>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!canEdit}
          rows={2}
          placeholder="e.g. Plan agreed with the client on call; site handover expected 20 Oct, production to start after design sign-off."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!ready || busy === "confirm"}
            onClick={() => void confirm()}
            className={cn(buttonVariants())}
          >
            {busy === "confirm" ? "Kicking off…" : "Confirm kick-off"}
          </button>
          {[...missing].length > 0 ? (
            <ul className="text-xs text-amber-700 space-y-0.5">
              {[...missing].map((m) => (
                <li key={m} className="flex items-center gap-1">
                  <ExclamationCircleIcon className="w-3.5 h-3.5" />
                  {MISSING_LABEL[m] ?? m}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-xs text-emerald-700">Everything is in place.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  done,
  doneText,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  doneText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-4 border-b border-slate-100">
      <div className="flex items-start gap-2 mb-2">
        <StepMark n={n} done={done} />
        <h4 className="flex-1 text-sm font-medium text-slate-800">{title}</h4>
        {doneText && <span className="text-xs text-slate-500">{doneText}</span>}
      </div>
      <div className="pl-7">{children}</div>
    </div>
  );
}

function StepMark({ n, done }: { n: number; done: boolean }) {
  return done ? (
    <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0" />
  ) : (
    <span className="w-5 h-5 shrink-0 rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500 flex items-center justify-center">
      {n}
    </span>
  );
}

function Fact({ label, value, sub }: { label: string; value?: string | null; sub?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-slate-800 truncate">{value || "—"}</dd>
      {sub && <dd className="text-slate-500 truncate">{sub}</dd>}
    </div>
  );
}

/** A date field that saves on change and shows when it is still empty. */
function DateInput({
  value,
  onChange,
  disabled,
  highlight,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <input
      type="date"
      value={value ? value.slice(0, 10) : ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className={cn(
        "rounded border px-1.5 py-1 bg-white",
        highlight || !value ? "border-amber-300 bg-amber-50" : "border-slate-200"
      )}
    />
  );
}

"use client";

/**
 * The project's payment schedule.
 *
 * Replaces a placeholder that read "Payment Milestones Implementation" over a
 * complete API - the milestones, their triggers and their payment records all
 * existed in the database and nothing rendered them.
 *
 * Two numbers matter on this screen and they are different questions:
 * what the project is worth (contract_value, agreed at handover and frozen)
 * and what has actually arrived (the sum of paid milestones). Everything else
 * is arithmetic between them, so the summary states all four rather than
 * making someone subtract in their head.
 *
 * Recording a payment is gated separately from editing the schedule -
 * finance.payments.record - because saying money arrived is a different act
 * from planning when it should.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { uiLogger } from "@/lib/logger";
import { formatCurrency } from "@/modules/projects/utils";
import {
  PlusIcon,
  TrashIcon,
  BanknotesIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";

export interface PaymentMilestone {
  id: string;
  name: string;
  description: string | null;
  percentage: number | null;
  amount: number | null;
  status: "pending" | "due" | "overdue" | "paid" | "waived";
  due_date: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  payment_reference: string | null;
  payment_method: string | null;
  notes: string | null;
  linked_phase_id: string | null;
  linked_phase?: { id: string; name: string; status: string } | null;
}

interface Props {
  projectId: string;
  /** The agreed value, frozen at handover. Milestone percentages resolve against it. */
  contractValue: number | null;
  projectClosed?: boolean;
  onCountChange?: (count: number) => void;
}

const STATUS_STYLE: Record<PaymentMilestone["status"], string> = {
  pending: "bg-slate-100 text-slate-600",
  due: "bg-amber-50 text-amber-700",
  overdue: "bg-red-50 text-red-700",
  paid: "bg-emerald-50 text-emerald-700",
  waived: "bg-slate-100 text-slate-500",
};

const STATUS_LABEL: Record<PaymentMilestone["status"], string> = {
  pending: "Pending",
  due: "Due",
  overdue: "Overdue",
  paid: "Paid",
  waived: "Waived",
};

/** A milestone's value: an explicit amount wins, else a percentage of the contract. */
function milestoneAmount(m: PaymentMilestone, contractValue: number | null): number {
  if (m.amount !== null && m.amount !== undefined) return Number(m.amount);
  if (m.percentage && contractValue) return (Number(m.percentage) / 100) * contractValue;
  return 0;
}

export function PaymentsTab({
  projectId,
  contractValue,
  projectClosed = false,
  onCountChange,
}: Props) {
  const { hasPermission } = useUserPermissions();
  const canRecordPayment = hasPermission("finance.payments.record");

  const [milestones, setMilestones] = useState<PaymentMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PaymentMilestone | null>(null);
  const [recording, setRecording] = useState<PaymentMilestone | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/payment-milestones`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load payments");
      // The route answers with payment_milestones, not milestones.
      const list: PaymentMilestone[] = json.payment_milestones ?? [];
      setMilestones(list);
      onCountChange?.(list.length);
      setError(null);
    } catch (err: any) {
      uiLogger.error("Failed to load payment milestones", err);
      setError(err.message || "Could not load payments");
    } finally {
      setLoading(false);
    }
  }, [projectId, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    let scheduled = 0;
    let paid = 0;
    let overdue = 0;
    for (const m of milestones) {
      if (m.status === "waived") continue;
      const value = milestoneAmount(m, contractValue);
      scheduled += value;
      if (m.status === "paid") paid += Number(m.paid_amount ?? value);
      else if (m.status === "overdue") overdue += value;
    }
    return { scheduled, paid, outstanding: scheduled - paid, overdue };
  }, [milestones, contractValue]);

  // A schedule that does not add up to the contract is the thing worth saying
  // out loud - it is how a project quietly under-bills.
  const unscheduled =
    contractValue !== null && contractValue > 0
      ? contractValue - totals.scheduled
      : 0;

  async function save(url: string, method: string, payload?: unknown, id?: string) {
    setBusy(id ?? "new");
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not save");
      await load();
      return true;
    } catch (err: any) {
      uiLogger.error("Payment milestone write failed", err);
      setError(err.message || "Could not save");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function remove(m: PaymentMilestone) {
    if (!confirm(`Remove the "${m.name}" milestone?`)) return;
    await save(
      `/api/projects/${projectId}/payment-milestones/${m.id}`,
      "DELETE",
      undefined,
      m.id
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-lg" />
          ))}
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryTile label="Contract value" value={contractValue} muted={!contractValue} />
        <SummaryTile label="Scheduled" value={totals.scheduled} />
        <SummaryTile label="Received" value={totals.paid} tone="good" />
        <SummaryTile
          label="Outstanding"
          value={totals.outstanding}
          tone={totals.overdue > 0 ? "bad" : undefined}
          footnote={
            totals.overdue > 0 ? `${formatCurrency(totals.overdue)} overdue` : undefined
          }
        />
      </div>

      {contractValue !== null && contractValue > 0 && Math.abs(unscheduled) > 1 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {unscheduled > 0 ? (
            <>
              <strong>{formatCurrency(unscheduled)}</strong> of the contract value is
              not covered by any milestone yet.
            </>
          ) : (
            <>
              The schedule exceeds the contract value by{" "}
              <strong>{formatCurrency(Math.abs(unscheduled))}</strong>.
            </>
          )}
        </div>
      )}

      {/* schedule */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">
            Payment schedule
            {milestones.length > 0 && (
              <span className="ml-2 text-xs font-normal text-slate-500">
                {milestones.filter((m) => m.status === "paid").length} of{" "}
                {milestones.length} received
              </span>
            )}
          </h3>
          {!projectClosed && (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add milestone
            </button>
          )}
        </div>

        {milestones.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <BanknotesIcon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">
              No payment milestones yet.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Break the contract value into instalments so you can track what has
              been invoiced and what has arrived.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-2 font-semibold">Milestone</th>
                  <th className="px-4 py-2 font-semibold">Trigger</th>
                  <th className="px-4 py-2 font-semibold text-right">Amount</th>
                  <th className="px-4 py-2 font-semibold">Due</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {milestones.map((m) => {
                  const value = milestoneAmount(m, contractValue);
                  const isBusy = busy === m.id;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800">{m.name}</p>
                        {m.description && (
                          <p className="text-xs text-slate-500">{m.description}</p>
                        )}
                        {m.status === "paid" && m.payment_reference && (
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            {m.payment_reference}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {m.linked_phase?.name ?? (
                          <span className="text-slate-400">Manual</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">
                        {formatCurrency(value)}
                        {m.percentage != null && (
                          <span className="block text-xs text-slate-400">
                            {Number(m.percentage)}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                        {m.due_date
                          ? new Date(m.due_date).toLocaleDateString()
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${STATUS_STYLE[m.status]}`}
                        >
                          {STATUS_LABEL[m.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {!projectClosed && m.status !== "paid" && canRecordPayment && (
                            <button
                              disabled={isBusy}
                              onClick={() => setRecording(m)}
                              className="px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Record payment
                            </button>
                          )}
                          {!projectClosed && (
                            <>
                              <button
                                disabled={isBusy}
                                onClick={() => setEditing(m)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                                title="Edit"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                disabled={isBusy}
                                onClick={() => remove(m)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                title="Remove"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(adding || editing) && (
        <MilestoneDialog
          milestone={editing}
          contractValue={contractValue}
          saving={busy !== null}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={async (payload) => {
            const ok = editing
              ? await save(
                  `/api/projects/${projectId}/payment-milestones/${editing.id}`,
                  "PATCH",
                  payload,
                  editing.id
                )
              : await save(
                  `/api/projects/${projectId}/payment-milestones`,
                  "POST",
                  payload
                );
            if (ok) {
              setAdding(false);
              setEditing(null);
            }
          }}
        />
      )}

      {recording && (
        <RecordPaymentDialog
          milestone={recording}
          expected={milestoneAmount(recording, contractValue)}
          saving={busy !== null}
          onClose={() => setRecording(null)}
          onSave={async (payload) => {
            const ok = await save(
              `/api/projects/${projectId}/payment-milestones/${recording.id}`,
              "PATCH",
              { status: "paid", ...payload },
              recording.id
            );
            if (ok) setRecording(null);
          }}
        />
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  muted,
  footnote,
}: {
  label: string;
  value: number | null;
  tone?: "good" | "bad";
  muted?: boolean;
  footnote?: string;
}) {
  const colour =
    tone === "good"
      ? "text-emerald-700"
      : tone === "bad"
        ? "text-red-700"
        : muted
          ? "text-slate-400"
          : "text-slate-900";
  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200">
      <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${colour}`}>
        {value === null ? "Not set" : formatCurrency(value)}
      </p>
      {footnote && <p className="text-xs text-red-600 mt-0.5">{footnote}</p>}
    </div>
  );
}

function MilestoneDialog({
  milestone,
  contractValue,
  saving,
  onClose,
  onSave,
}: {
  milestone: PaymentMilestone | null;
  contractValue: number | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(milestone?.name ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [dueDate, setDueDate] = useState(milestone?.due_date ?? "");
  // Percentage and amount are two ways to say the same thing; whichever the
  // user last touched is the one that is sent, so they cannot disagree.
  const [basis, setBasis] = useState<"percentage" | "amount">(
    milestone?.percentage != null ? "percentage" : "amount"
  );
  const [percentage, setPercentage] = useState(
    milestone?.percentage != null ? String(milestone.percentage) : ""
  );
  const [amount, setAmount] = useState(
    milestone?.amount != null ? String(milestone.amount) : ""
  );

  const preview =
    basis === "percentage" && contractValue && percentage
      ? (Number(percentage) / 100) * contractValue
      : basis === "amount" && amount
        ? Number(amount)
        : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">
            {milestone ? "Edit milestone" : "Add a payment milestone"}
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. On design sign-off"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </Field>

          <Field label="Description" optional>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </Field>

          <div>
            <div className="flex items-center gap-4 mb-1.5">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Value
              </span>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="radio"
                  checked={basis === "percentage"}
                  onChange={() => setBasis("percentage")}
                  className="w-3.5 h-3.5"
                />
                % of contract
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="radio"
                  checked={basis === "amount"}
                  onChange={() => setBasis("amount")}
                  className="w-3.5 h-3.5"
                />
                Fixed amount
              </label>
            </div>
            <input
              type="number"
              min="0"
              value={basis === "percentage" ? percentage : amount}
              onChange={(e) =>
                basis === "percentage"
                  ? setPercentage(e.target.value)
                  : setAmount(e.target.value)
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
            {basis === "percentage" && !contractValue && (
              <p className="text-xs text-amber-700 mt-1">
                This project has no contract value, so a percentage cannot be
                turned into an amount. Use a fixed amount instead.
              </p>
            )}
            {preview !== null && (
              <p className="text-xs text-slate-500 mt-1">
                = {formatCurrency(preview)}
              </p>
            )}
          </div>

          <Field label="Due date" optional>
            <input
              type="date"
              value={dueDate ?? ""}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={saving || !name.trim()}
            onClick={() =>
              onSave({
                name: name.trim(),
                description: description.trim() || null,
                due_date: dueDate || null,
                percentage: basis === "percentage" ? Number(percentage) || null : null,
                amount: basis === "amount" ? Number(amount) || null : null,
              })
            }
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : milestone ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordPaymentDialog({
  milestone,
  expected,
  saving,
  onClose,
  onSave,
}: {
  milestone: PaymentMilestone;
  expected: number;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [paidAmount, setPaidAmount] = useState(String(expected || ""));
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));

  const short = expected > 0 && Number(paidAmount) < expected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">Record payment</h3>
          <p className="text-sm text-slate-500 mt-0.5">{milestone.name}</p>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Amount received">
            <input
              autoFocus
              type="number"
              min="0"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
            {short && (
              <p className="text-xs text-amber-700 mt-1">
                Less than the {formatCurrency(expected)} scheduled. The milestone
                will still be marked paid.
              </p>
            )}
          </Field>
          <Field label="Received on">
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </Field>
          <Field label="Reference" optional>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="UTR, cheque number, transaction id"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </Field>
          <Field label="Method" optional>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              <option value="">Not specified</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
            </select>
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={saving || !paidAmount}
            onClick={() =>
              onSave({
                paid_amount: Number(paidAmount),
                paid_at: new Date(paidAt).toISOString(),
                payment_reference: reference.trim() || null,
                payment_method: method || null,
              })
            }
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Record payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
        {label}
        {optional && <span className="ml-1 font-normal normal-case text-slate-400">optional</span>}
      </label>
      {children}
    </div>
  );
}

"use client";

/**
 * What has been ordered for this project, grouped by purchase order.
 *
 * The tab existed in the bar and had no render branch at all - clicking it
 * showed an empty panel with no explanation.
 *
 * Grouped by PO rather than listed flat because a purchase order is the unit
 * people chase: one order, one vendor, one delivery date, one status. But only
 * the lines belonging to this project are shown and totalled, since a single PO
 * routinely covers several projects and showing its full value here would
 * overstate what this project has committed.
 *
 * Read-only on purpose. Ordering happens in Stock -> Purchase Orders against
 * the vendor and material catalogue; duplicating that here would be a second
 * way to create a PO, which is how two screens start disagreeing.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { uiLogger } from "@/lib/logger";
import { formatCurrency } from "@/modules/projects/utils";
import { TruckIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

interface Line {
  id: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  receivedQuantity: number;
  costType: string | null;
  costCode: string | null;
  notes: string | null;
  material: { id: string; name: string; sku: string | null; unit_of_measure: string | null } | null;
  po: {
    id: string;
    po_number: string;
    status: string;
    order_date: string | null;
    expected_delivery: string | null;
    payment_status: string | null;
    vendor: { id: string; name: string; display_name: string | null } | null;
  } | null;
}

interface Summary {
  lineCount: number;
  orderCount: number;
  committed: number;
  received: number;
  awaitingDelivery: number;
}

const PO_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-600" },
  pending_approval: { label: "Awaiting approval", className: "bg-amber-50 text-amber-700" },
  approved: { label: "Approved", className: "bg-blue-50 text-blue-700" },
  sent: { label: "Sent to vendor", className: "bg-blue-50 text-blue-700" },
  acknowledged: { label: "Acknowledged", className: "bg-indigo-50 text-indigo-700" },
  dispatched: { label: "Dispatched", className: "bg-indigo-50 text-indigo-700" },
  partially_received: { label: "Part received", className: "bg-amber-50 text-amber-700" },
  fully_received: { label: "Received", className: "bg-emerald-50 text-emerald-700" },
  closed: { label: "Closed", className: "bg-slate-100 text-slate-600" },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-700" },
};

function statusOf(status: string | undefined) {
  return (
    PO_STATUS[status ?? ""] ?? {
      label: status ?? "Unknown",
      className: "bg-slate-100 text-slate-600",
    }
  );
}

export function ProcurementTab({
  projectId,
  onCountChange,
}: {
  projectId: string;
  onCountChange?: (count: number) => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load procurement");
      setLines(json.data.lines);
      setSummary(json.data.summary);
      onCountChange?.(json.data.summary.lineCount);
      setError(null);
    } catch (err: any) {
      uiLogger.error("Failed to load project procurement", err);
      setError(err.message || "Could not load procurement");
    } finally {
      setLoading(false);
    }
  }, [projectId, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  // One group per purchase order, in the order the lines arrived.
  const orders = useMemo(() => {
    const map = new Map<string, { po: Line["po"]; lines: Line[]; total: number }>();
    for (const line of lines) {
      const key = line.po?.id ?? "none";
      if (!map.has(key)) map.set(key, { po: line.po, lines: [], total: 0 });
      const group = map.get(key)!;
      group.lines.push(line);
      group.total += line.totalAmount;
    }
    return [...map.values()];
  }, [lines]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-lg" />
          ))}
        </div>
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Purchase orders" value={String(summary?.orderCount ?? 0)} />
        <Tile label="Committed" value={formatCurrency(summary?.committed ?? 0)} />
        <Tile
          label="Delivered"
          value={formatCurrency(summary?.received ?? 0)}
          tone="good"
        />
        <Tile
          label="Awaiting delivery"
          value={`${summary?.awaitingDelivery ?? 0} line${summary?.awaitingDelivery === 1 ? "" : "s"}`}
          tone={summary?.awaitingDelivery ? "warn" : undefined}
        />
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-12 text-center">
          <TruckIcon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-600 font-medium">
            Nothing has been ordered for this project yet.
          </p>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
            Purchase orders are raised in Stock &amp; Procurement. A line appears
            here once it is assigned to this project — one order can cover
            several projects, so the link is made per line rather than per order.
          </p>
          <Link
            href="/dashboard/stock/purchase-orders"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Go to Purchase Orders
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((group) => {
            const s = statusOf(group.po?.status);
            const vendorName =
              group.po?.vendor?.display_name || group.po?.vendor?.name || "No vendor";
            return (
              <div
                key={group.po?.id ?? "none"}
                className="bg-white rounded-lg border border-slate-200 overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/dashboard/stock/purchase-orders/${group.po?.id}`}
                        className="text-sm font-semibold text-slate-800 hover:text-blue-600 font-mono"
                      >
                        {group.po?.po_number ?? "Unlinked"}
                      </Link>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${s.className}`}
                      >
                        {s.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {vendorName}
                      {group.po?.expected_delivery && (
                        <> · expected {new Date(group.po.expected_delivery).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800 tabular-nums">
                      {formatCurrency(group.total)}
                    </p>
                    <p className="text-xs text-slate-500">
                      this project&rsquo;s share
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                        <th className="px-4 py-2 font-semibold">Material</th>
                        <th className="px-4 py-2 font-semibold text-right">Ordered</th>
                        <th className="px-4 py-2 font-semibold text-right">Received</th>
                        <th className="px-4 py-2 font-semibold text-right">Rate</th>
                        <th className="px-4 py-2 font-semibold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {group.lines.map((line) => {
                        const short = line.receivedQuantity < line.quantity;
                        return (
                          <tr key={line.id}>
                            <td className="px-4 py-2">
                              <p className="text-slate-800">
                                {line.material?.name ?? "Unknown material"}
                              </p>
                              {line.costCode && (
                                <p className="text-xs text-slate-400 font-mono">
                                  {line.costCode}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                              {line.quantity}
                              {line.material?.unit_of_measure && (
                                <span className="text-slate-400 ml-1">
                                  {line.material.unit_of_measure}
                                </span>
                              )}
                            </td>
                            <td
                              className={`px-4 py-2 text-right tabular-nums ${short ? "text-amber-700" : "text-emerald-700"}`}
                            >
                              {line.receivedQuantity}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                              {formatCurrency(line.unitPrice)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-slate-800">
                              {formatCurrency(line.totalAmount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  const colour =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : "text-slate-900";
  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200">
      <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${colour}`}>{value}</p>
    </div>
  );
}

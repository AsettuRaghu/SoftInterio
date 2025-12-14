"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DocumentTextIcon, CheckBadgeIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

interface ProjectQuotationsTabProps {
  projectId: string;
  leadId?: string;
  quotationId?: string;
  onCountChange?: (count: number) => void;
}

export default function ProjectQuotationsTab({
  projectId,
  leadId,
  quotationId,
  onCountChange,
}: ProjectQuotationsTabProps) {
  const router = useRouter();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);

      const promises = [];

      // Fetch project quotations (quotations created directly for this project)
      promises.push(
        fetch(`/api/quotations?project_id=${projectId}`).then((res) =>
          res.ok ? res.json() : { quotations: [] }
        )
      );

      // Fetch the specific lead quotation that was linked to this project (if exists)
      if (quotationId) {
        promises.push(
          fetch(`/api/quotations/${quotationId}`).then((res) =>
            res.ok ? res.json() : null
          )
        );
      }

      const results = await Promise.all(promises);

      // Combine quotations and mark their source
      let allQuotations: any[] = [];

      // Add project quotations
      const projectQuotations = results[0].quotations || [];
      allQuotations = projectQuotations.map((q: any) => ({
        ...q,
        _source: "project" as const,
      }));

      // Add the specific linked lead quotation (if exists)
      if (quotationId && results[1]) {
        const leadQuotation = results[1].quotation || results[1];
        // Only add if not already in project quotations (avoid duplicates)
        if (!allQuotations.find((q) => q.id === leadQuotation.id)) {
          allQuotations.push({
            ...leadQuotation,
            _source: "lead" as const,
          });
        }
      }

      // Sort by created_at descending
      allQuotations.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setQuotations(allQuotations);
      onCountChange?.(allQuotations.length);
    } catch (err) {
      console.error("Error fetching quotations:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, quotationId, onCountChange]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Loading quotations...
      </div>
    );
  }

  if (quotations.length === 0) {
    return (
      <div className="text-center py-8">
        <DocumentTextIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-600 font-medium">
          No Quotations Found
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          No quotations have been created for this project yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-900">
          Quotations ({quotations.length})
        </h3>
        <p className="text-xs text-slate-500">
          {leadId && "Lead & "}Project Quotations
        </p>
      </div>

      {/* Table View */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                  Quote #
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                  Version
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                  Amount
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                  Source
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                  Valid Until
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotations.map((quote) => {
                const isLinked = quote.id === quotationId;
                return (
                  <tr
                    key={quote.id}
                    onClick={() =>
                      router.push(`/dashboard/quotations/${quote.id}`)
                    }
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-xs text-slate-900 group-hover:text-blue-600 transition-colors">
                          {quote.quotation_number || `#${quote.id.slice(0, 8)}`}
                        </p>
                        {isLinked && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            <CheckBadgeIcon className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                        v{quote.version || 1}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div>
                        <p className="font-semibold text-xs text-slate-900">
                          {formatCurrency(
                            quote.grand_total || quote.final_total || 0
                          )}
                        </p>
                        {quote.discount_amount && quote.discount_amount > 0 && (
                          <p className="text-xs text-green-600">
                            -{formatCurrency(quote.discount_amount)} off
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded-full ${
                          quote.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : quote.status === "sent"
                            ? "bg-blue-100 text-blue-700"
                            : quote.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : quote.status === "expired"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {quote.status?.charAt(0).toUpperCase() +
                          quote.status?.slice(1) || "Draft"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded-full ${
                          quote._source === "lead"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        {quote._source === "lead" ? "Lead" : "Project"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-xs text-slate-600">
                        {quote.valid_until
                          ? new Date(quote.valid_until).toLocaleDateString()
                          : "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-xs text-slate-600">
                        {new Date(quote.created_at).toLocaleDateString()}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

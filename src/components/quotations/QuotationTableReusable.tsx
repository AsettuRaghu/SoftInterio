"use client";

import { useState, useMemo } from "react";
import {
  Quotation,
  QuotationStatus,
  QuotationStatusLabels,
  QuotationStatusColors,
} from "@/types/quotations";
import { QUOTATION_STATUS_OPTIONS } from "@/utils/quotations/constants";
import { SearchBox } from "@/components/ui/SearchBox";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  DocumentTextIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency, formatDate } from "@/modules/sales/utils/formatters";

interface QuotationTableReusableProps {
  quotations: Quotation[];
  allowCreate?: boolean;
  allowView?: boolean;
  showFilters?: boolean;
  readOnly?: boolean;
  showHeader?: boolean; // Show/hide section header
  compact?: boolean; // Compact mode for embedded contexts
  headerTitle?: string; // Custom header title
  onCreateQuotation?: () => void;
  onViewQuotation?: (quotation: Quotation) => void;
  onNavigateToQuotations?: () => void; // Navigate to quotations list page
}

type SortField =
  | "quotation_number"
  | "status"
  | "grand_total"
  | "created_at"
  | "valid_until";
type SortDirection = "asc" | "desc";

const DEFAULT_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  negotiating: "Negotiating",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
  linked_to_project: "Linked to Project",
  project_baseline: "Project Baseline",
};

export default function QuotationTableReusable({
  quotations,
  allowCreate = true,
  allowView = true,
  showFilters = true,
  readOnly = false,
  showHeader = true,
  compact = false,
  headerTitle = "Quotations",
  onCreateQuotation,
  onViewQuotation,
  onNavigateToQuotations,
}: QuotationTableReusableProps) {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | "all">(
    "all"
  );
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Format helpers
  const formatDateTime = (date: string | null | undefined): string => {
    if (!date) return "—";
    try {
      return new Date(date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "—";
    }
  };

  // Get status badge colors
  const getStatusBadge = (status: QuotationStatus) => {
    const colors = QuotationStatusColors[status] || QuotationStatusColors.draft;
    const label =
      QuotationStatusLabels[status] || DEFAULT_STATUS_LABELS[status];

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
        {label}
      </span>
    );
  };

  // Filter and search
  const filteredQuotations = useMemo(() => {
    let filtered = [...quotations];

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((q) => q.status === statusFilter);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((q) => {
        const searchableText = [
          q.quotation_number,
          q.title,
          q.description,
          q.client_name || q.client?.name,
          q.lead_number,
          `v${q.version}`,
          q.spaces_count?.toString(),
          q.components_count?.toString(),
          formatCurrency(q.grand_total),
          QuotationStatusLabels[q.status] || DEFAULT_STATUS_LABELS[q.status],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    return filtered;
  }, [quotations, searchQuery, statusFilter]);

  // Sort
  const sortedQuotations = useMemo(() => {
    const sorted = [...filteredQuotations];

    sorted.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortField) {
        case "quotation_number":
          aVal = a.quotation_number || "";
          bVal = b.quotation_number || "";
          break;
        case "status":
          aVal = QuotationStatusLabels[a.status] || "";
          bVal = QuotationStatusLabels[b.status] || "";
          break;
        case "grand_total":
          aVal = a.grand_total || 0;
          bVal = b.grand_total || 0;
          break;
        case "created_at":
          aVal = new Date(a.created_at || 0).getTime();
          bVal = new Date(b.created_at || 0).getTime();
          break;
        case "valid_until":
          aVal = new Date(a.valid_until || 0).getTime();
          bVal = new Date(b.valid_until || 0).getTime();
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return sorted;
  }, [filteredQuotations, sortField, sortDirection]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort indicator component (matching other tables)
  const SortIndicator = ({ field }: { field: SortField }) => (
    <span className="ml-1 inline-flex">
      {sortField === field ? (
        sortDirection === "asc" ? (
          <ArrowUpIcon className="w-3 h-3" />
        ) : (
          <ArrowDownIcon className="w-3 h-3" />
        )
      ) : (
        <span className="w-3 h-3 opacity-0 group-hover:opacity-30">
          <ArrowUpIcon className="w-3 h-3" />
        </span>
      )}
    </span>
  );

  // All available statuses for filter (from constants)
  const allStatuses = useMemo(() => {
    return QUOTATION_STATUS_OPTIONS.map((opt) => opt.value);
  }, []);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200">
      {/* Search and Filters */}
      <div className="flex items-center gap-2 p-3 border-b border-slate-200">
        <div className="flex-1">
          <SearchBox
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search quotations..."
          />
        </div>

        {/* Status Filter */}
        {showFilters && (
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as QuotationStatus | "all")
            }
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            {QUOTATION_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* Add Quotation Button */}
        {!readOnly &&
          allowCreate &&
          (onCreateQuotation || onNavigateToQuotations) && (
            <button
              onClick={() => {
                if (onNavigateToQuotations) {
                  onNavigateToQuotations();
                } else if (onCreateQuotation) {
                  onCreateQuotation();
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <span>+</span> Quotation
            </button>
          )}
      </div>

      {/* Table or Empty State */}
      {sortedQuotations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center">
            <DocumentTextIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700 mb-1">
              No quotations found
            </p>
            <p className="text-xs text-slate-500">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Add your first quotation to get started"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr>
                <th
                  onClick={() => handleSort("quotation_number")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  Quotation #<SortIndicator field="quotation_number" />
                </th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  Spaces
                </th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  Components
                </th>
                <th
                  onClick={() => handleSort("grand_total")}
                  className="group px-3 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  Amount
                  <SortIndicator field="grand_total" />
                </th>
                <th className="px-6"></th>
                <th
                  onClick={() => handleSort("status")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  Status
                  <SortIndicator field="status" />
                </th>
                <th
                  onClick={() => handleSort("valid_until")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  Valid Until
                  <SortIndicator field="valid_until" />
                </th>
                <th
                  onClick={() => handleSort("created_at")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  Created At
                  <SortIndicator field="created_at" />
                </th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedQuotations.map((quotation) => (
                <tr
                  key={quotation.id}
                  onClick={() => onViewQuotation && onViewQuotation(quotation)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {/* Quotation Number */}
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-slate-900">
                        {quotation.quotation_number}
                      </span>
                      {quotation.title && (
                        <span className="text-[10px] text-slate-500">
                          {quotation.title}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Version */}
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                      v{quotation.version}
                    </span>
                  </td>

                  {/* No. of Spaces */}
                  <td className="px-3 py-2 text-center">
                    <span className="text-slate-700">
                      {quotation.spaces_count || 0}
                    </span>
                  </td>

                  {/* No. of Components */}
                  <td className="px-3 py-2 text-center">
                    <span className="text-slate-700">
                      {quotation.components_count || 0}
                    </span>
                  </td>

                  {/* Amount */}
                  <td className="px-3 py-2 text-right">
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(quotation.grand_total)}
                    </span>
                  </td>

                  {/* Spacer */}
                  <td className="px-6"></td>

                  {/* Status */}
                  <td className="px-3 py-2">
                    {getStatusBadge(quotation.status)}
                  </td>

                  {/* Valid Until */}
                  <td className="px-3 py-2">
                    <span className="text-slate-600">
                      {quotation.valid_until
                        ? formatDate(quotation.valid_until)
                        : "—"}
                    </span>
                  </td>

                  {/* Created At */}
                  <td className="px-3 py-2">
                    <span className="text-slate-600">
                      {formatDate(quotation.created_at)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td
                    className="px-3 py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      {allowView && onViewQuotation && !readOnly && (
                        <button
                          onClick={() => onViewQuotation(quotation)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View Quotation"
                        >
                          <EyeIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

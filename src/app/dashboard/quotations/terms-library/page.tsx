"use client";

/**
 * Quotation T&C Library.
 *
 * Reusable clauses that a quotation assembles its terms from. Grouped by
 * category, because a working library gets long quickly and people look for
 * "the warranty one" rather than scrolling.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  SettingsPageLayout,
  SettingsPageHeader,
  SettingsPageContent,
} from "@/components/ui/SettingsPageLayout";
import {
  AppTable,
  useAppTableSort,
  useAppTablePagination,
  type ColumnDef,
} from "@/components/ui/AppTable";
import { TermsClauseModal } from "@/components/quotations/TermsClauseModal";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ScaleIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import type { QuotationTermsClause } from "@/types/quotations";

export default function TermsLibraryPage() {
  const { confirm, confirmDialog } = useConfirm();
  const [clauses, setClauses] = useState<QuotationTermsClause[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<QuotationTermsClause | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(
        "/api/quotations/terms-clauses?include_inactive=true"
      );
      if (!response.ok) throw new Error("Failed to load clauses");
      const data = await response.json();
      setClauses(data.clauses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(
    () =>
      [...new Set(clauses.map((c) => c.category).filter(Boolean))] as string[],
    [clauses]
  );

  const { sortState, handleSort, sortData } =
    useAppTableSort<QuotationTermsClause>();

  // Searches every column the table shows, plus the clause body - people look
  // for a clause by a phrase inside it far more often than by its title.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = !q
      ? clauses
      : clauses.filter((c) =>
          [
            c.title,
            c.content,
            c.category || "",
            c.is_active ? "active" : "inactive",
            c.is_default ? "default" : "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
        );

    return sortData(matched, (item, column) => {
      switch (column) {
        case "title":
          return item.title.toLowerCase();
        case "category":
          return (item.category || "").toLowerCase();
        case "is_active":
          return item.is_active ? 1 : 0;
        default:
          return null;
      }
    });
  }, [clauses, search, sortData]);

  const { paginatedData, pagination, setPage, setPageSize } =
    useAppTablePagination(filtered, 25);

  const columns: ColumnDef<QuotationTermsClause>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Clause",
        width: "40%",
        sortable: true,
        // Title only. Clauses of the same kind open with almost identical
        // wording, so a preview distinguished nothing while making every row
        // taller; the wording is read in the edit modal instead.
        render: (c) => (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800">
              {c.title}
            </span>
            {c.is_default && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <CheckBadgeIcon className="w-3 h-3" />
                Default
              </span>
            )}
          </div>
        ),
      },
      {
        key: "category",
        header: "Category",
        width: "22%",
        sortable: true,
        render: (c) =>
          c.category ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
              {c.category}
            </span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          ),
      },
      {
        key: "is_active",
        header: "Status",
        width: "16%",
        sortable: true,
        render: (c) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
              c.is_active
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-slate-100 text-slate-500 border border-slate-200"
            }`}
          >
            {c.is_active ? "Active" : "Inactive"}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        width: "22%",
        align: "right",
        render: (c) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleDuplicate(c);
              }}
              disabled={copyingId === c.id}
              title="Duplicate clause"
              className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all disabled:opacity-50"
            >
              <DocumentDuplicateIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(c);
                setIsModalOpen(true);
              }}
              title="Edit clause"
              className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all"
            >
              <PencilSquareIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(c);
              }}
              disabled={deletingId === c.id}
              title="Delete clause"
              className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-50"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deletingId, copyingId]
  );

  /**
   * Copies a clause and opens it for editing straight away - you duplicate in
   * order to change the wording, so returning to the list would only mean a
   * second click.
   */
  const handleDuplicate = async (clause: QuotationTermsClause) => {
    try {
      setCopyingId(clause.id);
      const response = await fetch(
        `/api/quotations/terms-clauses/${clause.id}/duplicate`,
        { method: "POST" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to duplicate");
      await load();
      setEditing(data.clause);
      setIsModalOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to duplicate");
    } finally {
      setCopyingId(null);
    }
  };

  const handleDelete = async (clause: QuotationTermsClause) => {
    if (
      !(await confirm({
        title: `Delete "${clause.title}"?`,
        message: "This clause cannot be recovered.",
      }))
    ) {
      return;
    }
    try {
      setDeletingId(clause.id);
      const response = await fetch(
        `/api/quotations/terms-clauses/${clause.id}`,
        { method: "DELETE" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to delete");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <SettingsPageLayout isLoading={isLoading}>
      <SettingsPageHeader
        title="Quotation T&C Library"
        subtitle="Reusable terms and conditions clauses"
        breadcrumbs={[
          { label: "Quotations", href: "/dashboard/quotations" },
          { label: "T&C Library" },
        ]}
        icon={<ScaleIcon className="w-4 h-4 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        actions={
          <button
            onClick={() => {
              setEditing(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-all"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New Clause
          </button>
        }
      />

      <SettingsPageContent>
        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <AppTable<QuotationTermsClause>
          data={paginatedData}
          columns={columns}
          keyExtractor={(c) => c.id}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search clauses..."
          sortable
          sortState={sortState}
          onSort={handleSort}
          pagination={pagination}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          stickyHeader
          emptyState={{
            icon: <ScaleIcon className="w-6 h-6 text-slate-400" />,
            title: search ? "No clauses match your search" : "No clauses yet",
            description: search
              ? "Try a different search."
              : "Add the terms you attach to every quotation.",
          }}
        />
      </SettingsPageContent>

      <TermsClauseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clause={editing}
        categories={categories}
        onSaved={load}
      />
      {confirmDialog}
    </SettingsPageLayout>
  );
}

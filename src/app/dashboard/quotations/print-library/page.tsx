"use client";

/**
 * Quotation Print Library.
 *
 * Named, reusable print formats. One quotation often needs two documents - a
 * space-level version for the client and a full-detail version for the site
 * team - so these are picked at print time rather than fixed on the quotation.
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
import { PrintFormatModal } from "@/components/quotations/PrintFormatModal";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import {
  ITEMISE_LEVEL_LABELS,
  PRICE_AT_LABELS,
  type QuotationPrintFormat,
} from "@/types/quotations";

export default function PrintLibraryPage() {
  const { confirm, confirmDialog } = useConfirm();
  const [formats, setFormats] = useState<QuotationPrintFormat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<QuotationPrintFormat | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      // Inactive formats are shown here - this is where you manage them, so
      // hiding them would make them unreachable.
      const response = await fetch(
        "/api/quotations/print-formats?include_inactive=true"
      );
      if (!response.ok) throw new Error("Failed to load print formats");
      const data = await response.json();
      setFormats(data.formats || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { sortState, handleSort, sortData } = useAppTableSort<QuotationPrintFormat>();

  // Matches on everything the table shows, including the human-readable
  // labels rather than the stored enum values - searching "spaces only"
  // should find what the Detail column actually reads.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = !q
      ? formats
      : formats.filter((f) =>
          [
            f.name,
            f.description || "",
            ITEMISE_LEVEL_LABELS[f.itemise_to],
            PRICE_AT_LABELS[f.price_at],
            f.is_active ? "active" : "inactive",
            f.is_default ? "default" : "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
        );

    return sortData(matched, (item, column) => {
      switch (column) {
        case "name":
          return item.name.toLowerCase();
        case "itemise_to":
          return ITEMISE_LEVEL_LABELS[item.itemise_to];
        case "price_at":
          return PRICE_AT_LABELS[item.price_at];
        case "is_active":
          return item.is_active ? 1 : 0;
        default:
          return null;
      }
    });
  }, [formats, search, sortData]);

  const { paginatedData, pagination, setPage, setPageSize } =
    useAppTablePagination(filtered, 25);

  const columns: ColumnDef<QuotationPrintFormat>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        width: "34%",
        sortable: true,
        render: (f) => (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">
                {f.name}
              </span>
              {f.is_default && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <StarIcon className="w-3 h-3" />
                  Default
                </span>
              )}
              {f.cover_enabled && f.cover_image_path && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  Cover
                </span>
              )}
            </div>
            {f.description && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {f.description}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "itemise_to",
        header: "Detail",
        width: "23%",
        sortable: true,
        render: (f) => (
          <span className="text-xs text-slate-600">
            {ITEMISE_LEVEL_LABELS[f.itemise_to]}
          </span>
        ),
      },
      {
        key: "price_at",
        header: "Pricing",
        width: "23%",
        sortable: true,
        render: (f) => (
          <span className="text-xs text-slate-600">
            {PRICE_AT_LABELS[f.price_at]}
          </span>
        ),
      },
      {
        key: "is_active",
        header: "Status",
        width: "10%",
        sortable: true,
        render: (f) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
              f.is_active
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-slate-100 text-slate-500 border border-slate-200"
            }`}
          >
            {f.is_active ? "Active" : "Inactive"}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        width: "10%",
        align: "right",
        render: (f) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleDuplicate(f);
              }}
              disabled={copyingId === f.id}
              title="Duplicate format"
              className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all disabled:opacity-50"
            >
              <DocumentDuplicateIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(f);
                setIsModalOpen(true);
              }}
              title="Edit format"
              className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all"
            >
              <PencilSquareIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(f);
              }}
              disabled={deletingId === f.id}
              title="Delete format"
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
   * Copies a format and opens the copy for editing straight away - the point
   * of duplicating is to change something, so landing on the list would just
   * mean a second click.
   */
  const handleDuplicate = async (format: QuotationPrintFormat) => {
    try {
      setCopyingId(format.id);
      const response = await fetch(
        `/api/quotations/print-formats/${format.id}/duplicate`,
        { method: "POST" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to duplicate");
      await load();
      setEditing(data.format);
      setIsModalOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to duplicate");
    } finally {
      setCopyingId(null);
    }
  };

  const handleDelete = async (format: QuotationPrintFormat) => {
    if (
      !(await confirm({
        title: `Delete "${format.name}"?`,
        message: "This print format cannot be recovered.",
      }))
    ) {
      return;
    }
    try {
      setDeletingId(format.id);
      const response = await fetch(
        `/api/quotations/print-formats/${format.id}`,
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
        title="Quotation Print Library"
        subtitle="How quotations look when printed or sent"
        breadcrumbs={[
          { label: "Quotations", href: "/dashboard/quotations" },
          { label: "Print Library" },
        ]}
        icon={<DocumentTextIcon className="w-4 h-4 text-white" />}
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
            New Format
          </button>
        }
      />

      <SettingsPageContent>
        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Same table component the leads and quotations lists use, so search,
            sorting and pagination behave identically here. */}
        <AppTable<QuotationPrintFormat>
          data={paginatedData}
          columns={columns}
          keyExtractor={(f) => f.id}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search print formats..."
          sortable
          sortState={sortState}
          onSort={handleSort}
          pagination={pagination}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          stickyHeader
          emptyState={{
            icon: <DocumentTextIcon className="w-6 h-6 text-slate-400" />,
            title: search ? "No formats match your search" : "No print formats yet",
            description: search
              ? "Try a different search."
              : "Create one to control how quotations are printed.",
          }}
        />
      </SettingsPageContent>

      <PrintFormatModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        format={editing}
        onSaved={load}
      />
      {confirmDialog}
    </SettingsPageLayout>
  );
}

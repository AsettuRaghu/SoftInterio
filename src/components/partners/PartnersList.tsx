"use client";

/**
 * Partners - everyone this business works with, one list per hat.
 *
 * /dashboard/partners shows everyone; /dashboard/partners/t/customer the
 * customers, /t/distributor the distributors. The menu offers one entry per
 * shipped type; a business's own types appear as tabs here. Same list shape
 * as leads, projects and quotations. See docs/plans/partners.md.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/PageLayout";
import { AppTable, useAppTableSort, useAppTablePagination, type ColumnDef } from "@/components/ui/AppTable";
import { Headline, StatusPill, Chip, UpdatedCell } from "@/components/ui/list-cells";
import { Toast } from "@/components/ui/Toast";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { PlusIcon, UsersIcon } from "@heroicons/react/24/outline";
import { PartnerFormModal, type PartnerType } from "@/components/partners/PartnerFormModal";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface PartnerRow {
  id: string;
  kind: "person" | "organisation";
  name: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  types: string[];
  primary_contact: { name: string; phone: string | null; designation: string | null } | null;
  contacts_count: number;
  leads_count: number;
  projects_count: number;
  purchase_orders_count: number;
}

export function PartnersList({ type = "" }: { type?: string }) {
  const router = useRouter();
  const { hasPermission } = useUserPermissions();

  const [types, setTypes] = useState<PartnerType[]>([]);
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const { sortState, handleSort, sortData } = useAppTableSort<PartnerRow>();

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([fetch("/api/partners/types"), fetch("/api/partners")]);
      const tj = await t.json().catch(() => ({}));
      const pj = await p.json().catch(() => ({}));
      if (t.ok) setTypes(tj.data ?? []);
      if (p.ok) setRows(pj.data ?? []);
      else setNotice({ message: pj.error || "Could not load partners", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const typeLabel = useMemo(() => new Map(types.map((t) => [t.code, t.label])), [types]);
  const current = types.find((t) => t.code === type) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (!type || r.types.includes(type)) &&
        (showInactive || r.status === "active") &&
        (!q ||
          [r.name, r.display_name, r.phone, r.email, r.city, r.primary_contact?.name, r.primary_contact?.phone, ...r.types.map((t) => typeLabel.get(t))]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)))
    );
    return sortData(list, (item, column) => {
      switch (column) {
        case "name":
          return item.name.toLowerCase();
        case "city":
          return (item.city || "").toLowerCase();
        case "work":
          return item.leads_count + item.projects_count + item.purchase_orders_count;
        case "status":
          return item.status === "active" ? 1 : 0;
        case "updated_at":
          return item.updated_at || item.created_at;
        default:
          return null;
      }
    });
  }, [rows, type, query, showInactive, sortData, typeLabel]);

  const { paginatedData, pagination, setPage, setPageSize } = useAppTablePagination(filtered, 25);

  const columns: ColumnDef<PartnerRow>[] = [
    {
      key: "name",
      header: current ? current.label : "Partner",
      width: "30%",
      sortable: true,
      render: (p) => (
        <Headline
          title={p.name}
          chips={
            <>
              {p.types
                .filter((t) => t !== type)
                .map((t) => (
                  <Chip key={t} label={typeLabel.get(t) ?? t} tone="violet" />
                ))}
            </>
          }
          line1={[p.kind === "organisation" ? "Organisation" : "Person", p.city].filter(Boolean).join(" · ")}
          line2={
            p.primary_contact && p.primary_contact.name !== p.name
              ? `${p.primary_contact.name}${p.primary_contact.designation ? ` · ${p.primary_contact.designation}` : ""}`
              : undefined
          }
        />
      ),
    },
    {
      key: "contact",
      header: "Reach them on",
      width: "20%",
      render: (p) => {
        const phone = p.primary_contact?.phone || p.phone;
        return (
          <div className="min-w-0">
            <p className="text-sm text-slate-700 tabular-nums">{phone || <span className="text-slate-300">no phone</span>}</p>
            <p className="text-xs text-slate-400 truncate">{p.email || ""}</p>
            {p.contacts_count > 1 && (
              <p className="text-xs text-slate-400">
                {p.contacts_count} contacts
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "work",
      header: "Work together",
      width: "20%",
      sortable: true,
      render: (p) => {
        const parts = [
          p.projects_count ? `${p.projects_count} project${p.projects_count === 1 ? "" : "s"}` : null,
          p.leads_count ? `${p.leads_count} lead${p.leads_count === 1 ? "" : "s"}` : null,
          p.purchase_orders_count ? `${p.purchase_orders_count} purchase order${p.purchase_orders_count === 1 ? "" : "s"}` : null,
        ].filter(Boolean);
        return parts.length ? (
          <p className="text-sm text-slate-700">{parts.join(" · ")}</p>
        ) : (
          <p className="text-xs text-slate-400">nothing yet</p>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      sortable: true,
      render: (p) => <StatusPill label={p.status === "active" ? "Active" : "Inactive"} tone={p.status === "active" ? "green" : "slate"} />,
    },
    {
      key: "updated_at",
      header: "Last Updated",
      width: "14%",
      sortable: true,
      render: (p) => <UpdatedCell created_at={p.created_at} updated_at={p.updated_at} />,
    },
  ];

  return (
    <PageLayout isLoading={loading} loadingText="Loading partners...">
      <PageHeader
        title={current ? `${current.label}s` : "Partners"}
        subtitle={current?.description || "Everyone this business works with."}
        basePath={{ label: "Partners", href: "/dashboard/partners" }}
        breadcrumbs={current ? [{ label: current.label }] : []}
        actions={
          hasPermission("clients.create") ? (
            <button type="button" onClick={() => setAdding(true)} className={cn(buttonVariants())}>
              <PlusIcon className="w-4 h-4 mr-1.5" />
              New {current ? current.label.toLowerCase() : "partner"}
            </button>
          ) : undefined
        }
      />
      <PageContent>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/partners")}
            className={cn("px-3 py-1.5 text-xs font-medium rounded-full border", !type ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}
          >
            All {rows.length}
          </button>
          {types.map((t) => {
            const n = rows.filter((r) => r.types.includes(t.code) && (showInactive || r.status === "active")).length;
            return (
              <button
                key={t.code}
                type="button"
                onClick={() => router.push(`/dashboard/partners/t/${t.code}`)}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-full border", type === t.code ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}
              >
                {t.label} {n}
              </button>
            );
          })}
          <span className="flex-1" />
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            show inactive
          </label>
        </div>

        <AppTable<PartnerRow>
          data={paginatedData}
          columns={columns}
          keyExtractor={(p) => p.id}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search by name, phone, email, city…"
          sortable
          sortState={sortState}
          onSort={handleSort}
          pagination={pagination}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          stickyHeader
          onRowClick={(p) => router.push(`/dashboard/partners/${p.id}`)}
          emptyState={{
            icon: <UsersIcon className="w-6 h-6 text-slate-400" />,
            title: query ? "No partners match" : current ? `No ${current.label.toLowerCase()}s yet` : "No partners yet",
            description: query ? "Try a different search." : "Add the people and companies this business works with.",
          }}
        />
      </PageContent>

      <PartnerFormModal
        isOpen={adding}
        onClose={() => setAdding(false)}
        types={types}
        defaultType={type || undefined}
        onSaved={(id) => {
          setNotice({ message: "Partner added.", variant: "success" });
          void load();
          router.push(`/dashboard/partners/${id}`);
        }}
        onPickExisting={(id) => router.push(`/dashboard/partners/${id}`)}
      />
      <Toast message={notice?.message ?? null} variant={notice?.variant ?? "error"} onDismiss={() => setNotice(null)} />
    </PageLayout>
  );
}

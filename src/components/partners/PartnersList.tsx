"use client";

/**
 * Partners - everyone this business works with, one list per hat.
 *
 * /dashboard/partners/t/customer is the customers, /t/architect the
 * architects. The page is built the way every list page in the app is: the
 * header with its icon and one primary action, a one-line filter bar
 * (search, then "Status: …" dropdowns), and a fixed-layout table whose
 * first column is the name in bold with what-it-is beneath. See
 * docs/plans/partners.md.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/PageLayout";
import { AppTable, useAppTableSort, useAppTablePagination, type ColumnDef } from "@/components/ui/AppTable";
import { ListFilterBar, MultiSelectFilter } from "@/components/ui/ListFilterBar";
import { Headline, StatusPill, Chip, UpdatedCell } from "@/components/ui/list-cells";
import { Toast } from "@/components/ui/Toast";
import { PlusIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { PartnerFormModal, type PartnerType } from "@/components/partners/PartnerFormModal";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { isEnabledPartnerType } from "@/lib/partners/enabled-types";

interface PartnerRow {
  id: string;
  kind: "person" | "organisation";
  name: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  status: "active" | "inactive";
  on_platform: boolean;
  created_at: string;
  updated_at: string;
  types: string[];
  primary_contact: { name: string; phone: string | null; designation: string | null } | null;
  contacts_count: number;
  leads_count: number;
  projects_count: number;
  purchase_orders_count: number;
}

type StatusKey = "active" | "inactive";
type PlatformKey = "on" | "off";

export function PartnersList({ type = "" }: { type?: string }) {
  const router = useRouter();
  const { hasPermission } = useUserPermissions();

  const [types, setTypes] = useState<PartnerType[]>([]);
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<StatusKey[]>(["active"]);
  const [platform, setPlatform] = useState<PlatformKey[]>(["on", "off"]);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const { sortState, handleSort, sortData } = useAppTableSort<PartnerRow>();

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([fetch("/api/partners/types"), fetch("/api/partners")]);
      const tj = await t.json().catch(() => ({}));
      const pj = await p.json().catch(() => ({}));
      if (t.ok) setTypes((tj.data ?? []).filter((x: PartnerType) => isEnabledPartnerType(x.code)));
      if (p.ok) setRows((pj.data ?? []).filter((r: PartnerRow) => r.types.some(isEnabledPartnerType)));
      else setError(pj.error || "Could not load partners");
    } catch {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const typeLabel = useMemo(() => new Map(types.map((t) => [t.code, t.label])), [types]);
  const current = types.find((t) => t.code === type) ?? null;
  const noun = current ? current.label.toLowerCase() : "partner";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (!type || r.types.includes(type)) &&
        statuses.includes(r.status) &&
        platform.includes(r.on_platform ? "on" : "off") &&
        (!q ||
          [r.name, r.display_name, r.phone, r.email, r.city, r.primary_contact?.name, r.primary_contact?.phone]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)))
    );
    return sortData(list, (item, column) => {
      switch (column) {
        case "name":
          return item.name.toLowerCase();
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
  }, [rows, type, query, statuses, platform, sortData]);

  const { paginatedData, pagination, setPage, setPageSize } = useAppTablePagination(filtered, 25);

  const columns: ColumnDef<PartnerRow>[] = [
    {
      key: "name",
      header: current ? current.label : "Partner",
      width: "28%",
      sortable: true,
      render: (p) => (
        <Headline
          title={p.name}
          chips={
            <>
              {p.types
                .filter((t) => t !== type && isEnabledPartnerType(t))
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
      header: "Contact",
      width: "18%",
      render: (p) => {
        const phone = p.primary_contact?.phone || p.phone;
        return (
          <div className="space-y-0.5">
            <p className="text-sm text-slate-700 tabular-nums">{phone || <span className="text-slate-400">—</span>}</p>
            {p.email && <p className="text-xs text-slate-500 truncate">{p.email}</p>}
            {p.contacts_count > 1 && <p className="text-xs text-slate-400">{p.contacts_count} contacts</p>}
          </div>
        );
      },
    },
    {
      key: "work",
      header: "Work Together",
      width: "18%",
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
          <p className="text-sm text-slate-400">—</p>
        );
      },
    },
    {
      key: "platform",
      header: "On SoftInterio",
      width: "12%",
      // Whether the party has an account of their own on the platform. The
      // ecosystem - their portal, ratings, services - hangs off that; today
      // nobody is linked, and the column says so honestly.
      render: (p) =>
        p.on_platform ? (
          <StatusPill label="Subscriber" tone="blue" />
        ) : (
          <span className="text-xs text-slate-400">Not yet</span>
        ),
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
    <PageLayout isLoading={loading} loadingText={`Loading ${noun}s...`}>
      <PageHeader
        title={current ? `${current.label}s` : "Partners"}
        subtitle={current?.description || "Everyone this business works with."}
        breadcrumbs={current ? [{ label: `${current.label}s` }] : []}
        basePath={{ label: "Partners", href: "/dashboard/partners" }}
        icon={<UserGroupIcon className="w-5 h-5 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        actions={
          hasPermission("partners.create") ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all text-sm font-medium flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Add {current ? current.label : "Partner"}
            </button>
          ) : undefined
        }
      />

      <PageContent noPadding>
        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center px-4">
            <p className="text-sm font-medium text-red-600 mb-1">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setLoading(true);
                void load();
              }}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            <ListFilterBar
              searchValue={query}
              onSearchChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
              searchPlaceholder="Search by name, phone, email, city..."
            >
              <MultiSelectFilter<StatusKey>
                label="Status"
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
                selected={statuses}
                onChange={(v) => {
                  setStatuses(v);
                  setPage(1);
                }}
              />
              <MultiSelectFilter<PlatformKey>
                label="On SoftInterio"
                options={[
                  { value: "on", label: "Subscriber" },
                  { value: "off", label: "Not yet" },
                ]}
                selected={platform}
                onChange={(v) => {
                  setPlatform(v);
                  setPage(1);
                }}
              />
            </ListFilterBar>

            <AppTable<PartnerRow>
              className="table-fixed"
              data={paginatedData}
              columns={columns}
              keyExtractor={(p) => p.id}
              showToolbar={false}
              sortable
              sortState={sortState}
              onSort={handleSort}
              pagination={pagination}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onRowClick={(p) => router.push(`/dashboard/partners/${p.id}`)}
              emptyState={{
                icon: <UserGroupIcon className="w-6 h-6 text-slate-400" />,
                title: query ? `No ${noun}s match` : `No ${noun}s yet`,
                description: query ? "Try adjusting your search" : `Add the ${noun}s this business works with.`,
              }}
            />
          </>
        )}
      </PageContent>

      <PartnerFormModal
        isOpen={adding}
        onClose={() => setAdding(false)}
        types={types}
        defaultType={type || undefined}
        onSaved={(id) => {
          setNotice({ message: `${current ? current.label : "Partner"} added.`, variant: "success" });
          void load();
          router.push(`/dashboard/partners/${id}`);
        }}
        onPickExisting={(id) => router.push(`/dashboard/partners/${id}`)}
      />
      <Toast message={notice?.message ?? null} variant={notice?.variant ?? "error"} onDismiss={() => setNotice(null)} />
    </PageLayout>
  );
}

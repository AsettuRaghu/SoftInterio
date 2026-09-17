"use client";

/**
 * One partner: who they are to us, the people at them, and everything we
 * have done together. Tabs depend on the hats: a customer has leads,
 * projects and quotations; a vendor has purchase orders. Same header and
 * tab bar as the lead and project pages.
 */

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { isEnabledPartnerType } from "@/lib/partners/enabled-types";
import { useParams, useRouter } from "next/navigation";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/PageLayout";
import { Headline, StatusPill, Chip } from "@/components/ui/list-cells";
import { Toast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { PartnerFormModal, type PartnerType } from "@/components/partners/PartnerFormModal";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { QuotationStatusLabels, QuotationStatusColors, type QuotationStatus } from "@/types/quotations";
import { LeadStageLabels, type LeadStage } from "@/types/leads";
import { ProjectStatusLabels, type ProjectStatus } from "@/types/projects";

interface Contact {
  id: string;
  name: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  notes: string | null;
}

interface Partner {
  id: string;
  kind: "person" | "organisation";
  name: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gst_number: string | null;
  pan_number: string | null;
  notes: string | null;
  status: "active" | "inactive";
  platform_identity_id: string | null;
  created_at: string;
  updated_at: string;
  types: string[];
  contacts: Contact[];
  client_ids: string[];
  vendor: { id: string; code: string | null; payment_terms: string | null; credit_days: number | null } | null;
}

interface Related {
  leads: any[];
  projects: any[];
  quotations: any[];
  purchase_orders: any[];
}

const money = (n: number | null | undefined) =>
  n == null ? "—" : `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;
const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function PartnerPage() {
  return (
    <Suspense fallback={null}>
      <PartnerDetail />
    </Suspense>
  );
}

function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useUserPermissions();
  const canEdit = hasPermission("clients.edit");
  const { confirm, confirmDialog } = useConfirm();

  const [partner, setPartner] = useState<Partner | null>(null);
  const [related, setRelated] = useState<Related | null>(null);
  const [types, setTypes] = useState<PartnerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "contacts" | "work" | "quotations" | "orders">("overview");
  const [editing, setEditing] = useState(false);
  const [contactModal, setContactModal] = useState<{ open: boolean; contact: Contact | null }>({ open: false, contact: null });
  const [notice, setNotice] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    const [p, r, t] = await Promise.all([fetch(`/api/partners/${id}`), fetch(`/api/partners/${id}/related`), fetch("/api/partners/types")]);
    const pj = await p.json().catch(() => ({}));
    const rj = await r.json().catch(() => ({}));
    const tj = await t.json().catch(() => ({}));
    if (p.ok) setPartner(pj.data);
    else setNotice({ message: pj.error || "Could not load the partner", variant: "error" });
    if (r.ok) setRelated(rj.data);
    if (t.ok) setTypes((tj.data ?? []).filter((x: PartnerType) => isEnabledPartnerType(x.code)));
    setLoading(false);
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const typeLabel = new Map(types.map((t) => [t.code, t.label]));
  const primaryType = types.find((t) => partner?.types.includes(t.code)) ?? null;
  const isCustomer = partner?.types.includes("customer");
  const isVendor = !!partner?.vendor || !!partner?.types.some((t) => ["distributor", "producer", "interior_factory", "contractor"].includes(t));

  const setStatus = async (status: "active" | "inactive") => {
    if (status === "inactive" && !(await confirm({ title: `Mark ${partner?.name} inactive?`, message: "They stay on record; they stop being offered.", confirmLabel: "Mark inactive", tone: "warning" }))) return;
    const res = await fetch(`/api/partners/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setNotice({ message: json.error || "Could not change status", variant: "error" });
    setPartner(json.data);
    setNotice({ message: status === "active" ? "Partner active again." : "Partner marked inactive.", variant: "success" });
  };

  const removeContact = async (c: Contact) => {
    if (!(await confirm({ title: `Remove ${c.name}?`, confirmLabel: "Remove", tone: "danger" }))) return;
    const res = await fetch(`/api/partners/${id}/contacts/${c.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setNotice({ message: json.error || "Could not remove", variant: "error" });
    void load();
  };
  const makePrimary = async (c: Contact) => {
    const res = await fetch(`/api/partners/${id}/contacts/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_primary: true }) });
    if (!res.ok) return setNotice({ message: "Could not change the primary contact", variant: "error" });
    void load();
  };

  if (loading || !partner) return <PageLayout isLoading loadingText="Loading partner..."><div /></PageLayout>;

  const tabs: { key: typeof tab; label: string; count?: number; show: boolean }[] = [
    { key: "overview", label: "Overview", show: true },
    { key: "contacts", label: "Contacts", count: partner.contacts.length, show: true },
    { key: "work", label: "Leads & Projects", count: (related?.leads.length ?? 0) + (related?.projects.length ?? 0), show: !!isCustomer },
    { key: "quotations", label: "Quotations", count: related?.quotations.length ?? 0, show: !!isCustomer || (related?.quotations.length ?? 0) > 0 },
    { key: "orders", label: "Purchase Orders", count: related?.purchase_orders.length ?? 0, show: isVendor },
  ];

  return (
    <PageLayout>
      <PageHeader
        title={partner.name}
        subtitle={[partner.kind === "organisation" ? "Organisation" : "Person", partner.types.filter(isEnabledPartnerType).map((t) => typeLabel.get(t) ?? t).join(", "), partner.city].filter(Boolean).join(" · ")}
        basePath={{ label: "Partners", href: "/dashboard/partners" }}
        breadcrumbs={[
          ...(primaryType ? [{ label: `${primaryType.label}s`, href: `/dashboard/partners/t/${primaryType.code}` }] : []),
          { label: partner.name },
        ]}
        icon={<UserGroupIcon className="w-5 h-5 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        actions={
          <div className="flex items-center gap-2">
            {partner.platform_identity_id ? (
              <StatusPill label="On SoftInterio" tone="blue" />
            ) : (
              <span className="text-xs text-slate-400" title="They do not have their own SoftInterio account yet">Not on SoftInterio</span>
            )}
            <StatusPill label={partner.status === "active" ? "Active" : "Inactive"} tone={partner.status === "active" ? "green" : "slate"} />
            {canEdit && (
              <>
                {partner.status === "active" ? (
                  <button type="button" onClick={() => void setStatus("inactive")} className={cn(buttonVariants({ variant: "ghost" }), "text-slate-600")}>
                    Mark inactive
                  </button>
                ) : (
                  <button type="button" onClick={() => void setStatus("active")} className={cn(buttonVariants({ variant: "outline" }))}>
                    Make active
                  </button>
                )}
                <button type="button" onClick={() => setEditing(true)} className={cn(buttonVariants())}>
                  Edit
                </button>
              </>
            )}
          </div>
        }
      />
      <PageContent>
        <div className="border-b border-slate-200 mb-4 overflow-x-auto">
          <nav className="flex gap-1 whitespace-nowrap">
            {tabs
              .filter((t) => t.show)
              .map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2",
                    tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                >
                  {t.label}
                  {typeof t.count === "number" && t.count > 0 ? <span className="ml-1 text-slate-400">{t.count}</span> : null}
                </button>
              ))}
          </nav>
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Details</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Row k="Phone" v={partner.phone} />
                <Row k="Email" v={partner.email} />
                <Row k="Website" v={partner.website} />
                <Row k="Address" v={[partner.address_line1, partner.city, partner.state, partner.pincode].filter(Boolean).join(", ")} />
                {partner.kind === "organisation" && <Row k="GST" v={partner.gst_number} />}
                {partner.kind === "organisation" && <Row k="PAN" v={partner.pan_number} />}
                {partner.vendor?.payment_terms && <Row k="Payment terms" v={partner.vendor.payment_terms} />}
                <Row k="With us since" v={day(partner.created_at)} />
              </dl>
              {partner.notes && (
                <p className="mt-3 text-sm text-slate-600 whitespace-pre-wrap border-t border-slate-100 pt-3">{partner.notes}</p>
              )}
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">What they are to us</h3>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {partner.types.filter(isEnabledPartnerType).map((t) => (
                  <Chip key={t} label={typeLabel.get(t) ?? t} tone="violet" />
                ))}
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Work together</h3>
              <ul className="text-sm text-slate-700 space-y-1">
                {isCustomer && <li>{related?.projects.length ?? 0} projects · {related?.leads.length ?? 0} leads</li>}
                {(related?.quotations.length ?? 0) > 0 && <li>{related?.quotations.length} quotations</li>}
                {isVendor && <li>{related?.purchase_orders.length ?? 0} purchase orders</li>}
                {!isCustomer && !isVendor && <li className="text-slate-400">nothing recorded yet</li>}
              </ul>
              <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-2">Primary contact</h3>
              {(() => {
                const c = partner.contacts.find((x) => x.is_primary) ?? partner.contacts[0];
                return c ? (
                  <p className="text-sm text-slate-700">
                    {c.name}
                    {c.designation ? <span className="text-slate-400"> · {c.designation}</span> : null}
                    <br />
                    <span className="text-xs text-slate-500">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">none yet</p>
                );
              })()}
            </section>
          </div>
        )}

        {tab === "contacts" && (
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm text-slate-600">The people at {partner.name}. One is primary - the owner of the relationship.</p>
              {canEdit && (
                <button type="button" onClick={() => setContactModal({ open: true, contact: null })} className={cn(buttonVariants({ size: "sm" }))}>
                  Add contact
                </button>
              )}
            </div>
            <ul className="divide-y divide-slate-100">
              {partner.contacts.map((c) => (
                <li key={c.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Headline
                      title={c.name}
                      chips={c.is_primary ? <Chip label="Primary" tone="blue" /> : undefined}
                      line1={c.designation || undefined}
                      line2={[c.phone, c.email].filter(Boolean).join(" · ") || undefined}
                    />
                    {c.notes && <p className="text-xs text-slate-500 mt-1">{c.notes}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2 text-xs">
                      {!c.is_primary && (
                        <button type="button" onClick={() => void makePrimary(c)} className="text-slate-500 hover:text-slate-800">
                          Make primary
                        </button>
                      )}
                      <button type="button" onClick={() => setContactModal({ open: true, contact: c })} className="text-blue-600 hover:underline">
                        Edit
                      </button>
                      {!c.is_primary && (
                        <button type="button" onClick={() => void removeContact(c)} className="text-red-600 hover:underline">
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "work" && (
          <div className="space-y-4">
            <ListCard
              title="Projects"
              empty="No projects yet."
              rows={(related?.projects ?? []).map((p) => ({
                id: p.id,
                href: `/dashboard/projects/${p.id}`,
                title: p.name,
                line1: [p.project_number, p.property?.property_name, p.property?.city].filter(Boolean).join(" · "),
                right: <StatusPill label={ProjectStatusLabels[p.status as ProjectStatus] ?? p.status} tone={p.status === "in_progress" ? "blue" : p.status === "completed" ? "green" : p.status === "on_hold" ? "amber" : "slate"} />,
                sub: p.expected_end_date ? `ends ${day(p.expected_end_date)}` : undefined,
              }))}
            />
            <ListCard
              title="Leads"
              empty="No leads yet."
              rows={(related?.leads ?? []).map((l) => ({
                id: l.id,
                href: `/dashboard/sales/leads/${l.id}`,
                title: l.lead_number,
                line1: [l.property?.property_name, l.property?.city, l.service_type].filter(Boolean).join(" · "),
                right: <StatusPill label={LeadStageLabels[l.stage as LeadStage] ?? l.stage} tone={l.stage === "won" ? "green" : ["lost", "disqualified"].includes(l.stage) ? "slate" : "blue"} />,
                sub: l.won_amount ? money(l.won_amount) : `since ${day(l.created_at)}`,
              }))}
            />
          </div>
        )}

        {tab === "quotations" && (
          <ListCard
            title="Quotations"
            empty="No quotations yet."
            rows={(related?.quotations ?? []).map((q) => {
              const c = QuotationStatusColors[q.status as QuotationStatus];
              return {
                id: q.id,
                href: `/dashboard/quotations/${q.id}`,
                title: `${q.quotation_number} · v${q.version}`,
                line1: q.lead_id ? "on a lead" : q.project_id ? "on a project" : "standalone",
                right: (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${c?.bg ?? "bg-slate-100"} ${c?.text ?? "text-slate-600"}`}>
                    {QuotationStatusLabels[q.status as QuotationStatus] ?? q.status}
                  </span>
                ),
                sub: money(q.grand_total),
              };
            })}
          />
        )}

        {tab === "orders" && (
          <ListCard
            title="Purchase orders"
            empty="No purchase orders yet."
            rows={(related?.purchase_orders ?? []).map((po) => ({
              id: po.id,
              href: `/dashboard/stock/purchase-orders/${po.id}`,
              title: po.po_number,
              line1: [po.order_date ? `ordered ${day(po.order_date)}` : null, po.expected_delivery ? `expected ${day(po.expected_delivery)}` : null].filter(Boolean).join(" · "),
              right: <Chip label={String(po.status ?? "").replace(/_/g, " ")} tone="slate" />,
              sub: money(po.total_amount),
            }))}
          />
        )}
      </PageContent>

      <PartnerFormModal
        isOpen={editing}
        onClose={() => setEditing(false)}
        types={types}
        initial={{
          id: partner.id,
          name: partner.name,
          kind: partner.kind,
          types: partner.types,
          phone: partner.phone ?? "",
          email: partner.email ?? "",
          city: partner.city ?? "",
          website: partner.website ?? "",
          gst_number: partner.gst_number ?? "",
          notes: partner.notes ?? "",
        }}
        onSaved={() => {
          setNotice({ message: "Saved.", variant: "success" });
          void load();
        }}
      />
      <ContactModal
        state={contactModal}
        partnerId={partner.id}
        onClose={() => setContactModal({ open: false, contact: null })}
        onSaved={() => {
          setNotice({ message: "Contact saved.", variant: "success" });
          void load();
        }}
      />
      {confirmDialog}
      <Toast message={notice?.message ?? null} variant={notice?.variant ?? "error"} onDismiss={() => setNotice(null)} />
    </PageLayout>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <>
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-slate-800">{v || <span className="text-slate-300">—</span>}</dd>
    </>
  );
}

function ListCard({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { id: string; href: string; title: string; line1?: string; right?: React.ReactNode; sub?: string }[];
}) {
  const router = useRouter();
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">
          {title} <span className="text-slate-400 font-normal">{rows.length}</span>
        </h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} onClick={() => router.push(r.href)} className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50">
              <div className="flex-1 min-w-0">
                <Headline title={r.title} line1={r.line1 || undefined} />
              </div>
              <div className="text-right shrink-0">
                {r.right}
                {r.sub && <p className="text-xs text-slate-500 mt-1 tabular-nums">{r.sub}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactModal({
  state,
  partnerId,
  onClose,
  onSaved,
}: {
  state: { open: boolean; contact: Contact | null };
  partnerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState({ name: "", designation: "", phone: "", email: "", notes: "", is_primary: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!state.open) return;
    const c = state.contact;
    setV({ name: c?.name ?? "", designation: c?.designation ?? "", phone: c?.phone ?? "", email: c?.email ?? "", notes: c?.notes ?? "", is_primary: c?.is_primary ?? false });
    setError(null);
  }, [state]);
  const input = "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";
  const save = async () => {
    if (!v.name.trim()) return setError("Give the contact a name.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(state.contact ? `/api/partners/${partnerId}/contacts/${state.contact.id}` : `/api/partners/${partnerId}/contacts`, {
        method: state.contact ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error || "Could not save");
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      isOpen={state.open}
      onClose={onClose}
      title={state.contact ? "Edit contact" : "Add contact"}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cn(buttonVariants({ variant: "outline" }))}>Cancel</button>
          <button type="button" disabled={busy} onClick={() => void save()} className={cn(buttonVariants())}>{busy ? "Saving…" : "Save"}</button>
        </div>
      }
    >
      <div className="space-y-2">
        <input type="text" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Name *" autoFocus className={input} />
        <input type="text" value={v.designation} onChange={(e) => setV({ ...v, designation: e.target.value })} placeholder="Designation / relationship (e.g. Site engineer, Husband)" className={input} />
        <div className="grid grid-cols-2 gap-2">
          <input type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="Phone" className={input} />
          <input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} placeholder="Email" className={input} />
        </div>
        <textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="Notes" rows={2} className={cn(input, "resize-none")} />
        {!state.contact?.is_primary && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={v.is_primary} onChange={(e) => setV({ ...v, is_primary: e.target.checked })} />
            Make this the primary contact
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

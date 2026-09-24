"use client";

/**
 * One partner: who they are to us, the people at them, and everything we have
 * done together.
 *
 * Built the way every detail page in the app is built, which it was not until
 * 2026-09-24 - the tab lived in state so a reload lost it, the tabs carried
 * count badges the lead and project pages deliberately do not have, the
 * read-only status pills sat in the header's ACTIONS slot among the buttons
 * rather than in `stats` where the lead puts its stage, the Overview cards were
 * plain bordered boxes instead of the tinted-header card both other Overviews
 * use, and the related records were a hand-rolled list of clickable `<li>`s
 * beside an app that has one table component. Partners was the page that
 * prompted "every list page is built the same way - do not ask, copy"; this is
 * the detail half of that.
 *
 * Tabs depend on the hats: a customer has leads, projects and quotations; a
 * vendor has purchase orders.
 */

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isEnabledPartnerType } from "@/lib/partners/enabled-types";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/PageLayout";
import { AppTable } from "@/components/ui/AppTable";
import { DetailCard, DetailField, DetailFields } from "@/components/ui/DetailCard";
import { Headline, StatusPill, Chip } from "@/components/ui/list-cells";
import { Toast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { buttonVariants } from "@/components/ui/Button";
import { useUrlTab } from "@/hooks/useUrlTab";
import { cn } from "@/utils/cn";
import CustomerContacts from "@/components/leads/CustomerContacts";
import { PartnerFormModal, type PartnerType } from "@/components/partners/PartnerFormModal";
import {
  UserGroupIcon,
  IdentificationIcon,
  BriefcaseIcon,
  ChatBubbleBottomCenterTextIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { QuotationStatusLabels, QuotationStatusColors, type QuotationStatus } from "@/types/quotations";
import { LeadStageLabels, type LeadStage } from "@/types/leads";
import { ProjectStatusLabels, type ProjectStatus } from "@/types/projects";
import type { PartnerContact } from "@/types/partners";

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
  contacts: PartnerContact[];
  client_ids: string[];
  vendor: { id: string; code: string | null; payment_terms: string | null; credit_days: number | null } | null;
}

interface RelatedProject {
  id: string;
  name: string | null;
  project_number: string | null;
  status: string | null;
  expected_end_date: string | null;
  property?: { property_name?: string | null; city?: string | null } | null;
}
interface RelatedLead {
  id: string;
  lead_number: string | null;
  stage: string;
  service_type: string | null;
  won_amount: number | null;
  created_at: string;
  property?: { property_name?: string | null; city?: string | null } | null;
}
interface RelatedQuotation {
  id: string;
  quotation_number: string | null;
  version: number | null;
  status: string;
  grand_total: number | null;
  lead_id: string | null;
  project_id: string | null;
}
interface RelatedOrder {
  id: string;
  po_number: string | null;
  status: string | null;
  order_date: string | null;
  expected_delivery: string | null;
  total_amount: number | null;
}
interface ReferredLead {
  id: string;
  lead_number: string | null;
  stage: string;
  won_amount: number | null;
  created_at: string;
  client?: { name?: string | null } | null;
}
interface Related {
  /** Leads this partner INTRODUCED - not leads where they are the customer. */
  referred: ReferredLead[];
  leads: RelatedLead[];
  projects: RelatedProject[];
  quotations: RelatedQuotation[];
  purchase_orders: RelatedOrder[];
}

const TABS = ["overview", "contacts", "referred", "work", "quotations", "orders"] as const;
type Tab = (typeof TABS)[number];

const money = (n: number | null | undefined) =>
  n == null ? "—" : `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;
const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

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
  const canEdit = hasPermission("partners.edit");
  const { confirm, confirmDialog } = useConfirm();

  const [partner, setPartner] = useState<Partner | null>(null);
  const [related, setRelated] = useState<Related | null>(null);
  const [types, setTypes] = useState<PartnerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, selectTab] = useUrlTab<Tab>(TABS, "overview");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    const [p, r, t] = await Promise.all([
      fetch(`/api/partners/${id}`),
      fetch(`/api/partners/${id}/related`),
      fetch("/api/partners/types"),
    ]);
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
    // setState happens after the fetch resolves, not synchronously; the rule cannot see through `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const typeLabel = new Map(types.map((t) => [t.code, t.label]));
  const primaryType = types.find((t) => partner?.types.includes(t.code)) ?? null;
  const isCustomer = partner?.types.includes("customer");
  const isVendor =
    !!partner?.vendor ||
    !!partner?.types.some((t) => ["distributor", "producer", "interior_factory", "contractor"].includes(t));
  /**
   * A partner whose whole purpose is sending work our way. Referring is what an
   * architect IS, so the tab is theirs whether or not anything has arrived yet -
   * an empty one saying "no lead names Naveen yet" is a page that explains
   * itself, where an absent one just looks poorer than a customer's.
   */
  const isReferrer = !!partner?.types.includes("architect");

  const setStatus = async (status: "active" | "inactive") => {
    if (
      status === "inactive" &&
      !(await confirm({
        title: `Mark ${partner?.name} inactive?`,
        message: "They stay on record; they stop being offered.",
        confirmLabel: "Mark inactive",
        tone: "warning",
      }))
    )
      return;
    const res = await fetch(`/api/partners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setNotice({ message: json.error || "Could not change status", variant: "error" });
    setPartner(json.data);
    setNotice({
      message: status === "active" ? "Partner active again." : "Partner marked inactive.",
      variant: "success",
    });
  };

  if (loading || !partner) {
    return (
      <PageLayout isLoading loadingText="Loading partner...">
        <div />
      </PageLayout>
    );
  }

  const counts = {
    referred: related?.referred?.length ?? 0,
    leads: related?.leads.length ?? 0,
    projects: related?.projects.length ?? 0,
    quotations: related?.quotations.length ?? 0,
    orders: related?.purchase_orders.length ?? 0,
  };

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "overview", label: "Overview", show: true },
    { key: "contacts", label: "Contacts", show: true },
    // An architect refers work without ever being a customer, so this tab shows
    // whenever there is anything to show rather than depending on a hat.
    /**
     * **A tab shows when it has something to show, or when the hat says it will.**
     *
     * These were gated on the HAT alone - `work` on `isCustomer`, `orders` on
     * `isVendor` - so an architect saw Overview and Contacts and nothing else,
     * which read as a different, poorer page than a customer's (2026-09-24).
     * Gating on content fixes it without inventing anything: an architect gets
     * Referred to Us, and gets Leads & Projects the day one of them is also a
     * customer of ours.
     *
     * The hat is still consulted, so a customer with nothing yet still sees where
     * their leads WILL appear rather than a page that grows tabs later.
     */
    { key: "referred", label: "Referred to Us", show: isReferrer || counts.referred > 0 },
    { key: "work", label: "Leads & Projects", show: !!isCustomer || counts.leads + counts.projects > 0 },
    { key: "quotations", label: "Quotations", show: !!isCustomer || counts.quotations > 0 },
    { key: "orders", label: "Purchase Orders", show: isVendor || counts.orders > 0 },
  ];
  const visible = tabs.filter((t) => t.show);
  // A tab in the URL that this partner does not have - ?tab=orders on a
  // customer - falls back rather than rendering an empty page.
  const active: Tab = visible.some((t) => t.key === tab) ? tab : "overview";

  /** What their referrals have actually won us - the number an incentive is worked out from. */
  const referredWon = (related?.referred ?? []).reduce((n, l) => n + Number(l.won_amount ?? 0), 0);

  const mainContact = partner.contacts.find((c) => c.is_primary) ?? partner.contacts[0] ?? null;
  const deciders = partner.contacts.filter((c) => c.is_decision_maker);

  return (
    <PageLayout>
      <PageHeader
        title={partner.name}
        subtitle={[
          partner.kind === "organisation" ? "Organisation" : "Person",
          partner.types.filter(isEnabledPartnerType).map((t) => typeLabel.get(t) ?? t).join(", "),
          partner.city,
        ]
          .filter(Boolean)
          .join(" · ")}
        basePath={{ label: "Partners", href: "/dashboard/partners" }}
        breadcrumbs={[
          ...(primaryType
            ? [{ label: `${primaryType.label}s`, href: `/dashboard/partners/t/${primaryType.code}` }]
            : []),
          { label: partner.name },
        ]}
        icon={<UserGroupIcon className="w-5 h-5 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        // What the record IS goes in `stats`, beside the title and behind a
        // divider - the same slot the lead page puts its stage and priority in.
        // These were in `actions`, which reads as "things you can press".
        stats={
          <div className="flex items-center gap-2">
            <StatusPill
              label={partner.status === "active" ? "Active" : "Inactive"}
              tone={partner.status === "active" ? "green" : "slate"}
            />
            {partner.platform_identity_id ? (
              <StatusPill label="On SoftInterio" tone="blue" />
            ) : (
              <span
                className="text-[11px] text-slate-400"
                title="They do not have their own SoftInterio account yet"
              >
                Not on SoftInterio
              </span>
            )}
          </div>
        }
        actions={
          canEdit ? (
            <>
              {partner.status === "active" ? (
                <button
                  type="button"
                  onClick={() => void setStatus("inactive")}
                  className={cn(buttonVariants({ variant: "ghost" }), "text-slate-600")}
                >
                  Mark inactive
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void setStatus("active")}
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Make active
                </button>
              )}
              <button type="button" onClick={() => setEditing(true)} className={cn(buttonVariants())}>
                Edit
              </button>
            </>
          ) : undefined
        }
      />
      <PageContent>
        {/* The lead and project tab bar, exactly: no icons and no count badges.
            A number beside a label makes the reader count things before they
            have decided which tab they want. */}
        <div className="border-b border-slate-200 mb-4 overflow-x-auto">
          <nav className="flex gap-1 whitespace-nowrap">
            {visible.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => selectTab(t.key)}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2",
                  active === t.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {active === "overview" && (
          <div className="space-y-4">
            <DetailCard
              title="Contact Details"
              tone="blue"
              icon={
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                </svg>
              }
            >
              <DetailFields>
                <DetailField label="Phone" value={partner.phone} href={partner.phone ? `tel:${partner.phone}` : null} />
                <DetailField
                  label="Email"
                  value={partner.email}
                  href={partner.email ? `mailto:${partner.email}` : null}
                />
                <DetailField
                  label="Website"
                  value={partner.website}
                  href={
                    partner.website
                      ? partner.website.startsWith("http")
                        ? partner.website
                        : `https://${partner.website}`
                      : null
                  }
                />
                <DetailField
                  label="Address"
                  value={[partner.address_line1, partner.city, partner.state, partner.pincode]
                    .filter(Boolean)
                    .join(", ")}
                />
                {partner.kind === "organisation" && <DetailField label="GST" value={partner.gst_number} />}
                {partner.kind === "organisation" && <DetailField label="PAN" value={partner.pan_number} />}
                {partner.vendor?.payment_terms && (
                  <DetailField label="Payment terms" value={partner.vendor.payment_terms} />
                )}
                <DetailField label="With us since" value={day(partner.created_at)} />
              </DetailFields>
            </DetailCard>

            <DetailCard
              title="The Relationship"
              tone="purple"
              icon={<IdentificationIcon className="w-3 h-3" />}
            >
              <DetailFields>
                <DetailField
                  label="What they are to us"
                  value={
                    partner.types.filter(isEnabledPartnerType).length ? (
                      <span className="inline-flex flex-wrap gap-1.5 align-middle">
                        {partner.types.filter(isEnabledPartnerType).map((t) => (
                          <Chip key={t} label={typeLabel.get(t) ?? t} tone="violet" />
                        ))}
                      </span>
                    ) : null
                  }
                />
                <DetailField
                  label="Main contact"
                  value={
                    mainContact
                      ? `${mainContact.name}${mainContact.designation ? ` · ${mainContact.designation}` : ""}`
                      : null
                  }
                />
                <DetailField
                  label="Reach them on"
                  value={mainContact ? [mainContact.phone, mainContact.email].filter(Boolean).join(" · ") : null}
                />
                {/* Who signs off, which is the fact a seller acts on and the one
                    this page could not show until the flag existed. */}
                <DetailField
                  label="Decides"
                  value={deciders.length ? deciders.map((c) => c.name).join(", ") : null}
                />
                <DetailField label="People on record" value={plural(partner.contacts.length, "contact")} />
              </DetailFields>
            </DetailCard>

            <DetailCard title="Work Together" tone="green" icon={<BriefcaseIcon className="w-3 h-3" />}>
              <DetailFields>
                {/* First, because for an architect it is the only number that
                    matters and the reason the record exists. */}
                {counts.referred > 0 && (
                  <DetailField label="Referred to us" value={plural(counts.referred, "lead")} />
                )}
                {counts.referred > 0 && (
                  <DetailField label="Won from referrals" value={money(referredWon) } />
                )}
                {(isCustomer || counts.projects > 0) && (
                  <DetailField label="Projects" value={plural(counts.projects, "project")} />
                )}
                {(isCustomer || counts.leads > 0) && (
                  <DetailField label="Leads" value={plural(counts.leads, "lead")} />
                )}
                {(isCustomer || counts.quotations > 0) && (
                  <DetailField label="Quotations" value={plural(counts.quotations, "quotation")} />
                )}
                {(isVendor || counts.orders > 0) && (
                  <DetailField label="Purchase orders" value={plural(counts.orders, "purchase order")} />
                )}
                {/* A partner who is only a referrer would otherwise show an empty
                    card, which reads as a missing feature rather than a fact. */}
                {!isCustomer && !isVendor && counts.referred === 0 && (
                  <DetailField label="Together so far" value={null} />
                )}
              </DetailFields>
            </DetailCard>

            {partner.notes && (
              <DetailCard
                title="Notes"
                tone="slate"
                icon={<ChatBubbleBottomCenterTextIcon className="w-3 h-3" />}
              >
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{partner.notes}</p>
              </DetailCard>
            )}
          </div>
        )}

        {active === "contacts" && (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* The same block the lead's Overview carries. Two gates, one
                component: there is no reason a customer's people should look or
                behave differently depending on which screen you reached them
                from, and keeping two editors is how one of them quietly stops
                supporting a field - this page could not set "Decides" at all. */}
            <CustomerContacts
              basePath={`/api/partners/${partner.id}/contacts`}
              contacts={partner.contacts}
              canEdit={canEdit}
              customerName={partner.name}
              className="px-4 py-4"
            />
          </div>
        )}

        {active === "referred" && (
          <DetailCard
            title="Referred to Us"
            tone="violet"
            icon={<UserGroupIcon className="w-3 h-3" />}
            bodyClassName="p-0"
          >
            <AppTable<ReferredLead>
              className="table-fixed"
              data={related?.referred ?? []}
              keyExtractor={(l) => l.id}
              showToolbar={false}
              onRowClick={(l) => router.push(`/dashboard/sales/leads/${l.id}`)}
              columns={[
                {
                  key: "lead",
                  header: "Lead",
                  width: "44%",
                  render: (l) => (
                    <Headline title={l.client?.name || l.lead_number || "Lead"} line1={l.lead_number ?? undefined} />
                  ),
                },
                {
                  key: "stage",
                  header: "Stage",
                  width: "28%",
                  render: (l) => (
                    <StatusPill
                      label={LeadStageLabels[l.stage as LeadStage] ?? l.stage}
                      tone={l.stage === "won" ? "green" : ["lost", "disqualified"].includes(l.stage) ? "slate" : "blue"}
                    />
                  ),
                },
                {
                  key: "value",
                  header: "Value",
                  width: "28%",
                  render: (l) => (
                    <span className="text-sm text-slate-600 tabular-nums">
                      {l.won_amount ? money(l.won_amount) : <span className="text-slate-400">—</span>}
                    </span>
                  ),
                },
              ]}
              emptyState={{
                icon: <UserGroupIcon className="w-6 h-6 text-slate-400" />,
                title: "Nothing referred yet",
                description: `No lead so far names ${partner.name} as the referrer.`,
              }}
            />
          </DetailCard>
        )}

        {active === "work" && (
          <div className="space-y-4">
            <DetailCard
              title="Projects"
              tone="blue"
              icon={<FolderOpenIcon className="w-3 h-3" />}
              bodyClassName="p-0"
            >
              <AppTable<RelatedProject>
                className="table-fixed"
                data={related?.projects ?? []}
                keyExtractor={(p) => p.id}
                showToolbar={false}
                onRowClick={(p) => router.push(`/dashboard/projects/${p.id}`)}
                columns={[
                  {
                    key: "name",
                    header: "Project",
                    width: "48%",
                    render: (p) => (
                      <Headline
                        title={p.name || p.project_number || "Project"}
                        line1={[p.project_number, p.property?.property_name, p.property?.city]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    width: "26%",
                    render: (p) => (
                      <StatusPill
                        label={ProjectStatusLabels[p.status as ProjectStatus] ?? p.status ?? "—"}
                        tone={
                          p.status === "in_progress"
                            ? "blue"
                            : p.status === "completed"
                              ? "green"
                              : p.status === "on_hold"
                                ? "amber"
                                : "slate"
                        }
                      />
                    ),
                  },
                  {
                    key: "ends",
                    header: "Expected End",
                    width: "26%",
                    render: (p) => <span className="text-sm text-slate-600">{day(p.expected_end_date)}</span>,
                  },
                ]}
                emptyState={{
                  icon: <FolderOpenIcon className="w-6 h-6 text-slate-400" />,
                  title: "No projects yet",
                  description: `Nothing has been delivered for ${partner.name} so far.`,
                }}
              />
            </DetailCard>

            <DetailCard
              title="Leads"
              tone="purple"
              icon={<UserGroupIcon className="w-3 h-3" />}
              bodyClassName="p-0"
            >
              <AppTable<RelatedLead>
                className="table-fixed"
                data={related?.leads ?? []}
                keyExtractor={(l) => l.id}
                showToolbar={false}
                onRowClick={(l) => router.push(`/dashboard/sales/leads/${l.id}`)}
                columns={[
                  {
                    key: "lead",
                    header: "Lead",
                    width: "48%",
                    render: (l) => (
                      <Headline
                        title={l.lead_number || "Lead"}
                        line1={[l.property?.property_name, l.property?.city, l.service_type]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                    ),
                  },
                  {
                    key: "stage",
                    header: "Stage",
                    width: "26%",
                    render: (l) => (
                      <StatusPill
                        label={LeadStageLabels[l.stage as LeadStage] ?? l.stage}
                        tone={
                          l.stage === "won"
                            ? "green"
                            : ["lost", "disqualified"].includes(l.stage)
                              ? "slate"
                              : "blue"
                        }
                      />
                    ),
                  },
                  {
                    key: "value",
                    header: "Value",
                    width: "26%",
                    render: (l) => (
                      <span className="text-sm text-slate-600 tabular-nums">
                        {l.won_amount ? money(l.won_amount) : <span className="text-slate-400">—</span>}
                      </span>
                    ),
                  },
                ]}
                emptyState={{
                  icon: <UserGroupIcon className="w-6 h-6 text-slate-400" />,
                  title: "No leads yet",
                  description: `Nothing has been sold to ${partner.name} so far.`,
                }}
              />
            </DetailCard>
          </div>
        )}

        {active === "quotations" && (
          <DetailCard
            title="Quotations"
            tone="blue"
            icon={<DocumentTextIcon className="w-3 h-3" />}
            bodyClassName="p-0"
          >
            <AppTable<RelatedQuotation>
              className="table-fixed"
              data={related?.quotations ?? []}
              keyExtractor={(q) => q.id}
              showToolbar={false}
              onRowClick={(q) => router.push(`/dashboard/quotations/${q.id}`)}
              columns={[
                {
                  key: "number",
                  header: "Quotation",
                  width: "44%",
                  render: (q) => (
                    <Headline
                      title={`${q.quotation_number ?? "—"}${q.version ? ` · v${q.version}` : ""}`}
                      line1={q.lead_id ? "on a lead" : q.project_id ? "on a project" : "standalone"}
                    />
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  width: "28%",
                  render: (q) => {
                    const c = QuotationStatusColors[q.status as QuotationStatus];
                    return (
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full",
                          c?.bg ?? "bg-slate-100",
                          c?.text ?? "text-slate-600"
                        )}
                      >
                        {QuotationStatusLabels[q.status as QuotationStatus] ?? q.status}
                      </span>
                    );
                  },
                },
                {
                  key: "total",
                  header: "Total",
                  width: "28%",
                  render: (q) => (
                    <span className="text-sm font-medium text-slate-800 tabular-nums">{money(q.grand_total)}</span>
                  ),
                },
              ]}
              emptyState={{
                icon: <DocumentTextIcon className="w-6 h-6 text-slate-400" />,
                title: "No quotations yet",
                description: `Nothing has been priced for ${partner.name} so far.`,
              }}
            />
          </DetailCard>
        )}

        {active === "orders" && (
          <DetailCard
            title="Purchase Orders"
            tone="green"
            icon={<TruckIcon className="w-3 h-3" />}
            bodyClassName="p-0"
          >
            <AppTable<RelatedOrder>
              className="table-fixed"
              data={related?.purchase_orders ?? []}
              keyExtractor={(o) => o.id}
              showToolbar={false}
              onRowClick={(o) => router.push(`/dashboard/stock/purchase-orders/${o.id}`)}
              columns={[
                {
                  key: "po",
                  header: "Order",
                  width: "44%",
                  render: (o) => (
                    <Headline
                      title={o.po_number || "Purchase order"}
                      line1={[
                        o.order_date ? `ordered ${day(o.order_date)}` : null,
                        o.expected_delivery ? `expected ${day(o.expected_delivery)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  width: "28%",
                  render: (o) => <Chip label={String(o.status ?? "—").replace(/_/g, " ")} tone="slate" />,
                },
                {
                  key: "total",
                  header: "Total",
                  width: "28%",
                  render: (o) => (
                    <span className="text-sm font-medium text-slate-800 tabular-nums">{money(o.total_amount)}</span>
                  ),
                },
              ]}
              emptyState={{
                icon: <TruckIcon className="w-6 h-6 text-slate-400" />,
                title: "No purchase orders yet",
                description: `Nothing has been ordered from ${partner.name} so far.`,
              }}
            />
          </DetailCard>
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
          contact_name: partner.contacts.find((c) => c.is_primary)?.name ?? "",
        }}
        onSaved={() => {
          setNotice({ message: "Saved.", variant: "success" });
          void load();
        }}
      />
      {confirmDialog}
      <Toast
        message={notice?.message ?? null}
        variant={notice?.variant ?? "error"}
        onDismiss={() => setNotice(null)}
      />
    </PageLayout>
  );
}

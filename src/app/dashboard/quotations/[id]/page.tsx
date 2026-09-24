"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ShareQuotationModal } from "@/components/quotations/ShareQuotationModal";
import { PrintQuotationModal } from "@/components/quotations/PrintQuotationModal";
import { SpaceCard } from "@/components/quotations/SpaceCard";
import { ScopeDriftNotice } from "@/components/quotations/ScopeDriftNotice";
import { toBuilderSpaces } from "@/lib/quotations/to-builder-spaces";
import { deriveQuantities } from "@/lib/costing/derive-quantities";
import { fetchConfigOnce } from "@/lib/quotations/config-cache";
import type { ComponentType } from "@/types/quotations";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { QuotationBuilder } from "@/components/quotations/QuotationBuilder";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Toast } from "@/components/ui/Toast";

// ============================================================================
// V2 Types - Using Cost Items with Calculated Amounts
// ============================================================================

interface CostItemCategory {
  id: string;
  name: string;
  slug: string;
  color?: string;
}

interface CostItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  default_rate?: number;
  company_cost?: number;
  vendor_cost?: number;
  category?: CostItemCategory;
}

interface QuotationLineItem {
  id: string;
  /** Present only when the API decided this user may see costs. */
  company_cost?: number;
  margin_amount?: number;
  quotation_id: string;
  quotation_space_id?: string;
  quotation_component_id?: string;
  cost_item_id: string;
  name: string;
  length?: number;
  width?: number;
  measurement_unit?: string;
  quantity: number;
  unit_code: string;
  rate: number;
  amount: number;
  display_order: number;
  notes?: string;
  cost_item?: CostItem;
}

interface QuotationComponent {
  id: string;
  quotation_id: string;
  space_id?: string;
  component_type_id: string;
  name: string;
  description?: string;
  length?: number;
  width?: number;
  area?: number;
  subtotal: number;
  sort_order: number;
  component_type?: { id: string; name: string; slug: string; icon?: string };
  lineItems: QuotationLineItem[];
}

interface QuotationSpace {
  id: string;
  quotation_id: string;
  space_type_id: string;
  name: string;
  description?: string;
  length?: number;
  width?: number;
  area?: number;
  subtotal: number;
  sort_order: number;
  space_type?: { id: string; name: string; slug: string; icon?: string };
  components: QuotationComponent[];
  lineItems: QuotationLineItem[]; // Direct line items not under a component
}

interface QuotationVersion {
  id: string;
  version: number;
  status: string;
  grand_total: number;
  created_at: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface Quotation {
  id: string;
  quotation_number: string;
  /** "p2" when this prices the scope's alternatives - an Option 2. */
  scope_preference?: "p1" | "p2" | null;
  title?: string;
  description?: string;
  client_name?: string;
  /** Returned by the API already; used for the WhatsApp share. */
  client_phone?: string | null;
  property_name?: string;
  property_address?: string;
  property_city?: string;
  carpet_area_sqft?: number;
  status: string;
  valid_from?: string;
  valid_until?: string;
  created_at: string;
  version: number;
  subtotal?: number;
  discount_amount?: number;
  tax_percent?: number;
  tax_amount?: number;
  grand_total?: number;
  lead_id?: string;
  template_id?: string;
  presentation_level?: string;
  hide_dimensions?: boolean;
  notes?: string;
  assigned_to?: string;
  created_user?: User;
  updated_user?: User;
  assigned_user?: User;
  /** Set once the quotation is copied into a project; the DB refuses edits. */
  is_locked?: boolean;
  linked_to_project_id?: string | null;
  lead?: {
    id: string;
    lead_number?: string;
    stage: string;
  };
  project_id?: string;
  project?: {
    id: string;
    project_number?: string;
    name?: string;
    status?: string;
  };
}

// ============================================================================
// Display Helpers
// ============================================================================

/** "proposal_discussion" -> "Proposal Discussion". */
const humaniseStage = (stage?: string) =>
  (stage || "")
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> =
  {
    draft: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
    sent: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  };


const formatCurrency = (amount: number | undefined | null) => {
  if (amount === undefined || amount === null) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString: string | undefined | null) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};


// ============================================================================
// Main Component
// ============================================================================

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [spaces, setSpaces] = useState<QuotationSpace[]>([]);
  const [orphanComponents, setOrphanComponents] = useState<
    QuotationComponent[]
  >([]);
  const [orphanLineItems, setOrphanLineItems] = useState<QuotationLineItem[]>(
    []
  );
  const [versions, setVersions] = useState<QuotationVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(
    new Set()
  );
  /**
   * Whether internal cost and margin may be shown. The quotation API strips
   * the underlying figures for anyone without cost_items.pricing, so false
   * here means they are genuinely absent rather than merely hidden.
   */
  const [canViewCosts, setCanViewCosts] = useState(false);

  // Fetch quotation data
  const fetchQuotation = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/quotations/${params.id}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch quotation");
      }

      const data = await response.json();
      setQuotation(data.quotation);
      setSpaces(data.spaces || []);
      setCanViewCosts(!!data.can_view_costs);
      setOrphanComponents(data.components || []);
      setOrphanLineItems(data.lineItems || []);
      setVersions(data.versions || []);

      // Expand all spaces by default
      if (data.spaces && data.spaces.length > 0) {
        setExpandedSpaces(
          new Set(data.spaces.map((s: QuotationSpace) => s.id))
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch quotation"
      );
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (params.id) {
      fetchQuotation();
    }
  }, [params.id, fetchQuotation]);

  // Calculate totals from spaces
  const calculatedTotals = useMemo(() => {
    let subtotal = 0;

    spaces.forEach((space) => {
      space.lineItems?.forEach((item) => {
        subtotal += item.amount || 0;
      });
      space.components?.forEach((comp) => {
        comp.lineItems?.forEach((item) => {
          subtotal += item.amount || 0;
        });
      });
    });

    orphanComponents.forEach((comp) => {
      comp.lineItems?.forEach((item) => {
        subtotal += item.amount || 0;
      });
    });

    orphanLineItems.forEach((item) => {
      subtotal += item.amount || 0;
    });

    return subtotal;
  }, [spaces, orphanComponents, orphanLineItems]);

  // Helper function to convert dimensions to feet
  const convertToFeet = (value: number, unit: string): number => {
    const unitLower = (unit || "mm").toLowerCase();
    switch (unitLower) {
      case "mm":
        return value * 0.00328084;
      case "cm":
        return value * 0.0328084;
      case "inch":
        return value * 0.0833333;
      case "ft":
        return value;
      default:
        return value;
    }
  };

  // Helper to calculate sqft from length × width
  const calculateSqftFromItem = (item: QuotationLineItem): number => {
    const unitLower = (item.unit_code || "").toLowerCase();

    // Only calculate sqft for area-based units
    if (
      unitLower === "sqft" ||
      unitLower === "sft" ||
      unitLower === "sq.ft" ||
      unitLower === "sq ft"
    ) {
      // If item has length and width, calculate from dimensions
      if (item.length && item.width) {
        const measureUnit = item.measurement_unit || "mm";
        const lengthInFeet = convertToFeet(item.length, measureUnit);
        const widthInFeet = convertToFeet(item.width, measureUnit);
        return lengthInFeet * widthInFeet;
      }
      // Otherwise use the quantity as the sqft value
      return item.quantity || 0;
    }
    return 0;
  };

  // Space totals for summary (including area calculation from line items)
  const spaceTotals = useMemo(() => {
    return spaces.map((space) => {
      let total = 0;
      let totalSqft = 0;

      space.lineItems?.forEach((item) => {
        total += item.amount || 0;
        totalSqft += calculateSqftFromItem(item);
      });
      space.components?.forEach((comp) => {
        comp.lineItems?.forEach((item) => {
          total += item.amount || 0;
          totalSqft += calculateSqftFromItem(item);
        });
      });
      return { id: space.id, name: space.name, total, sqft: totalSqft };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the named function is defined in this component and closes over the same values already listed
  }, [spaces]);

  /**
   * This quotation, in the shape the builder renders.
   *
   * The document below is `SpaceCard` - the same component the builder uses,
   * with `readOnly` set. It used to be 533 lines of hand-written markup here
   * walking the same spaces, components and line items, which meant one
   * quotation had two renderings that drifted: different dimension handling,
   * different treatment of a line that follows its component's size, and a
   * different idea of which rate is the one the client pays.
   *
   * Expansion is this page's own - `SpaceCard` reads it off each node, so the
   * existing Expand all / Collapse all keeps working untouched.
   */
  // Through deriveQuantities like the builder's, or every rule-priced line
  // reads as zero in a component and space total.
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([]);
  useEffect(() => {
    fetchConfigOnce<{ data?: ComponentType[] }>("/api/quotations/config/component-types")
      .then((r) => setComponentTypes(r?.data ?? []))
      .catch(() => {});
  }, []);

  const documentSpaces = useMemo(
    () =>
      deriveQuantities(toBuilderSpaces(spaces), componentTypes).map((space) => ({
        ...space,
        expanded: expandedSpaces.has(space.id),
        components: space.components.map((component) => ({
          ...component,
          expanded: expandedComponents.has(component.id),
        })),
      })),
    [spaces, componentTypes, expandedSpaces, expandedComponents]
  );

  /**
   * Nothing here may change the quotation, so every mutation SpaceCard asks
   * for is a no-op. It takes them as required props because the builder always
   * has them; on a document the controls that would call them are not drawn at
   * all, so none of these can actually be reached.
   */
  const noop = () => {};

  const toggleSpace = (spaceId: string) => {
    setExpandedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  };

  const toggleComponent = (componentId: string) => {
    setExpandedComponents((prev) => {
      const next = new Set(prev);
      if (next.has(componentId)) next.delete(componentId);
      else next.add(componentId);
      return next;
    });
  };

  // Collapse/Expand all spaces and components
  const collapseAll = () => {
    setExpandedSpaces(new Set());
    setExpandedComponents(new Set());
  };

  const expandAll = () => {
    const allSpaceIds = spaces.map((s) => s.id);
    setExpandedSpaces(new Set(allSpaceIds));

    const allComponentIds: string[] = [];
    spaces.forEach((space) => {
      space.components?.forEach((comp) => {
        allComponentIds.push(comp.id);
      });
    });
    orphanComponents.forEach((comp) => {
      allComponentIds.push(comp.id);
    });
    setExpandedComponents(new Set(allComponentIds));
  };

  // Check if any spaces or components are collapsed
  const hasCollapsedItems = useMemo(() => {
    // Check if any spaces are collapsed
    if (spaces.length > 0 && expandedSpaces.size < spaces.length) return true;

    // Check if any components are collapsed
    let totalComponents = 0;
    spaces.forEach((space) => {
      totalComponents += space.components?.length || 0;
    });
    totalComponents += orphanComponents.length;
    if (totalComponents > 0 && expandedComponents.size < totalComponents)
      return true;

    return false;
  }, [spaces, orphanComponents, expandedSpaces, expandedComponents]);

  /**
   * Whether this quotation can still be changed in place.
   *
   * Read and edit are one route now, so the Edit button has to be governed by
   * the same rules the API enforces rather than always being available and
   * failing on save. Each of these is refused server-side:
   *
   *   - approved / rejected      "Create a revision instead"
   *   - sent                     the client already has this document
   *   - lead won / lost / disqualified
   *   - locked, or copied into a project (a database trigger)
   *
   * Anything blocked here offers Revise instead, which is the supported way to
   * change a quotation that has left the building.
   */
  /**
   * Margin across the whole quotation.
   *
   * The document view is where the decision to send actually gets made, and it
   * had no cost awareness at all - one incidental reference against nine in
   * the builder. Sums the per-line margin the API already stores; when the
   * viewer is not permitted to see costs those fields never arrive, and the
   * panel hides itself rather than reporting zero.
   */
  const marginTotals = useMemo(() => {
    // Same traversal as calculatedTotals: line items hang off a space, off a
    // component within a space, off a component with no space, or off nothing.
    const all: QuotationLineItem[] = [];
    spaces.forEach((space) => {
      space.lineItems?.forEach((i) => all.push(i));
      space.components?.forEach((comp) =>
        comp.lineItems?.forEach((i) => all.push(i))
      );
    });
    orphanComponents.forEach((comp) =>
      comp.lineItems?.forEach((i) => all.push(i))
    );
    orphanLineItems.forEach((i) => all.push(i));

    // A line with no company_cost is "cost unknown", not "cost nothing".
    // Counting those as fully profitable is how a quotation ends up reporting
    // a confident 100% margin - QT-20251216-001 does exactly that today.
    const withCost = all.filter(
      (i) => i.margin_amount != null && (i.company_cost || 0) > 0
    );
    if (withCost.length === 0) return null;
    const margin = withCost.reduce((n, i) => n + (i.margin_amount || 0), 0);
    // Measured over the costed lines only, so the percentage means something.
    const revenue = withCost.reduce((n, i) => n + (i.amount || 0), 0);
    return {
      margin,
      percent: revenue > 0 ? (margin / revenue) * 100 : 0,
      // A partial answer is worse than a flagged one.
      complete: withCost.length === all.length,
      costedCount: withCost.length,
      totalCount: all.length,
    };
  }, [spaces, orphanComponents, orphanLineItems]);

  const { hasPermission } = useUserPermissions();
  const editBlockedReason = useMemo(() => {
    if (!quotation) return null;
    if (!hasPermission("quotations.edit")) {
      return "You do not have permission to edit quotations";
    }
    if (quotation.is_locked || quotation.linked_to_project_id) {
      return "This quotation belongs to a project and is read-only";
    }
    if (["approved", "rejected", "superseded"].includes(quotation.status)) {
      return `This quotation is ${quotation.status}. Create a revision to make changes.`;
    }
    if (quotation.status === "sent") {
      return "This quotation has been sent to the client. Create a revision to make changes.";
    }
    if (
      quotation.lead &&
      ["won", "lost", "disqualified"].includes(quotation.lead.stage)
    ) {
      return `The lead is ${quotation.lead.stage}, so this quotation is archived`;
    }
    return null;
  }, [quotation, hasPermission]);

  const canEdit = !!quotation && !editBlockedReason;

  /**
   * Reading and editing share this route, and the state decides which you get.
   *
   * A draft opens straight in the builder - that is what you came to do, and
   * making you click Edit first is the extra step this merge was meant to
   * remove. Anything sent, approved, locked or on a closed lead opens as the
   * document instead, because it cannot be edited at all.
   *
   * ?view=1 forces the document for an editable quotation, which is how
   * Preview works from inside the builder.
   */
  const searchParams = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => {
    if (!quotation) return;
    if (searchParams.get("view") === "1") {
      setIsEditing(false);
      return;
    }
    if (canEdit) setIsEditing(true);
  }, [quotation, searchParams, canEdit]);

  // Revision state
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  // "Option 2": the alternative quotation from the scope's second
  // preferences. Offered only when the scope holds any.
  const [secondPreferences, setSecondPreferences] = useState(0);
  const [isCreatingOption2, setIsCreatingOption2] = useState(false);

  // PDF and Share state
  /**
   * The builder chooses a print format before producing anything; this page
   * downloaded straight from the button with whatever the default was. A print
   * format decides `itemise_to` and `price_at` - what the client actually sees
   * priced - so they are genuinely different documents, and picking one is the
   * decision, not a preference buried in settings.
   */
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Belongs up here with the others: the loading, error and not-found returns
  // all sit between this and the markup that uses it, so declaring it there
  // changed how many hooks ran between one render and the next.
  const [changingStatus, setChangingStatus] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  useEffect(() => {
    if (!quotation?.id || (!quotation.lead_id && !quotation.project_id)) return;
    let live = true;
    fetch(`/api/quotations/${quotation.id}/scope-drift`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live) setSecondPreferences(Number(j?.data?.second_preferences) || 0); })
      .catch(() => {});
    return () => { live = false; };
  }, [quotation?.id, quotation?.lead_id, quotation?.project_id, quotation?.version]);

  const handleCreateOption2 = async () => {
    if (!quotation || isCreatingOption2) return;
    setIsCreatingOption2(true);
    try {
      const response = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: quotation.lead_id || null, project_id: quotation.project_id || null, from_scope: true, preference: "p2" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not create Option 2");
      router.push(`/dashboard/quotations/${data.quotation.id}?edit=1`);
    } catch (err) {
      setNotice({ message: err instanceof Error ? err.message : "Could not create Option 2", variant: "error" });
    } finally {
      setIsCreatingOption2(false);
    }
  };

  // Create a new revision and open it for editing
  const handleCreateRevision = async () => {
    if (!quotation) return;

    try {
      setIsCreatingRevision(true);
      const response = await fetch(`/api/quotations/${quotation.id}/revision`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create revision");
      }

      const data = await response.json();
      // Redirect to edit the new revision
      router.push(`/dashboard/quotations/${data.quotation.id}?edit=1`);
    } catch (err) {
      console.error("Error creating revision:", err);
      setNotice({
        message: err instanceof Error ? err.message : "Failed to create revision",
        variant: "error",
      });
    } finally {
      setIsCreatingRevision(false);
    }
  };


  /**
   * Sharing now runs through ShareQuotationModal.
   *
   * The two handlers that used to live here each did half the job: one copied
   * a link and announced it with alert(), the other opened a mailto: that does
   * nothing on a machine without a desktop mail client. Neither moved the
   * quotation out of draft, so the client portal refused every approval with
   * "current status: draft" - which is why no quotation here has ever reached
   * sent or viewed.
   */

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading quotation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Error Loading Quotation
          </h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <Link
            href="/dashboard/quotations"
            className="text-blue-600 hover:text-blue-700"
          >
            ← Back to Quotations
          </Link>
        </div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Quotation Not Found
          </h2>
          <Link
            href="/dashboard/quotations"
            className="text-blue-600 hover:text-blue-700"
          >
            ← Back to Quotations
          </Link>
        </div>
      </div>
    );
  }

  // The builder takes the whole screen. Leaving it refetches, so the document
  // below always reflects what was just saved.
  if (isEditing) {
    return (
      <QuotationBuilder
        quotationId={quotation.id}
        onExit={(builderNotice) => {
          setIsEditing(false);
          router.replace(`/dashboard/quotations/${quotation.id}?view=1`);
          // The builder unmounts on exit, so a toast raised in there would go
          // with it. It hands the message up and this page shows it.
          if (builderNotice) {
            setNotice({ message: builderNotice, variant: "success" });
          }
          void fetchQuotation();
        }}
      />
    );
  }

  /**
   * The one move that makes sense from here.
   *
   * A quotation is built, sent, and agreed. Offering every status at once is
   * what made this confusing; offering the next one is a decision anybody can
   * make without a diagram.
   */
  const nextStatus = (() => {
    switch (quotation?.status) {
      // A draft can be approved without first being declared sent. Requiring
      // the ceremony was my invention, not a rule anyone asked for, and a
      // price is often agreed on a call before anything is formally issued.
      case "draft":
      case "sent":
        return {
          to: "approved",
          label: "Approve",
          hint: "This is the agreed price. Any other approved version of this quotation number is superseded.",
        };
      default:
        return null;
    }
  })();

  /**
   * Move the quotation to its next status.
   *
   * Two browser dialogs used to do this work - one for the refusal, one to say
   * which quotation had been superseded. Neither could be styled, both carried
   * the app's URL like a security warning, and both blocked the page behind
   * them from repainting. The outcome is a toast now.
   *
   * The `window.location.reload()` that followed them is gone too: a reload
   * would have thrown the toast away before anyone could read it, and
   * `fetchQuotation` already reloads everything this page holds.
   *
   * Deliberately no confirmation step added here. Approving silently
   * supersedes another quotation, so a confirm is arguable - but the builder's
   * own Approve does not ask either, and adding one to a single path would
   * make the two disagree. If it is wanted, it belongs on both.
   */
  const saveValidity = async (date: string | null) => {
    const res = await fetch(`/api/quotations/${quotation?.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valid_until: date }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice({ message: data.error || "Could not save the validity", variant: "error" });
      return;
    }
    setNotice({ message: date ? `Valid until ${formatDate(date)}.` : "No expiry.", variant: "success" });
    await fetchQuotation();
  };

  const changeStatus = async (to: string) => {
    setChangingStatus(true);
    try {
      const res = await fetch(`/api/quotations/${quotation?.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({
          message: data.error || "Could not change the status",
          variant: "error",
        });
        return;
      }
      // Refetch rather than reload: a full reload threw away the toast before
      // anyone could read which quotation had been superseded.
      setNotice({
        message: data.supersededNumber
          ? data.message
          : `Quotation marked as ${to}.`,
        variant: "success",
      });
      await fetchQuotation();
    } finally {
      setChangingStatus(false);
    }
  };

  const statusColors =
    STATUS_COLORS[quotation.status?.toLowerCase()] || STATUS_COLORS.draft;
  const subtotal = quotation.subtotal || calculatedTotals;
  const taxPercent = quotation.tax_percent ?? 18;
  const gstAmount = quotation.tax_amount || subtotal * (taxPercent / 100);
  const total = quotation.grand_total || subtotal + gstAmount;

  // Stats
  const totalLineItems =
    spaces.reduce(
      (sum, s) =>
        sum +
        (s.lineItems?.length || 0) +
        (s.components?.reduce((cs, c) => cs + (c.lineItems?.length || 0), 0) ||
          0),
      0
    ) +
    orphanComponents.reduce((sum, c) => sum + (c.lineItems?.length || 0), 0) +
    orphanLineItems.length;

  const totalComponents =
    spaces.reduce((sum, s) => sum + (s.components?.length || 0), 0) +
    orphanComponents.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 px-5 py-4">
        {/*
         * One line, and it holds at any width.
         *
         * It began as a non-wrapping row whose left group carried min-w-0
         * while every chip inside was shrink-0 - so the group could be
         * squeezed below its content width with nothing inside willing to
         * give, and the chips overflowed their own box and ran under the
         * actions. That is why View Lead sat on top of the property name.
         *
         * Letting it wrap fixed the overlap and spent a second line, so this
         * puts less in the row instead of letting it grow:
         *
         *   - View Lead is gone. The lead chip two places along already links
         *     to the same lead, so the row offered one destination twice.
         *   - Approve moved to the actions, where it belongs. It had been
         *     sitting among the metadata chips as though it were one.
         *   - The title takes the squeeze - truncate on a min-w-0 flex child -
         *     and the chips that carry least drop out at narrow widths rather
         *     than wrapping.
         *
         * overflow-hidden is the backstop: anything that still exceeds the row
         * is clipped at the edge instead of drawn over the actions.
         */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3 min-w-0 overflow-hidden">
            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500 shrink-0">
              <Link
                href="/dashboard/quotations"
                className="hover:text-blue-600"
              >
                Quotations
              </Link>
              <span>/</span>
              <span className="text-slate-700 font-medium">
                {quotation.quotation_number}
              </span>
            </div>

            <div className="hidden sm:block h-5 w-px bg-slate-200 shrink-0" />

            <h1 className="text-xl font-bold text-slate-900 truncate">
              {quotation.client_name || quotation.title || "Untitled Quotation"}
            </h1>

            {/* Status Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full shrink-0 ${statusColors.bg} ${statusColors.text}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${statusColors.dot}`}
              ></span>
              {quotation.status?.charAt(0).toUpperCase() +
                quotation.status?.slice(1)}
            </span>


            {/* Version */}
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-600 bg-slate-100 rounded-lg shrink-0">
              v{quotation.version}
            </span>

            {/* What this document IS. Two quotations on one lead are otherwise
                told apart only by their numbers. */}
            {quotation.scope_preference === "p2" && (
              <span
                className="flex items-center px-2.5 py-1.5 text-sm text-emerald-800 bg-emerald-100 rounded-lg shrink-0"
                title="Built from the scope's second preferences - the alternative discussed with the customer, priced beside the main quotation"
              >
                Alternative
              </span>
            )}

            {/* Where this quotation came from. The header used to show only the
                client name and property, which are not enough to tell two
                quotations apart - and the lead number is what people actually
                search and talk by. Links through to whichever record owns it. */}
            {quotation.lead_id && quotation.lead?.lead_number && (
              <Link
                href={`/dashboard/sales/leads/${quotation.lead_id}`}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg shrink-0 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                title={`Lead ${quotation.lead.lead_number}`}
              >
                <span className="font-medium">{quotation.lead.lead_number}</span>
                {quotation.lead.stage && (
                  <span className="hidden lg:inline text-slate-400">
                    · {humaniseStage(quotation.lead.stage)}
                  </span>
                )}
              </Link>
            )}

            {quotation.project_id && quotation.project && (
              <Link
                href={`/dashboard/projects/${quotation.project_id}`}
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg shrink-0 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                title={quotation.project.name || "Project"}
              >
                <span className="font-medium">
                  {quotation.project.project_number || "Project"}
                </span>
                {quotation.project.name && (
                  <span className="hidden lg:inline max-w-[160px] truncate text-slate-400">
                    · {quotation.project.name}
                  </span>
                )}
              </Link>
            )}

            {/* Property */}
            {quotation.property_name && (
              <span className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-600 bg-slate-100 rounded-lg shrink-0">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <span className="max-w-[180px] truncate">
                  {quotation.property_name}
                </span>
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/*
             * Approving where the quotation can be read.
             *
             * The only way to approve was a menu on the quotations list - a
             * decision about a price, made from a row, without the price in
             * front of you. One button, and only the move that makes sense
             * from where this quotation actually is.
             */}
            {nextStatus && (
              <button
                type="button"
                onClick={() => void changeStatus(nextStatus.to)}
                disabled={changingStatus}
                title={nextStatus.hint}
                className="shrink-0 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {changingStatus ? "Working…" : nextStatus.label}
              </button>
            )}
            {/* Edit is offered only when the API would actually accept the
                save; everything else routes to Revise, which is the supported
                way to change a quotation that has already gone out. */}
            {canEdit && (
              <>
                <button
                  onClick={() => {
                    router.replace(`/dashboard/quotations/${quotation.id}`);
                    setIsEditing(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit
                </button>
              </>
            )}
            {/* Hiding Edit without saying why reads as a missing feature. */}
            {editBlockedReason && (
              <span className="hidden lg:inline text-xs text-slate-500 max-w-[260px]">
                {editBlockedReason}
              </span>
            )}
            {/* Revise stays available while the lead is open, whatever the
                quotation's own status - that is the point of it. */}
            {(!quotation.lead ||
              !["won", "lost", "disqualified"].includes(
                quotation.lead.stage
              )) && (
              <>
                <button
                  onClick={handleCreateRevision}
                  disabled={isCreatingRevision}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-amber-300 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingRevision ? (
                    <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  )}
                  {isCreatingRevision ? "Creating..." : "Revise"}
                </button>
                {secondPreferences > 0 && (
                  <button
                    onClick={handleCreateOption2}
                    disabled={isCreatingOption2}
                    title={`A second quotation built from the scope's ${secondPreferences} second preference${secondPreferences === 1 ? "" : "s"} - the fallback the customer discussed, priced beside this one`}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors font-medium disabled:opacity-50"
                  >
                    {isCreatingOption2 ? "Creating..." : "Option 2"}
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              PDF
            </button>
            {/* One action instead of two half-working ones. The modal mints
                the link, offers WhatsApp / email / copy, and marks the
                quotation sent so the client can actually act on it. */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Share with Client
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Quotation Info - Compact */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">
                  Client
                </label>
                <p className="text-sm text-slate-900 font-medium truncate">
                  {quotation.client_name || "—"}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">
                  Property
                </label>
                <p className="text-sm text-slate-900 truncate">
                  {quotation.property_name || "—"}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">
                  Address
                </label>
                <p className="text-sm text-slate-900 truncate">
                  {quotation.property_address || quotation.property_city || "—"}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">
                  Carpet Area
                </label>
                <p className="text-sm text-slate-900">
                  {quotation.carpet_area_sqft
                    ? `${quotation.carpet_area_sqft} sqft`
                    : "—"}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">
                  Created
                </label>
                <p className="text-sm text-slate-900">
                  {formatDate(quotation.created_at)}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">
                  Valid Until
                </label>
                {/* Optional, and the person's to set: a quotation has no expiry
                    unless one was chosen. Editable while it is a draft. */}
                {quotation.status === "draft" && canEdit ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={quotation.valid_until ? quotation.valid_until.slice(0, 10) : ""}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => void saveValidity(e.target.value || null)}
                      className="px-2 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {quotation.valid_until && (
                      <button type="button" onClick={() => void saveValidity(null)} className="text-xs text-slate-500 hover:text-slate-800">
                        No expiry
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-900">{quotation.valid_until ? formatDate(quotation.valid_until) : "No expiry"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Has the Scope tab moved on since this document? */}
          {(quotation.lead_id || quotation.project_id) && (
            <ScopeDriftNotice quotationId={quotation.id} status={quotation.status} projectId={quotation.project_id ?? null} refreshKey={`${quotation.status}:${quotation.version}`} />
          )}

          {/* Cost Breakdown - V2 Structure */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Cost Breakdown
              </h3>
              {spaces.length > 0 && (
                <button
                  onClick={hasCollapsedItems ? expandAll : collapseAll}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                >
                  {hasCollapsedItems ? (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        />
                      </svg>
                      Expand All
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                        />
                      </svg>
                      Collapse All
                    </>
                  )}
                </button>
              )}
            </div>

            {spaces.length === 0 &&
            orphanComponents.length === 0 &&
            orphanLineItems.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <h4 className="text-base font-semibold text-slate-900 mb-2">
                  No Spaces Added Yet
                </h4>
                <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                  Start building your quotation by adding spaces (like Bedroom,
                  Kitchen) and then add components and items to each space.
                </p>
                <div className="flex items-center justify-center gap-3">
                  {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Add Spaces
                  </button>
                  )}
                  {canEdit && (
                  <button
                    onClick={() => {
                      router.replace(
                        `/dashboard/quotations/${quotation.id}?edit=1&useTemplate=true`
                      );
                      setIsEditing(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-medium"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                      />
                    </svg>
                    Use Template
                  </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {documentSpaces.map((space) => (
                  <SpaceCard
                    key={space.id}
                    space={space}
                    mode="quotation"
                    readOnly
                    canViewCosts={canViewCosts}
                    formatCurrency={formatCurrency}
                    onToggleExpand={() => toggleSpace(space.id)}
                    onToggleComponentExpand={toggleComponent}
                    onDelete={noop}
                    onUpdateName={noop}
                    onAddComponent={noop}
                    onDeleteComponent={noop}
                    onAddCostItem={noop}
                    // Not to change them, but because ComponentCard gates the
                    // whole width/height row on this prop existing - without it
                    // a component's size would be absent from the document
                    // rather than merely uneditable.
                    onUpdateDimensions={noop}
                    onUpdateLineItem={noop}
                    onDeleteLineItem={noop}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {quotation.notes && (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Notes
              </h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {quotation.notes}
              </p>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 shrink-0 space-y-4">
          {/* Quote Summary */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Quote Summary
            </h3>

            {spaceTotals.length > 0 && (
              <div className="space-y-2 mb-4">
                {spaceTotals.map((space) => (
                  <div
                    key={space.id}
                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                  >
                    <span className="text-sm text-slate-600">{space.name}</span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatCurrency(space.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-slate-200 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Subtotal</span>
                <span className="text-sm font-medium text-slate-900">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              {quotation.discount_amount ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Discount</span>
                  <span className="text-sm font-medium text-red-600">
                    -{formatCurrency(quotation.discount_amount)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  GST ({quotation.tax_percent || 18}%)
                </span>
                <span className="text-sm font-medium text-slate-900">
                  {formatCurrency(gstAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-sm font-semibold text-slate-900">
                  Grand Total
                </span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(total)}
                </span>
              </div>
              {marginTotals && (
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-dashed border-slate-200">
                  <span className="text-xs text-slate-500">
                    Margin
                    {!marginTotals.complete &&
                      ` (${marginTotals.costedCount} of ${marginTotals.totalCount} lines costed)`}
                  </span>
                  <span className="text-xs font-medium text-slate-700 tabular-nums">
                    {formatCurrency(marginTotals.margin)} (
                    {marginTotals.percent.toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Statistics */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Statistics
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Total Spaces</span>
                <span className="font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {spaces.length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Total Components</span>
                <span className="font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {totalComponents}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Total items</span>
                <span className="font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {totalLineItems}
                </span>
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Assignment
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Assigned To</span>
                {quotation.assigned_user ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
                      {quotation.assigned_user.name?.[0]?.toUpperCase() ||
                        quotation.assigned_user.email?.[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-900">
                      {quotation.assigned_user.name ||
                        quotation.assigned_user.email}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Unassigned</span>
                )}
              </div>
            </div>
          </div>

          {/* Version History */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Version History
            </h3>
            {versions.length > 0 ? (
              <div className="space-y-3">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span
                      className={`w-6 h-6 ${
                        version.id === quotation.id
                          ? "bg-blue-600"
                          : "bg-slate-300"
                      } text-white rounded-full flex items-center justify-center text-xs font-medium`}
                    >
                      {version.version}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-700">
                        {version.id === quotation.id
                          ? "Current version"
                          : `Version ${version.version}`}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {formatDate(version.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No version history available.
              </p>
            )}
          </div>

          {/* Activity */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Activity
            </h3>
            <div className="space-y-3">
              <div className="flex gap-3 text-sm">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 shrink-0"></div>
                <div>
                  <p className="text-slate-700">Quotation created</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(quotation.created_at)}
                    {quotation.created_user?.name &&
                      ` by ${quotation.created_user.name}`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PrintQuotationModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        quotationId={quotation.id}
        quotationNumber={quotation.quotation_number}
      />

      <ShareQuotationModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        quotation={quotation}
        onShared={fetchQuotation}
      />

      <Toast
        message={notice?.message ?? null}
        variant={notice?.variant ?? "error"}
        onDismiss={() => setNotice(null)}
      />
    </div>
  );
}

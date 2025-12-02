"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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
  category?: CostItemCategory;
}

interface QuotationLineItem {
  id: string;
  quotation_id: string;
  quotation_space_id?: string;
  quotation_component_id?: string;
  cost_item_id: string;
  name: string;
  group_name?: string;
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
  component_variant_id?: string;
  name: string;
  description?: string;
  length?: number;
  width?: number;
  area?: number;
  subtotal: number;
  sort_order: number;
  component_type?: { id: string; name: string; slug: string; icon?: string };
  component_variant?: { id: string; name: string; slug: string };
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
  title?: string;
  description?: string;
  client_name?: string;
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
}

// ============================================================================
// Display Helpers
// ============================================================================

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> =
  {
    draft: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
    pending: {
      bg: "bg-yellow-100",
      text: "text-yellow-700",
      dot: "bg-yellow-500",
    },
    sent: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
    approved: {
      bg: "bg-green-100",
      text: "text-green-700",
      dot: "bg-green-500",
    },
    rejected: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
  };

const CATEGORY_COLORS: Record<string, string> = {
  carcass: "bg-amber-100 text-amber-700",
  shutter: "bg-blue-100 text-blue-700",
  hardware: "bg-purple-100 text-purple-700",
  finish: "bg-pink-100 text-pink-700",
  labour: "bg-green-100 text-green-700",
  accessories: "bg-indigo-100 text-indigo-700",
  countertop: "bg-teal-100 text-teal-700",
  appliances: "bg-orange-100 text-orange-700",
  default: "bg-slate-100 text-slate-600",
};

function getCategoryColor(categorySlug?: string): string {
  if (!categorySlug) return CATEGORY_COLORS.default;
  return CATEGORY_COLORS[categorySlug.toLowerCase()] || CATEGORY_COLORS.default;
}

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

  // Space totals for summary
  const spaceTotals = useMemo(() => {
    return spaces.map((space) => {
      let total = 0;
      space.lineItems?.forEach((item) => {
        total += item.amount || 0;
      });
      space.components?.forEach((comp) => {
        comp.lineItems?.forEach((item) => {
          total += item.amount || 0;
        });
      });
      return { id: space.id, name: space.name, total };
    });
  }, [spaces]);

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

  // Revision state
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);

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
      router.push(`/dashboard/quotations/${data.quotation.id}/edit`);
    } catch (err) {
      console.error("Error creating revision:", err);
      alert(err instanceof Error ? err.message : "Failed to create revision");
    } finally {
      setIsCreatingRevision(false);
    }
  };

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

  const statusColors =
    STATUS_COLORS[quotation.status?.toLowerCase()] || STATUS_COLORS.draft;
  const subtotal = quotation.subtotal || calculatedTotals;
  const gstAmount = quotation.tax_amount || subtotal * 0.18;
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500 shrink-0">
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

            <div className="h-5 w-px bg-slate-200 shrink-0" />

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

            {/* Property */}
            {quotation.property_name && (
              <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-600 bg-slate-100 rounded-lg shrink-0">
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
            {quotation.lead_id && (
              <Link
                href={`/dashboard/sales/leads/${quotation.lead_id}`}
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                View Lead
              </Link>
            )}
            <Link
              href={`/dashboard/quotations/${params.id}/edit`}
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
            </Link>
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
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
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
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              Send to Client
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Quotation Info */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Quotation Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Client
                </label>
                <p className="text-sm text-slate-900 font-medium">
                  {quotation.client_name || "—"}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Property
                </label>
                <p className="text-sm text-slate-900">
                  {quotation.property_name || "—"}
                  {quotation.property_city && `, ${quotation.property_city}`}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Created
                </label>
                <p className="text-sm text-slate-900">
                  {formatDate(quotation.created_at)}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Valid Until
                </label>
                <p className="text-sm text-slate-900">
                  {formatDate(quotation.valid_until)}
                </p>
              </div>
            </div>
            {(quotation.property_address || quotation.carpet_area_sqft) && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-4 pt-4 border-t border-slate-100">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Property Address
                  </label>
                  <p className="text-sm text-slate-900">
                    {quotation.property_address || "—"}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Carpet Area
                  </label>
                  <p className="text-sm text-slate-900">
                    {quotation.carpet_area_sqft
                      ? `${quotation.carpet_area_sqft} sqft`
                      : "—"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Cost Breakdown - V2 Structure */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Cost Breakdown
            </h3>

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
                  Kitchen) and then add components and cost items to each space.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link
                    href={`/dashboard/quotations/${params.id}/edit`}
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
                  </Link>
                  <Link
                    href={`/dashboard/quotations/${params.id}/edit?useTemplate=true`}
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
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Spaces */}
                {spaces.map((space) => (
                  <div
                    key={space.id}
                    className="border border-slate-200 rounded-lg overflow-hidden"
                  >
                    {/* Space Header */}
                    <div
                      className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer"
                      onClick={() => toggleSpace(space.id)}
                    >
                      <div className="flex items-center gap-3">
                        <button className="text-slate-600">
                          <svg
                            className={`w-5 h-5 transition-transform ${
                              expandedSpaces.has(space.id) ? "rotate-90" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-white"
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
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">
                            {space.name}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {space.space_type?.name || "Space"} •{" "}
                            {space.components?.length || 0} components
                            {space.area && ` • ${space.area} sqft`}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-blue-600">
                        {formatCurrency(
                          spaceTotals.find((t) => t.id === space.id)?.total || 0
                        )}
                      </span>
                    </div>

                    {/* Space Content */}
                    {expandedSpaces.has(space.id) && (
                      <div className="p-4 space-y-3 border-t border-slate-100">
                        {/* Components */}
                        {space.components?.map((component) => (
                          <div
                            key={component.id}
                            className="border border-slate-200 rounded-lg overflow-hidden"
                          >
                            {/* Component Header */}
                            <div
                              className="flex items-center justify-between px-4 py-2.5 bg-slate-50 cursor-pointer"
                              onClick={() => toggleComponent(component.id)}
                            >
                              <div className="flex items-center gap-3">
                                <button className="text-slate-500">
                                  <svg
                                    className={`w-4 h-4 transition-transform ${
                                      expandedComponents.has(component.id)
                                        ? "rotate-90"
                                        : ""
                                    }`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 5l7 7-7 7"
                                    />
                                  </svg>
                                </button>
                                <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
                                  <svg
                                    className="w-3 h-3 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                    />
                                  </svg>
                                </div>
                                <div>
                                  <h5 className="text-sm font-medium text-slate-900">
                                    {component.name ||
                                      component.component_type?.name}
                                    {component.component_variant && (
                                      <span className="text-slate-500 font-normal">
                                        {" "}
                                        - {component.component_variant.name}
                                      </span>
                                    )}
                                  </h5>
                                  <p className="text-xs text-slate-500">
                                    {component.lineItems?.length || 0} cost
                                    items
                                    {component.area &&
                                      ` • ${component.area} sqft`}
                                  </p>
                                </div>
                              </div>
                              <span className="text-sm font-semibold text-purple-600">
                                {formatCurrency(
                                  component.lineItems?.reduce(
                                    (sum, item) => sum + (item.amount || 0),
                                    0
                                  ) || 0
                                )}
                              </span>
                            </div>

                            {/* Component Line Items */}
                            {expandedComponents.has(component.id) && (
                              <div className="p-3 border-t border-slate-100">
                                {/* Component Description */}
                                {component.description && (
                                  <div className="mb-3 p-2 bg-purple-50 rounded-lg">
                                    <p className="text-xs text-purple-700">
                                      <span className="font-medium">
                                        Notes:
                                      </span>{" "}
                                      {component.description}
                                    </p>
                                  </div>
                                )}

                                {component.lineItems?.length === 0 ? (
                                  <p className="text-sm text-slate-500 text-center py-2">
                                    No cost items in this component
                                  </p>
                                ) : (
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-50">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                                          Cost Item
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                                          Dimensions
                                        </th>
                                        <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase">
                                          Qty
                                        </th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                                          Rate
                                        </th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                                          Amount
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {component.lineItems?.map((item) => (
                                        <tr
                                          key={item.id}
                                          className="hover:bg-slate-50"
                                        >
                                          <td className="px-3 py-2">
                                            <span className="font-medium text-slate-900">
                                              {item.name ||
                                                item.cost_item?.name}
                                            </span>
                                            {item.group_name && (
                                              <span className="ml-2 text-xs text-slate-500">
                                                ({item.group_name})
                                              </span>
                                            )}
                                            {item.cost_item?.category && (
                                              <span
                                                className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getCategoryColor(
                                                  item.cost_item.category.slug
                                                )}`}
                                              >
                                                {item.cost_item.category.name}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-slate-600">
                                            {item.length && item.width
                                              ? `${item.length} × ${
                                                  item.width
                                                } ${
                                                  item.measurement_unit || "ft"
                                                }`
                                              : item.length
                                              ? `${item.length} ${
                                                  item.measurement_unit || "ft"
                                                }`
                                              : "—"}
                                          </td>
                                          <td className="px-3 py-2 text-center text-slate-600">
                                            {item.quantity?.toFixed(2)}{" "}
                                            {item.unit_code}
                                          </td>
                                          <td className="px-3 py-2 text-right text-slate-600">
                                            {formatCurrency(item.rate)}/
                                            {item.unit_code}
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium text-green-600">
                                            {formatCurrency(item.amount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Direct line items under space */}
                        {space.lineItems && space.lineItems.length > 0 && (
                          <div className="border border-dashed border-slate-300 rounded-lg p-3">
                            <h5 className="text-xs font-medium text-slate-500 uppercase mb-2">
                              Other Cost Items
                            </h5>
                            <table className="w-full text-sm">
                              <tbody className="divide-y divide-slate-100">
                                {space.lineItems.map((item) => (
                                  <tr
                                    key={item.id}
                                    className="hover:bg-slate-50"
                                  >
                                    <td className="px-3 py-2 font-medium text-slate-900">
                                      {item.name || item.cost_item?.name}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">
                                      {item.quantity?.toFixed(2)}{" "}
                                      {item.unit_code}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-600">
                                      {formatCurrency(item.rate)}/
                                      {item.unit_code}
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium text-green-600">
                                      {formatCurrency(item.amount)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {(!space.components || space.components.length === 0) &&
                          (!space.lineItems ||
                            space.lineItems.length === 0) && (
                            <p className="text-sm text-slate-500 text-center py-4">
                              No cost items in this space
                            </p>
                          )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Orphan components */}
                {orphanComponents.length > 0 && (
                  <div className="border border-dashed border-slate-300 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">
                      Components (Not in a Space)
                    </h4>
                    {orphanComponents.map((component) => (
                      <div
                        key={component.id}
                        className="border border-slate-200 rounded-lg mb-2 last:mb-0"
                      >
                        <div className="px-4 py-2 bg-slate-50 flex justify-between items-center">
                          <span className="font-medium text-slate-900">
                            {component.name || component.component_type?.name}
                          </span>
                          <span className="font-semibold text-purple-600">
                            {formatCurrency(
                              component.lineItems?.reduce(
                                (sum, item) => sum + (item.amount || 0),
                                0
                              ) || 0
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Orphan line items */}
                {orphanLineItems.length > 0 && (
                  <div className="border border-dashed border-slate-300 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">
                      Additional Cost Items
                    </h4>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                            Cost Item
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase">
                            Qty
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                            Rate
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orphanLineItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {item.name || item.cost_item?.name}
                            </td>
                            <td className="px-3 py-2 text-center text-slate-600">
                              {item.quantity?.toFixed(2)} {item.unit_code}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">
                              {formatCurrency(item.rate)}/{item.unit_code}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-green-600">
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                <span className="text-slate-600">Total Cost Items</span>
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
    </div>
  );
}

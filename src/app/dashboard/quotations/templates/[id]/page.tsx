"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

// ============================================================================
// V2 Types - Using Cost Items with Flexible Hierarchy
// ============================================================================

interface CostItemCategory {
  id: string;
  name: string;
  slug: string;
  color?: string;
  icon?: string;
}

interface CostItem {
  id: string;
  name: string;
  slug: string;
  unit_code: string;
  default_rate: number;
  quality_tier?: string;
  category?: CostItemCategory;
}

interface ComponentType {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface ComponentVariant {
  id: string;
  name: string;
  slug: string;
}

interface SpaceType {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface TemplateSpace {
  id: string;
  template_id: string;
  space_type_id: string;
  default_name?: string;
  display_order: number;
  space_type?: SpaceType;
}

interface TemplateLineItem {
  id: string;
  template_id: string;
  space_type_id?: string;
  component_type_id?: string;
  component_variant_id?: string;
  cost_item_id: string;
  group_name?: string;
  rate?: number;
  display_order: number;
  notes?: string;
  // Joined relations
  space_type?: SpaceType;
  component_type?: ComponentType;
  component_variant?: ComponentVariant;
  cost_item?: CostItem;
}

interface QuotationTemplate {
  id: string;
  name: string;
  description?: string;
  property_type: string;
  quality_tier: string;
  base_price: number;
  is_active: boolean;
  is_featured: boolean;
  usage_count: number;
  spaces: TemplateSpace[];
  line_items: TemplateLineItem[];
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// ============================================================================
// Display Helpers
// ============================================================================

const STATUS_COLORS = {
  active: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  draft: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
  archived: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
};

const QUALITY_TIER_COLORS: Record<string, string> = {
  luxury: "bg-purple-100 text-purple-700",
  premium: "bg-blue-100 text-blue-700",
  standard: "bg-green-100 text-green-700",
  basic: "bg-slate-100 text-slate-700",
};

const PROPERTY_TYPES: Record<string, string> = {
  "1bhk": "1BHK Apartment",
  "2bhk": "2BHK Apartment",
  "3bhk": "3BHK Apartment",
  "4bhk": "4BHK Apartment",
  studio: "Studio",
  villa: "Villa",
  penthouse: "Penthouse",
  office: "Commercial Office",
  retail: "Retail",
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

// ============================================================================
// Helper to organize line items into hierarchy
// ============================================================================

interface ComponentGroup {
  componentTypeId: string;
  componentTypeName: string;
  componentTypeIcon?: string;
  variantId?: string;
  variantName?: string;
  lineItems: TemplateLineItem[];
}

interface SpaceGroup {
  spaceTypeId: string;
  spaceTypeName: string;
  spaceTypeIcon?: string;
  defaultName?: string;
  components: ComponentGroup[];
  directLineItems: TemplateLineItem[]; // Line items not grouped under a component
}

function organizeLineItems(
  spaces: TemplateSpace[],
  lineItems: TemplateLineItem[]
): {
  spaceGroups: SpaceGroup[];
  ungroupedLineItems: TemplateLineItem[];
} {
  const spaceMap = new Map<string, SpaceGroup>();
  const ungroupedLineItems: TemplateLineItem[] = [];

  // Initialize space groups from template_spaces
  spaces.forEach((space) => {
    spaceMap.set(space.space_type_id, {
      spaceTypeId: space.space_type_id,
      spaceTypeName: space.space_type?.name || space.space_type_id,
      spaceTypeIcon: space.space_type?.icon,
      defaultName: space.default_name,
      components: [],
      directLineItems: [],
    });
  });

  // Group line items
  lineItems.forEach((item) => {
    if (item.space_type_id) {
      let spaceGroup = spaceMap.get(item.space_type_id);

      // Create space group if it doesn't exist (in case spaces array is incomplete)
      if (!spaceGroup) {
        spaceGroup = {
          spaceTypeId: item.space_type_id,
          spaceTypeName: item.space_type?.name || item.space_type_id,
          spaceTypeIcon: item.space_type?.icon,
          components: [],
          directLineItems: [],
        };
        spaceMap.set(item.space_type_id, spaceGroup);
      }

      if (item.component_type_id) {
        // Find or create component group within space
        const componentKey = `${item.component_type_id}-${
          item.component_variant_id || "default"
        }`;
        let componentGroup = spaceGroup.components.find(
          (c) =>
            c.componentTypeId === item.component_type_id &&
            c.variantId === item.component_variant_id
        );

        if (!componentGroup) {
          componentGroup = {
            componentTypeId: item.component_type_id,
            componentTypeName:
              item.component_type?.name || item.component_type_id,
            componentTypeIcon: item.component_type?.icon,
            variantId: item.component_variant_id,
            variantName: item.component_variant?.name,
            lineItems: [],
          };
          spaceGroup.components.push(componentGroup);
        }

        componentGroup.lineItems.push(item);
      } else {
        // Line item directly under space (no component)
        spaceGroup.directLineItems.push(item);
      }
    } else {
      // No space - ungrouped
      ungroupedLineItems.push(item);
    }
  });

  return {
    spaceGroups: Array.from(spaceMap.values()),
    ungroupedLineItems,
  };
}

// ============================================================================
// Main Component
// ============================================================================

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<QuotationTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(
    new Set()
  );
  const [duplicating, setDuplicating] = useState(false);

  // Duplicate template handler
  const handleDuplicate = async () => {
    if (!template) return;

    try {
      setDuplicating(true);
      const response = await fetch(
        `/api/quotations/templates/${template.id}/duplicate`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to duplicate template");
      }

      const data = await response.json();
      if (data.success && data.template) {
        // Navigate to the new template's edit page
        router.push(`/dashboard/quotations/templates/${data.template.id}/edit`);
      } else {
        throw new Error(data.error || "Failed to duplicate template");
      }
    } catch (err) {
      console.error("Error duplicating template:", err);
      alert(
        err instanceof Error ? err.message : "Failed to duplicate template"
      );
    } finally {
      setDuplicating(false);
    }
  };

  // Fetch template
  const fetchTemplate = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/quotations/templates/${params.id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch template");
      }

      const data = await response.json();
      if (data.success && data.template) {
        setTemplate(data.template);
        // Expand all spaces by default
        if (data.template.spaces) {
          setExpandedSpaces(
            new Set(
              data.template.spaces.map((s: TemplateSpace) => s.space_type_id)
            )
          );
        }
      } else {
        throw new Error(data.error || "Template not found");
      }
    } catch (err) {
      console.error("Error fetching template:", err);
      setError(err instanceof Error ? err.message : "Failed to load template");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  // Organize line items into hierarchy
  const { spaceGroups, ungroupedLineItems } = useMemo(() => {
    if (!template) return { spaceGroups: [], ungroupedLineItems: [] };
    return organizeLineItems(template.spaces || [], template.line_items || []);
  }, [template]);

  // Statistics
  const stats = useMemo(() => {
    if (!template) return { spaces: 0, components: 0, lineItems: 0 };
    const totalComponents = spaceGroups.reduce(
      (sum, s) => sum + s.components.length,
      0
    );
    return {
      spaces: spaceGroups.length,
      components: totalComponents,
      lineItems: template.line_items?.length || 0,
    };
  }, [template, spaceGroups]);

  const toggleSpace = (spaceId: string) => {
    setExpandedSpaces((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(spaceId)) {
        newSet.delete(spaceId);
      } else {
        newSet.add(spaceId);
      }
      return newSet;
    });
  };

  const toggleComponent = (componentKey: string) => {
    setExpandedComponents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(componentKey)) {
        newSet.delete(componentKey);
      } else {
        newSet.add(componentKey);
      }
      return newSet;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-slate-600">Loading template...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !template) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="text-lg font-medium text-slate-900 mb-2">
          {error || "Template not found"}
        </p>
        <Link
          href="/dashboard/quotations/templates"
          className="text-blue-600 hover:underline"
        >
          ← Back to Templates
        </Link>
      </div>
    );
  }

  const status = template.is_active ? "active" : "archived";
  const statusColors = STATUS_COLORS[status];

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
              <Link
                href="/dashboard/quotations/templates"
                className="hover:text-blue-600"
              >
                Templates
              </Link>
              <span>/</span>
              <span className="text-slate-700 font-medium truncate max-w-[200px]">
                {template.name}
              </span>
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-slate-200 shrink-0" />

            {/* Title */}
            <h1 className="text-xl font-bold text-slate-900 truncate">
              {template.name}
            </h1>

            {/* Status Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full shrink-0 ${statusColors.bg} ${statusColors.text}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${statusColors.dot}`}
              ></span>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>

            {/* Quality Tier Badge */}
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
                QUALITY_TIER_COLORS[template.quality_tier?.toLowerCase()] ||
                QUALITY_TIER_COLORS.standard
              }`}
            >
              {template.quality_tier?.charAt(0).toUpperCase() +
                template.quality_tier?.slice(1) || "Standard"}
            </span>

            {/* Property Type */}
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
              {PROPERTY_TYPES[template.property_type] || template.property_type}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() =>
                router.push(
                  `/dashboard/quotations/templates/${template.id}/edit`
                )
              }
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
            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {duplicating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
              {duplicating ? "Duplicating..." : "Duplicate"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Template Info Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Template Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Template Type
                </label>
                <p className="text-sm text-slate-900">
                  {PROPERTY_TYPES[template.property_type] ||
                    template.property_type}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Quality Tier
                </label>
                <p className="text-sm text-slate-900">
                  {template.quality_tier?.charAt(0).toUpperCase() +
                    template.quality_tier?.slice(1) || "Standard"}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Base Price
                </label>
                <p className="text-sm text-slate-900 font-semibold">
                  {formatCurrency(template.base_price || 0)}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Usage Count
                </label>
                <p className="text-sm text-slate-900">
                  {template.usage_count || 0} times
                </p>
              </div>
            </div>
            {template.description && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Description
                </label>
                <p className="text-sm text-slate-700">{template.description}</p>
              </div>
            )}
          </div>

          {/* Template Structure - V2 with Cost Items */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Template Structure
            </h3>

            {spaceGroups.length === 0 && ungroupedLineItems.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg
                    className="w-6 h-6 text-slate-400"
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
                <h4 className="text-sm font-medium text-slate-900 mb-1">
                  No Cost Items Defined
                </h4>
                <p className="text-sm text-slate-500 mb-4">
                  This template doesn&apos;t have any cost items configured yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Space Groups */}
                {spaceGroups.map((space) => (
                  <div
                    key={space.spaceTypeId}
                    className="border border-slate-200 rounded-lg overflow-hidden"
                  >
                    {/* Space Header */}
                    <div
                      className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer"
                      onClick={() => toggleSpace(space.spaceTypeId)}
                    >
                      <div className="flex items-center gap-3">
                        <button className="text-slate-600">
                          <svg
                            className={`w-5 h-5 transition-transform ${
                              expandedSpaces.has(space.spaceTypeId)
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
                            {space.defaultName || space.spaceTypeName}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {space.spaceTypeName} • {space.components.length}{" "}
                            components •{" "}
                            {space.components.reduce(
                              (sum, c) => sum + c.lineItems.length,
                              0
                            ) + space.directLineItems.length}{" "}
                            cost items
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Space Content */}
                    {expandedSpaces.has(space.spaceTypeId) && (
                      <div className="p-4 space-y-3 border-t border-slate-100">
                        {/* Components within Space */}
                        {space.components.map((component, idx) => {
                          const componentKey = `${space.spaceTypeId}-${
                            component.componentTypeId
                          }-${component.variantId || "default"}`;
                          return (
                            <div
                              key={componentKey}
                              className="border border-slate-200 rounded-lg overflow-hidden"
                            >
                              {/* Component Header */}
                              <div
                                className="flex items-center justify-between px-4 py-2.5 bg-slate-50 cursor-pointer"
                                onClick={() => toggleComponent(componentKey)}
                              >
                                <div className="flex items-center gap-3">
                                  <button className="text-slate-500">
                                    <svg
                                      className={`w-4 h-4 transition-transform ${
                                        expandedComponents.has(componentKey)
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
                                      {component.componentTypeName}
                                      {component.variantName && (
                                        <span className="text-slate-500 font-normal">
                                          {" "}
                                          - {component.variantName}
                                        </span>
                                      )}
                                    </h5>
                                    <p className="text-xs text-slate-500">
                                      {component.lineItems.length} cost items
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Component Line Items */}
                              {expandedComponents.has(componentKey) && (
                                <div className="p-3 border-t border-slate-100">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-50">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                                          Cost Item
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                                          Category
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                                          Unit
                                        </th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                                          Rate
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {component.lineItems.map((item) => (
                                        <tr
                                          key={item.id}
                                          className="hover:bg-slate-50"
                                        >
                                          <td className="px-3 py-2">
                                            <span className="font-medium text-slate-900">
                                              {item.cost_item?.name ||
                                                item.cost_item_id}
                                            </span>
                                            {item.group_name && (
                                              <span className="ml-2 text-xs text-slate-500">
                                                ({item.group_name})
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2">
                                            <span
                                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(
                                                item.cost_item?.category?.slug
                                              )}`}
                                            >
                                              {item.cost_item?.category?.name ||
                                                "—"}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-slate-600">
                                            {item.cost_item?.unit_code || "—"}
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium text-slate-900">
                                            {formatCurrency(
                                              item.rate ||
                                                item.cost_item?.default_rate ||
                                                0
                                            )}
                                            <span className="text-slate-500 font-normal">
                                              /
                                              {item.cost_item?.unit_code ||
                                                "unit"}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Direct line items (not under component) */}
                        {space.directLineItems.length > 0 && (
                          <div className="border border-dashed border-slate-300 rounded-lg p-3">
                            <h5 className="text-xs font-medium text-slate-500 uppercase mb-2">
                              Direct Cost Items (No Component)
                            </h5>
                            <table className="w-full text-sm">
                              <tbody className="divide-y divide-slate-100">
                                {space.directLineItems.map((item) => (
                                  <tr
                                    key={item.id}
                                    className="hover:bg-slate-50"
                                  >
                                    <td className="px-3 py-2">
                                      <span className="font-medium text-slate-900">
                                        {item.cost_item?.name ||
                                          item.cost_item_id}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(
                                          item.cost_item?.category?.slug
                                        )}`}
                                      >
                                        {item.cost_item?.category?.name || "—"}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium text-slate-900">
                                      {formatCurrency(
                                        item.rate ||
                                          item.cost_item?.default_rate ||
                                          0
                                      )}
                                      /{item.cost_item?.unit_code || "unit"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {space.components.length === 0 &&
                          space.directLineItems.length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-4">
                              No cost items in this space
                            </p>
                          )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Ungrouped Line Items */}
                {ungroupedLineItems.length > 0 && (
                  <div className="border border-dashed border-slate-300 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">
                      Ungrouped Cost Items
                    </h4>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                            Cost Item
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                            Category
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                            Unit
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                            Rate
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ungroupedLineItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <span className="font-medium text-slate-900">
                                {item.cost_item?.name || item.cost_item_id}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(
                                  item.cost_item?.category?.slug
                                )}`}
                              >
                                {item.cost_item?.category?.name || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {item.cost_item?.unit_code || "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-slate-900">
                              {formatCurrency(
                                item.rate || item.cost_item?.default_rate || 0
                              )}
                              /{item.cost_item?.unit_code || "unit"}
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
        </div>

        {/* Right Sidebar */}
        <div className="w-80 shrink-0 space-y-4">
          {/* Summary Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Template Summary
            </h3>

            {spaceGroups.length > 0 ? (
              <div className="space-y-2 mb-4">
                {spaceGroups.map((space) => (
                  <div
                    key={space.spaceTypeId}
                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                  >
                    <span className="text-sm text-slate-600">
                      {space.defaultName || space.spaceTypeName}
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {space.components.reduce(
                        (sum, c) => sum + c.lineItems.length,
                        0
                      ) + space.directLineItems.length}{" "}
                      items
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-4">
                No spaces defined yet.
              </p>
            )}

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-semibold text-slate-900">
                  Base Price
                </span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(template.base_price || 0)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Actual cost calculated from dimensions
              </p>
            </div>
          </div>

          {/* Statistics Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Statistics
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Total Spaces</span>
                <span className="font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {stats.spaces}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Total Components</span>
                <span className="font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {stats.components}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Total Cost Items</span>
                <span className="font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {stats.lineItems}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Times Used</span>
                <span className="font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {template.usage_count || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Information
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500">Created</span>
                <p className="text-slate-900">
                  {formatDate(template.created_at)}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Last Updated</span>
                <p className="text-slate-900">
                  {formatDate(template.updated_at)}
                </p>
              </div>
              {template.is_featured && (
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Featured Template
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

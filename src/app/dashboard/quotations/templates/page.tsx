"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatBadge,
} from "@/components/ui/PageLayout";
import {
  AppTable,
  useAppTableSort,
  useAppTableSearch,
  type ColumnDef,
} from "@/components/ui/AppTable";
import {
  RectangleStackIcon,
  PlusIcon,
  DocumentDuplicateIcon,
  Squares2X2Icon,
  ListBulletIcon,
  StarIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";

// Template status types
type TemplateStatus = "active" | "archived" | "draft";

interface QuotationTemplate {
  id: string;
  name: string;
  property_type: string;
  quality_tier: string;
  base_price: number;
  description: string;
  usage_count: number;
  status: TemplateStatus;
  spaces_count: number;
  components_count: number;
  created_at: string;
  updated_at: string;
  created_by: {
    id: string;
    name: string;
  } | null;
}

const QUALITY_TIER_COLORS: Record<string, string> = {
  luxury: "bg-purple-100 text-purple-700",
  premium: "bg-blue-100 text-blue-700",
  standard: "bg-green-100 text-green-700",
  basic: "bg-slate-100 text-slate-700",
};

const QUALITY_TIER_DOT_COLORS: Record<string, string> = {
  luxury: "bg-purple-500",
  premium: "bg-blue-500",
  standard: "bg-green-500",
  basic: "bg-slate-400",
};

const QUALITY_TIER_LABELS: Record<string, string> = {
  luxury: "Luxury",
  premium: "Premium",
  standard: "Standard",
  basic: "Basic",
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
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

export default function QuotationTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>("");
  const [qualityTierFilter, setQualityTierFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Use AppTable hooks
  const { sortState, handleSort, sortData } =
    useAppTableSort<QuotationTemplate>();
  const { searchValue, setSearchValue } = useAppTableSearch<QuotationTemplate>(
    []
  );

  // Custom filter function
  const filterData = useCallback(
    (data: QuotationTemplate[], searchTerm: string) => {
      if (!searchTerm) return data;
      const query = searchTerm.toLowerCase();
      return data.filter(
        (template) =>
          template.name?.toLowerCase().includes(query) ||
          template.property_type?.toLowerCase().includes(query) ||
          template.description?.toLowerCase().includes(query) ||
          QUALITY_TIER_LABELS[template.quality_tier]
            ?.toLowerCase()
            .includes(query)
      );
    },
    []
  );

  // Custom sort value getter
  const getSortValue = useCallback(
    (item: QuotationTemplate, column: string) => {
      switch (column) {
        case "name":
          return item.name?.toLowerCase() || "";
        case "property_type":
          return item.property_type?.toLowerCase() || "";
        case "quality_tier":
          const tierOrder = ["basic", "standard", "premium", "luxury"];
          return tierOrder.indexOf(item.quality_tier);
        case "spaces_count":
          return item.spaces_count || 0;
        case "components_count":
          return item.components_count || 0;
        case "usage_count":
          return item.usage_count || 0;
        case "updated_at":
        default:
          return item.updated_at ? new Date(item.updated_at) : null;
      }
    },
    []
  );

  // Process data: filter by search -> filter by dropdowns -> sort
  const processedTemplates = useMemo(() => {
    let result = filterData(templates, searchValue);

    // Apply dropdown filters
    if (propertyTypeFilter) {
      result = result.filter((t) => t.property_type === propertyTypeFilter);
    }
    if (qualityTierFilter) {
      result = result.filter((t) => t.quality_tier === qualityTierFilter);
    }

    return sortData(result, getSortValue);
  }, [
    templates,
    searchValue,
    filterData,
    sortData,
    getSortValue,
    propertyTypeFilter,
    qualityTierFilter,
  ]);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("status", "active");

      const response = await fetch(
        `/api/quotations/templates?${params.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch templates");

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalUsage = templates.reduce(
      (sum, t) => sum + (t.usage_count || 0),
      0
    );

    // Count by tier
    const tierCounts = templates.reduce((acc, t) => {
      acc[t.quality_tier] = (acc[t.quality_tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count by property type
    const propertyTypeCounts = templates.reduce((acc, t) => {
      acc[t.property_type] = (acc[t.property_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: templates.length,
      totalUsage,
      tierCounts,
      propertyTypeCounts,
    };
  }, [templates]);

  // Duplicate template handler
  const handleDuplicate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await fetch(
        `/api/quotations/templates/${templateId}/duplicate`,
        {
          method: "POST",
        }
      );

      if (!response.ok) throw new Error("Failed to duplicate template");

      const data = await response.json();
      if (data.success && data.template) {
        router.push(`/dashboard/quotations/templates/${data.template.id}/edit`);
      } else {
        throw new Error(data.error || "Failed to duplicate template");
      }
    } catch (err) {
      console.error("Error duplicating template:", err);
      alert(
        err instanceof Error ? err.message : "Failed to duplicate template"
      );
    }
  };

  // Delete template handler
  const handleDelete = async (
    templateId: string,
    templateName: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (
      !confirm(
        `Are you sure you want to delete "${templateName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/quotations/templates/${templateId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete template");
      }

      // Refresh the list
      fetchTemplates();
    } catch (err) {
      console.error("Error deleting template:", err);
      alert(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Define table columns
  const columns: ColumnDef<QuotationTemplate>[] = [
    {
      key: "name",
      header: "Template Name",
      width: "25%",
      sortable: true,
      render: (template) => (
        <div>
          <p className="text-sm font-medium text-slate-900">{template.name}</p>
          {template.description && (
            <p className="text-xs text-slate-500 truncate max-w-[200px]">
              {template.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "property_type",
      header: "Property Type",
      width: "15%",
      sortable: true,
      render: (template) => (
        <p className="text-sm text-slate-700">
          {PROPERTY_TYPE_LABELS[template.property_type] ||
            template.property_type}
        </p>
      ),
    },
    {
      key: "quality_tier",
      header: "Tier",
      width: "12%",
      sortable: true,
      render: (template) => (
        <span
          className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
            QUALITY_TIER_COLORS[template.quality_tier] ||
            "bg-slate-100 text-slate-700"
          }`}
        >
          {QUALITY_TIER_LABELS[template.quality_tier] || template.quality_tier}
        </span>
      ),
    },
    {
      key: "spaces_count",
      header: "Spaces",
      width: "10%",
      sortable: true,
      render: (template) => (
        <p className="text-sm text-slate-700">{template.spaces_count || 0}</p>
      ),
    },
    {
      key: "components_count",
      header: "Components",
      width: "10%",
      sortable: true,
      render: (template) => (
        <p className="text-sm text-slate-700">
          {template.components_count || 0}
        </p>
      ),
    },
    {
      key: "usage_count",
      header: "Uses",
      width: "8%",
      sortable: true,
      render: (template) => (
        <p className="text-sm font-medium text-blue-600">
          {template.usage_count || 0}
        </p>
      ),
    },
    {
      key: "updated_at",
      header: "Last Updated",
      width: "12%",
      sortable: true,
      render: (template) => (
        <p className="text-sm text-slate-700">
          {formatDate(template.updated_at)}
        </p>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "10%",
      render: (template) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/quotations/templates/${template.id}`);
            }}
            className="px-2 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded font-medium"
          >
            View
          </button>
          <button
            onClick={(e) => handleDuplicate(template.id, e)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
            title="Duplicate"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDelete(template.id, template.name, e)}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageLayout>
      <PageHeader
        title="Quotation Templates"
        breadcrumbs={[{ label: "Quotations" }, { label: "Templates" }]}
        actions={
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-slate-200 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded ${
                  viewMode === "table"
                    ? "bg-slate-100 text-slate-700"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                title="Table View"
              >
                <ListBulletIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded ${
                  viewMode === "cards"
                    ? "bg-slate-100 text-slate-700"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                title="Card View"
              >
                <Squares2X2Icon className="w-4 h-4" />
              </button>
            </div>
            <Link
              href="/dashboard/quotations/templates/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
            >
              <PlusIcon className="w-4 h-4" />
              Create Template
            </Link>
          </div>
        }
        stats={
          <>
            <StatBadge
              label="Total Templates"
              value={stats.total}
              color="slate"
            />
            <StatBadge
              label="Total Uses"
              value={stats.totalUsage}
              color="blue"
            />
          </>
        }
      />

      <PageContent>
        {/* Toolbar with Search and Filters */}
        <div className="mb-4 flex items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search by name, property type, or tier..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full pl-3 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100"
              >
                <span className="text-slate-400 text-xs">✕</span>
              </button>
            )}
          </div>

          {/* Quality Tier Filter Dropdown */}
          <select
            value={qualityTierFilter}
            onChange={(e) => setQualityTierFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="">All Tiers ({stats.total})</option>
            {["luxury", "premium", "standard", "basic"].map((tier) => (
              <option key={tier} value={tier}>
                {QUALITY_TIER_LABELS[tier]} ({stats.tierCounts[tier] || 0})
              </option>
            ))}
          </select>

          {/* Property Type Filter Dropdown */}
          {Object.keys(stats.propertyTypeCounts).length > 0 && (
            <select
              value={propertyTypeFilter}
              onChange={(e) => setPropertyTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
            >
              <option value="">All Properties</option>
              {Object.entries(stats.propertyTypeCounts).map(([type, count]) => (
                <option key={type} value={type}>
                  {PROPERTY_TYPE_LABELS[type] || type} ({count})
                </option>
              ))}
            </select>
          )}
        </div>

        {viewMode === "cards" ? (
          /* Cards View */
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : processedTemplates.length === 0 ? (
              <div className="text-center py-12">
                <RectangleStackIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No templates found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {processedTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() =>
                      router.push(
                        `/dashboard/quotations/templates/${template.id}`
                      )
                    }
                    className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600">
                          {template.name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {PROPERTY_TYPE_LABELS[template.property_type] ||
                            template.property_type}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                          QUALITY_TIER_COLORS[template.quality_tier] ||
                          "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {QUALITY_TIER_LABELS[template.quality_tier] ||
                          template.quality_tier}
                      </span>
                    </div>

                    {template.description && (
                      <p className="text-xs text-slate-500 mb-3 line-clamp-2">
                        {template.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3 mt-3">
                      <div className="flex items-center gap-3">
                        <span>{template.spaces_count || 0} spaces</span>
                        <span>{template.components_count || 0} components</span>
                      </div>
                      <div className="flex items-center gap-1 text-blue-600">
                        <StarIconSolid className="w-3.5 h-3.5" />
                        <span className="font-medium">
                          {template.usage_count || 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(
                            `/dashboard/quotations/templates/${template.id}`
                          );
                        }}
                        className="flex-1 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        View Details
                      </button>
                      <button
                        onClick={(e) => handleDuplicate(template.id, e)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Duplicate"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) =>
                          handleDelete(template.id, template.name, e)
                        }
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Table View */
          <AppTable
            data={processedTemplates}
            columns={columns}
            keyExtractor={(t) => t.id}
            isLoading={isLoading}
            showToolbar={false}
            sortable={true}
            sortState={sortState}
            onSort={handleSort}
            onRowClick={(template) =>
              router.push(`/dashboard/quotations/templates/${template.id}`)
            }
            emptyState={{
              title: "No templates found",
              description:
                qualityTierFilter || propertyTypeFilter || searchValue
                  ? "No templates match your filters. Try a different filter."
                  : "Create your first quotation template to get started.",
              icon: <RectangleStackIcon className="w-6 h-6 text-slate-400" />,
            }}
          />
        )}
      </PageContent>
    </PageLayout>
  );
}

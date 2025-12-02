"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

const TEMPLATE_TYPES = [
  { value: "", label: "All Template Types" },
  { value: "1bhk", label: "1BHK Apartment" },
  { value: "2bhk", label: "2BHK Apartment" },
  { value: "3bhk", label: "3BHK Apartment" },
  { value: "4bhk", label: "4BHK Apartment" },
  { value: "studio", label: "Studio" },
  { value: "villa", label: "Villa" },
  { value: "penthouse", label: "Penthouse" },
  { value: "office", label: "Commercial Office" },
  { value: "retail", label: "Retail" },
];

const QUALITY_TIERS = [
  { value: "", label: "All Tiers" },
  { value: "basic", label: "Basic" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxury" },
];

// Sorting types
type SortField =
  | "name"
  | "property_type"
  | "quality_tier"
  | "usage_count"
  | "updated_at"
  | "created_by";
type SortDirection = "asc" | "desc";

export default function QuotationTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [templateTypeFilter, setTemplateTypeFilter] = useState<string>("");
  const [qualityTierFilter, setQualityTierFilter] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      // Always fetch active templates (remove status filter UI)
      params.set("status", "active");
      if (templateTypeFilter) params.set("property_type", templateTypeFilter);
      if (qualityTierFilter) params.set("quality_tier", qualityTierFilter);
      if (searchTerm) params.set("search", searchTerm);
      params.set("sort_by", sortField);
      params.set("sort_order", sortDirection);

      const response = await fetch(
        `/api/quotations/templates?${params.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch templates");

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      // Use sample data for now
      setTemplates(getSampleTemplates());
    } finally {
      setLoading(false);
    }
  }, [
    templateTypeFilter,
    qualityTierFilter,
    searchTerm,
    sortField,
    sortDirection,
  ]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Duplicate template handler
  const handleDuplicate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      setDuplicatingId(templateId);
      const response = await fetch(
        `/api/quotations/templates/${templateId}/duplicate`,
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
      setDuplicatingId(null);
    }
  };

  // Filter and sort templates locally (in case API doesn't support it)
  const filteredTemplates = useMemo(() => {
    let filtered = [...templates];

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (template) =>
          template.name?.toLowerCase().includes(search) ||
          template.property_type?.toLowerCase().includes(search) ||
          template.description?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [templates, searchTerm]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalUsage = templates.reduce(
      (sum, t) => sum + (t.usage_count || 0),
      0
    );
    return {
      total: templates.length,
      totalUsage,
    };
  }, [templates]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <svg
      className={`w-4 h-4 ${
        sortField === field ? "text-slate-900" : "text-slate-400"
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {sortField === field && sortDirection === "asc" ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      ) : sortField === field && sortDirection === "desc" ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      )}
    </svg>
  );

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
              <span className="text-slate-700 font-medium">Templates</span>
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-slate-200 shrink-0" />

            {/* Title */}
            <h1 className="text-xl font-bold text-slate-900">
              Quotation Templates
            </h1>

            {/* Stats Pills */}
            <div className="hidden md:flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-600 bg-slate-100 rounded-lg">
                <span className="font-medium">{stats.total}</span> templates
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg">
                <span className="font-medium">{stats.totalUsage}</span> uses
              </span>
            </div>
          </div>

          {/* Create Template Button */}
          <Link
            href="/dashboard/quotations/templates/new"
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shrink-0"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Template
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 px-5 py-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Template Type Filter */}
          <select
            value={templateTypeFilter}
            onChange={(e) => setTemplateTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            {TEMPLATE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          {/* Quality Tier Filter */}
          <select
            value={qualityTierFilter}
            onChange={(e) => setQualityTierFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            {QUALITY_TIERS.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Templates Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              No templates found
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {searchTerm
                ? "Try adjusting your search or filters"
                : "Create your first template to get started"}
            </p>
            {!searchTerm && (
              <Link
                href="/dashboard/quotations/templates/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Template
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Template
                      <SortIcon field="name" />
                    </div>
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("property_type")}
                  >
                    <div className="flex items-center gap-1">
                      Template Type
                      <SortIcon field="property_type" />
                    </div>
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("quality_tier")}
                  >
                    <div className="flex items-center gap-1">
                      Quality Tier
                      <SortIcon field="quality_tier" />
                    </div>
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("usage_count")}
                  >
                    <div className="flex items-center gap-1">
                      Usage
                      <SortIcon field="usage_count" />
                    </div>
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("created_by")}
                  >
                    <div className="flex items-center gap-1">
                      Created By
                      <SortIcon field="created_by" />
                    </div>
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("updated_at")}
                  >
                    <div className="flex items-center gap-1">
                      Updated
                      <SortIcon field="updated_at" />
                    </div>
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredTemplates.map((template) => (
                  <tr
                    key={template.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() =>
                      router.push(
                        `/dashboard/quotations/templates/${template.id}`
                      )
                    }
                  >
                    <td className="px-5 py-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {template.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">
                          {template.description || "No description"}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">
                        {TEMPLATE_TYPES.find(
                          (t) => t.value === template.property_type
                        )?.label ||
                          template.property_type ||
                          "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          QUALITY_TIER_COLORS[
                            template.quality_tier?.toLowerCase()
                          ] || QUALITY_TIER_COLORS.standard
                        }`}
                      >
                        {template.quality_tier?.charAt(0).toUpperCase() +
                          template.quality_tier?.slice(1) || "Standard"}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">
                        {template.usage_count || 0} times
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">
                        {template.created_by?.name || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formatDate(template.updated_at)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <div
                        className="flex items-center justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link
                          href={`/dashboard/quotations/templates/${template.id}/edit`}
                          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit"
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
                        </Link>
                        <button
                          onClick={(e) => handleDuplicate(template.id, e)}
                          disabled={duplicatingId === template.id}
                          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Duplicate"
                        >
                          {duplicatingId === template.id ? (
                            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
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
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Sample templates for development
function getSampleTemplates(): QuotationTemplate[] {
  return [
    {
      id: "1",
      name: "Modern 2BHK Premium",
      property_type: "2bhk",
      quality_tier: "premium",
      base_price: 850000,
      description:
        "Complete interior package for modern 2BHK apartments with premium finishes",
      usage_count: 24,
      status: "active",
      spaces_count: 4,
      components_count: 12,
      created_at: "2024-01-10T09:00:00Z",
      updated_at: "2024-11-15T14:30:00Z",
      created_by: { id: "1", name: "Admin User" },
    },
    {
      id: "2",
      name: "Classic 3BHK Standard",
      property_type: "3bhk",
      quality_tier: "standard",
      base_price: 650000,
      description:
        "Traditional design package for 3BHK apartments with standard materials",
      usage_count: 18,
      status: "active",
      spaces_count: 5,
      components_count: 15,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-11-20T11:00:00Z",
      created_by: { id: "1", name: "Admin User" },
    },
    {
      id: "3",
      name: "Luxury Villa Package",
      property_type: "villa",
      quality_tier: "luxury",
      base_price: 2500000,
      description:
        "Comprehensive luxury interior design for villas with imported materials",
      usage_count: 8,
      status: "active",
      spaces_count: 8,
      components_count: 28,
      created_at: "2024-01-20T11:00:00Z",
      updated_at: "2024-11-25T16:00:00Z",
      created_by: { id: "1", name: "Admin User" },
    },
    {
      id: "4",
      name: "Studio Apartment Minimal",
      property_type: "studio",
      quality_tier: "standard",
      base_price: 280000,
      description: "Minimalist design for studio apartments optimizing space",
      usage_count: 32,
      status: "active",
      spaces_count: 2,
      components_count: 6,
      created_at: "2024-02-01T08:00:00Z",
      updated_at: "2024-11-01T09:00:00Z",
      created_by: { id: "2", name: "Design Team" },
    },
    {
      id: "5",
      name: "Office Space Modern",
      property_type: "office",
      quality_tier: "premium",
      base_price: 1200000,
      description: "Modern office interior with ergonomic workspaces",
      usage_count: 5,
      status: "draft",
      spaces_count: 6,
      components_count: 18,
      created_at: "2024-02-15T14:00:00Z",
      updated_at: "2024-11-05T10:00:00Z",
      created_by: { id: "2", name: "Design Team" },
    },
    {
      id: "6",
      name: "Retail Store Premium",
      property_type: "retail",
      quality_tier: "premium",
      base_price: 950000,
      description: "High-end retail store design with display systems",
      usage_count: 0,
      status: "draft",
      spaces_count: 3,
      components_count: 10,
      created_at: "2024-03-01T09:00:00Z",
      updated_at: "2024-11-10T11:00:00Z",
      created_by: { id: "1", name: "Admin User" },
    },
    {
      id: "7",
      name: "Old 1BHK Basic",
      property_type: "1bhk",
      quality_tier: "basic",
      base_price: 180000,
      description: "Deprecated basic package - replaced by new templates",
      usage_count: 45,
      status: "archived",
      spaces_count: 3,
      components_count: 8,
      created_at: "2023-06-15T10:00:00Z",
      updated_at: "2024-01-05T12:00:00Z",
      created_by: { id: "1", name: "Admin User" },
    },
  ];
}

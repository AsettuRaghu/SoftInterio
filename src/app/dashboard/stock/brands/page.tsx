"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CreateBrandModal, EditBrandModal } from "@/components/stock";
import type {
  Brand,
  CreateBrandInput,
  UpdateBrandInput,
  BrandQualityTier,
} from "@/types/stock";
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
import { PlusIcon, GlobeAltIcon, TagIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const qualityTierLabels: Record<BrandQualityTier, string> = {
  budget: "Budget",
  standard: "Standard",
  premium: "Premium",
  luxury: "Luxury",
};

const qualityTierColors: Record<
  BrandQualityTier,
  { bg: string; text: string }
> = {
  budget: { bg: "bg-slate-100", text: "text-slate-700" },
  standard: { bg: "bg-blue-100", text: "text-blue-700" },
  premium: { bg: "bg-purple-100", text: "text-purple-700" },
  luxury: { bg: "bg-amber-100", text: "text-amber-700" },
};

// Status filter options
const STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "#22c55e" },
  { value: "inactive", label: "Inactive", color: "#94a3b8" },
];

// Quality tier filter options
const QUALITY_TIER_OPTIONS = [
  { value: "budget", label: "Budget", color: "#64748b" },
  { value: "standard", label: "Standard", color: "#3b82f6" },
  { value: "premium", label: "Premium", color: "#8b5cf6" },
  { value: "luxury", label: "Luxury", color: "#f59e0b" },
];

export default function BrandsPage() {
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [qualityTierFilter, setQualityTierFilter] = useState<string>("");
  const [preferredFilter, setPreferredFilter] = useState<boolean | null>(null);

  // Use AppTable hooks
  const { sortState, handleSort, sortData } = useAppTableSort<Brand>();
  const { searchValue, setSearchValue } = useAppTableSearch<Brand>([]);

  // Custom filter function
  const filterData = useCallback(
    (data: Brand[], searchTerm: string) => {
      let filtered = data;

      // Apply status filter
      if (statusFilter) {
        filtered = filtered.filter((b) =>
          statusFilter === "active" ? b.is_active : !b.is_active
        );
      }

      // Apply quality tier filter
      if (qualityTierFilter) {
        filtered = filtered.filter((b) => b.quality_tier === qualityTierFilter);
      }

      // Apply preferred filter
      if (preferredFilter !== null) {
        filtered = filtered.filter((b) =>
          preferredFilter ? b.is_preferred : !b.is_preferred
        );
      }

      // Apply search filter
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (brand) =>
            brand.name?.toLowerCase().includes(query) ||
            brand.code?.toLowerCase().includes(query) ||
            brand.country?.toLowerCase().includes(query) ||
            brand.categories?.some((c) => c.toLowerCase().includes(query))
        );
      }

      return filtered;
    },
    [statusFilter, qualityTierFilter, preferredFilter]
  );

  // Custom sort value getter
  const getSortValue = useCallback((item: Brand, column: string) => {
    switch (column) {
      case "name":
        return item.name?.toLowerCase() || "";
      case "quality_tier":
        const tierOrder = ["budget", "standard", "premium", "luxury"];
        return tierOrder.indexOf(item.quality_tier);
      case "country":
        return item.country?.toLowerCase() || "";
      case "created_at":
      default:
        return item.created_at ? new Date(item.created_at) : null;
    }
  }, []);

  // Process data: filter -> sort
  const processedBrands = useMemo(() => {
    const filtered = filterData(allBrands, searchValue);
    return sortData(filtered, getSortValue);
  }, [allBrands, searchValue, filterData, sortData, getSortValue]);

  // Fetch brands
  const fetchBrands = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("limit", pagination.limit.toString());
      params.set(
        "offset",
        ((pagination.page - 1) * pagination.limit).toString()
      );

      const response = await fetch(`/api/stock/brands?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load brands");
      }

      const data = await response.json();
      setAllBrands(data.brands || []);
      setPagination((prev) => ({
        ...prev,
        total: data.total || 0,
        totalPages: Math.ceil((data.total || 0) / prev.limit),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load brands");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = allBrands.length;
    const active = allBrands.filter((b) => b.is_active).length;
    const preferred = allBrands.filter((b) => b.is_preferred).length;
    const premium = allBrands.filter(
      (b) => b.quality_tier === "premium" || b.quality_tier === "luxury"
    ).length;

    return { total, active, preferred, premium };
  }, [allBrands]);

  // Create brand
  const handleCreateBrand = async (input: CreateBrandInput) => {
    const response = await fetch("/api/stock/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to create brand");
    }

    fetchBrands();
  };

  // Update brand
  const handleUpdateBrand = async (
    brandId: string,
    updates: UpdateBrandInput
  ) => {
    const response = await fetch(`/api/stock/brands?id=${brandId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to update brand");
    }

    fetchBrands();
  };

  // Define table columns
  const columns: ColumnDef<Brand>[] = [
    {
      key: "name",
      header: "Brand",
      width: "25%",
      sortable: true,
      render: (brand) => (
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 ${
              brand.is_preferred
                ? "bg-linear-to-br from-amber-500 to-orange-500"
                : "bg-linear-to-br from-indigo-500 to-purple-500"
            } rounded-lg flex items-center justify-center text-white font-semibold text-xs shrink-0 relative`}
          >
            {brand.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
            {brand.is_preferred && (
              <HeartIconSolid className="absolute -top-1 -right-1 h-4 w-4 text-red-500 drop-shadow" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-900 truncate">
                {brand.display_name || brand.name}
              </p>
              {brand.is_preferred && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                  Preferred
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{brand.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: "categories",
      header: "Categories",
      width: "20%",
      render: (brand) =>
        brand.categories && brand.categories.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {brand.categories.slice(0, 3).map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded"
              >
                {cat}
              </span>
            ))}
            {brand.categories.length > 3 && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
                +{brand.categories.length - 3}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: "quality_tier",
      header: "Quality",
      width: "12%",
      sortable: true,
      render: (brand) => (
        <span
          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
            qualityTierColors[brand.quality_tier]?.bg || "bg-slate-100"
          } ${qualityTierColors[brand.quality_tier]?.text || "text-slate-700"}`}
        >
          {qualityTierLabels[brand.quality_tier] || brand.quality_tier}
        </span>
      ),
    },
    {
      key: "country",
      header: "Country",
      width: "12%",
      sortable: true,
      render: (brand) =>
        brand.country ? (
          <div className="flex items-center gap-1.5">
            <GlobeAltIcon className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-sm text-slate-700">{brand.country}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      align: "center",
      render: (brand) => (
        <span
          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
            brand.is_active
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {brand.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "12%",
      render: (brand) => (
        <div className="flex items-center justify-end gap-2">
          {brand.website && (
            <a
              href={brand.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              title="Visit website"
            >
              <GlobeAltIcon className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingBrand(brand);
            }}
            className="px-2 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded font-medium"
          >
            Edit
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageLayout isLoading={isLoading && allBrands.length === 0}>
      <PageHeader
        title="Brands"
        breadcrumbs={[{ label: "Stock & Procurement" }, { label: "Brands" }]}
        actions={
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            Add Brand
          </button>
        }
        stats={
          <>
            <StatBadge label="Total" value={stats.total} color="slate" />
            <StatBadge label="Active" value={stats.active} color="green" />
            <StatBadge
              label="Preferred"
              value={stats.preferred}
              color="amber"
            />
            <StatBadge label="Premium+" value={stats.premium} color="blue" />
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
              placeholder="Search by name, code, country..."
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

          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Quality Tier Filter Dropdown */}
          <select
            value={qualityTierFilter}
            onChange={(e) => setQualityTierFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="">All Quality Tiers</option>
            {QUALITY_TIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Preferred Filter Dropdown */}
          <select
            value={
              preferredFilter === null
                ? ""
                : preferredFilter
                ? "preferred"
                : "regular"
            }
            onChange={(e) => {
              const val = e.target.value;
              setPreferredFilter(val === "" ? null : val === "preferred");
            }}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="preferred">Preferred</option>
            <option value="regular">Regular</option>
          </select>
        </div>

        <AppTable
          data={processedBrands}
          columns={columns}
          keyExtractor={(b) => b.id}
          isLoading={isLoading}
          showToolbar={false}
          sortable={true}
          sortState={sortState}
          onSort={handleSort}
          onRowClick={(brand) => setEditingBrand(brand)}
          emptyState={{
            title: "No brands found",
            description:
              statusFilter ||
              qualityTierFilter ||
              preferredFilter !== null ||
              searchValue
                ? "No brands match your filters. Try a different filter."
                : "Get started by adding your first brand.",
            icon: <TagIcon className="w-6 h-6 text-slate-400" />,
          }}
        />
      </PageContent>

      {/* Modals */}
      <CreateBrandModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateBrand}
      />

      <EditBrandModal
        isOpen={!!editingBrand}
        brand={editingBrand}
        onClose={() => setEditingBrand(null)}
        onSubmit={handleUpdateBrand}
      />
    </PageLayout>
  );
}

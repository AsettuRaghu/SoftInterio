"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CreateBrandModal, EditBrandModal } from "@/components/stock";
import type {
  Brand,
  CreateBrandInput,
  UpdateBrandInput,
  BrandQualityTier,
  BrandQualityTierLabels,
  BrandQualityTierColors,
} from "@/types/stock";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  GlobeAltIcon,
  PencilSquareIcon,
  ChevronUpDownIcon,
  TagIcon,
  FunnelIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";

type SortField = "name" | "quality_tier" | "country" | "created_at";
type SortOrder = "asc" | "desc";

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

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [filterPreferred, setFilterPreferred] = useState<boolean | null>(null);
  const [filterQualityTier, setFilterQualityTier] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Fetch brands
  const fetchBrands = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus !== "all")
        params.set("is_active", filterStatus === "active" ? "true" : "false");
      if (filterPreferred !== null)
        params.set("is_preferred", filterPreferred ? "true" : "false");
      if (filterQualityTier) params.set("quality_tier", filterQualityTier);
      params.set("sort_by", sortField);
      params.set("sort_order", sortOrder);
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
      setBrands(data.brands || []);
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
  }, [
    searchQuery,
    filterStatus,
    filterPreferred,
    filterQualityTier,
    sortField,
    sortOrder,
    pagination.page,
    pagination.limit,
  ]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

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

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronUpDownIcon className="w-4 h-4 text-slate-400" />;
    }
    return (
      <ChevronUpDownIcon
        className={`w-4 h-4 text-blue-600 ${
          sortOrder === "desc" ? "rotate-180" : ""
        }`}
      />
    );
  };

  // Stats
  const activeBrands = brands.filter((b) => b.is_active).length;
  const preferredBrands = brands.filter((b) => b.is_preferred).length;

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterPreferred(null);
    setFilterQualityTier("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Reset to page 1 when filter changes
  const handleFilterStatusChange = (value: "all" | "active" | "inactive") => {
    setFilterStatus(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters =
    searchQuery ||
    filterStatus !== "all" ||
    filterPreferred !== null ||
    filterQualityTier;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/dashboard" className="hover:text-slate-700">
                Dashboard
              </Link>
              <span>/</span>
              <Link href="/dashboard/stock" className="hover:text-slate-700">
                Stock
              </Link>
              <span>/</span>
              <span className="text-slate-700">Brands</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-slate-900">Brands</h1>
              <div className="hidden md:flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
                  {pagination.total} Total
                </span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700">
                  {activeBrands} Active
                </span>
                {preferredBrands > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-700 flex items-center gap-1">
                    <HeartIconSolid className="h-3 w-3" />
                    {preferredBrands} Preferred
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Brand
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search brands by name, code..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-inset focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg transition-colors ${
                showFilters || hasActiveFilters
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FunnelIcon className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              )}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                <XMarkIcon className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Status:</span>
              <div className="flex gap-1">
                {(["all", "active", "inactive"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleFilterStatusChange(status)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                      filterStatus === status
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Preferred:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setFilterPreferred(null);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    filterPreferred === null
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => {
                    setFilterPreferred(true);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                    filterPreferred === true
                      ? "bg-amber-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <HeartIconSolid className="h-3 w-3" />
                  Preferred
                </button>
                <button
                  onClick={() => {
                    setFilterPreferred(false);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    filterPreferred === false
                      ? "bg-slate-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Other
                </button>
              </div>
            </div>

            {/* Quality Tier Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Quality:</span>
              <select
                value={filterQualityTier}
                onChange={(e) => {
                  setFilterQualityTier(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Tiers</option>
                <option value="budget">Budget</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="luxury">Luxury</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Loading State */}
        {isLoading && (
          <div className="p-8">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-slate-200 rounded-lg" />
                  <div className="flex-1 h-4 bg-slate-200 rounded" />
                  <div className="w-24 h-4 bg-slate-200 rounded" />
                  <div className="w-20 h-4 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="p-8 text-center">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={fetchBrands}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && brands.length === 0 && (
          <div className="p-8 text-center">
            <TagIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">
              {hasActiveFilters
                ? "No brands match your filters"
                : "No brands yet"}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {hasActiveFilters
                ? "Try adjusting your search or filters"
                : "Add your first brand to get started"}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4" />
                Add Brand
              </button>
            )}
          </div>
        )}

        {/* Table Content */}
        {!isLoading && !error && brands.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Brand
                      {renderSortIcon("name")}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-semibold text-slate-600">
                      Categories
                    </span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort("quality_tier")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Quality
                      {renderSortIcon("quality_tier")}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort("country")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Country
                      {renderSortIcon("country")}
                    </button>
                  </th>
                  <th className="text-center px-4 py-3">
                    <span className="text-xs font-semibold text-slate-600">
                      Status
                    </span>
                  </th>
                  <th className="text-right px-4 py-3">
                    <span className="text-xs font-semibold text-slate-600">
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {brands.map((brand) => (
                  <tr
                    key={brand.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    {/* Brand Name & Code */}
                    <td className="px-4 py-3">
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
                    </td>

                    {/* Categories */}
                    <td className="px-4 py-3">
                      {brand.categories && brand.categories.length > 0 ? (
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
                      )}
                    </td>

                    {/* Quality Tier */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          qualityTierColors[brand.quality_tier]?.bg ||
                          "bg-slate-100"
                        } ${
                          qualityTierColors[brand.quality_tier]?.text ||
                          "text-slate-700"
                        }`}
                      >
                        {qualityTierLabels[brand.quality_tier] ||
                          brand.quality_tier}
                      </span>
                    </td>

                    {/* Country */}
                    <td className="px-4 py-3">
                      {brand.country ? (
                        <div className="flex items-center gap-1.5">
                          <GlobeAltIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm text-slate-700">
                            {brand.country}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          brand.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {brand.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {brand.website && (
                          <a
                            href={brand.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-700 hover:bg-slate-50 rounded"
                          >
                            <GlobeAltIcon className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => setEditingBrand(brand)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                          Edit
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

      {/* Pagination */}
      {!isLoading && !error && brands.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Results info */}
            <div className="text-sm text-slate-600">
              Showing{" "}
              <span className="font-medium">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              of <span className="font-medium">{pagination.total}</span> brands
              {hasActiveFilters && " (filtered)"}
            </div>

            {/* Pagination controls */}
            <div className="flex items-center gap-3">
              {/* Rows per page */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Rows per page:</span>
                <select
                  value={pagination.limit}
                  onChange={(e) => {
                    setPagination({
                      ...pagination,
                      limit: parseInt(e.target.value),
                      page: 1,
                    });
                  }}
                  className="px-2 py-1 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPagination({ ...pagination, page: 1 })}
                  disabled={pagination.page === 1}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  title="First page"
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
                      d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                    />
                  </svg>
                </button>
                <button
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page - 1 })
                  }
                  disabled={pagination.page === 1}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Previous page"
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                <span className="px-3 text-sm text-slate-700">
                  Page <span className="font-medium">{pagination.page}</span> of{" "}
                  <span className="font-medium">
                    {pagination.totalPages || 1}
                  </span>
                </span>

                <button
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page + 1 })
                  }
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Next page"
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
                <button
                  onClick={() =>
                    setPagination({
                      ...pagination,
                      page: pagination.totalPages,
                    })
                  }
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Last page"
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
                      d="M13 5l7 7-7 7M5 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}

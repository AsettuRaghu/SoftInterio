"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  StockItemTypeBadge,
  StockStatusBadge,
  CreateMaterialModal,
  EditMaterialModal,
} from "@/components/stock";
import type { StockItemType } from "@/types/stock";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  ChevronUpDownIcon,
  CubeIcon,
  FunnelIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface Material {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category: string | null;
  item_type: string;
  unit_of_measure: string;
  current_quantity: number;
  minimum_quantity: number;
  reorder_quantity: number;
  unit_cost: number;
  selling_price: number | null;
  storage_location: string | null;
  is_active: boolean;
  brand_id: string | null;
  specifications: Record<string, unknown> | null;
  preferred_vendor: {
    id: string;
    name: string;
    code: string;
  } | null;
  brand: {
    id: string;
    name: string;
    code: string;
    quality_tier: string;
  } | null;
  created_at: string;
  updated_at: string;
}

interface Brand {
  id: string;
  name: string;
  code: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type SortField =
  | "name"
  | "sku"
  | "category"
  | "current_quantity"
  | "unit_cost"
  | "created_at";
type SortOrder = "asc" | "desc";

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterItemType, setFilterItemType] = useState("");
  const [filterStockStatus, setFilterStockStatus] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // Fetch brands on mount
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await fetch("/api/stock/brands?limit=100");
        if (response.ok) {
          const data = await response.json();
          setBrands(data.brands || []);
        }
      } catch (err) {
        console.error("Failed to fetch brands:", err);
      }
    };
    fetchBrands();
  }, []);

  const fetchMaterials = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterCategory) params.set("category", filterCategory);
      if (filterItemType) params.set("item_type", filterItemType);
      if (filterStockStatus) params.set("stock_status", filterStockStatus);
      if (filterBrand) params.set("brand_id", filterBrand);
      params.set("sort_by", sortField);
      params.set("sort_order", sortOrder);
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      const response = await fetch(`/api/stock/materials?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        const errorDetails = data.details ? `: ${data.details}` : "";
        const errorHint = data.hint ? ` (Hint: ${data.hint})` : "";
        throw new Error(
          `${
            data.error || "Failed to fetch materials"
          }${errorDetails}${errorHint}`
        );
      }

      setMaterials(data.materials);
      setPagination(data.pagination);
      setCategories(data.filters?.categories || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load materials";
      console.error("[Materials Page] Error:", errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    filterCategory,
    filterItemType,
    filterStockStatus,
    filterBrand,
    sortField,
    sortOrder,
    pagination.page,
    pagination.limit,
  ]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchMaterials();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchMaterials]);

  const getStockStatus = (
    current: number,
    minimum: number
  ): "out_of_stock" | "low_stock" | "in_stock" => {
    if (current === 0) return "out_of_stock";
    if (current <= minimum) return "low_stock";
    return "in_stock";
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

  const itemTypes = [
    { value: "raw_material", label: "Raw Material" },
    { value: "finished_good", label: "Finished Good" },
    { value: "consumable", label: "Consumable" },
    { value: "service", label: "Service" },
    { value: "asset", label: "Asset" },
  ];

  const stockStatuses = [
    { value: "in_stock", label: "In Stock" },
    { value: "low_stock", label: "Low Stock" },
    { value: "out_of_stock", label: "Out of Stock" },
  ];

  // Stats calculation
  const stats = {
    total: pagination.total,
    inStock: materials.filter((m) => m.current_quantity > m.minimum_quantity)
      .length,
    lowStock: materials.filter(
      (m) => m.current_quantity > 0 && m.current_quantity <= m.minimum_quantity
    ).length,
    outOfStock: materials.filter((m) => m.current_quantity === 0).length,
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setFilterCategory("");
    setFilterItemType("");
    setFilterStockStatus("");
    setFilterBrand("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters =
    searchQuery ||
    filterCategory ||
    filterItemType ||
    filterStockStatus ||
    filterBrand;

  if (isLoading && materials.length === 0) {
    return (
      <div className="space-y-4">
        {/* Header Skeleton */}
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
          <div className="animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-32 mb-2"></div>
            <div className="h-5 bg-slate-200 rounded w-48"></div>
          </div>
        </div>
        {/* Table Skeleton */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/dashboard" className="hover:text-slate-700">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/dashboard/stock" className="hover:text-slate-700">
              Stock
            </Link>
            <span>/</span>
            <span className="text-slate-700">Materials</span>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Materials</h1>
        </div>
        {/* Error message */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-1">
              Error Loading Materials
            </h3>
            <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
              {error}
            </p>
            <button
              onClick={fetchMaterials}
              className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              <span className="text-slate-700">Materials</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-slate-900">
                Materials
              </h1>
              <div className="hidden md:flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
                  {pagination.total} Total
                </span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700">
                  {stats.inStock} In Stock
                </span>
                {stats.lowStock > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-700">
                    {stats.lowStock} Low
                  </span>
                )}
                {stats.outOfStock > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-red-50 text-red-700">
                    {stats.outOfStock} Out
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Material
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, SKU, category, description..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filter Toggle & Clear */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
                showFilters || hasActiveFilters
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FunnelIcon className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2 py-2 text-xs text-slate-500 hover:text-slate-700"
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
            {/* Item Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Type:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setFilterItemType("");
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    filterItemType === ""
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All
                </button>
                {itemTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => {
                      setFilterItemType(type.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      filterItemType === type.value
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Stock:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setFilterStockStatus("");
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    filterStockStatus === ""
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All
                </button>
                {stockStatuses.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => {
                      setFilterStockStatus(status.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      filterStockStatus === status.value
                        ? status.value === "in_stock"
                          ? "bg-green-600 text-white"
                          : status.value === "low_stock"
                          ? "bg-amber-500 text-white"
                          : "bg-red-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Category:</span>
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Brand Filter */}
            {brands.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Brand:</span>
                <select
                  value={filterBrand}
                  onChange={(e) => {
                    setFilterBrand(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Brands</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                  <div className="w-32 h-4 bg-slate-200 rounded" />
                  <div className="w-20 h-4 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && materials.length === 0 && (
          <div className="p-12 text-center">
            <CubeIcon className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 mb-1">
              {hasActiveFilters
                ? "No materials match your filters"
                : "No materials yet"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {hasActiveFilters
                ? "Try adjusting your search or filters."
                : "Get started by adding your first material."}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Add Material
              </button>
            )}
          </div>
        )}

        {/* Table Content */}
        {!isLoading && !error && materials.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Material
                      {renderSortIcon("name")}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort("sku")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      SKU
                      {renderSortIcon("sku")}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-semibold text-slate-600">
                      Type
                    </span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort("category")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Category
                      {renderSortIcon("category")}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-semibold text-slate-600">
                      Brand
                    </span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort("current_quantity")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Qty
                      {renderSortIcon("current_quantity")}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-semibold text-slate-600">
                      Status
                    </span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort("unit_cost")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Cost
                      {renderSortIcon("unit_cost")}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-semibold text-slate-600">
                      Vendor
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
                {materials.map((material) => (
                  <tr
                    key={material.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-linear-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-semibold text-xs shrink-0">
                          {material.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {material.name}
                          </p>
                          {material.storage_location && (
                            <p className="text-[10px] text-slate-500">
                              {material.storage_location}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {material.sku}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <StockItemTypeBadge
                        type={material.item_type as StockItemType}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-700">
                        {material.category || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {material.brand ? (
                        <span className="text-xs font-medium text-slate-700">
                          {material.brand.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {material.current_quantity.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {material.unit_of_measure} (min:{" "}
                          {material.minimum_quantity})
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StockStatusBadge
                        status={getStockStatus(
                          material.current_quantity,
                          material.minimum_quantity
                        )}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-900">
                      ${material.unit_cost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {material.preferred_vendor?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingMaterial(material)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <Link
                          href={`/dashboard/stock/purchase-orders?action=create&material=${material.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                          PO
                        </Link>
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
      {!isLoading && !error && materials.length > 0 && (
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
              of <span className="font-medium">{pagination.total}</span>{" "}
              materials
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
                  <option value={25}>25</option>
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
      <CreateMaterialModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchMaterials();
        }}
      />

      <EditMaterialModal
        isOpen={!!editingMaterial}
        material={editingMaterial}
        onClose={() => setEditingMaterial(null)}
        onSuccess={() => {
          setEditingMaterial(null);
          fetchMaterials();
        }}
      />
    </div>
  );
}

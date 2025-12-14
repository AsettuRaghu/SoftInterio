"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  StockItemTypeBadge,
  StockStatusBadge,
  CreateMaterialModal,
  EditMaterialModal,
} from "@/components/stock";
import type { StockItemType } from "@/types/stock";
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
import { PlusIcon, CubeIcon } from "@heroicons/react/24/outline";

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

// Stock status options for filter pills
const STOCK_STATUS_OPTIONS = [
  { value: "in_stock", label: "In Stock", color: "#22c55e" },
  { value: "low_stock", label: "Low Stock", color: "#f59e0b" },
  { value: "out_of_stock", label: "Out of Stock", color: "#ef4444" },
];

// Item type options
const ITEM_TYPE_OPTIONS = [
  { value: "raw_material", label: "Raw Material" },
  { value: "finished_good", label: "Finished Good" },
  { value: "consumable", label: "Consumable" },
  { value: "service", label: "Service" },
  { value: "asset", label: "Asset" },
];

export default function MaterialsPage() {
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
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

  // Filter states
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // Use AppTable hooks
  const { sortState, handleSort, sortData } = useAppTableSort<Material>();
  const { searchValue, setSearchValue } = useAppTableSearch<Material>([]);

  // Get stock status
  const getStockStatus = (
    current: number,
    minimum: number
  ): "out_of_stock" | "low_stock" | "in_stock" => {
    if (current === 0) return "out_of_stock";
    if (current <= minimum) return "low_stock";
    return "in_stock";
  };

  // Custom filter function
  const filterData = useCallback(
    (data: Material[], searchTerm: string) => {
      let filtered = data;

      // Apply stock status filter
      if (stockStatusFilter) {
        filtered = filtered.filter((m) => {
          const status = getStockStatus(m.current_quantity, m.minimum_quantity);
          return status === stockStatusFilter;
        });
      }

      // Apply item type filter
      if (itemTypeFilter) {
        filtered = filtered.filter((m) => m.item_type === itemTypeFilter);
      }

      // Apply search filter
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (material) =>
            material.name?.toLowerCase().includes(query) ||
            material.sku?.toLowerCase().includes(query) ||
            material.category?.toLowerCase().includes(query) ||
            material.description?.toLowerCase().includes(query) ||
            material.brand?.name?.toLowerCase().includes(query) ||
            material.preferred_vendor?.name?.toLowerCase().includes(query)
        );
      }

      return filtered;
    },
    [stockStatusFilter, itemTypeFilter]
  );

  // Custom sort value getter
  const getSortValue = useCallback((item: Material, column: string) => {
    switch (column) {
      case "name":
        return item.name?.toLowerCase() || "";
      case "sku":
        return item.sku?.toLowerCase() || "";
      case "category":
        return item.category?.toLowerCase() || "";
      case "current_quantity":
        return item.current_quantity || 0;
      case "unit_cost":
        return item.unit_cost || 0;
      case "created_at":
      default:
        return item.created_at ? new Date(item.created_at) : null;
    }
  }, []);

  // Process data: filter -> sort
  const processedMaterials = useMemo(() => {
    const filtered = filterData(allMaterials, searchValue);
    return sortData(filtered, getSortValue);
  }, [allMaterials, searchValue, filterData, sortData, getSortValue]);

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

  // Fetch materials
  const fetchMaterials = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      const response = await fetch(`/api/stock/materials?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch materials");
      }

      setAllMaterials(data.materials);
      setPagination(data.pagination);
      setCategories(data.filters?.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load materials");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = allMaterials.length;
    const inStock = allMaterials.filter(
      (m) => m.current_quantity > m.minimum_quantity
    ).length;
    const lowStock = allMaterials.filter(
      (m) => m.current_quantity > 0 && m.current_quantity <= m.minimum_quantity
    ).length;
    const outOfStock = allMaterials.filter(
      (m) => m.current_quantity === 0
    ).length;

    // Count by status for filter badges
    const statusCounts = {
      in_stock: inStock,
      low_stock: lowStock,
      out_of_stock: outOfStock,
    };

    return { total, inStock, lowStock, outOfStock, statusCounts };
  }, [allMaterials]);

  // Format currency
  const formatCurrency = (amount: number | null) => {
    if (!amount) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Define table columns
  const columns: ColumnDef<Material>[] = [
    {
      key: "name",
      header: "Material",
      width: "20%",
      sortable: true,
      render: (material) => (
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
      ),
    },
    {
      key: "sku",
      header: "SKU",
      width: "10%",
      sortable: true,
      render: (material) => (
        <code className="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
          {material.sku}
        </code>
      ),
    },
    {
      key: "item_type",
      header: "Type",
      width: "10%",
      render: (material) => (
        <StockItemTypeBadge type={material.item_type as StockItemType} />
      ),
    },
    {
      key: "category",
      header: "Category",
      width: "10%",
      sortable: true,
      render: (material) => (
        <span className="text-xs text-slate-700">
          {material.category || "—"}
        </span>
      ),
    },
    {
      key: "brand",
      header: "Brand",
      width: "10%",
      render: (material) =>
        material.brand ? (
          <span className="text-xs font-medium text-slate-700">
            {material.brand.name}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: "current_quantity",
      header: "Quantity",
      width: "10%",
      sortable: true,
      render: (material) => (
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {material.current_quantity.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500">
            {material.unit_of_measure} (min: {material.minimum_quantity})
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      render: (material) => (
        <StockStatusBadge
          status={getStockStatus(
            material.current_quantity,
            material.minimum_quantity
          )}
        />
      ),
    },
    {
      key: "unit_cost",
      header: "Cost",
      width: "8%",
      sortable: true,
      render: (material) => (
        <span className="text-sm text-slate-900">
          {formatCurrency(material.unit_cost)}
        </span>
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      width: "10%",
      render: (material) => (
        <span className="text-xs text-slate-600">
          {material.preferred_vendor?.name || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "8%",
      render: (material) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingMaterial(material);
            }}
            className="px-2 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded font-medium"
          >
            Edit
          </button>
          <Link
            href={`/dashboard/stock/purchase-orders?action=create&material=${material.id}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"
            title="Create PO"
          >
            <PlusIcon className="w-4 h-4" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <PageLayout isLoading={isLoading && allMaterials.length === 0}>
      <PageHeader
        title="Inventory"
        breadcrumbs={[{ label: "Stock & Procurement" }, { label: "Inventory" }]}
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            Add Material
          </button>
        }
        stats={
          <>
            <StatBadge label="Total" value={stats.total} color="slate" />
            <StatBadge label="In Stock" value={stats.inStock} color="green" />
            <StatBadge label="Low Stock" value={stats.lowStock} color="amber" />
            <StatBadge
              label="Out of Stock"
              value={stats.outOfStock}
              color="red"
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
              placeholder="Search by name, SKU, category, brand..."
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

          {/* Stock Status Filter Dropdown */}
          <select
            value={stockStatusFilter}
            onChange={(e) => setStockStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="">All Status</option>
            {STOCK_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} (
                {stats.statusCounts[
                  opt.value as keyof typeof stats.statusCounts
                ] || 0}
                )
              </option>
            ))}
          </select>

          {/* Item Type Filter Dropdown */}
          <select
            value={itemTypeFilter}
            onChange={(e) => setItemTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="">All Types</option>
            {ITEM_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <AppTable
          data={processedMaterials}
          columns={columns}
          keyExtractor={(m) => m.id}
          isLoading={isLoading}
          showToolbar={false}
          sortable={true}
          sortState={sortState}
          onSort={handleSort}
          onRowClick={(material) => setEditingMaterial(material)}
          emptyState={{
            title: "No materials found",
            description:
              stockStatusFilter || itemTypeFilter || searchValue
                ? "No materials match your filters. Try a different filter."
                : "Get started by adding your first material to inventory.",
            icon: <CubeIcon className="w-6 h-6 text-slate-400" />,
          }}
        />
      </PageContent>

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
    </PageLayout>
  );
}

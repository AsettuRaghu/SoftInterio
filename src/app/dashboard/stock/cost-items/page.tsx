"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
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
import { CostItemModal } from "@/components/stock/CostItemModal";
import {
  PlusIcon,
  TagIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { QUALITY_TIER_OPTIONS } from "@/utils/stock";

interface CostItemCategory {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
}

interface Vendor {
  id: string;
  name: string;
  code: string;
}

interface CostItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  category: CostItemCategory | null;
  unit_code: string;
  vendor_cost: number;
  company_cost: number;
  default_rate: number;
  retail_price: number | null;
  margin_percent: number | null;
  calculated_margin_percent: number | null;
  quality_tier: string;
  is_stockable: boolean;
  is_active: boolean;
  last_purchase_date: string | null;
  last_vendor_id: string | null;
  last_vendor: Vendor | null;
  reorder_level: number;
  min_order_qty: number;
  lead_time_days: number;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CostItemsPage() {
  const [allCostItems, setAllCostItems] = useState<CostItem[]>([]);
  const [categories, setCategories] = useState<CostItemCategory[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [stockableFilter, setStockableFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CostItem | null>(null);

  // Use AppTable hooks
  const { sortState, handleSort, sortData } = useAppTableSort<CostItem>();
  const { searchValue, setSearchValue } = useAppTableSearch<CostItem>([]);

  // Custom filter function
  const filterData = useCallback(
    (data: CostItem[], searchTerm: string) => {
      let filtered = data;

      // Apply category filter
      if (categoryFilter) {
        filtered = filtered.filter(
          (item) => item.category_id === categoryFilter
        );
      }

      // Apply stockable filter
      if (stockableFilter !== "") {
        filtered = filtered.filter(
          (item) => item.is_stockable === (stockableFilter === "true")
        );
      }

      // Apply active filter
      if (activeFilter !== "") {
        filtered = filtered.filter(
          (item) => item.is_active === (activeFilter === "true")
        );
      }

      // Apply search filter
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (item) =>
            item.name?.toLowerCase().includes(query) ||
            item.slug?.toLowerCase().includes(query) ||
            item.description?.toLowerCase().includes(query) ||
            item.category?.name?.toLowerCase().includes(query)
        );
      }

      return filtered;
    },
    [categoryFilter, stockableFilter, activeFilter]
  );

  // Custom sort value getter
  const getSortValue = useCallback((item: CostItem, column: string) => {
    switch (column) {
      case "name":
        return item.name?.toLowerCase() || "";
      case "category":
        return item.category?.name?.toLowerCase() || "";
      case "vendor_cost":
        return item.vendor_cost || 0;
      case "company_cost":
        return item.company_cost || 0;
      case "default_rate":
        return item.default_rate || 0;
      case "calculated_margin_percent":
        return item.calculated_margin_percent || 0;
      case "created_at":
      default:
        return item.created_at ? new Date(item.created_at) : null;
    }
  }, []);

  // Process data: filter -> sort
  const processedItems = useMemo(() => {
    const filtered = filterData(allCostItems, searchValue);
    return sortData(filtered, getSortValue);
  }, [allCostItems, searchValue, filterData, sortData, getSortValue]);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(
          "/api/quotations/master-data?type=cost_item_categories"
        );
        if (response.ok) {
          const data = await response.json();
          setCategories(data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch cost items
  const fetchCostItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      const response = await fetch(
        `/api/stock/cost-items?${params.toString()}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch cost items");
      }

      setAllCostItems(data.costItems);
      setPagination(data.pagination);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load cost items"
      );
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    fetchCostItems();
  }, [fetchCostItems]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = allCostItems.length;
    const active = allCostItems.filter((item) => item.is_active).length;
    const stockable = allCostItems.filter((item) => item.is_stockable).length;
    const withMargin = allCostItems.filter(
      (item) =>
        item.calculated_margin_percent && item.calculated_margin_percent > 0
    ).length;

    return { total, active, stockable, withMargin };
  }, [allCostItems]);

  // Format currency
  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get category color
  const getCategoryColor = (category: CostItemCategory | null) => {
    if (!category?.color) return "bg-slate-100 text-slate-600";
    const colorMap: Record<string, string> = {
      blue: "bg-blue-100 text-blue-700",
      green: "bg-green-100 text-green-700",
      purple: "bg-purple-100 text-purple-700",
      amber: "bg-amber-100 text-amber-700",
      red: "bg-red-100 text-red-700",
      orange: "bg-orange-100 text-orange-700",
      pink: "bg-pink-100 text-pink-700",
      indigo: "bg-indigo-100 text-indigo-700",
      cyan: "bg-cyan-100 text-cyan-700",
      teal: "bg-teal-100 text-teal-700",
    };
    return colorMap[category.color] || "bg-slate-100 text-slate-600";
  };

  // Define table columns
  const columns: ColumnDef<CostItem>[] = [
    {
      key: "name",
      header: "Item",
      width: "20%",
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-linear-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center text-white font-semibold text-xs shrink-0">
            {item.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {item.name}
            </p>
            <p className="text-[10px] text-slate-500">{item.unit_code}</p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      width: "12%",
      sortable: true,
      render: (item) =>
        item.category ? (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(
              item.category
            )}`}
          >
            {item.category.name}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: "quality_tier",
      header: "Quality",
      width: "8%",
      render: (item) => {
        const tierColors: Record<string, string> = {
          economy: "bg-slate-100 text-slate-600",
          standard: "bg-blue-100 text-blue-600",
          premium: "bg-purple-100 text-purple-600",
          luxury: "bg-amber-100 text-amber-600",
        };
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              tierColors[item.quality_tier] || tierColors.standard
            }`}
          >
            {item.quality_tier.charAt(0).toUpperCase() +
              item.quality_tier.slice(1)}
          </span>
        );
      },
    },
    {
      key: "vendor_cost",
      header: "Vendor Cost",
      width: "10%",
      sortable: true,
      render: (item) => (
        <span className="text-sm text-slate-600">
          {formatCurrency(item.vendor_cost)}
        </span>
      ),
    },
    {
      key: "company_cost",
      header: "Company Cost",
      width: "10%",
      sortable: true,
      render: (item) => (
        <span className="text-sm text-slate-700 font-medium">
          {formatCurrency(item.company_cost)}
        </span>
      ),
    },
    {
      key: "default_rate",
      header: "Base Cost",
      width: "10%",
      sortable: true,
      render: (item) => (
        <span className="text-sm text-slate-900 font-semibold">
          {formatCurrency(item.default_rate)}
        </span>
      ),
    },
    {
      key: "calculated_margin_percent",
      header: "Margin",
      width: "8%",
      sortable: true,
      render: (item) => {
        if (!item.calculated_margin_percent) {
          return <span className="text-xs text-slate-400">—</span>;
        }
        const isGood = item.calculated_margin_percent >= 20;
        return (
          <span
            className={`text-sm font-medium ${
              isGood ? "text-green-600" : "text-amber-600"
            }`}
          >
            {item.calculated_margin_percent}%
          </span>
        );
      },
    },
    {
      key: "is_stockable",
      header: "Stockable",
      width: "6%",
      render: (item) =>
        item.is_stockable ? (
          <CheckCircleIcon className="w-5 h-5 text-green-500" />
        ) : (
          <XCircleIcon className="w-5 h-5 text-slate-300" />
        ),
    },
    {
      key: "is_active",
      header: "Active",
      width: "6%",
      render: (item) =>
        item.is_active ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
            Inactive
          </span>
        ),
    },
    {
      key: "actions",
      header: "",
      width: "8%",
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingItem(item);
            }}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Edit"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          {item.is_stockable && (
            <Link
              href={`/dashboard/stock/inventory?cost_item_id=${item.id}`}
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded"
              title="View Linked Materials"
            >
              <LinkIcon className="w-4 h-4" />
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageLayout isLoading={isLoading && allCostItems.length === 0}>
      <PageHeader
        title="Cost Items"
        breadcrumbs={[
          { label: "Stock & Procurement" },
          { label: "Cost Items" },
        ]}
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            Add Cost Item
          </button>
        }
        stats={
          <>
            <StatBadge label="Total" value={stats.total} color="slate" />
            <StatBadge label="Active" value={stats.active} color="green" />
            <StatBadge label="Stockable" value={stats.stockable} color="blue" />
            <StatBadge
              label="With Margin"
              value={stats.withMargin}
              color="amber"
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
              placeholder="Search by name, description, category..."
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

          {/* Category Filter Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Stockable Filter Dropdown */}
          <select
            value={stockableFilter}
            onChange={(e) => setStockableFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="">All Items</option>
            <option value="true">Stockable Only</option>
            <option value="false">Non-Stockable Only</option>
          </select>

          {/* Active Filter Dropdown */}
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>

        <AppTable
          data={processedItems}
          columns={columns}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          showToolbar={false}
          sortable={true}
          sortState={sortState}
          onSort={handleSort}
          onRowClick={(item) => setEditingItem(item)}
          emptyState={{
            title: "No cost items found",
            description:
              categoryFilter || stockableFilter || activeFilter || searchValue
                ? "No cost items match your filters. Try a different filter."
                : "Get started by adding your first cost item.",
            icon: <TagIcon className="w-6 h-6 text-slate-400" />,
          }}
        />
      </PageContent>

      {/* Create Modal */}
      {showCreateModal && (
        <CostItemModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchCostItems();
          }}
          categories={categories}
        />
      )}

      {/* Edit Modal */}
      {editingItem && (
        <CostItemModal
          isOpen={!!editingItem}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={() => {
            setEditingItem(null);
            fetchCostItems();
          }}
          categories={categories}
        />
      )}
    </PageLayout>
  );
}

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
import {
  PlusIcon,
  TagIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";

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

const QUALITY_TIER_OPTIONS = [
  { value: "economy", label: "Economy" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxury" },
];

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

// Cost Item Modal Component
interface CostItemModalProps {
  isOpen: boolean;
  item?: CostItem | null;
  onClose: () => void;
  onSuccess: () => void;
  categories: CostItemCategory[];
}

function CostItemModal({
  isOpen,
  item,
  onClose,
  onSuccess,
  categories,
}: CostItemModalProps) {
  const isEditing = !!item;
  const [formData, setFormData] = useState({
    name: item?.name || "",
    description: item?.description || "",
    category_id: item?.category_id || "",
    unit_code: item?.unit_code || "sqft",
    vendor_cost: item?.vendor_cost || 0,
    company_cost: item?.company_cost || 0,
    default_rate: item?.default_rate || 0,
    retail_price: item?.retail_price || null,
    quality_tier: item?.quality_tier || "standard",
    is_stockable: item?.is_stockable || false,
    is_active: item?.is_active !== false,
    reorder_level: item?.reorder_level || 0,
    min_order_qty: item?.min_order_qty || 1,
    lead_time_days: item?.lead_time_days || 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate margin when costs change
  const calculatedMargin =
    formData.company_cost > 0 && formData.default_rate > 0
      ? Math.round(
          ((formData.default_rate - formData.company_cost) /
            formData.company_cost) *
            100 *
            100
        ) / 100
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing
        ? `/api/stock/cost-items/${item.id}`
        : "/api/stock/cost-items";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save cost item");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save cost item");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-xl">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditing ? "Edit Cost Item" : "Create Cost Item"}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700">
              Basic Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) =>
                    setFormData({ ...formData, category_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Unit Code *
                </label>
                <select
                  value={formData.unit_code}
                  onChange={(e) =>
                    setFormData({ ...formData, unit_code: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  required
                >
                  <option value="sqft">Square Feet (sqft)</option>
                  <option value="sqm">Square Meter (sqm)</option>
                  <option value="rft">Running Feet (rft)</option>
                  <option value="nos">Numbers (nos)</option>
                  <option value="lot">Lot</option>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="ltr">Litre (ltr)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quality Tier
                </label>
                <select
                  value={formData.quality_tier}
                  onChange={(e) =>
                    setFormData({ ...formData, quality_tier: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                >
                  {QUALITY_TIER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_stockable}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_stockable: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Stockable</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Active</span>
                </label>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700">Pricing</h3>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Vendor Cost
                </label>
                <input
                  type="number"
                  value={formData.vendor_cost}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vendor_cost: parseFloat(e.target.value) || 0,
                    })
                  }
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  What you pay vendor
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Company Cost
                </label>
                <input
                  type="number"
                  value={formData.company_cost}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      company_cost: parseFloat(e.target.value) || 0,
                    })
                  }
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Internal costing
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Base Cost (Default)
                </label>
                <input
                  type="number"
                  value={formData.default_rate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      default_rate: parseFloat(e.target.value) || 0,
                    })
                  }
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Quotation default
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Margin
                </label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                  {calculatedMargin !== null ? (
                    <span
                      className={`font-medium ${
                        calculatedMargin >= 20
                          ? "text-green-600"
                          : "text-amber-600"
                      }`}
                    >
                      {calculatedMargin}%
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Auto-calculated
                </p>
              </div>
            </div>
          </div>

          {/* Stock Settings (only if stockable) */}
          {formData.is_stockable && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-700">
                Stock Settings
              </h3>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    value={formData.reorder_level}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        reorder_level: parseInt(e.target.value) || 0,
                      })
                    }
                    min="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Min Order Qty
                  </label>
                  <input
                    type="number"
                    value={formData.min_order_qty}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        min_order_qty: parseInt(e.target.value) || 1,
                      })
                    }
                    min="1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Lead Time (days)
                  </label>
                  <input
                    type="number"
                    value={formData.lead_time_days}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lead_time_days: parseInt(e.target.value) || 0,
                      })
                    }
                    min="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Create Cost Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

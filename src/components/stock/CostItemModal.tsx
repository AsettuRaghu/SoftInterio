"use client";

import { useState } from "react";
import { QUALITY_TIER_OPTIONS } from "@/utils/stock";

interface CostItem {
  id: string;
  name: string;
  description?: string;
  category_id?: string;
  unit_code: string;
  vendor_cost: number;
  company_cost: number;
  default_rate: number;
  retail_price?: number | null;
  quality_tier: string;
  is_stockable: boolean;
  is_active: boolean;
  reorder_level?: number;
  min_order_qty?: number;
  lead_time_days?: number;
}

interface CostItemCategory {
  id: string;
  name: string;
}

export interface CostItemModalProps {
  isOpen: boolean;
  item?: CostItem | null;
  onClose: () => void;
  onSuccess: () => void;
  categories: CostItemCategory[];
}

/**
 * Modal for creating and editing cost items
 * Includes form validation, pricing calculation, and API integration
 */
export function CostItemModal({
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
        ? `/api/stock/cost-items/${item?.id}`
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
                    setFormData({
                      ...formData,
                      quality_tier: e.target.value,
                    })
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
                    setFormData({
                      ...formData,
                      description: e.target.value,
                    })
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

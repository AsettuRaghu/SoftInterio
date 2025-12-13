"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  BuilderSpace,
  LineItem,
  CostItem,
  CostItemCategory,
  getMeasurementInfo,
  calculateSqft,
  convertToFeet,
} from "./types";
import {
  ScopeSelector,
  ScopeSelection,
  defaultScope,
  isInScope,
} from "./ScopeSelector";

interface MaterialUsage {
  costItemId: string;
  costItemName: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  unitCode: string;
  currentRate: number;
  usageCount: number;
  totalAmount: number;
  // Which spaces/components use this material
  usedIn: Array<{
    spaceId: string;
    componentId: string;
    spaceName: string;
    componentName: string;
  }>;
}

interface MaterialSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaces: BuilderSpace[];
  costItems: CostItem[];
  categories: CostItemCategory[];
  onApplySwaps: (swappedSpaces: BuilderSpace[]) => void;
  onSaveAsNewVersion: (swappedSpaces: BuilderSpace[], notes: string) => void;
  formatCurrency: (amount: number) => string;
}

export function MaterialSwapModal({
  isOpen,
  onClose,
  spaces,
  costItems,
  categories,
  onApplySwaps,
  onSaveAsNewVersion,
  formatCurrency,
}: MaterialSwapModalProps) {
  // Scope selection - determines which spaces/components to apply swaps to
  const [scope, setScope] = useState<ScopeSelection>(defaultScope);

  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [versionNotes, setVersionNotes] = useState("");

  // Calculate item amount
  const calculateItemAmount = useCallback((item: LineItem): number => {
    const measureType = getMeasurementInfo(item.unitCode).type;
    const unit = item.measurementUnit || "ft";
    switch (measureType) {
      case "area":
        const sqft = calculateSqft(item.length, item.width, unit);
        return sqft * item.rate;
      case "length":
        const lengthInFeet = convertToFeet(item.length || 0, unit);
        return lengthInFeet * item.rate;
      case "quantity":
        return (item.quantity || 0) * item.rate;
      case "fixed":
        return item.rate;
      default:
        return (item.quantity || 0) * item.rate;
    }
  }, []);

  // Calculate item amount with a specific rate
  const calculateItemAmountWithRate = useCallback(
    (item: LineItem, rate: number): number => {
      const measureType = getMeasurementInfo(item.unitCode).type;
      const unit = item.measurementUnit || "ft";
      switch (measureType) {
        case "area":
          const sqft = calculateSqft(item.length, item.width, unit);
          return sqft * rate;
        case "length":
          const lengthInFeet = convertToFeet(item.length || 0, unit);
          return lengthInFeet * rate;
        case "quantity":
          return (item.quantity || 0) * rate;
        case "fixed":
          return rate;
        default:
          return (item.quantity || 0) * rate;
      }
    },
    []
  );

  // Analyze materials used in quotation (considering scope)
  const materialUsage = useMemo(() => {
    const usage: Record<string, MaterialUsage> = {};

    spaces.forEach((space) => {
      space.components.forEach((comp) => {
        // Check if this component is in scope
        if (!isInScope(space.id, comp.id, scope)) return;

        comp.lineItems.forEach((item) => {
          if (!item.costItemId) return;

          if (!usage[item.costItemId]) {
            const costItem = costItems.find((ci) => ci.id === item.costItemId);
            const category = categories.find(
              (c) => c.name === item.categoryName
            );

            usage[item.costItemId] = {
              costItemId: item.costItemId,
              costItemName: item.costItemName || costItem?.name || "Unknown",
              categoryId: category?.id || "",
              categoryName: item.categoryName || "Other",
              categoryColor: item.categoryColor || "#718096",
              unitCode: item.unitCode,
              currentRate: item.rate,
              usageCount: 0,
              totalAmount: 0,
              usedIn: [],
            };
          }

          const amount = calculateItemAmount(item);
          usage[item.costItemId].usageCount += 1;
          usage[item.costItemId].totalAmount += amount;
          usage[item.costItemId].usedIn.push({
            spaceId: space.id,
            componentId: comp.id,
            spaceName: space.defaultName || space.name,
            componentName: comp.name,
          });
        });
      });
    });

    return Object.values(usage);
  }, [spaces, costItems, categories, scope, calculateItemAmount]);

  // Calculate new amounts after swaps
  const materialUsageWithSwaps = useMemo(() => {
    return materialUsage.map((material) => {
      const swapId = swaps[material.costItemId];
      if (!swapId) {
        return {
          ...material,
          newTotalAmount: null,
          replacementName: null,
          replacementRate: null,
        };
      }

      const swapItem = costItems.find((ci) => ci.id === swapId);
      if (!swapItem) {
        return {
          ...material,
          newTotalAmount: null,
          replacementName: null,
          replacementRate: null,
        };
      }

      // Calculate new total amount by going through all line items in scope
      let newTotalAmount = 0;
      spaces.forEach((space) => {
        space.components.forEach((comp) => {
          if (!isInScope(space.id, comp.id, scope)) return;

          comp.lineItems.forEach((item) => {
            if (item.costItemId === material.costItemId) {
              newTotalAmount += calculateItemAmountWithRate(
                item,
                swapItem.default_rate
              );
            }
          });
        });
      });

      return {
        ...material,
        newTotalAmount,
        replacementName: swapItem.name,
        replacementRate: swapItem.default_rate,
      };
    });
  }, [
    materialUsage,
    swaps,
    costItems,
    spaces,
    scope,
    calculateItemAmountWithRate,
  ]);

  // Get available replacements for a cost item (same category, same unit type)
  const getReplacements = useCallback(
    (material: MaterialUsage) => {
      return costItems.filter((ci) => {
        // Same category
        if (ci.category_id !== material.categoryId) return false;
        // Same unit code (can't swap sqft item with nos item)
        if (ci.unit_code !== material.unitCode) return false;
        // Not the same item
        if (ci.id === material.costItemId) return false;
        return true;
      });
    },
    [costItems]
  );

  // Filter materials
  const filteredMaterials = useMemo(() => {
    let result = materialUsageWithSwaps;

    if (categoryFilter) {
      result = result.filter((m) => m.categoryId === categoryFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.costItemName.toLowerCase().includes(query) ||
          m.categoryName.toLowerCase().includes(query)
      );
    }

    // Sort by total amount descending
    return result.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [materialUsageWithSwaps, categoryFilter, searchQuery]);

  // Calculate totals
  const totals = useMemo(() => {
    let originalTotal = 0;
    let newTotal = 0;
    let swapCount = 0;

    materialUsageWithSwaps.forEach((m) => {
      originalTotal += m.totalAmount;
      if (m.newTotalAmount !== null) {
        newTotal += m.newTotalAmount;
        swapCount += 1;
      } else {
        newTotal += m.totalAmount;
      }
    });

    const difference = newTotal - originalTotal;
    const percentageChange =
      originalTotal > 0 ? (difference / originalTotal) * 100 : 0;

    return { originalTotal, newTotal, difference, percentageChange, swapCount };
  }, [materialUsageWithSwaps]);

  // Handle swap selection
  const handleSwap = (costItemId: string, replacementId: string) => {
    if (replacementId === "") {
      // Remove swap
      const newSwaps = { ...swaps };
      delete newSwaps[costItemId];
      setSwaps(newSwaps);
    } else {
      setSwaps((prev) => ({
        ...prev,
        [costItemId]: replacementId,
      }));
    }
  };

  // Get swapped spaces (respecting scope)
  const getSwappedSpaces = useCallback((): BuilderSpace[] => {
    return spaces.map((space) => ({
      ...space,
      components: space.components.map((comp) => {
        // Check if this component is in scope
        if (!isInScope(space.id, comp.id, scope)) {
          return comp; // Return unchanged
        }

        return {
          ...comp,
          lineItems: comp.lineItems.map((item) => {
            const swapId = swaps[item.costItemId];
            if (!swapId) return item;

            const swapItem = costItems.find((ci) => ci.id === swapId);
            if (!swapItem) return item;

            const category = categories.find(
              (c) => c.id === swapItem.category_id
            );

            return {
              ...item,
              costItemId: swapItem.id,
              costItemName: swapItem.name,
              categoryName: category?.name || item.categoryName,
              categoryColor: category?.color || item.categoryColor,
              rate: swapItem.default_rate,
              defaultRate: swapItem.default_rate,
            };
          }),
        };
      }),
    }));
  }, [spaces, swaps, costItems, categories, scope]);

  // Reset all swaps
  const handleReset = () => {
    setSwaps({});
  };

  // Apply and close
  const handleApply = () => {
    const swappedSpaces = getSwappedSpaces();
    onApplySwaps(swappedSpaces);
    onClose();
  };

  // Save as new version
  const handleSaveAsNewVersion = () => {
    const swappedSpaces = getSwappedSpaces();
    onSaveAsNewVersion(swappedSpaces, versionNotes);
    onClose();
  };

  // Get unique categories for filter
  const usedCategories = useMemo(() => {
    const cats = new Set<string>();
    materialUsage.forEach((m) => {
      if (m.categoryId) cats.add(m.categoryId);
    });
    return categories.filter((c) => cats.has(c.id));
  }, [materialUsage, categories]);

  if (!isOpen) return null;

  const hasAnySwap = Object.keys(swaps).length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Material Swap
              </h2>
              <p className="text-sm text-slate-500">
                Replace materials to see different pricing options
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Scope Selection */}
          <div className="w-72 border-r border-slate-200 bg-slate-50 p-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-slate-700 mb-3">
              Apply To
            </h3>
            <ScopeSelector spaces={spaces} value={scope} onChange={setScope} />
          </div>

          {/* Right Panel - Materials */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search & Filter */}
            <div className="px-6 py-4 bg-white border-b border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
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
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search materials..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Categories</option>
                  {usedCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <div className="text-sm text-slate-500">
                  {filteredMaterials.length} materials in scope
                </div>
              </div>
            </div>

            {/* Materials List */}
            <div className="flex-1 overflow-auto p-6">
              {filteredMaterials.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <svg
                    className="w-12 h-12 mx-auto mb-4 text-slate-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  <p>No materials found in selected scope</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Try selecting different spaces or components
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMaterials.map((material) => {
                    const replacements = getReplacements(material);
                    const hasSwap = swaps[material.costItemId];
                    const priceDiff =
                      material.newTotalAmount !== null
                        ? material.newTotalAmount - material.totalAmount
                        : 0;

                    return (
                      <div
                        key={material.costItemId}
                        className={`border rounded-lg p-4 transition-colors ${
                          hasSwap
                            ? "border-orange-300 bg-orange-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Current Material Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: material.categoryColor,
                                }}
                              />
                              <span className="text-xs font-medium text-slate-500 uppercase">
                                {material.categoryName}
                              </span>
                            </div>
                            <h4 className="font-medium text-slate-900 truncate">
                              {material.costItemName}
                            </h4>
                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                              <span>
                                ₹{material.currentRate.toLocaleString("en-IN")}/
                                {material.unitCode}
                              </span>
                              <span>•</span>
                              <span>Used {material.usageCount}x</span>
                              <span>•</span>
                              <span className="font-medium text-slate-700">
                                {formatCurrency(material.totalAmount)}
                              </span>
                            </div>
                          </div>

                          {/* Swap Arrow */}
                          <div className="flex items-center px-2">
                            <svg
                              className={`w-6 h-6 ${
                                hasSwap ? "text-orange-500" : "text-slate-300"
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 8l4 4m0 0l-4 4m4-4H3"
                              />
                            </svg>
                          </div>

                          {/* Replacement Selector */}
                          <div className="w-64 shrink-0">
                            <select
                              value={swaps[material.costItemId] || ""}
                              onChange={(e) =>
                                handleSwap(material.costItemId, e.target.value)
                              }
                              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 ${
                                hasSwap
                                  ? "border-orange-300 bg-white"
                                  : "border-slate-200 bg-slate-50"
                              }`}
                            >
                              <option value="">Keep original</option>
                              {replacements.map((rep) => (
                                <option key={rep.id} value={rep.id}>
                                  {rep.name} (₹
                                  {rep.default_rate.toLocaleString("en-IN")})
                                </option>
                              ))}
                            </select>
                            {replacements.length === 0 && (
                              <p className="text-xs text-slate-400 mt-1">
                                No alternatives available
                              </p>
                            )}
                          </div>

                          {/* Price Difference */}
                          <div className="w-28 text-right shrink-0">
                            {hasSwap && material.newTotalAmount !== null && (
                              <div>
                                <div className="text-sm font-medium text-slate-900">
                                  {formatCurrency(material.newTotalAmount)}
                                </div>
                                <div
                                  className={`text-xs font-medium ${
                                    priceDiff > 0
                                      ? "text-red-600"
                                      : priceDiff < 0
                                      ? "text-green-600"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {priceDiff >= 0 ? "+" : ""}
                                  {formatCurrency(priceDiff)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          {/* Totals Comparison */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-8">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">
                  Original (in scope)
                </div>
                <div className="text-lg font-semibold text-slate-700">
                  {formatCurrency(totals.originalTotal)}
                </div>
              </div>
              <div className="text-2xl text-slate-300">→</div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">
                  After Swaps
                </div>
                <div
                  className={`text-lg font-semibold ${
                    totals.difference > 0
                      ? "text-red-600"
                      : totals.difference < 0
                      ? "text-green-600"
                      : "text-slate-700"
                  }`}
                >
                  {formatCurrency(totals.newTotal)}
                </div>
              </div>
              {hasAnySwap && (
                <div
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    totals.difference > 0
                      ? "bg-red-100 text-red-700"
                      : totals.difference < 0
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {totals.difference >= 0 ? "+" : ""}
                  {totals.percentageChange.toFixed(1)}%
                  <span className="ml-1 text-xs opacity-70">
                    ({totals.difference >= 0 ? "+" : ""}
                    {formatCurrency(totals.difference)})
                  </span>
                </div>
              )}
            </div>
            <div className="text-sm text-slate-500">
              {totals.swapCount} swap{totals.swapCount !== 1 ? "s" : ""}{" "}
              configured
              {scope.mode !== "all" && (
                <span className="ml-2 text-xs">
                  (
                  {scope.mode === "spaces"
                    ? `${scope.selectedSpaceIds.length} space(s)`
                    : `${scope.selectedComponentIds.length} component(s)`}
                  )
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {showSaveOptions ? (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                placeholder="Version notes (e.g., 'Upgraded to premium laminate')..."
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={() => setShowSaveOptions(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsNewVersion}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Create New Version
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                onClick={handleReset}
                disabled={!hasAnySwap}
                className="text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset All
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowSaveOptions(true)}
                  disabled={!hasAnySwap}
                  className="px-4 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save as New Version
                </button>
                <button
                  onClick={handleApply}
                  disabled={!hasAnySwap}
                  className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply Swaps
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

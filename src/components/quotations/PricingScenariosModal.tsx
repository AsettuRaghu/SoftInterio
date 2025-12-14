"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  BuilderSpace,
  LineItem,
  CostItem,
  CostItemCategory,
  ComponentType,
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

type ActiveTab = "adjustments" | "swaps";

interface PricingScenariosModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaces: BuilderSpace[];
  costItems: CostItem[];
  categories: CostItemCategory[];
  componentTypes: ComponentType[];
  onApply: (modifiedSpaces: BuilderSpace[]) => void;
  onSaveAsNewVersion: (modifiedSpaces: BuilderSpace[], notes: string) => void;
  formatCurrency: (amount: number) => string;
}

export function PricingScenariosModal({
  isOpen,
  onClose,
  spaces,
  costItems,
  categories,
  componentTypes,
  onApply,
  onSaveAsNewVersion,
  formatCurrency,
}: PricingScenariosModalProps) {
  // Active tab
  const [activeTab, setActiveTab] = useState<ActiveTab>("adjustments");

  // Shared scope selection
  const [scope, setScope] = useState<ScopeSelection>(defaultScope);

  // === ADJUSTMENTS STATE ===
  const [adjustmentMode, setAdjustmentMode] = useState<
    "category" | "component"
  >("category");
  const [categoryAdjustments, setCategoryAdjustments] = useState<
    Record<string, number>
  >({});
  const [componentAdjustments, setComponentAdjustments] = useState<
    Record<string, number>
  >({});
  const [globalAdjustment, setGlobalAdjustment] = useState<number>(0);

  // === SWAPS STATE ===
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  // === SAVE STATE ===
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [versionNotes, setVersionNotes] = useState("");

  // Calculate item amount
  const calculateItemAmount = useCallback((item: LineItem): number => {
    const measureType = getMeasurementInfo(item.unitCode).type;
    const unit = item.measurementUnit || "mm";
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
      const unit = item.measurementUnit || "mm";
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

  // === ADJUSTMENTS ANALYSIS ===
  const categoryAnalysis = useMemo(() => {
    const analysis: Record<
      string,
      {
        categoryId: string;
        categoryName: string;
        categoryColor: string;
        percentage: number;
        originalTotal: number;
        adjustedTotal: number;
        itemCount: number;
      }
    > = {};

    categories.forEach((cat) => {
      analysis[cat.id] = {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryColor: cat.color || "#718096",
        percentage: categoryAdjustments[cat.id] || 0,
        originalTotal: 0,
        adjustedTotal: 0,
        itemCount: 0,
      };
    });

    spaces.forEach((space) => {
      space.components.forEach((comp) => {
        if (!isInScope(space.id, comp.id, scope)) return;

        comp.lineItems.forEach((item) => {
          const amount = calculateItemAmount(item);
          const category = categories.find((c) => c.name === item.categoryName);
          if (category && analysis[category.id]) {
            analysis[category.id].originalTotal += amount;
            analysis[category.id].itemCount += 1;

            const adjustment = categoryAdjustments[category.id] || 0;
            const totalAdjustment = adjustment + globalAdjustment;
            analysis[category.id].adjustedTotal +=
              amount * (1 + totalAdjustment / 100);
          }
        });
      });
    });

    return Object.values(analysis).filter((a) => a.itemCount > 0);
  }, [
    spaces,
    categories,
    categoryAdjustments,
    globalAdjustment,
    calculateItemAmount,
    scope,
  ]);

  const componentAnalysis = useMemo(() => {
    const analysis: Record<
      string,
      {
        componentTypeId: string;
        componentTypeName: string;
        percentage: number;
        originalTotal: number;
        adjustedTotal: number;
        itemCount: number;
      }
    > = {};

    spaces.forEach((space) => {
      space.components.forEach((comp) => {
        if (!isInScope(space.id, comp.id, scope)) return;

        if (!analysis[comp.componentTypeId]) {
          const compType = componentTypes.find(
            (ct) => ct.id === comp.componentTypeId
          );
          analysis[comp.componentTypeId] = {
            componentTypeId: comp.componentTypeId,
            componentTypeName: compType?.name || comp.name,
            percentage: componentAdjustments[comp.componentTypeId] || 0,
            originalTotal: 0,
            adjustedTotal: 0,
            itemCount: 0,
          };
        }

        comp.lineItems.forEach((item) => {
          const amount = calculateItemAmount(item);
          analysis[comp.componentTypeId].originalTotal += amount;
          analysis[comp.componentTypeId].itemCount += 1;

          const adjustment = componentAdjustments[comp.componentTypeId] || 0;
          const totalAdjustment = adjustment + globalAdjustment;
          analysis[comp.componentTypeId].adjustedTotal +=
            amount * (1 + totalAdjustment / 100);
        });
      });
    });

    return Object.values(analysis).filter((a) => a.itemCount > 0);
  }, [
    spaces,
    componentTypes,
    componentAdjustments,
    globalAdjustment,
    calculateItemAmount,
    scope,
  ]);

  // === SWAPS ANALYSIS ===
  const materialUsage = useMemo(() => {
    const usage: Record<
      string,
      {
        costItemId: string;
        costItemName: string;
        categoryId: string;
        categoryName: string;
        categoryColor: string;
        unitCode: string;
        currentRate: number;
        usageCount: number;
        totalAmount: number;
      }
    > = {};

    spaces.forEach((space) => {
      space.components.forEach((comp) => {
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
            };
          }

          const amount = calculateItemAmount(item);
          usage[item.costItemId].usageCount += 1;
          usage[item.costItemId].totalAmount += amount;
        });
      });
    });

    return Object.values(usage);
  }, [spaces, costItems, categories, scope, calculateItemAmount]);

  // Calculate swapped amounts
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

    return result.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [materialUsageWithSwaps, categoryFilter, searchQuery]);

  // Get replacements for a material
  const getReplacements = useCallback(
    (material: (typeof materialUsage)[0]) => {
      return costItems.filter((ci) => {
        if (ci.category_id !== material.categoryId) return false;
        if (ci.unit_code !== material.unitCode) return false;
        if (ci.id === material.costItemId) return false;
        return true;
      });
    },
    [costItems]
  );

  // Used categories for filter
  const usedCategories = useMemo(() => {
    const cats = new Set<string>();
    materialUsage.forEach((m) => {
      if (m.categoryId) cats.add(m.categoryId);
    });
    return categories.filter((c) => cats.has(c.id));
  }, [materialUsage, categories]);

  // === COMBINED TOTALS ===
  const totals = useMemo(() => {
    let originalTotal = 0;
    let afterAdjustments = 0;
    let afterSwaps = 0;
    let finalTotal = 0;

    // Calculate original total in scope
    spaces.forEach((space) => {
      space.components.forEach((comp) => {
        if (!isInScope(space.id, comp.id, scope)) return;

        comp.lineItems.forEach((item) => {
          const amount = calculateItemAmount(item);
          originalTotal += amount;
        });
      });
    });

    // Calculate after adjustments only
    if (adjustmentMode === "category") {
      categoryAnalysis.forEach((cat) => {
        afterAdjustments += cat.adjustedTotal;
      });
    } else {
      componentAnalysis.forEach((comp) => {
        afterAdjustments += comp.adjustedTotal;
      });
    }

    // Calculate after swaps only
    let swapsTotal = 0;
    materialUsageWithSwaps.forEach((m) => {
      if (m.newTotalAmount !== null) {
        swapsTotal += m.newTotalAmount;
      } else {
        swapsTotal += m.totalAmount;
      }
    });
    afterSwaps = swapsTotal;

    // Calculate final (both applied)
    // First apply swaps, then apply percentage adjustments
    spaces.forEach((space) => {
      space.components.forEach((comp) => {
        if (!isInScope(space.id, comp.id, scope)) return;

        comp.lineItems.forEach((item) => {
          // Get rate after swap
          const swapId = swaps[item.costItemId];
          const swapItem = swapId
            ? costItems.find((ci) => ci.id === swapId)
            : null;
          const effectiveRate = swapItem ? swapItem.default_rate : item.rate;

          // Calculate amount with effective rate
          let amount = calculateItemAmountWithRate(item, effectiveRate);

          // Apply percentage adjustment
          let adjustment = globalAdjustment;
          if (adjustmentMode === "category") {
            const category = categories.find(
              (c) => c.name === item.categoryName
            );
            if (category) {
              adjustment += categoryAdjustments[category.id] || 0;
            }
          } else {
            adjustment += componentAdjustments[comp.componentTypeId] || 0;
          }

          amount = amount * (1 + adjustment / 100);
          finalTotal += amount;
        });
      });
    });

    const difference = finalTotal - originalTotal;
    const percentageChange =
      originalTotal > 0 ? (difference / originalTotal) * 100 : 0;

    return {
      originalTotal,
      afterAdjustments,
      afterSwaps,
      finalTotal,
      difference,
      percentageChange,
    };
  }, [
    spaces,
    scope,
    calculateItemAmount,
    calculateItemAmountWithRate,
    adjustmentMode,
    categoryAnalysis,
    componentAnalysis,
    materialUsageWithSwaps,
    swaps,
    costItems,
    globalAdjustment,
    categoryAdjustments,
    componentAdjustments,
    categories,
  ]);

  // === HANDLERS ===
  const handleCategoryAdjustment = (categoryId: string, value: number) => {
    setCategoryAdjustments((prev) => ({ ...prev, [categoryId]: value }));
  };

  const handleComponentAdjustment = (
    componentTypeId: string,
    value: number
  ) => {
    setComponentAdjustments((prev) => ({ ...prev, [componentTypeId]: value }));
  };

  const handleSwap = (costItemId: string, replacementId: string) => {
    if (replacementId === "") {
      const newSwaps = { ...swaps };
      delete newSwaps[costItemId];
      setSwaps(newSwaps);
    } else {
      setSwaps((prev) => ({ ...prev, [costItemId]: replacementId }));
    }
  };

  const handleReset = () => {
    setCategoryAdjustments({});
    setComponentAdjustments({});
    setGlobalAdjustment(0);
    setSwaps({});
  };

  // Get modified spaces with both swaps and adjustments applied
  const getModifiedSpaces = useCallback((): BuilderSpace[] => {
    return spaces.map((space) => ({
      ...space,
      components: space.components.map((comp) => {
        if (!isInScope(space.id, comp.id, scope)) {
          return comp;
        }

        return {
          ...comp,
          lineItems: comp.lineItems.map((item) => {
            // First apply swap if any
            const swapId = swaps[item.costItemId];
            let newItem = { ...item };

            if (swapId) {
              const swapItem = costItems.find((ci) => ci.id === swapId);
              if (swapItem) {
                const category = categories.find(
                  (c) => c.id === swapItem.category_id
                );
                newItem = {
                  ...newItem,
                  costItemId: swapItem.id,
                  costItemName: swapItem.name,
                  categoryName: category?.name || item.categoryName,
                  categoryColor: category?.color || item.categoryColor,
                  rate: swapItem.default_rate,
                  defaultRate: swapItem.default_rate,
                };
              }
            }

            // Then apply percentage adjustment
            let adjustment = globalAdjustment;
            if (adjustmentMode === "category") {
              const category = categories.find(
                (c) => c.name === newItem.categoryName
              );
              if (category) {
                adjustment += categoryAdjustments[category.id] || 0;
              }
            } else {
              adjustment += componentAdjustments[comp.componentTypeId] || 0;
            }

            if (adjustment !== 0) {
              const newRate = newItem.rate * (1 + adjustment / 100);
              newItem = {
                ...newItem,
                rate: Math.round(newRate * 100) / 100,
              };
            }

            return newItem;
          }),
        };
      }),
    }));
  }, [
    spaces,
    scope,
    swaps,
    costItems,
    categories,
    globalAdjustment,
    adjustmentMode,
    categoryAdjustments,
    componentAdjustments,
  ]);

  const handleApply = () => {
    console.log("[PricingScenariosModal] handleApply called");
    const modifiedSpaces = getModifiedSpaces();
    console.log(
      "[PricingScenariosModal] Modified spaces:",
      modifiedSpaces.length
    );
    onApply(modifiedSpaces);
    onClose();
  };

  const handleSaveAsNewVersion = () => {
    console.log("[PricingScenariosModal] handleSaveAsNewVersion called");
    console.log("[PricingScenariosModal] Version notes:", versionNotes);
    const modifiedSpaces = getModifiedSpaces();
    console.log(
      "[PricingScenariosModal] Modified spaces count:",
      modifiedSpaces.length
    );
    console.log("[PricingScenariosModal] Calling onSaveAsNewVersion...");
    onSaveAsNewVersion(modifiedSpaces, versionNotes);
    onClose();
  };

  if (!isOpen) return null;

  const hasAnyAdjustment =
    globalAdjustment !== 0 ||
    Object.values(categoryAdjustments).some((v) => v !== 0) ||
    Object.values(componentAdjustments).some((v) => v !== 0);
  const hasAnySwap = Object.keys(swaps).length > 0;
  const hasAnyChange = hasAnyAdjustment || hasAnySwap;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Pricing Scenarios
              </h2>
              <p className="text-sm text-slate-500">
                Adjust prices or swap materials to explore different options
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

          {/* Tabs */}
          <div className="flex gap-1 mt-4 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab("adjustments")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                activeTab === "adjustments"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
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
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
              Price Adjustments
              {hasAnyAdjustment && (
                <span className="w-2 h-2 bg-green-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("swaps")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                activeTab === "swaps"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
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
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              Material Swap
              {hasAnySwap && (
                <span className="w-2 h-2 bg-orange-500 rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Scope Selection */}
          <div className="w-72 border-r border-slate-200 bg-slate-50 p-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-slate-700 mb-3">
              Apply To
            </h3>
            <ScopeSelector spaces={spaces} value={scope} onChange={setScope} />
          </div>

          {/* Right Panel - Content based on tab */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === "adjustments" ? (
              <>
                {/* Adjustments Controls */}
                <div className="px-6 py-4 bg-white border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAdjustmentMode("category")}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          adjustmentMode === "category"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        By Category
                      </button>
                      <button
                        onClick={() => setAdjustmentMode("component")}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          adjustmentMode === "component"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        By Component
                      </button>
                    </div>

                    {/* Global Adjustment */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-600">Global:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          step="1"
                          value={globalAdjustment}
                          onChange={(e) =>
                            setGlobalAdjustment(Number(e.target.value))
                          }
                          className="w-24 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex items-center">
                          <input
                            type="number"
                            value={globalAdjustment}
                            onChange={(e) =>
                              setGlobalAdjustment(Number(e.target.value) || 0)
                            }
                            className="w-16 px-2 py-1 text-sm text-center border border-slate-200 rounded-l-lg focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="px-2 py-1 text-sm bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg">
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Adjustment Items */}
                <div className="flex-1 overflow-auto p-6">
                  {adjustmentMode === "category" ? (
                    <div className="space-y-3">
                      {categoryAnalysis.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                          <p>No items in selected scope</p>
                        </div>
                      ) : (
                        categoryAnalysis.map((cat) => (
                          <div
                            key={cat.categoryId}
                            className="bg-white border border-slate-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: cat.categoryColor }}
                                />
                                <div>
                                  <span className="font-medium text-slate-900">
                                    {cat.categoryName}
                                  </span>
                                  <span className="text-xs text-slate-500 ml-2">
                                    ({cat.itemCount} items)
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-slate-500">
                                  {formatCurrency(cat.originalTotal)}
                                </div>
                                {(cat.percentage !== 0 ||
                                  globalAdjustment !== 0) && (
                                  <div
                                    className={`text-sm font-medium ${
                                      cat.adjustedTotal > cat.originalTotal
                                        ? "text-red-600"
                                        : cat.adjustedTotal < cat.originalTotal
                                        ? "text-green-600"
                                        : "text-slate-600"
                                    }`}
                                  >
                                    → {formatCurrency(cat.adjustedTotal)}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <input
                                type="range"
                                min="-50"
                                max="50"
                                step="1"
                                value={cat.percentage}
                                onChange={(e) =>
                                  handleCategoryAdjustment(
                                    cat.categoryId,
                                    Number(e.target.value)
                                  )
                                }
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  value={cat.percentage}
                                  onChange={(e) =>
                                    handleCategoryAdjustment(
                                      cat.categoryId,
                                      Number(e.target.value) || 0
                                    )
                                  }
                                  className="w-16 px-2 py-1 text-sm text-center border border-slate-200 rounded-l-lg focus:ring-1 focus:ring-blue-500"
                                />
                                <span className="px-2 py-1 text-sm bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg">
                                  %
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {componentAnalysis.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                          <p>No components in selected scope</p>
                        </div>
                      ) : (
                        componentAnalysis.map((comp) => (
                          <div
                            key={comp.componentTypeId}
                            className="bg-white border border-slate-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <span className="font-medium text-slate-900">
                                  {comp.componentTypeName}
                                </span>
                                <span className="text-xs text-slate-500 ml-2">
                                  ({comp.itemCount} items)
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-slate-500">
                                  {formatCurrency(comp.originalTotal)}
                                </div>
                                {(comp.percentage !== 0 ||
                                  globalAdjustment !== 0) && (
                                  <div
                                    className={`text-sm font-medium ${
                                      comp.adjustedTotal > comp.originalTotal
                                        ? "text-red-600"
                                        : comp.adjustedTotal <
                                          comp.originalTotal
                                        ? "text-green-600"
                                        : "text-slate-600"
                                    }`}
                                  >
                                    → {formatCurrency(comp.adjustedTotal)}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <input
                                type="range"
                                min="-50"
                                max="50"
                                step="1"
                                value={comp.percentage}
                                onChange={(e) =>
                                  handleComponentAdjustment(
                                    comp.componentTypeId,
                                    Number(e.target.value)
                                  )
                                }
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  value={comp.percentage}
                                  onChange={(e) =>
                                    handleComponentAdjustment(
                                      comp.componentTypeId,
                                      Number(e.target.value) || 0
                                    )
                                  }
                                  className="w-16 px-2 py-1 text-sm text-center border border-slate-200 rounded-l-lg focus:ring-1 focus:ring-blue-500"
                                />
                                <span className="px-2 py-1 text-sm bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg">
                                  %
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Swaps Search/Filter */}
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
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 bg-white"
                    >
                      <option value="">All Categories</option>
                      {usedCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <div className="text-sm text-slate-500">
                      {filteredMaterials.length} materials
                    </div>
                  </div>
                </div>

                {/* Materials List */}
                <div className="flex-1 overflow-auto p-6">
                  {filteredMaterials.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <p>No materials found in selected scope</p>
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
                                    ₹
                                    {material.currentRate.toLocaleString(
                                      "en-IN"
                                    )}
                                    /{material.unitCode}
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
                                    hasSwap
                                      ? "text-orange-500"
                                      : "text-slate-300"
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
                                    handleSwap(
                                      material.costItemId,
                                      e.target.value
                                    )
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
                                      {rep.default_rate.toLocaleString("en-IN")}
                                      )
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
                                {hasSwap &&
                                  material.newTotalAmount !== null && (
                                    <div>
                                      <div className="text-sm font-medium text-slate-900">
                                        {formatCurrency(
                                          material.newTotalAmount
                                        )}
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
              </>
            )}
          </div>
        </div>

        {/* Summary Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          {/* Combined Summary */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">
                  Original
                </div>
                <div className="text-lg font-semibold text-slate-700">
                  {formatCurrency(totals.originalTotal)}
                </div>
              </div>

              {(hasAnyAdjustment || hasAnySwap) && (
                <>
                  <div className="text-2xl text-slate-300">→</div>

                  {/* Show breakdown if both are applied */}
                  {hasAnyAdjustment && hasAnySwap ? (
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-xs text-slate-400">
                          After Swaps
                        </div>
                        <div className="text-sm text-slate-600">
                          {formatCurrency(totals.afterSwaps)}
                        </div>
                      </div>
                      <div className="text-slate-300">+</div>
                      <div className="text-center">
                        <div className="text-xs text-slate-400">
                          Adjustments
                        </div>
                        <div className="text-sm text-slate-600">
                          {totals.finalTotal > totals.afterSwaps ? "+" : ""}
                          {formatCurrency(
                            totals.finalTotal - totals.afterSwaps
                          )}
                        </div>
                      </div>
                      <div className="text-slate-300">=</div>
                    </div>
                  ) : null}

                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide">
                      Final
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
                      {formatCurrency(totals.finalTotal)}
                    </div>
                  </div>

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
                </>
              )}
            </div>

            {/* Changes Summary */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              {hasAnyAdjustment && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  Adjustments active
                </span>
              )}
              {hasAnySwap && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-orange-500 rounded-full" />
                  {Object.keys(swaps).length} swap(s)
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
                placeholder="Version notes (e.g., 'Budget option with laminate')..."
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                disabled={!hasAnyChange}
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
                  disabled={!hasAnyChange}
                  className="px-4 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save as New Version
                </button>
                <button
                  onClick={handleApply}
                  disabled={!hasAnyChange}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

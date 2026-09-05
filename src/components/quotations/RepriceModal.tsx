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

/** The ladder, cheapest first. Order matters: it drives the tier buttons. */
const TIER_ORDER = ["basic", "standard", "premium", "luxury"] as const;
const TIER_LABEL: Record<string, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
  luxury: "Luxury",
};

interface RepriceModalProps {
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

export function RepriceModal({
  isOpen,
  onClose,
  spaces,
  costItems,
  categories,
  componentTypes,
  onApply,
  onSaveAsNewVersion,
  formatCurrency,
}: RepriceModalProps) {
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
  const [categoryTiers, setCategoryTiers] = useState<Record<string, string>>({});
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
        qualityTier: string | null;
        companyCost: number;
      }
    > = {};

    spaces.forEach((space) => {
      space.components.forEach((comp) => {
        if (!isInScope(space.id, comp.id, scope)) return;

        comp.lineItems.forEach((item) => {
          if (!item.costItemId) return;

          if (!usage[item.costItemId]) {
            const costItem = costItems.find((ci) => ci.id === item.costItemId);
            // The cost item's own category_id, not a lookup on the display
            // name. categoryName falls back to "Other" whenever a line loads
            // without its category joined, and "Other" matches no category -
            // which left categoryId empty and the replacement list permanently
            // showing "No alternatives available".
            const category = categories.find((c) => c.id === costItem?.category_id);

            usage[item.costItemId] = {
              costItemId: item.costItemId,
              costItemName: item.costItemName || costItem?.name || "Unknown",
              categoryId: costItem?.category_id || category?.id || "",
              qualityTier: costItem?.quality_tier || null,
              categoryName: item.categoryName || "Other",
              categoryColor: item.categoryColor || "#718096",
              unitCode: item.unitCode,
              currentRate: item.rate,
              usageCount: 0,
              totalAmount: 0,
              companyCost: 0,
            };
          }

          const amount = calculateItemAmount(item);
          usage[item.costItemId].usageCount += 1;
          usage[item.costItemId].totalAmount += amount;
          // Cost scales with the same measure as the price, so the margin on a
          // line is amount - (companyCost measured the same way).
          usage[item.costItemId].companyCost += calculateItemAmountWithRate(
            item,
            item.companyCost || 0
          );
        });
      });
    });

    return Object.values(usage);
  }, [
    spaces,
    costItems,
    categories,
    scope,
    calculateItemAmount,
    calculateItemAmountWithRate,
  ]);

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

  /**
   * Categories that can be moved as a whole up or down the ladder.
   *
   * A category qualifies only when every item in it carries a tier and each
   * tier appears once - that is what makes "take Carcass to Premium"
   * unambiguous. Categories where grade is not the axis (Labour, Service,
   * Accessories) have no tiers and are simply absent from this list, so a
   * corner carousel can never be offered as the premium organiser basket.
   */
  const tierLadders = useMemo(() => {
    const inScopeCategoryIds = new Set(
      materialUsage.map((m) => m.categoryId).filter(Boolean)
    );

    return categories
      .filter((c) => inScopeCategoryIds.has(c.id))
      .map((category) => {
        const items = costItems.filter(
          (ci) => ci.category_id === category.id && ci.quality_tier
        );
        const byTier: Record<string, (typeof items)[0]> = {};
        items.forEach((ci) => {
          if (ci.quality_tier) byTier[ci.quality_tier] = ci;
        });
        const rungs = TIER_ORDER.filter((t) => byTier[t]);
        return { category, byTier, rungs };
      })
      .filter((ladder) => ladder.rungs.length >= 2);
  }, [categories, costItems, materialUsage]);

  /**
   * Points every in-scope line in a category at that category's item for the
   * chosen tier, by writing ordinary per-item swaps. Nothing special happens
   * at apply time - the tier control is a faster way to fill in the same
   * swaps a user could set one at a time.
   */
  const applyCategoryTier = useCallback(
    (categoryId: string, tier: string) => {
      const ladder = tierLadders.find((l) => l.category.id === categoryId);
      if (!ladder) return;

      setSwaps((prev) => {
        const next = { ...prev };
        materialUsage
          .filter((m) => m.categoryId === categoryId)
          .forEach((m) => {
            const target = tier ? ladder.byTier[tier] : null;
            if (!target || target.id === m.costItemId) {
              // Already the right tier, or the tier was cleared: drop the swap
              // rather than recording a no-op that reads as a pending change.
              delete next[m.costItemId];
            } else {
              next[m.costItemId] = target.id;
            }
          });
        return next;
      });

      setCategoryTiers((prev) => ({ ...prev, [categoryId]: tier }));
    },
    [tierLadders, materialUsage]
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

    // Margin, before and after. A price screen that cannot show what a change
    // does to margin is the one place it is most needed - a 10% discount and a
    // swap to a cheaper material look identical on the total and are nothing
    // alike underneath.
    let originalCost = 0;
    let finalCost = 0;
    spaces.forEach((space) => {
      space.components.forEach((comp) => {
        if (!isInScope(space.id, comp.id, scope)) return;
        comp.lineItems.forEach((item) => {
          originalCost += calculateItemAmountWithRate(item, item.companyCost || 0);
          const swapId = swaps[item.costItemId];
          const swapItem = swapId ? costItems.find((ci) => ci.id === swapId) : null;
          // An adjustment moves the price, never the cost: discounting comes
          // out of margin, which is the point of showing this.
          finalCost += calculateItemAmountWithRate(
            item,
            swapItem?.company_cost ?? item.companyCost ?? 0
          );
        });
      });
    });

    const difference = finalTotal - originalTotal;
    const percentageChange =
      originalTotal > 0 ? (difference / originalTotal) * 100 : 0;

    const originalMargin = originalTotal - originalCost;
    const finalMargin = finalTotal - finalCost;

    return {
      originalTotal,
      afterAdjustments,
      afterSwaps,
      finalTotal,
      difference,
      percentageChange,
      originalMargin,
      finalMargin,
      originalMarginPercent:
        originalTotal > 0 ? (originalMargin / originalTotal) * 100 : 0,
      finalMarginPercent: finalTotal > 0 ? (finalMargin / finalTotal) * 100 : 0,
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

    // Overriding one line breaks the category's "everything at this tier"
    // claim, so the tier button stops showing as selected. The swap itself
    // stands - the button was only ever a shortcut for setting these.
    const material = materialUsage.find((m) => m.costItemId === costItemId);
    if (material?.categoryId && categoryTiers[material.categoryId]) {
      setCategoryTiers((prev) => {
        const next = { ...prev };
        delete next[material.categoryId];
        return next;
      });
    }
  };

  const handleReset = () => {
    setCategoryTiers({});
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
                  // Cost has to travel with the material. Without these the
                  // line sold at the new item's rate while still carrying the
                  // old item's cost, so every margin figure downstream was
                  // wrong - and swapping *down* to a cheaper material made
                  // reported margin go up.
                  companyCost: swapItem.company_cost ?? newItem.companyCost,
                  vendorCost: swapItem.vendor_cost ?? newItem.vendorCost,
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
    console.log("[RepriceModal] handleApply called");
    const modifiedSpaces = getModifiedSpaces();
    console.log(
      "[RepriceModal] Modified spaces:",
      modifiedSpaces.length
    );
    onApply(modifiedSpaces);
    onClose();
  };

  const handleSaveAsNewVersion = () => {
    console.log("[RepriceModal] handleSaveAsNewVersion called");
    console.log("[RepriceModal] Version notes:", versionNotes);
    const modifiedSpaces = getModifiedSpaces();
    console.log(
      "[RepriceModal] Modified spaces count:",
      modifiedSpaces.length
    );
    console.log("[RepriceModal] Calling onSaveAsNewVersion...");
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
              <h2 className="text-lg font-semibold text-slate-900">Reprice</h2>
              <p className="text-sm text-slate-500">
                Change the specification level or apply an adjustment, then
                apply it here or save it as a new version
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
          {/* Left Panel - Scope Selection.
              The panel itself no longer scrolls: the tree inside it does, so
              the heading stays put and the list uses the full modal height
              rather than a fixed box with space left under it. */}
          <div className="w-80 shrink-0 border-r border-slate-200 bg-slate-50 p-4 flex flex-col min-h-0">
            <h3 className="text-sm font-medium text-slate-700 mb-2 shrink-0">
              Apply to
            </h3>
            <ScopeSelector spaces={spaces} value={scope} onChange={setScope} />
          </div>

          {/* Right Panel - Content based on tab */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === "adjustments" ? (
              <>
                {/* Adjustments Controls */}
                <div className="px-6 py-3 bg-white border-b border-slate-200">
                  {/* Matched to the tab pills above rather than the chunkier
                      buttons these were - the header is chrome, not content. */}
                  <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg w-fit">
                    {(["category", "component"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setAdjustmentMode(m)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          adjustmentMode === m
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        By {m === "category" ? "Category" : "Component"}
                      </button>
                    ))}
                  </div>

                  {/* Global adjustment.
                      One row on purpose: this modal's job is comparing the
                      list below, so the control that drives it should not eat
                      the space that list needs. */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-3">
                    <span
                      className="text-sm text-slate-600 shrink-0"
                      title={`Applies on top of the per-${adjustmentMode} changes below`}
                    >
                      Adjust all in scope
                    </span>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="1"
                      value={globalAdjustment}
                      onChange={(e) =>
                        setGlobalAdjustment(Number(e.target.value))
                      }
                      className="flex-1 min-w-0 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex items-center shrink-0">
                      <input
                        type="number"
                        min="-50"
                        max="50"
                        value={globalAdjustment}
                        onChange={(e) =>
                          setGlobalAdjustment(
                            Math.max(
                              -50,
                              Math.min(50, Number(e.target.value) || 0)
                            )
                          )
                        }
                        className="w-14 px-1.5 py-1 text-sm text-center border border-slate-200 rounded-l-md focus:ring-1 focus:ring-blue-500 outline-none tabular-nums"
                      />
                      <span className="px-1.5 py-1 text-sm bg-slate-100 border border-l-0 border-slate-200 rounded-r-md text-slate-500">
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {/* Adjustment Items.
                    One line each: name, price, slider, percentage. These were
                    bordered two-row cards about a hundred pixels tall, so a
                    nine-category quotation could not be seen at once - which
                    defeats the point of a screen for comparing them. */}
                <div className="flex-1 overflow-auto px-6 py-3">
                  {(adjustmentMode === "category"
                    ? categoryAnalysis.map((c) => ({
                        key: c.categoryId,
                        name: c.categoryName,
                        color: c.categoryColor,
                        itemCount: c.itemCount,
                        percentage: c.percentage,
                        originalTotal: c.originalTotal,
                        adjustedTotal: c.adjustedTotal,
                        onChange: (v: number) =>
                          handleCategoryAdjustment(c.categoryId, v),
                      }))
                    : componentAnalysis.map((c) => ({
                        key: c.componentTypeId,
                        name: c.componentTypeName,
                        color: undefined as string | undefined,
                        itemCount: c.itemCount,
                        percentage: c.percentage,
                        originalTotal: c.originalTotal,
                        adjustedTotal: c.adjustedTotal,
                        onChange: (v: number) =>
                          handleComponentAdjustment(c.componentTypeId, v),
                      }))
                  ).length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <p>
                        {adjustmentMode === "category"
                          ? "No items in selected scope"
                          : "No components in selected scope"}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {(adjustmentMode === "category"
                        ? categoryAnalysis.map((c) => ({
                            key: c.categoryId,
                            name: c.categoryName,
                            color: c.categoryColor as string | undefined,
                            itemCount: c.itemCount,
                            percentage: c.percentage,
                            originalTotal: c.originalTotal,
                            adjustedTotal: c.adjustedTotal,
                            onChange: (v: number) =>
                              handleCategoryAdjustment(c.categoryId, v),
                          }))
                        : componentAnalysis.map((c) => ({
                            key: c.componentTypeId,
                            name: c.componentTypeName,
                            color: undefined as string | undefined,
                            itemCount: c.itemCount,
                            percentage: c.percentage,
                            originalTotal: c.originalTotal,
                            adjustedTotal: c.adjustedTotal,
                            onChange: (v: number) =>
                              handleComponentAdjustment(c.componentTypeId, v),
                          }))
                      ).map((row) => {
                        const changed =
                          row.percentage !== 0 || globalAdjustment !== 0;
                        return (
                          <div
                            key={row.key}
                            className="flex items-center gap-3 py-2"
                          >
                            <div className="flex items-center gap-2 w-48 shrink-0 min-w-0">
                              {row.color && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: row.color }}
                                />
                              )}
                              <span
                                className="text-sm text-slate-800 truncate"
                                title={row.name}
                              >
                                {row.name}
                              </span>
                              <span className="text-[11px] text-slate-400 shrink-0">
                                {row.itemCount}
                              </span>
                            </div>

                            <div className="w-40 shrink-0 text-right tabular-nums">
                              <span
                                className={`text-xs ${
                                  changed
                                    ? "text-slate-400 line-through"
                                    : "text-slate-500"
                                }`}
                              >
                                {formatCurrency(row.originalTotal)}
                              </span>
                              {changed && (
                                <span
                                  className={`ml-1.5 text-xs font-medium ${
                                    row.adjustedTotal > row.originalTotal
                                      ? "text-red-600"
                                      : row.adjustedTotal < row.originalTotal
                                      ? "text-green-600"
                                      : "text-slate-600"
                                  }`}
                                >
                                  {formatCurrency(row.adjustedTotal)}
                                </span>
                              )}
                            </div>

                            <input
                              type="range"
                              min="-50"
                              max="50"
                              step="1"
                              value={row.percentage}
                              onChange={(e) =>
                                row.onChange(Number(e.target.value))
                              }
                              className="flex-1 min-w-0 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />

                            <div className="flex items-center shrink-0">
                              <input
                                type="number"
                                min="-50"
                                max="50"
                                value={row.percentage}
                                onChange={(e) =>
                                  row.onChange(
                                    Math.max(
                                      -50,
                                      Math.min(50, Number(e.target.value) || 0)
                                    )
                                  )
                                }
                                className="w-14 px-1.5 py-1 text-sm text-center border border-slate-200 rounded-l-md focus:ring-1 focus:ring-blue-500 outline-none tabular-nums"
                              />
                              <span className="px-1.5 py-1 text-sm bg-slate-100 border border-l-0 border-slate-200 rounded-r-md text-slate-500">
                                %
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Move a whole category up or down the ladder. This is the
                    operation clients actually ask for - "same design, cheaper
                    shutters" - and doing it here saves setting the same swap on
                    every line by hand. */}
                {tierLadders.length > 0 && (
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">
                      Specification level by category
                    </p>
                    <div className="space-y-2">
                      {tierLadders.map(({ category, byTier, rungs }) => (
                        <div
                          key={category.id}
                          className="flex items-center gap-3"
                        >
                          <span className="w-36 shrink-0 text-sm text-slate-700 truncate">
                            {category.name}
                          </span>
                          <div className="flex items-center gap-1 p-0.5 bg-white border border-slate-200 rounded-lg">
                            {rungs.map((tier) => {
                              const isActive = categoryTiers[category.id] === tier;
                              return (
                                <button
                                  key={tier}
                                  type="button"
                                  onClick={() =>
                                    applyCategoryTier(
                                      category.id,
                                      isActive ? "" : tier
                                    )
                                  }
                                  title={`${byTier[tier].name} - ${formatCurrency(
                                    byTier[tier].default_rate
                                  )}/${byTier[tier].unit_code}`}
                                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                                    isActive
                                      ? "bg-orange-600 text-white"
                                      : "text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  {TIER_LABEL[tier] || tier}
                                </button>
                              );
                            })}
                          </div>
                          {categoryTiers[category.id] && (
                            <button
                              type="button"
                              onClick={() => applyCategoryTier(category.id, "")}
                              className="text-xs text-slate-400 hover:text-slate-600"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] text-slate-400">
                      Only categories with a full ladder appear here. Labour,
                      services and one-off accessories are never swapped by
                      tier - use the list below for those.
                    </p>
                  </div>
                )}

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

                {/* Materials List. Same row shape as the adjustments tab:
                    name, current price, the control, the effect. */}
                <div className="flex-1 overflow-auto px-6 py-3">
                  {filteredMaterials.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <p>No materials found in selected scope</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
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
                            className={`flex items-center gap-3 py-2 px-2 -mx-2 rounded ${
                              hasSwap ? "bg-orange-50" : ""
                            }`}
                          >
                            {/* Name and where it is used */}
                            <div className="flex items-center gap-2 w-56 shrink-0 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: material.categoryColor,
                                }}
                              />
                              <span
                                className="text-sm text-slate-800 truncate"
                                title={`${material.costItemName} - ${material.categoryName}`}
                              >
                                {material.costItemName}
                              </span>
                              <span className="text-[11px] text-slate-400 shrink-0">
                                {material.usageCount}
                              </span>
                            </div>

                            {/* What it costs, and what it would cost */}
                            <div className="w-40 shrink-0 text-right tabular-nums">
                              <span
                                className={`text-xs ${
                                  hasSwap
                                    ? "text-slate-400 line-through"
                                    : "text-slate-500"
                                }`}
                              >
                                {formatCurrency(material.totalAmount)}
                              </span>
                              {hasSwap && material.newTotalAmount !== null && (
                                <span
                                  className={`ml-1.5 text-xs font-medium ${
                                    priceDiff > 0
                                      ? "text-red-600"
                                      : priceDiff < 0
                                      ? "text-green-600"
                                      : "text-slate-600"
                                  }`}
                                >
                                  {formatCurrency(material.newTotalAmount)}
                                </span>
                              )}
                            </div>

                            {/* Replace with. Takes the middle, like the slider
                                does on the adjustments tab, so both lists read
                                as the same shape of row. */}
                            <select
                              value={swaps[material.costItemId] || ""}
                              onChange={(e) =>
                                handleSwap(material.costItemId, e.target.value)
                              }
                              disabled={replacements.length === 0}
                              className={`flex-1 min-w-0 px-2 py-1 border rounded-md text-sm outline-none focus:ring-1 focus:ring-orange-500 disabled:text-slate-400 ${
                                hasSwap
                                  ? "border-orange-300 bg-white"
                                  : "border-slate-200 bg-white"
                              }`}
                            >
                              <option value="">
                                {replacements.length === 0
                                  ? "No alternatives"
                                  : "Keep original"}
                              </option>
                              {replacements.map((rep) => (
                                <option key={rep.id} value={rep.id}>
                                  {rep.name} (
                                  {rep.default_rate.toLocaleString("en-IN")})
                                </option>
                              ))}
                            </select>

                            {/* Difference, so a swap's effect is readable
                                without comparing the two figures yourself. */}
                            <div className="w-24 shrink-0 text-right tabular-nums">
                              {hasSwap && priceDiff !== 0 && (
                                <span
                                  className={`text-xs font-medium ${
                                    priceDiff > 0
                                      ? "text-red-600"
                                      : "text-green-600"
                                  }`}
                                >
                                  {priceDiff > 0 ? "+" : ""}
                                  {formatCurrency(priceDiff)}
                                </span>
                              )}
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

          {/* Margin. Without this the two ways of reaching the same total look
              identical: a discount comes straight out of margin, while moving
              down a tier takes cost out with it. */}
          {totals.originalTotal > 0 && (
            <div className="flex items-center gap-2 pb-3 text-xs">
              <span className="text-slate-500">Margin</span>
              <span className="text-slate-600 tabular-nums">
                {formatCurrency(totals.originalMargin)} (
                {totals.originalMarginPercent.toFixed(1)}%)
              </span>
              {hasAnyChange && (
                <>
                  <span className="text-slate-400">&rarr;</span>
                  <span
                    className={`font-medium tabular-nums ${
                      totals.finalMargin < totals.originalMargin
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {formatCurrency(totals.finalMargin)} (
                    {totals.finalMarginPercent.toFixed(1)}%)
                  </span>
                </>
              )}
            </div>
          )}

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

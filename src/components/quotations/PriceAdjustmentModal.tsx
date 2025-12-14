"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  BuilderSpace,
  LineItem,
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

interface CategoryAdjustment {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  percentage: number;
  originalTotal: number;
  adjustedTotal: number;
  itemCount: number;
}

interface ComponentAdjustment {
  componentTypeId: string;
  componentTypeName: string;
  percentage: number;
  originalTotal: number;
  adjustedTotal: number;
  itemCount: number;
}

interface PriceAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaces: BuilderSpace[];
  categories: CostItemCategory[];
  componentTypes: ComponentType[];
  onApplyAdjustments: (adjustedSpaces: BuilderSpace[]) => void;
  onSaveAsNewVersion: (adjustedSpaces: BuilderSpace[], notes: string) => void;
  formatCurrency: (amount: number) => string;
}

export function PriceAdjustmentModal({
  isOpen,
  onClose,
  spaces,
  categories,
  componentTypes,
  onApplyAdjustments,
  onSaveAsNewVersion,
  formatCurrency,
}: PriceAdjustmentModalProps) {
  // Scope selection - determines which spaces/components to apply adjustments to
  const [scope, setScope] = useState<ScopeSelection>(defaultScope);

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

  // Analyze current quotation by category (considering scope)
  const categoryAnalysis = useMemo(() => {
    const analysis: Record<string, CategoryAdjustment> = {};

    // Initialize with all categories
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

    // Sum up by category (only for items in scope)
    spaces.forEach((space) => {
      space.components.forEach((comp) => {
        // Check if this component is in scope
        if (!isInScope(space.id, comp.id, scope)) return;

        comp.lineItems.forEach((item) => {
          const amount = calculateItemAmount(item);
          // Find category by name (since we store categoryName in lineItem)
          const category = categories.find((c) => c.name === item.categoryName);
          if (category && analysis[category.id]) {
            analysis[category.id].originalTotal += amount;
            analysis[category.id].itemCount += 1;

            const adjustment = categoryAdjustments[category.id] || 0;
            const globalAdj = globalAdjustment;
            const totalAdjustment = adjustment + globalAdj;
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

  // Analyze current quotation by component type (considering scope)
  const componentAnalysis = useMemo(() => {
    const analysis: Record<string, ComponentAdjustment> = {};

    spaces.forEach((space) => {
      space.components.forEach((comp) => {
        // Check if this component is in scope
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
          const globalAdj = globalAdjustment;
          const totalAdjustment = adjustment + globalAdj;
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

  // Calculate totals
  const totals = useMemo(() => {
    let originalTotal = 0;
    let adjustedTotal = 0;

    if (adjustmentMode === "category") {
      categoryAnalysis.forEach((cat) => {
        originalTotal += cat.originalTotal;
        adjustedTotal += cat.adjustedTotal;
      });
    } else {
      componentAnalysis.forEach((comp) => {
        originalTotal += comp.originalTotal;
        adjustedTotal += comp.adjustedTotal;
      });
    }

    const difference = adjustedTotal - originalTotal;
    const percentageChange =
      originalTotal > 0 ? (difference / originalTotal) * 100 : 0;

    return { originalTotal, adjustedTotal, difference, percentageChange };
  }, [adjustmentMode, categoryAnalysis, componentAnalysis]);

  // Apply adjustments and get modified spaces (respecting scope)
  const getAdjustedSpaces = useCallback((): BuilderSpace[] => {
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

            if (adjustment === 0) return item;

            const newRate = item.rate * (1 + adjustment / 100);
            return {
              ...item,
              rate: Math.round(newRate * 100) / 100, // Round to 2 decimal places
            };
          }),
        };
      }),
    }));
  }, [
    spaces,
    categories,
    adjustmentMode,
    categoryAdjustments,
    componentAdjustments,
    globalAdjustment,
    scope,
  ]);

  // Handle category adjustment change
  const handleCategoryAdjustment = (categoryId: string, value: number) => {
    setCategoryAdjustments((prev) => ({
      ...prev,
      [categoryId]: value,
    }));
  };

  // Handle component adjustment change
  const handleComponentAdjustment = (
    componentTypeId: string,
    value: number
  ) => {
    setComponentAdjustments((prev) => ({
      ...prev,
      [componentTypeId]: value,
    }));
  };

  // Reset all adjustments
  const handleReset = () => {
    setCategoryAdjustments({});
    setComponentAdjustments({});
    setGlobalAdjustment(0);
  };

  // Apply and close
  const handleApply = () => {
    const adjustedSpaces = getAdjustedSpaces();
    onApplyAdjustments(adjustedSpaces);
    onClose();
  };

  // Save as new version
  const handleSaveAsNewVersion = () => {
    const adjustedSpaces = getAdjustedSpaces();
    onSaveAsNewVersion(adjustedSpaces, versionNotes);
    onClose();
  };

  if (!isOpen) return null;

  const hasAnyAdjustment =
    globalAdjustment !== 0 ||
    Object.values(categoryAdjustments).some((v) => v !== 0) ||
    Object.values(componentAdjustments).some((v) => v !== 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Price Adjustments
              </h2>
              <p className="text-sm text-slate-500">
                Apply percentage adjustments to see pricing scenarios
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

          {/* Right Panel - Adjustments */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mode Tabs & Global Adjustment */}
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

            {/* Adjustment Controls */}
            <div className="flex-1 overflow-auto p-6">
              {adjustmentMode === "category" ? (
                <div className="space-y-3">
                  {categoryAnalysis.length === 0 ? (
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
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      <p>No items in selected scope</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try selecting different spaces or components
                      </p>
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
                            {cat.percentage !== 0 || globalAdjustment !== 0 ? (
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
                            ) : null}
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
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                      <p>No components in selected scope</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try selecting different spaces or components
                      </p>
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
                            {comp.percentage !== 0 || globalAdjustment !== 0 ? (
                              <div
                                className={`text-sm font-medium ${
                                  comp.adjustedTotal > comp.originalTotal
                                    ? "text-red-600"
                                    : comp.adjustedTotal < comp.originalTotal
                                    ? "text-green-600"
                                    : "text-slate-600"
                                }`}
                              >
                                → {formatCurrency(comp.adjustedTotal)}
                              </div>
                            ) : null}
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
                  Adjusted
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
                  {formatCurrency(totals.adjustedTotal)}
                </div>
              </div>
              {hasAnyAdjustment && (
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
            {scope.mode !== "all" && (
              <div className="text-xs text-slate-500">
                {scope.mode === "spaces"
                  ? `${scope.selectedSpaceIds.length} space(s) selected`
                  : `${scope.selectedComponentIds.length} component(s) selected`}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {showSaveOptions ? (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                placeholder="Version notes (optional)..."
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
                disabled={!hasAnyAdjustment}
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
                  disabled={!hasAnyAdjustment}
                  className="px-4 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save as New Version
                </button>
                <button
                  onClick={handleApply}
                  disabled={!hasAnyAdjustment}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply to Current
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import {
  BuilderComponent,
  LineItem,
  MeasurementUnit,
  calculateSqft,
  convertToFeet,
  getMeasurementInfo,
} from "./types";
import { LineItemRow } from "./LineItemRow";

interface ComponentCardProps {
  component: BuilderComponent;
  mode: "template" | "quotation";
  onToggleExpand: () => void;
  onDelete: () => void;
  onUpdateDescription?: (description: string) => void;
  onAddCostItem: () => void;
  /** Opens the template picker filtered to cost item bundles. */
  onAddFromBundle?: () => void;
  /** Keeps this component, with its cost items, as a template. */
  onSaveAsTemplate?: () => void;
  /** Keeps just its cost items as a reusable bundle. */
  onSaveAsBundle?: () => void;
  onUpdateLineItem: (lineItemId: string, updates: Partial<LineItem>) => void;
  /** Sets the component's own size and pushes it to every following line. */
  onUpdateDimensions?: (
    dimensions: Pick<BuilderComponent, "width" | "height" | "measurementUnit">
  ) => void;
  /** Whether internal cost and margin may be shown on this component. */
  canViewCosts?: boolean;
  onDeleteLineItem: (lineItemId: string) => void;
  formatCurrency: (amount: number) => string;
  onDuplicate?: () => void;
  onUpdateName?: (name: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveLineItemUp?: (lineItemId: string) => void;
  onMoveLineItemDown?: (lineItemId: string) => void;
  showValidation?: boolean; // Show validation errors on line items
}

export function ComponentCard({
  component,
  mode,
  onToggleExpand,
  onDelete,
  onUpdateDescription,
  onAddCostItem,
  onAddFromBundle,
  onSaveAsTemplate,
  onSaveAsBundle,
  onUpdateLineItem,
  onUpdateDimensions,
  canViewCosts = false,
  onDeleteLineItem,
  formatCurrency,
  onDuplicate,
  onUpdateName,
  onMoveUp,
  onMoveDown,
  onMoveLineItemUp,
  onMoveLineItemDown,
  showValidation = false,
}: ComponentCardProps) {
  // Only area and length lines take a size from the component. A count - four
  // hinges, two handles - is a decision, not a measurement, so it is never
  // driven from here.
  const isMeasured = (item: LineItem) => {
    const type = getMeasurementInfo(item.unitCode).type;
    return type === "area" || type === "length";
  };
  const hasMeasuredLines = component.lineItems.some(isMeasured);
  const followingCount = component.lineItems.filter(
    (i) => isMeasured(i) && i.followsComponent !== false
  ).length;

  // Calculate component total and sqft
  const calculateTotalAndSqft = () => {
    if (mode === "template") return { total: 0, sqft: 0 };

    let totalAmount = 0;
    let totalSqft = 0;

    component.lineItems.forEach((item) => {
      const measureType = getMeasurementType(item.unitCode);
      const unit = item.measurementUnit || "mm";

      switch (measureType) {
        case "area":
          const sqft = calculateSqft(item.length, item.width, unit);
          totalAmount += sqft * item.rate;
          totalSqft += sqft; // Accumulate sqft
          break;
        case "length":
          const lengthInFeet = convertToFeet(item.length || 0, unit);
          totalAmount += lengthInFeet * item.rate;
          break;
        case "quantity":
          totalAmount += (item.quantity || 0) * item.rate;
          break;
        case "fixed":
          totalAmount += item.rate;
          break;
        default:
          totalAmount += (item.quantity || 0) * item.rate;
      }
    });

    return { total: totalAmount, sqft: totalSqft };
  };

  const { total, sqft: totalSqft } = calculateTotalAndSqft();

  // Margin on this component. Cost is company_cost against the same measure
  // that produced the line's amount, so it reconciles with the total above.
  // Lines with no recorded cost are skipped rather than treated as free.
  const componentMargin = (() => {
    if (!canViewCosts || mode === "template") return null;
    let cost = 0;
    let costedRevenue = 0;
    for (const item of component.lineItems) {
      const c = item.companyCost ?? 0;
      if (!c) continue;
      const amount = item.amount ?? 0;
      const rate = item.rate ?? 0;
      const measure = rate > 0 ? amount / rate : item.quantity ?? 0;
      cost += c * measure;
      costedRevenue += amount;
    }
    if (costedRevenue <= 0) return null;
    const margin = costedRevenue - cost;
    return { margin, percent: (margin / costedRevenue) * 100 };
  })();
  const costPerSqft = totalSqft > 0 ? total / totalSqft : 0;

  return (
    <div className="border border-slate-200 rounded-lg">
      {/* Component Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-slate-50 cursor-pointer rounded-t-lg"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <button className="text-slate-600">
            <svg
              className={`w-4 h-4 transition-transform ${
                component.expanded ? "rotate-90" : ""
              }`}
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
          <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{component.name}:</span>
              <input
                type="text"
                value={component.customName || component.name}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdateName?.(e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder={component.name}
                className="text-sm font-medium text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-purple-500 focus:outline-none px-1 max-w-[180px]"
              />
            </div>
            <p className="text-xs text-slate-500">
              {component.lineItems.length} cost items
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mode === "quotation" && (
            <>
              {totalSqft > 0 && costPerSqft > 0 && (
                <span className="text-xs text-slate-500 bg-purple-50 px-2 py-0.5 rounded">
                  {formatCurrency(costPerSqft)}/sqft
                </span>
              )}
              {componentMargin && (
                <span
                  title="Margin on this component — internal, never printed for the client"
                  className={`text-xs px-2 py-0.5 rounded border ${
                    componentMargin.percent < 15
                      ? "bg-red-50 text-red-700 border-red-200"
                      : componentMargin.percent < 30
                      ? "bg-orange-50 text-orange-700 border-orange-200"
                      : "bg-green-50 text-green-700 border-green-200"
                  }`}
                >
                  {componentMargin.percent.toFixed(0)}% margin
                </span>
              )}
              <span className="font-semibold text-purple-600">
                {formatCurrency(total)}
              </span>
            </>
          )}
          {mode === "template" && (
            <span className="text-sm text-slate-500">
              {component.lineItems.length} items
            </span>
          )}
          {/* Move buttons */}
          {onMoveUp && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              title="Move up"
              className="text-slate-400 hover:text-slate-600"
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
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              title="Move down"
              className="text-slate-400 hover:text-slate-600"
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
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}
          {onDuplicate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              title="Duplicate component"
              className="text-slate-400 hover:text-blue-600"
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-slate-400 hover:text-red-600"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Component Content */}
      {component.expanded && (
        <div className="p-3 border-t border-slate-100 space-y-3">
          {/* Description field for quotation mode */}
          {mode === "quotation" && onUpdateDescription && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Component Notes / Description
              </label>
              <textarea
                value={component.description || ""}
                onChange={(e) => onUpdateDescription(e.target.value)}
                placeholder="e.g., 8ft x 7ft sliding wardrobe with mirror, soft-close hinges..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500 resize-none"
              />
            </div>
          )}

          {/* Component size.
              Entered once here instead of repeated on every line: a wardrobe's
              shutters, back panel and carcass all share the wardrobe's size.
              Only shown when the component actually holds measured lines - a
              component made purely of counted items has no size worth asking
              for. */}
          {mode === "quotation" && onUpdateDimensions && hasMeasuredLines && (
            <div className="flex flex-wrap items-end gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">
                  Width
                </label>
                <input
                  type="number"
                  value={component.width ?? ""}
                  onChange={(e) =>
                    onUpdateDimensions({
                      width: e.target.value === "" ? null : Number(e.target.value),
                      height: component.height ?? null,
                      measurementUnit: component.measurementUnit || "mm",
                    })
                  }
                  placeholder="—"
                  className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>
              <span className="pb-2 text-slate-400 text-sm">×</span>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">
                  Height
                </label>
                <input
                  type="number"
                  value={component.height ?? ""}
                  onChange={(e) =>
                    onUpdateDimensions({
                      width: component.width ?? null,
                      height: e.target.value === "" ? null : Number(e.target.value),
                      measurementUnit: component.measurementUnit || "mm",
                    })
                  }
                  placeholder="—"
                  className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">
                  Unit
                </label>
                <select
                  value={component.measurementUnit || "mm"}
                  onChange={(e) =>
                    onUpdateDimensions({
                      width: component.width ?? null,
                      height: component.height ?? null,
                      measurementUnit: e.target.value as MeasurementUnit,
                    })
                  }
                  className="px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-purple-500 outline-none"
                >
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="inch">inch</option>
                  <option value="ft">ft</option>
                </select>
              </div>
              <p className="flex-1 min-w-40 pb-1.5 text-[11px] text-slate-500">
                {followingCount > 0
                  ? `Applies to ${followingCount} line${
                      followingCount === 1 ? "" : "s"
                    }. Typing a size on a line stops it following.`
                  : "Every line here has its own size typed in, so nothing follows this."}
              </p>
            </div>
          )}

          {/* Line Items */}
          {component.lineItems.length > 0 && (
            <div className="space-y-2">
              {mode === "template" && (
                <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 mb-2 px-2">
                  <span className="col-span-4">Cost Item</span>
                  <span className="col-span-2">Category</span>
                  <span className="col-span-3">Unit / Measure</span>
                  <span className="col-span-2">Rate (₹)</span>
                  <span className="col-span-1"></span>
                </div>
              )}
              {component.lineItems.map((item, index) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  mode={mode}
                  onUpdateRate={(rate) => onUpdateLineItem(item.id, { rate })}
                  onUpdateLength={(length) =>
                    onUpdateLineItem(item.id, { length })
                  }
                  onUpdateWidth={(width) =>
                    onUpdateLineItem(item.id, { width })
                  }
                  onUpdateMeasurementUnit={(measurementUnit) =>
                    onUpdateLineItem(item.id, { measurementUnit })
                  }
                  onUpdateQuantity={(quantity) =>
                    onUpdateLineItem(item.id, { quantity })
                  }
                  onDelete={() => onDeleteLineItem(item.id)}
                  onMoveUp={
                    onMoveLineItemUp && index > 0
                      ? () => onMoveLineItemUp(item.id)
                      : undefined
                  }
                  onMoveDown={
                    onMoveLineItemDown && index < component.lineItems.length - 1
                      ? () => onMoveLineItemDown(item.id)
                      : undefined
                  }
                  showValidation={showValidation}
                />
              ))}
            </div>
          )}

          {/* Add Cost Item Button */}
          <div className="flex gap-2">
          <button
            onClick={onAddCostItem}
            className="flex-1 py-2 text-sm text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg border border-dashed border-amber-300 flex items-center justify-center gap-1"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Cost Item
          </button>
          {/* A saved set of items that always go together - drawer hardware,
              say - rather than picking them one at a time. */}
          {onSaveAsTemplate && (
            <button
              onClick={onSaveAsTemplate}
              title="Save this component and its cost items as a template"
              className="shrink-0 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 rounded-lg border border-dashed border-slate-300 hover:bg-slate-50"
            >
              Save
            </button>
          )}
          {onSaveAsBundle && (
            <button
              onClick={onSaveAsBundle}
              title="Save just these cost items as a reusable bundle"
              className="shrink-0 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 rounded-lg border border-dashed border-slate-300 hover:bg-slate-50"
            >
              Save bundle
            </button>
          )}
          {onAddFromBundle && (
            <button
              onClick={onAddFromBundle}
              title="Add a saved cost item bundle"
              className="shrink-0 px-3 py-2 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg border border-dashed border-purple-300"
            >
              From bundle
            </button>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function
function getMeasurementType(unitCode: string): string {
  const mapping: Record<string, string> = {
    sqft: "area",
    rft: "length",
    nos: "quantity",
    set: "quantity",
    lot: "fixed",
    lumpsum: "fixed",
    kg: "quantity",
    ltr: "quantity",
  };
  return mapping[unitCode?.toLowerCase()] || "quantity";
}

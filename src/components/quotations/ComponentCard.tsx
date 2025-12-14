"use client";

import React from "react";
import {
  BuilderComponent,
  LineItem,
  calculateSqft,
  convertToFeet,
} from "./types";
import { LineItemRow } from "./LineItemRow";

interface ComponentCardProps {
  component: BuilderComponent;
  mode: "template" | "quotation";
  onToggleExpand: () => void;
  onDelete: () => void;
  onUpdateDescription?: (description: string) => void;
  onAddCostItem: () => void;
  onUpdateLineItem: (lineItemId: string, updates: Partial<LineItem>) => void;
  onDeleteLineItem: (lineItemId: string) => void;
  formatCurrency: (amount: number) => string;
  onDuplicate?: () => void;
  onUpdateName?: (name: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  showValidation?: boolean; // Show validation errors on line items
}

export function ComponentCard({
  component,
  mode,
  onToggleExpand,
  onDelete,
  onUpdateDescription,
  onAddCostItem,
  onUpdateLineItem,
  onDeleteLineItem,
  formatCurrency,
  onDuplicate,
  onUpdateName,
  onMoveUp,
  onMoveDown,
  showValidation = false,
}: ComponentCardProps) {
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
              {component.lineItems.map((item) => (
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
                  showValidation={showValidation}
                />
              ))}
            </div>
          )}

          {/* Add Cost Item Button */}
          <button
            onClick={onAddCostItem}
            className="w-full py-2 text-sm text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg border border-dashed border-amber-300 flex items-center justify-center gap-1"
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

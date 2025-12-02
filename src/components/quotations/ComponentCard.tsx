"use client";

import React from "react";
import {
  BuilderComponent,
  LineItem,
  CostItem,
  CostItemCategory,
  calculateSqft,
  convertToFeet,
  MeasurementUnit,
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
}: ComponentCardProps) {
  // Calculate component total
  const calculateTotal = () => {
    if (mode === "template") return 0;

    return component.lineItems.reduce((sum, item) => {
      const measureType = getMeasurementType(item.unitCode);
      const unit = item.measurementUnit || "ft";

      switch (measureType) {
        case "area":
          const sqft = calculateSqft(item.length, item.width, unit);
          return sum + sqft * item.rate;
        case "length":
          const lengthInFeet = convertToFeet(item.length || 0, unit);
          return sum + lengthInFeet * item.rate;
        case "quantity":
          return sum + (item.quantity || 0) * item.rate;
        case "fixed":
          return sum + item.rate;
        default:
          return sum + (item.quantity || 0) * item.rate;
      }
    }, 0);
  };

  const total = calculateTotal();

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
            <h5 className="text-sm font-medium text-slate-900">
              {component.name}
              {component.variantName && (
                <span className="text-slate-500 font-normal">
                  {" "}
                  - {component.variantName}
                </span>
              )}
            </h5>
            <p className="text-xs text-slate-500">
              {component.lineItems.length} cost items
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mode === "quotation" && (
            <span className="font-semibold text-purple-600">
              {formatCurrency(total)}
            </span>
          )}
          {mode === "template" && (
            <span className="text-sm text-slate-500">
              {component.lineItems.length} items
            </span>
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
                  <span className="col-span-3">Cost Item</span>
                  <span className="col-span-2">Category</span>
                  <span className="col-span-2">Group</span>
                  <span className="col-span-2">Unit / Measure</span>
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
                  onUpdateGroup={(groupName) =>
                    onUpdateLineItem(item.id, { groupName })
                  }
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

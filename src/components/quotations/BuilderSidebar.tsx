"use client";

import React from "react";
import {
  BuilderSpace,
  formatCurrency,
  calculateSqft,
  convertToFeet,
} from "./types";

interface BuilderSidebarProps {
  mode: "template" | "quotation";
  spaces: BuilderSpace[];
  // For quotation mode
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  taxPercent?: number;
  onTaxPercentChange?: (percent: number) => void;
}

export function BuilderSidebar({
  mode,
  spaces,
  subtotal = 0,
  taxAmount = 0,
  total = 0,
  taxPercent = 18,
  onTaxPercentChange,
}: BuilderSidebarProps) {
  const totalSpaces = spaces.length;
  const totalComponents = spaces.reduce(
    (sum, s) => sum + s.components.length,
    0
  );
  const totalLineItems = spaces.reduce(
    (sum, s) =>
      sum + s.components.reduce((cSum, c) => cSum + c.lineItems.length, 0),
    0
  );

  // Calculate space totals for quotation mode
  const getSpaceTotal = (space: BuilderSpace) => {
    return space.components.reduce((spaceSum, comp) => {
      return (
        spaceSum +
        comp.lineItems.reduce((compSum, item) => {
          const measureType = getMeasurementType(item.unitCode);
          const unit = item.measurementUnit || "mm";

          switch (measureType) {
            case "area":
              const sqft = calculateSqft(item.length, item.width, unit);
              return compSum + sqft * item.rate;
            case "length":
              const lengthInFeet = convertToFeet(item.length || 0, unit);
              return compSum + lengthInFeet * item.rate;
            case "quantity":
              return compSum + (item.quantity || 0) * item.rate;
            case "fixed":
              return compSum + item.rate;
            default:
              return compSum + (item.quantity || 0) * item.rate;
          }
        }, 0)
      );
    }, 0);
  };

  if (mode === "template") {
    return (
      <div className="w-80 bg-white border-l border-slate-200 p-6 sticky top-[65px] h-[calc(100vh-65px)] overflow-auto">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Template Summary
        </h2>

        <div className="space-y-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">
              {totalSpaces}
            </div>
            <div className="text-sm text-blue-700">Spaces</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-3xl font-bold text-purple-600">
              {totalComponents}
            </div>
            <div className="text-sm text-purple-700">Components</div>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg">
            <div className="text-3xl font-bold text-amber-600">
              {totalLineItems}
            </div>
            <div className="text-sm text-amber-700">Cost Items</div>
          </div>
        </div>

        {spaces.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-medium text-slate-900 mb-3">
              Space Breakdown
            </h3>
            <div className="space-y-2">
              {spaces.map((space) => (
                <div
                  key={space.id}
                  className="flex justify-between text-sm py-2 border-b border-slate-100"
                >
                  <span className="text-slate-600">{space.defaultName}</span>
                  <span className="text-slate-900 font-medium">
                    {space.components.length} comp
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Quotation mode
  return (
    <div className="w-80 bg-white border-l border-slate-200 p-6 sticky top-[65px] h-[calc(100vh-65px)] overflow-auto">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">
        Cost Summary
      </h2>

      {/* Space totals */}
      {spaces.length > 0 && (
        <div className="space-y-2 mb-4">
          {spaces.map((space) => (
            <div
              key={space.id}
              className="flex justify-between text-sm py-2 border-b border-slate-100"
            >
              <span className="text-slate-600">{space.defaultName}</span>
              <span className="text-slate-900 font-medium">
                {formatCurrency(getSpaceTotal(space))}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Totals */}
      <div className="border-t border-slate-200 pt-4 space-y-2">
        <div className="flex justify-between items-start">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-medium text-slate-900">
            {formatCurrency(subtotal)}
          </span>
        </div>

        {/* Tax Percentage Section */}
        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-700">
              Tax Rate (GST)
            </label>
            {onTaxPercentChange ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={taxPercent}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    // Allow empty string (will be treated as 0)
                    if (inputValue === "") {
                      onTaxPercentChange(0);
                    } else {
                      const value = parseFloat(inputValue);
                      // Only update if it's a valid number between 0-100
                      if (!isNaN(value) && value >= 0 && value <= 100) {
                        onTaxPercentChange(value);
                      }
                    }
                  }}
                  className="w-16 px-2 py-1 text-center text-sm font-semibold border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                  max="100"
                  step="0.5"
                />
                <span className="text-sm font-medium text-slate-700">%</span>
              </div>
            ) : (
              <span className="text-sm font-semibold text-slate-900">
                {taxPercent}%
              </span>
            )}
          </div>

          {/* Range Slider */}
          {onTaxPercentChange && (
            <div className="space-y-2">
              <input
                type="range"
                value={taxPercent}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  onTaxPercentChange(value);
                }}
                min="0"
                max="100"
                step="0.5"
                className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex gap-1 pt-2">
                {[0, 5, 12, 18, 28].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => onTaxPercentChange(rate)}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-colors ${
                      Math.abs(taxPercent - rate) < 0.1
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tax Amount */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-200">
          <span className="text-sm font-medium text-slate-700">Tax Amount</span>
          <span className="font-semibold text-slate-900">
            {formatCurrency(taxAmount)}
          </span>
        </div>
        <div className="flex justify-between pt-3 border-t-2 border-blue-200 mt-3">
          <span className="text-base font-bold text-slate-900">
            Grand Total
          </span>
          <span className="text-2xl font-bold text-blue-600">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Quick Stats</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-700">Total Spaces</span>
            <span className="font-medium text-blue-900">{totalSpaces}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Total Components</span>
            <span className="font-medium text-blue-900">{totalComponents}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Total Cost Items</span>
            <span className="font-medium text-blue-900">{totalLineItems}</span>
          </div>
        </div>
      </div>
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

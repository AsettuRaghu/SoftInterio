"use client";

import React from "react";
import {
  LineItem,
  GROUP_NAMES,
  getMeasurementInfo,
  formatCurrency,
  MeasurementUnit,
  MEASUREMENT_UNITS,
  calculateSqft,
  convertToFeet,
} from "./types";

interface LineItemRowProps {
  item: LineItem;
  mode: "template" | "quotation";
  onUpdateRate: (rate: number) => void;
  onUpdateGroup: (group: string) => void;
  onUpdateLength?: (length: number | null) => void;
  onUpdateWidth?: (width: number | null) => void;
  onUpdateMeasurementUnit?: (unit: MeasurementUnit) => void;
  onUpdateQuantity?: (quantity: number) => void;
  onDelete: () => void;
}

export function LineItemRow({
  item,
  mode,
  onUpdateRate,
  onUpdateGroup,
  onUpdateLength,
  onUpdateWidth,
  onUpdateMeasurementUnit,
  onUpdateQuantity,
  onDelete,
}: LineItemRowProps) {
  const measureInfo = getMeasurementInfo(item.unitCode);
  const unit = item.measurementUnit || "ft"; // Use stored unit, default to ft for legacy data

  // Calculate sqft from dimensions with unit conversion
  const sqft = calculateSqft(item.length, item.width, unit);

  // Calculate amount based on measurement type
  const calculateAmount = () => {
    if (mode === "template") return 0;

    switch (measureInfo.type) {
      case "area":
        // Use calculated sqft × rate
        return sqft * item.rate;
      case "length":
        // Convert length to feet for calculation
        const lengthInFeet = convertToFeet(item.length || 0, unit);
        return lengthInFeet * item.rate;
      case "quantity":
        return (item.quantity || 0) * item.rate;
      case "fixed":
        return item.rate;
      default:
        return (item.quantity || 0) * item.rate;
    }
  };

  const amount = calculateAmount();

  if (mode === "template") {
    // Template mode - no dimensions, just rate
    return (
      <div className="grid grid-cols-12 gap-2 items-center px-2 py-2 bg-slate-50 rounded-lg">
        <span className="col-span-3 text-sm text-slate-900 truncate">
          {item.costItemName}
        </span>
        <span
          className="col-span-2 text-xs px-2 py-0.5 rounded truncate"
          style={{
            backgroundColor: `${item.categoryColor}20`,
            color: item.categoryColor,
          }}
        >
          {item.categoryName}
        </span>
        <select
          value={item.groupName}
          onChange={(e) => onUpdateGroup(e.target.value)}
          className="col-span-2 text-xs border border-slate-200 rounded px-1 py-1"
        >
          {GROUP_NAMES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <div className="col-span-2 flex items-center gap-1">
          <span className="text-xs text-slate-500 uppercase">
            {item.unitCode}
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${measureInfo.color}`}
          >
            {measureInfo.label}
          </span>
        </div>
        <input
          type="number"
          value={item.rate}
          onChange={(e) => onUpdateRate(parseFloat(e.target.value) || 0)}
          className="col-span-2 text-sm border border-slate-200 rounded px-2 py-1 w-full"
        />
        <button
          onClick={onDelete}
          className="col-span-1 text-slate-400 hover:text-red-600"
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
    );
  }

  // Quotation mode - with dimensions
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">
            {item.costItemName}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{
              backgroundColor: `${item.categoryColor}20`,
              color: item.categoryColor,
            }}
          >
            {item.categoryName}
          </span>
          <select
            value={item.groupName}
            onChange={(e) => onUpdateGroup(e.target.value)}
            className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white"
          >
            {GROUP_NAMES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${measureInfo.color}`}
          >
            {measureInfo.label}
          </span>
        </div>
        <button
          onClick={onDelete}
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

      <div className="grid grid-cols-12 gap-3 items-end">
        {/* Dimension inputs based on measurement type */}
        {measureInfo.type === "area" && (
          <>
            {/* Unit selector - separate from L/W */}
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Unit</label>
              <select
                value={unit}
                onChange={(e) =>
                  onUpdateMeasurementUnit?.(e.target.value as MeasurementUnit)
                }
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded bg-slate-50 focus:ring-1 focus:ring-blue-500"
              >
                {MEASUREMENT_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Length input */}
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">
                Length
              </label>
              <input
                type="number"
                step="0.01"
                value={item.length || ""}
                onChange={(e) =>
                  onUpdateLength?.(parseFloat(e.target.value) || null)
                }
                placeholder="L"
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {/* Width input */}
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Width</label>
              <input
                type="number"
                step="0.01"
                value={item.width || ""}
                onChange={(e) =>
                  onUpdateWidth?.(parseFloat(e.target.value) || null)
                }
                placeholder="W"
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {/* Calculated sqft */}
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">
                Area (sqft)
              </label>
              <div className="px-2 py-1.5 text-sm bg-blue-50 text-blue-700 font-medium rounded">
                {sqft.toFixed(2)}
              </div>
            </div>
          </>
        )}

        {measureInfo.type === "length" && (
          <>
            {/* Unit selector */}
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Unit</label>
              <select
                value={unit}
                onChange={(e) =>
                  onUpdateMeasurementUnit?.(e.target.value as MeasurementUnit)
                }
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded bg-slate-50 focus:ring-1 focus:ring-blue-500"
              >
                {MEASUREMENT_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Length input */}
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">
                Length
              </label>
              <input
                type="number"
                step="0.01"
                value={item.length || ""}
                onChange={(e) =>
                  onUpdateLength?.(parseFloat(e.target.value) || null)
                }
                placeholder="Length"
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">
                in Feet
              </label>
              <div className="px-2 py-1.5 text-sm bg-green-50 text-green-700 font-medium rounded">
                {convertToFeet(item.length || 0, unit).toFixed(2)} ft
              </div>
            </div>
          </>
        )}

        {measureInfo.type === "quantity" && (
          <>
            <div className="col-span-3">
              <label className="block text-xs text-slate-500 mb-1">
                Quantity ({item.unitCode})
              </label>
              <input
                type="number"
                value={item.quantity || ""}
                onChange={(e) =>
                  onUpdateQuantity?.(parseFloat(e.target.value) || 0)
                }
                placeholder="Qty"
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-3" />
          </>
        )}

        {measureInfo.type === "fixed" && (
          <div className="col-span-6">
            <label className="block text-xs text-slate-500 mb-1">
              Fixed / Lump Sum
            </label>
            <div className="px-2 py-1.5 text-sm bg-slate-100 rounded text-slate-500 italic">
              Lump sum item
            </div>
          </div>
        )}

        {/* Rate */}
        <div className="col-span-2">
          <label className="block text-xs text-slate-500 mb-1">
            Rate (₹/{item.unitCode})
          </label>
          <input
            type="number"
            value={item.rate}
            onChange={(e) => onUpdateRate(parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Amount */}
        <div className="col-span-2">
          <label className="block text-xs text-slate-500 mb-1">Amount</label>
          <div className="px-2 py-1.5 text-sm font-semibold bg-green-50 text-green-700 rounded">
            {formatCurrency(amount)}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import {
  LineItem,
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
  onUpdateLength?: (length: number | null) => void;
  onUpdateWidth?: (width: number | null) => void;
  onUpdateMeasurementUnit?: (unit: MeasurementUnit) => void;
  onUpdateQuantity?: (quantity: number) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  showValidation?: boolean; // Show validation errors
}

export function LineItemRow({
  item,
  mode,
  onUpdateRate,
  onUpdateLength,
  onUpdateWidth,
  onUpdateMeasurementUnit,
  onUpdateQuantity,
  onDelete,
  onMoveUp,
  onMoveDown,
  showValidation = false,
}: LineItemRowProps) {
  // Local state for input fields to allow empty values while typing
  const [rateInput, setRateInput] = useState<string>(item.rate.toString());
  const [quantityInput, setQuantityInput] = useState<string>(
    (item.quantity ?? "").toString()
  );
  const [lengthInput, setLengthInput] = useState<string>(
    (item.length ?? "").toString()
  );
  const [widthInput, setWidthInput] = useState<string>(
    (item.width ?? "").toString()
  );

  const measureInfo = getMeasurementInfo(item.unitCode);
  const unit = item.measurementUnit || "mm"; // Use stored unit, default to mm

  // Validation checks
  const isLengthMissing =
    showValidation &&
    (measureInfo.type === "area" || measureInfo.type === "length") &&
    !item.length;
  const isWidthMissing =
    showValidation && measureInfo.type === "area" && !item.width;
  const isQuantityMissing =
    showValidation && measureInfo.type === "quantity" && !item.quantity;
  const isRateMissing = showValidation && !item.rate;

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

  // Handle rate input change - allow empty or positive whole numbers only
  const handleRateChange = (value: string) => {
    // Only allow digits or empty
    const filtered = value === "" ? "" : value.replace(/[^0-9]/g, "");
    setRateInput(filtered);
  };

  const handleRateBlur = () => {
    if (rateInput === "") {
      // Keep empty - will be validated before save
      onUpdateRate(0);
    } else {
      const numValue = parseInt(rateInput, 10);
      if (isNaN(numValue) || numValue < 0) {
        setRateInput("");
        onUpdateRate(0);
      } else {
        setRateInput(numValue.toString());
        onUpdateRate(numValue);
      }
    }
  };

  // Handle quantity input change - allow empty or positive whole numbers only
  const handleQuantityChange = (value: string) => {
    // Only allow digits or empty
    const filtered = value === "" ? "" : value.replace(/[^0-9]/g, "");
    setQuantityInput(filtered);
  };

  const handleQuantityBlur = () => {
    if (quantityInput === "") {
      // Keep empty - will be validated before save
      onUpdateQuantity?.(0);
    } else {
      const numValue = parseInt(quantityInput, 10);
      if (isNaN(numValue) || numValue < 0) {
        setQuantityInput("");
        onUpdateQuantity?.(0);
      } else {
        setQuantityInput(numValue.toString());
        onUpdateQuantity?.(numValue);
      }
    }
  };

  // Handle length input change - allow empty or positive whole numbers only
  const handleLengthChange = (value: string) => {
    // Only allow digits or empty
    const filtered = value === "" ? "" : value.replace(/[^0-9]/g, "");
    setLengthInput(filtered);
  };

  const handleLengthBlur = () => {
    if (lengthInput === "") {
      onUpdateLength?.(null);
    } else {
      const numValue = parseInt(lengthInput, 10);
      if (isNaN(numValue) || numValue < 0) {
        setLengthInput("");
        onUpdateLength?.(null);
      } else {
        setLengthInput(numValue.toString());
        onUpdateLength?.(numValue);
      }
    }
  };

  // Handle width input change - allow empty or positive whole numbers only
  const handleWidthChange = (value: string) => {
    // Only allow digits or empty
    const filtered = value === "" ? "" : value.replace(/[^0-9]/g, "");
    setWidthInput(filtered);
  };

  const handleWidthBlur = () => {
    if (widthInput === "") {
      onUpdateWidth?.(null);
    } else {
      const numValue = parseInt(widthInput, 10);
      if (isNaN(numValue) || numValue < 0) {
        setWidthInput("");
        onUpdateWidth?.(null);
      } else {
        setWidthInput(numValue.toString());
        onUpdateWidth?.(numValue);
      }
    }
  };

  // Sync local state when item changes externally
  React.useEffect(() => {
    setRateInput(item.rate.toString());
  }, [item.rate]);

  React.useEffect(() => {
    setQuantityInput((item.quantity ?? "").toString());
  }, [item.quantity]);

  React.useEffect(() => {
    setLengthInput((item.length ?? "").toString());
  }, [item.length]);

  React.useEffect(() => {
    setWidthInput((item.width ?? "").toString());
  }, [item.width]);

  if (mode === "template") {
    // Template mode - no dimensions, just rate
    return (
      <div className="grid grid-cols-12 gap-2 items-center px-2 py-2 bg-slate-50 rounded-lg">
        <span className="col-span-4 text-sm text-slate-900 truncate">
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
        <div className="col-span-3 flex items-center gap-1">
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
          step="1"
          value={rateInput}
          onChange={(e) => handleRateChange(e.target.value)}
          onBlur={handleRateBlur}
          onFocus={(e) => e.target.select()}
          className="col-span-2 text-sm border border-slate-200 rounded px-2 py-1 w-full"
        />
        <div className="col-span-1 flex items-center gap-1">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              className="text-slate-400 hover:text-slate-600"
              title="Move up"
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
              onClick={onMoveDown}
              className="text-slate-400 hover:text-slate-600"
              title="Move down"
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
      </div>
    );
  }

  // Quotation mode - two row layout: header + fields
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2 space-y-2">
      {/* Row 1: Header with item name, category, type, and delete */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">
            {item.costItemName}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${item.categoryColor}20`,
              color: item.categoryColor,
            }}
          >
            {item.categoryName}
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${measureInfo.color}`}
          >
            {measureInfo.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              className="text-slate-400 hover:text-slate-600 p-1"
              title="Move up"
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
              onClick={onMoveDown}
              className="text-slate-400 hover:text-slate-600 p-1"
              title="Move down"
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
          <button
            onClick={onDelete}
            className="text-slate-400 hover:text-red-600 p-1"
            title="Remove item"
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

      {/* Row 2: All input fields with consistent grid layout - 9 columns */}
      {/* Unit | Height | × | Width | Area/Value | Spacer | Base Rate | Rate | Amount */}
      <div className="grid grid-cols-[90px_100px_20px_100px_110px_1fr_120px_120px_140px] gap-3 items-end">
        {/* Column 1: Unit (for area/length) or Qty */}
        {measureInfo.type === "area" || measureInfo.type === "length" ? (
          <div>
            <label className="block text-xs text-slate-500 mb-1">Unit</label>
            <select
              value={unit}
              onChange={(e) =>
                onUpdateMeasurementUnit?.(e.target.value as MeasurementUnit)
              }
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded bg-white"
            >
              {MEASUREMENT_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        ) : measureInfo.type === "quantity" ? (
          <div>
            <label
              className={`block text-xs mb-1 ${
                isQuantityMissing
                  ? "text-red-500 font-medium"
                  : "text-slate-500"
              }`}
            >
              Qty {isQuantityMissing && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              value={quantityInput}
              onChange={(e) => handleQuantityChange(e.target.value)}
              onBlur={handleQuantityBlur}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                // Prevent decimal point, minus, plus
                if ([".", "-", "+", "e", "E"].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = (e.clipboardData?.getData("text") || "").replace(
                  /[^0-9]/g,
                  ""
                );
                handleQuantityChange(pasted);
              }}
              placeholder="Qty"
              className={`w-full px-3 py-1.5 text-sm border rounded focus:ring-1 ${
                isQuantityMissing
                  ? "border-red-500 bg-red-50 focus:ring-red-500"
                  : "border-slate-200 focus:ring-blue-500"
              }`}
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs text-slate-500 mb-1">Type</label>
            <div className="px-3 py-1.5 text-sm text-slate-500 italic bg-slate-100 rounded text-center">
              Lump sum
            </div>
          </div>
        )}

        {/* Column 2: Height (for area/length) or empty */}
        {measureInfo.type === "area" ? (
          <div>
            <label
              className={`block text-xs mb-1 ${
                isLengthMissing ? "text-red-500 font-medium" : "text-slate-500"
              }`}
            >
              Height{" "}
              {isLengthMissing && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              value={lengthInput}
              onChange={(e) => handleLengthChange(e.target.value)}
              onBlur={handleLengthBlur}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                // Prevent decimal point, minus, plus
                if ([".", "-", "+", "e", "E"].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              onKeyDown={(e) => {
                // Prevent decimal point, minus, plus
                if ([".", "-", "+", "e", "E"].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = (e.clipboardData?.getData("text") || "").replace(
                  /[^0-9]/g,
                  ""
                );
                handleLengthChange(pasted);
              }}
              placeholder="H"
              className={`w-full px-3 py-1.5 text-sm border rounded focus:ring-1 ${
                isLengthMissing
                  ? "border-red-500 bg-red-50 focus:ring-red-500"
                  : "border-slate-200 focus:ring-blue-500"
              }`}
            />
          </div>
        ) : measureInfo.type === "length" ? (
          <div>
            <label
              className={`block text-xs mb-1 ${
                isLengthMissing ? "text-red-500 font-medium" : "text-slate-500"
              }`}
            >
              Height{" "}
              {isLengthMissing && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={lengthInput}
              onChange={(e) => handleLengthChange(e.target.value)}
              onBlur={handleLengthBlur}
              onFocus={(e) => e.target.select()}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = (e.clipboardData?.getData("text") || "").replace(
                  /[^0-9]/g,
                  ""
                );
                handleLengthChange(pasted);
              }}
              placeholder="H"
              className={`w-full px-3 py-1.5 text-sm border rounded focus:ring-1 ${
                isLengthMissing
                  ? "border-red-500 bg-red-50 focus:ring-red-500"
                  : "border-slate-200 focus:ring-blue-500"
              }`}
            />
          </div>
        ) : (
          <div /> // Empty placeholder
        )}

        {/* Column 3: × symbol (for area) or empty */}
        {measureInfo.type === "area" ? (
          <span className="text-slate-400 text-center pb-2 text-lg">×</span>
        ) : (
          <div /> // Empty placeholder
        )}

        {/* Column 4: Width (for area) or in Feet (for length) or empty */}
        {measureInfo.type === "area" ? (
          <div>
            <label
              className={`block text-xs mb-1 ${
                isWidthMissing ? "text-red-500 font-medium" : "text-slate-500"
              }`}
            >
              Width {isWidthMissing && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              value={widthInput}
              onChange={(e) => handleWidthChange(e.target.value)}
              onBlur={handleWidthBlur}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                // Prevent decimal point, minus, plus
                if ([".", "-", "+", "e", "E"].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = (e.clipboardData?.getData("text") || "").replace(
                  /[^0-9]/g,
                  ""
                );
                handleWidthChange(pasted);
              }}
              placeholder="W"
              className={`w-full px-3 py-1.5 text-sm border rounded focus:ring-1 ${
                isWidthMissing
                  ? "border-red-500 bg-red-50 focus:ring-red-500"
                  : "border-slate-200 focus:ring-blue-500"
              }`}
            />
          </div>
        ) : measureInfo.type === "length" ? (
          <div>
            <label className="block text-xs text-slate-500 mb-1">in Feet</label>
            <div className="px-3 py-1.5 text-sm bg-green-50 text-green-700 font-medium rounded whitespace-nowrap text-center">
              {convertToFeet(item.length || 0, unit).toFixed(2)} ft
            </div>
          </div>
        ) : (
          <div /> // Empty placeholder
        )}

        {/* Column 5: Area (for area type) or empty */}
        {measureInfo.type === "area" ? (
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Area (sqft)
            </label>
            <div className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 font-medium rounded whitespace-nowrap text-center">
              {sqft.toFixed(2)}
            </div>
          </div>
        ) : (
          <div /> // Empty placeholder
        )}

        {/* Column 6: Spacer - 1fr to push remaining columns to the right */}
        <div />

        {/* Column 7: Base Rate - always in same position */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Base Rate</label>
          {item.defaultRate > 0 ? (
            <div className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 font-medium rounded whitespace-nowrap text-center">
              ₹{item.defaultRate.toLocaleString("en-IN")}
            </div>
          ) : (
            <div className="px-3 py-1.5 text-sm bg-slate-100 text-slate-400 rounded text-center">
              —
            </div>
          )}
        </div>

        {/* Column 8: Rate input - always in same position */}
        <div>
          <label
            className={`block text-xs mb-1 ${
              isRateMissing ? "text-red-500 font-medium" : "text-slate-500"
            }`}
          >
            Rate (₹) {isRateMissing && <span className="text-red-500">*</span>}
          </label>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            value={rateInput}
            onChange={(e) => handleRateChange(e.target.value)}
            onBlur={handleRateBlur}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              // Prevent decimal point, minus, plus
              if ([".", "-", "+", "e", "E"].includes(e.key)) {
                e.preventDefault();
              }
            }}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = (e.clipboardData?.getData("text") || "").replace(
                /[^0-9]/g,
                ""
              );
              handleRateChange(pasted);
            }}
            placeholder="Rate"
            className={`w-full px-3 py-1.5 text-sm border rounded focus:ring-1 ${
              isRateMissing
                ? "border-red-500 bg-red-50 focus:ring-red-500"
                : "border-slate-200 focus:ring-blue-500"
            }`}
          />
        </div>

        {/* Column 9: Amount - always in same position */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Amount</label>
          <div className="px-3 py-1.5 text-sm font-semibold bg-green-50 text-green-700 rounded whitespace-nowrap text-right">
            {formatCurrency(amount)}
          </div>
        </div>
      </div>
    </div>
  );
}

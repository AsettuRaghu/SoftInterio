"use client";

import React from "react";
import {
  BuilderSpace,
  BuilderComponent,
  LineItem,
  ComponentType,
  ComponentVariant,
  MasterData,
  calculateSqft,
  convertToFeet,
} from "./types";
import { ComponentCard } from "./ComponentCard";

interface SpaceCardProps {
  space: BuilderSpace;
  mode: "template" | "quotation";
  onToggleExpand: () => void;
  onDelete: () => void;
  onUpdateName: (name: string) => void;
  onAddComponent: () => void;
  onToggleComponentExpand: (componentId: string) => void;
  onDeleteComponent: (componentId: string) => void;
  onUpdateComponentDescription?: (
    componentId: string,
    description: string
  ) => void;
  onUpdateComponentName?: (componentId: string, name: string) => void;
  onUpdateComponentVariant?: (
    componentId: string,
    variantId: string,
    variantName: string
  ) => void;
  masterData?: MasterData;
  onAddCostItem: (componentId: string) => void;
  onUpdateLineItem: (
    componentId: string,
    lineItemId: string,
    updates: Partial<LineItem>
  ) => void;
  onDeleteLineItem: (componentId: string, lineItemId: string) => void;
  formatCurrency: (amount: number) => string;
  // Duplicate operations
  onDuplicateSpace?: () => void;
  onDuplicateComponent?: (componentId: string) => void;
  // Drag & drop
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  // Move up/down
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveComponentUp?: (componentId: string) => void;
  onMoveComponentDown?: (componentId: string) => void;
}

export function SpaceCard({
  space,
  mode,
  onToggleExpand,
  onDelete,
  onUpdateName,
  onAddComponent,
  onToggleComponentExpand,
  onDeleteComponent,
  onUpdateComponentDescription,
  onUpdateComponentName,
  onUpdateComponentVariant,
  masterData,
  onAddCostItem,
  onUpdateLineItem,
  onDeleteLineItem,
  formatCurrency,
  onDuplicateSpace,
  onDuplicateComponent,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onMoveComponentUp,
  onMoveComponentDown,
}: SpaceCardProps) {
  // Calculate space total
  const calculateTotal = () => {
    if (mode === "template") return 0;

    return space.components.reduce((spaceSum, comp) => {
      return (
        spaceSum +
        comp.lineItems.reduce((compSum, item) => {
          const measureType = getMeasurementType(item.unitCode);
          const unit = item.measurementUnit || "ft";

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

  const total = calculateTotal();

  return (
    <div
      className={`bg-white rounded-xl border transition-all ${
        isDragging
          ? "opacity-50 border-blue-400"
          : isDragOver
          ? "border-blue-500 border-2 shadow-lg"
          : "border-slate-200"
      }`}
      draggable={!!onDragStart}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
      onDragEnd={onDragEnd}
    >
      {/* Space Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100 cursor-pointer rounded-t-xl"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <button className="text-blue-600">
            <svg
              className={`w-5 h-5 transition-transform ${
                space.expanded ? "rotate-90" : ""
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
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{space.name}:</span>
            <input
              type="text"
              value={space.defaultName}
              onChange={(e) => {
                e.stopPropagation();
                onUpdateName(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-1"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mode === "quotation" && (
            <span className="text-lg font-bold text-blue-600">
              {formatCurrency(total)}
            </span>
          )}
          {mode === "template" && (
            <span className="text-sm text-slate-500">
              {space.components.length} components
            </span>
          )}
          {/* Move up/down buttons */}
          {onMoveUp && canMoveUp && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              title="Move up"
              className="text-slate-400 hover:text-slate-600"
            >
              <svg
                className="w-5 h-5"
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
          {onMoveDown && canMoveDown && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              title="Move down"
              className="text-slate-400 hover:text-slate-600"
            >
              <svg
                className="w-5 h-5"
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
          {/* Copy/Duplicate buttons */}
          {onDuplicateSpace && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateSpace();
              }}
              title="Duplicate space"
              className="text-slate-400 hover:text-blue-600"
            >
              <svg
                className="w-5 h-5"
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
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Space Content */}
      {space.expanded && (
        <div className="p-4 space-y-3">
          {space.components.map((component, index) => (
            <ComponentCard
              key={component.id}
              component={component}
              mode={mode}
              onToggleExpand={() => onToggleComponentExpand(component.id)}
              onDelete={() => onDeleteComponent(component.id)}
              onUpdateDescription={
                onUpdateComponentDescription
                  ? (desc) => onUpdateComponentDescription(component.id, desc)
                  : undefined
              }
              onUpdateName={
                onUpdateComponentName
                  ? (name) => onUpdateComponentName(component.id, name)
                  : undefined
              }
              onUpdateVariant={
                onUpdateComponentVariant
                  ? (variantId, variantName) =>
                      onUpdateComponentVariant(
                        component.id,
                        variantId,
                        variantName
                      )
                  : undefined
              }
              availableVariants={
                masterData?.variants_by_component?.[component.componentTypeId]
              }
              onAddCostItem={() => onAddCostItem(component.id)}
              onUpdateLineItem={(lineItemId, updates) =>
                onUpdateLineItem(component.id, lineItemId, updates)
              }
              onDeleteLineItem={(lineItemId) =>
                onDeleteLineItem(component.id, lineItemId)
              }
              formatCurrency={formatCurrency}
              onDuplicate={
                onDuplicateComponent
                  ? () => onDuplicateComponent(component.id)
                  : undefined
              }
              onMoveUp={
                onMoveComponentUp && index > 0
                  ? () => onMoveComponentUp(component.id)
                  : undefined
              }
              onMoveDown={
                onMoveComponentDown && index < space.components.length - 1
                  ? () => onMoveComponentDown(component.id)
                  : undefined
              }
            />
          ))}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onAddComponent}
              className="flex-1 py-3 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg border border-dashed border-purple-300 flex items-center justify-center gap-1"
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
              Add Component
            </button>
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

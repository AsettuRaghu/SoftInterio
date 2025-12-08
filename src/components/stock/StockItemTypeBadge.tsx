"use client";

import React from "react";
import {
  StockItemType,
  StockItemTypeLabels,
  StockItemTypeColors,
} from "@/types/stock";

interface StockItemTypeBadgeProps {
  type: StockItemType;
  size?: "sm" | "md";
}

export function StockItemTypeBadge({
  type,
  size = "sm",
}: StockItemTypeBadgeProps) {
  const colors = StockItemTypeColors[type];
  const label = StockItemTypeLabels[type];

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${colors.bg} ${colors.text} ${sizeClasses[size]}`}
    >
      {label}
    </span>
  );
}

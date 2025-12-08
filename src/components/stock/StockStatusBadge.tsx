"use client";

import React from "react";

type StockStatus = "out_of_stock" | "low_stock" | "in_stock";

interface StockStatusBadgeProps {
  status: StockStatus;
  size?: "sm" | "md";
}

const statusConfig: Record<
  StockStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  out_of_stock: {
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
    label: "Out of Stock",
  },
  low_stock: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
    label: "Low Stock",
  },
  in_stock: {
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
    label: "In Stock",
  },
};

export function StockStatusBadge({
  status,
  size = "sm",
}: StockStatusBadgeProps) {
  const config = statusConfig[status];

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${config.bg} ${config.text} ${sizeClasses[size]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

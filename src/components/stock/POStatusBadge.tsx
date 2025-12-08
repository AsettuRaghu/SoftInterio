"use client";

import React from "react";
import { POStatus, POStatusLabels, POStatusColors } from "@/types/stock";

interface POStatusBadgeProps {
  status: POStatus;
  size?: "sm" | "md";
}

export function POStatusBadge({ status, size = "sm" }: POStatusBadgeProps) {
  const colors = POStatusColors[status];
  const label = POStatusLabels[status];

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${colors.bg} ${colors.text} ${sizeClasses[size]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  );
}

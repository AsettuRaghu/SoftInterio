"use client";

import React from "react";
import { cn } from "@/utils/cn";

interface CardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
  noPadding?: boolean;
}

export function Card({
  title,
  description,
  children,
  className,
  headerActions,
  noPadding = false,
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-slate-50 rounded-lg border border-slate-200 overflow-hidden",
        className
      )}
    >
      {(title || headerActions) && (
        <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200 flex items-center justify-between">
          <div>
            {title && (
              <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            )}
            {description && (
              <p className="text-[10px] text-slate-500">{description}</p>
            )}
          </div>
          {headerActions}
        </div>
      )}
      <div className={noPadding ? "" : "p-4"}>{children}</div>
    </div>
  );
}

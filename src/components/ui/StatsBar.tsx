"use client";

import React from "react";

interface StatItemProps {
  label: string;
  value: number;
  color?: "blue" | "green" | "red" | "default";
}

export function StatItem({ label, value, color = "default" }: StatItemProps) {
  const colorClasses = {
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
    default: "text-slate-900",
  };

  return (
    <span className="flex items-center gap-1 text-sm text-slate-600">
      <span className={`font-semibold ${colorClasses[color]}`}>{value}</span>{" "}
      {label}
    </span>
  );
}

interface StatsBarProps {
  stats: Array<{
    label: string;
    value: number;
    color?: "blue" | "green" | "red" | "default";
  }>;
  className?: string;
}

export function StatsBar({ stats, className = "" }: StatsBarProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {stats.map((stat, index) => (
        <React.Fragment key={stat.label}>
          {index > 0 && <span className="text-slate-300">•</span>}
          <StatItem {...stat} />
        </React.Fragment>
      ))}
    </div>
  );
}

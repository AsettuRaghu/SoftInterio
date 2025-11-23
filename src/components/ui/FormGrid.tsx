import React from "react";

interface FormGridProps {
  children: React.ReactNode;
  columns?: 1 | 2;
  className?: string;
}

export function FormGrid({
  children,
  columns = 2,
  className = "",
}: FormGridProps) {
  const gridClass =
    columns === 2
      ? "grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6"
      : "space-y-4";

  return <div className={`${gridClass} ${className}`}>{children}</div>;
}

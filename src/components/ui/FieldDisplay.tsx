import React from "react";

interface FieldDisplayProps {
  label: string;
  value: string | null | undefined | React.ReactNode;
  required?: boolean;
  className?: string;
}

export function FieldDisplay({
  label,
  value,
  required = false,
  className = "",
}: FieldDisplayProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="text-sm text-slate-900 font-medium py-1">
        {value || (
          <span className="text-slate-400 font-normal italic">Not set</span>
        )}
      </div>
    </div>
  );
}

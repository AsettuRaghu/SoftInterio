import React from "react";

interface FieldInputProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
  hint?: string;
  locked?: boolean;
  className?: string;
  id?: string;
}

export function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  maxLength,
  hint,
  locked = false,
  className = "",
  id,
}: FieldInputProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={id}
        className="block text-xs font-semibold text-slate-500 uppercase tracking-wide"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {locked ? (
        <div className="flex items-center justify-between px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600">
          <span>{value || "Not set"}</span>
          <svg
            className="w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) =>
            onChange?.(
              type === "text" && maxLength
                ? e.target.value.slice(0, maxLength)
                : e.target.value
            )
          }
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      )}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

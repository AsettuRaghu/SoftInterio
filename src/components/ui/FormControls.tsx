"use client";

import React from "react";
import { cn } from "@/utils/cn";

// ============================================
// FormInput - Text input with proper focus styles
// ============================================
export interface FormInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
  helperText?: string;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ className, label, error, required, helperText, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          data-error={error ? "true" : undefined}
          className={cn(
            "w-full px-3 py-2 text-sm text-slate-900 bg-white",
            "border border-slate-300 rounded-lg",
            "placeholder:text-slate-400",
            "transition-colors duration-150",
            "focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:ring-inset",
            "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed",
            "data-[error=true]:border-red-500 data-[error=true]:focus:border-red-500 data-[error=true]:focus:ring-red-500",
            className
          )}
          {...props}
        />
        {helperText && !error && (
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        )}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
FormInput.displayName = "FormInput";

// ============================================
// FormTextarea - Textarea with proper focus styles
// ============================================
export interface FormTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
  helperText?: string;
}

export const FormTextarea = React.forwardRef<
  HTMLTextAreaElement,
  FormTextareaProps
>(({ className, label, error, required, helperText, id, ...props }, ref) => {
  const textareaId = id || props.name;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-slate-700 mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        ref={ref}
        data-error={error ? "true" : undefined}
        className={cn(
          "w-full px-3 py-2 text-sm text-slate-900 bg-white",
          "border border-slate-300 rounded-lg",
          "placeholder:text-slate-400",
          "transition-colors duration-150",
          "resize-none",
          "focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:ring-inset",
          "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed",
          "data-[error=true]:border-red-500 data-[error=true]:focus:border-red-500 data-[error=true]:focus:ring-red-500",
          className
        )}
        {...props}
      />
      {helperText && !error && (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
});
FormTextarea.displayName = "FormTextarea";

// ============================================
// FormSelect - Select with proper focus styles
// ============================================
export interface FormSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  helperText?: string;
  options?: Array<{ value: string | number; label: string }>;
}

export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  (
    {
      className,
      label,
      error,
      required,
      helperText,
      id,
      options,
      children,
      ...props
    },
    ref
  ) => {
    const selectId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          data-error={error ? "true" : undefined}
          className={cn(
            "w-full px-3 py-2 text-sm text-slate-900 bg-white",
            "border border-slate-300 rounded-lg",
            "transition-colors duration-150",
            "focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:ring-inset",
            "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed",
            "data-[error=true]:border-red-500 data-[error=true]:focus:border-red-500 data-[error=true]:focus:ring-red-500",
            className
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {helperText && !error && (
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        )}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
FormSelect.displayName = "FormSelect";

// ============================================
// FormCheckbox - Checkbox with label
// ============================================
export interface FormCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
  error?: string;
}

export const FormCheckbox = React.forwardRef<
  HTMLInputElement,
  FormCheckboxProps
>(({ className, label, description, error, id, ...props }, ref) => {
  const checkboxId = id || props.name;

  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={checkboxId}
        ref={ref}
        className={cn(
          "h-4 w-4 mt-0.5 rounded border-slate-300",
          "text-blue-600",
          "focus:ring-1 focus:ring-blue-500 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-500",
          className
        )}
        {...props}
      />
      <div className="flex-1">
        {label && (
          <label
            htmlFor={checkboxId}
            className="text-sm font-medium text-slate-700 cursor-pointer"
          >
            {label}
          </label>
        )}
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
});
FormCheckbox.displayName = "FormCheckbox";

// ============================================
// FormGroup - Group form fields in rows
// ============================================
export interface FormGroupProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
}

export function FormGroup({ children, cols = 2, className }: FormGroupProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", gridCols[cols], className)}>
      {children}
    </div>
  );
}

// ============================================
// FormDivider - Visual separator in forms
// ============================================
export function FormDivider({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  if (label) {
    return (
      <div className={cn("flex items-center gap-4 py-2", className)}>
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
    );
  }

  return <div className={cn("h-px bg-slate-200 my-4", className)} />;
}

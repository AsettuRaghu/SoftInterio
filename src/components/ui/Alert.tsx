"use client";

import React from "react";
import { cn } from "@/utils/cn";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

type AlertVariant = "success" | "error" | "warning" | "info";

interface AlertProps {
  variant: AlertVariant;
  message: string;
  className?: string;
  onDismiss?: () => void;
}

const variantConfig: Record<
  AlertVariant,
  { bg: string; border: string; text: string; Icon: typeof CheckCircleIcon }
> = {
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    Icon: CheckCircleIcon,
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    Icon: XCircleIcon,
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    Icon: ExclamationCircleIcon,
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    Icon: InformationCircleIcon,
  },
};

export function Alert({ variant, message, className, onDismiss }: AlertProps) {
  const config = variantConfig[variant];
  const { Icon } = config;

  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg text-xs flex items-center gap-2 border",
        config.bg,
        config.border,
        config.text,
        className
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-0.5 hover:bg-black/5 rounded transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

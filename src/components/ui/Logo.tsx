import React from "react";
import { cn } from "@/utils/cn";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "default" | "white" | "dark";
}

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-12 h-12",
};

const textSizeClasses = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
};

export function Logo({
  className,
  size = "md",
  showText = true,
  variant = "default",
}: LogoProps) {
  const logoClasses = cn(
    sizeClasses[size],
    "rounded-xl flex items-center justify-center",
    variant === "default" && "bg-blue-600 shadow-sm",
    variant === "white" && "bg-white shadow-sm",
    variant === "dark" && "bg-gray-900",
    className
  );

  const iconColor = variant === "white" ? "text-blue-600" : "text-white";
  const textColor =
    variant === "white"
      ? "text-blue-600"
      : variant === "dark"
      ? "text-white"
      : "text-gray-900";

  return (
    <div className="flex items-center space-x-3">
      <div className={logoClasses}>
        {/* Interior Design Icon - Simple geometric representation */}
        <svg
          className={cn(
            iconColor,
            size === "sm"
              ? "w-3 h-3"
              : size === "md"
              ? "w-4 h-4"
              : size === "lg"
              ? "w-5 h-5"
              : "w-6 h-6"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      </div>

      {showText && (
        <div>
          <span
            className={cn(
              "font-bold text-gray-900",
              textSizeClasses[size],
              variant === "white" && "text-blue-600",
              variant === "dark" && "text-white"
            )}
          >
            SoftInterio
          </span>
          {size !== "sm" && (
            <div
              className={cn(
                "text-xs -mt-1",
                textColor === "text-gray-900"
                  ? "text-gray-500"
                  : variant === "white"
                  ? "text-blue-500"
                  : "text-gray-300"
              )}
            >
              Interior Design ERP
            </div>
          )}
        </div>
      )}
    </div>
  );
}

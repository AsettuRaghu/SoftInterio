"use client";

import React, { ReactNode } from "react";

interface ModalWrapperProps {
  isOpen: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  showHeader?: boolean;
}

export function ModalWrapper({
  isOpen,
  title,
  description,
  children,
  onClose,
  size = "md",
  showHeader = true,
}: ModalWrapperProps) {
  if (!isOpen) return null;

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
  }[size];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl w-full ${maxWidthClass} shadow-xl`}>
        {showHeader && (
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description && (
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

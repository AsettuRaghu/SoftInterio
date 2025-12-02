"use client";

import React from "react";
import { ComponentVariant } from "./types";

interface SelectVariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (variant: ComponentVariant) => void;
  variants: ComponentVariant[];
}

export function SelectVariantModal({
  isOpen,
  onClose,
  onSelect,
  variants,
}: SelectVariantModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Select Variant
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          Choose a variant for this component (optional)
        </p>
        <div className="space-y-2 max-h-60 overflow-auto">
          {variants.map((variant) => (
            <button
              key={variant.id}
              onClick={() => onSelect(variant)}
              className="w-full p-3 text-left border border-slate-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
            >
              <div className="font-medium text-slate-900">{variant.name}</div>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 py-2 text-slate-600 hover:text-slate-900"
        >
          Skip (No Variant)
        </button>
      </div>
    </div>
  );
}

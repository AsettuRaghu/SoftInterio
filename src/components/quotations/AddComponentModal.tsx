"use client";

import React from "react";
import { ComponentType } from "./types";

interface AddComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (componentType: ComponentType) => void;
  componentTypes: ComponentType[];
}

export function AddComponentModal({
  isOpen,
  onClose,
  onAdd,
  componentTypes,
}: AddComponentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Add Component
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          Select a component type to add
        </p>
        <div className="grid grid-cols-2 gap-3 max-h-80 overflow-auto">
          {componentTypes.map((componentType) => (
            <button
              key={componentType.id}
              onClick={() => onAdd(componentType)}
              className="p-4 text-left border border-slate-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
            >
              <div className="font-medium text-slate-900">
                {componentType.name}
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 py-2 text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

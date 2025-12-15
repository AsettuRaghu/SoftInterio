"use client";

import React, { useState } from "react";
import type {
  PropertyType,
  PropertyCategory,
  PropertySubtype,
  ServiceType,
  LeadSource,
} from "@/types/leads";
import {
  PropertyCategoryLabels as CatLabels,
  PropertyTypeLabels as PropLabels,
  PropertySubtypeLabels as SubtypeLabels,
  PropertyTypesByCategory,
  PropertySubtypesByCategory,
  ServiceTypeLabels as SvcLabels,
  LeadSourceLabels as SrcLabels,
} from "@/types/leads";

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateLeadModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateLeadModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // All form data in one state
  const [formData, setFormData] = useState({
    // Client Details (required fields marked)
    client_name: "", // Required at lead creation
    phone: "", // Required at lead creation
    email: "",
    // Lead Details
    service_type: "" as ServiceType | "",
    lead_source: "" as LeadSource | "",
    // Property Classification
    property_category: "" as PropertyCategory | "",
    property_type: "" as PropertyType | "",
    property_subtype: "" as PropertySubtype | "",
    // Property Details (optional at creation, required at later stages)
    property_name: "",
    unit_number: "",
    property_city: "",
    carpet_area: "",
    // Notes
    notes: "",
  });

  if (!isOpen) return null;

  // Helper to update individual fields
  const updateField = (
    field: keyof typeof formData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear category-dependent fields when category changes
    if (field === "property_category") {
      setFormData((prev) => ({
        ...prev,
        property_type: "",
        property_subtype: "",
      }));
    }
    // Clear subtype when type changes
    if (field === "property_type") {
      setFormData((prev) => ({
        ...prev,
        property_subtype: "",
      }));
    }
  };

  // Get available subtypes for selected category
  const availableSubtypes: PropertySubtype[] =
    PropertySubtypesByCategory[
      formData.property_category as PropertyCategory
    ] || [];

  // Get available types for selected category
  const availableTypes =
    PropertyTypesByCategory[formData.property_category as PropertyCategory] ||
    [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields for lead creation
    if (!formData.client_name.trim()) {
      setError("Client name is required");
      setIsSubmitting(false);
      return;
    }
    if (!formData.phone.trim()) {
      setError("Phone number is required");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/sales/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Client details
          client_name: formData.client_name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || undefined,
          // Lead details
          service_type: formData.service_type || undefined,
          lead_source: formData.lead_source || undefined,
          // Property classification
          property_category: formData.property_category || undefined,
          property_type: formData.property_type || undefined,
          property_subtype: formData.property_subtype || undefined,
          // Property details
          property_name: formData.property_name.trim() || undefined,
          unit_number: formData.unit_number.trim() || undefined,
          property_city: formData.property_city.trim() || undefined,
          carpet_area: formData.carpet_area
            ? Number(formData.carpet_area)
            : undefined,
          // Notes
          notes: formData.notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create lead");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Create New Lead
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter client and property details
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <svg
              className="w-5 h-5"
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
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Client Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Client Details</h3>
              <span className="text-xs text-slate-400">(required)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => updateField("client_name", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., +91 98765 43210"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., john@example.com"
                />
              </div>
            </div>
          </div>

          {/* Lead Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Lead Details</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Service Type
                </label>
                <select
                  value={formData.service_type}
                  onChange={(e) => updateField("service_type", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Select service type</option>
                  {Object.entries(SvcLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Lead Source
                </label>
                <select
                  value={formData.lead_source}
                  onChange={(e) => updateField("lead_source", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Select lead source</option>
                  {Object.entries(SrcLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Property Classification Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4"
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
              <h3 className="font-semibold text-slate-900">Property Classification</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.property_category}
                  onChange={(e) =>
                    updateField("property_category", e.target.value)
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Select category</option>
                  {Object.entries(CatLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Type
                </label>
                <select
                  value={formData.property_type}
                  onChange={(e) => updateField("property_type", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  disabled={!formData.property_category}
                >
                  <option value="">
                    {formData.property_category
                      ? "Select type"
                      : "Select category first"}
                  </option>
                  {availableTypes.map((type) => (
                    <option key={type} value={type}>
                      {PropLabels[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sub-type
                </label>
                <select
                  value={formData.property_subtype}
                  onChange={(e) =>
                    updateField("property_subtype", e.target.value)
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  disabled={!formData.property_type}
                >
                  <option value="">
                    {formData.property_type
                      ? "Select subtype"
                      : "Select type first"}
                  </option>
                  {availableSubtypes.map((subtype: PropertySubtype) => (
                    <option key={subtype} value={subtype}>
                      {SubtypeLabels[subtype]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Property Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4"
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
              <h3 className="font-semibold text-slate-900">Property Details</h3>
              <span className="text-xs text-slate-400">
                (can be added later)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property/Project Name
                </label>
                <input
                  type="text"
                  value={formData.property_name}
                  onChange={(e) => updateField("property_name", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Prestige Heights"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Unit Number
                </label>
                <input
                  type="text"
                  value={formData.unit_number}
                  onChange={(e) => updateField("unit_number", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., A-501"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={formData.property_city}
                  onChange={(e) => updateField("property_city", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Bangalore"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Carpet Area (sq.ft)
                </label>
                <input
                  type="number"
                  value={formData.carpet_area}
                  onChange={(e) => updateField("carpet_area", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 1500"
                />
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Notes</h3>
            </div>

            <textarea
              value={formData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Any initial notes about this lead..."
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Lead"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

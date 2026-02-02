"use client";

import React, { useState, useEffect } from "react";
import type {
  PropertyType,
  PropertyCategory,
  PropertySubtype,
  ServiceType,
  LeadSource,
} from "@/types/leads";
import {
  PropertyTypeLabels as PropLabels,
  PropertyCategoryLabels as CatLabels,
  PropertySubtypeLabels as SubtypeLabels,
  PropertyTypesByCategory,
  PropertySubtypesByCategory,
  ServiceTypeLabels as SvcLabels,
  LeadSourceLabels as SrcLabels,
  BudgetRangeLabels,
} from "@/types/leads";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  is_active?: boolean;
}

export function CreateLeadModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useCurrentUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(true);

  // All form data in one state - matching EditFormData naming conventions
  const [formData, setFormData] = useState({
    // Client Details
    client_name: "",
    phone: "",
    email: "",
    // Property Details
    property_name: "",
    unit_number: "",
    property_category: "" as PropertyCategory | "",
    property_type: "" as PropertyType | "",
    property_subtype: "" as PropertySubtype | "",
    property_address: "",
    property_city: "",
    property_pincode: "",
    carpet_area: "",
    // Lead Details
    service_type: "" as ServiceType | "",
    lead_source: "" as LeadSource | "",
    budget_range: "",
    target_start_date: "",
    target_end_date: "",
    // Assignment
    assigned_to: "",
    // Notes
    notes: "",
  });

  // Fetch team members on mount
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const response = await fetch("/api/team/members");
        const data = await response.json();
        if (response.ok && data.success && data.data) {
          // Filter to only active team members
          const activeMembers = data.data
            .filter((m: any) => m.is_active !== false)
            .map((m: any) => ({
              id: m.id,
              name: m.name,
              email: m.email,
              avatar_url: m.avatar_url,
              is_active: m.is_active,
            }));
          setTeamMembers(activeMembers);

          // Set default assignee to current user
          if (user?.id) {
            setFormData((prev) => ({ ...prev, assigned_to: user.id }));
          }
        }
      } catch (err) {
        console.error("Failed to fetch team members:", err);
      } finally {
        setLoadingTeamMembers(false);
      }
    };

    fetchTeamMembers();
  }, [user?.id]);

  // Get available property types based on selected category
  const availablePropertyTypes = formData.property_category
    ? PropertyTypesByCategory[formData.property_category]
    : [];

  // Get available subtypes based on selected category
  const availableSubtypes = formData.property_category
    ? PropertySubtypesByCategory[formData.property_category]
    : [];

  const updateField = (field: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Reset dependent fields when category changes
      if (field === "property_category") {
        updated.property_type = "" as PropertyType | "";
        updated.property_subtype = "" as PropertySubtype | "";
      }
      // Auto-set minimum end date when start date is selected
      if (field === "target_start_date" && value) {
        const minEnd = new Date(value);
        minEnd.setMonth(minEnd.getMonth() + 1);
        if (
          !updated.target_end_date ||
          updated.target_end_date < minEnd.toISOString().split("T")[0]
        ) {
          updated.target_end_date = minEnd.toISOString().split("T")[0];
        }
      }
      return updated;
    });
  };

  const getMinEndDate = () => {
    if (!formData.target_start_date) return "";
    const startDate = new Date(formData.target_start_date);
    startDate.setMonth(startDate.getMonth() + 1);
    return startDate.toISOString().split("T")[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
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
          budget_range: formData.budget_range || undefined,
          target_start_date: formData.target_start_date || undefined,
          target_end_date: formData.target_end_date || undefined,
          assigned_to: formData.assigned_to || undefined,
          // Property details
          property_name: formData.property_name.trim() || undefined,
          unit_number: formData.unit_number.trim() || undefined,
          property_category: formData.property_category || undefined,
          property_type: formData.property_type || undefined,
          property_subtype: formData.property_subtype || undefined,
          property_address: formData.property_address.trim() || undefined,
          property_city: formData.property_city.trim() || undefined,
          property_pincode: formData.property_pincode.trim() || undefined,
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
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
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

          {/* Assignment Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center">
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
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Assignment</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Assign To
              </label>
              <select
                value={formData.assigned_to}
                onChange={(e) => updateField("assigned_to", e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-slate-50"
                disabled={loadingTeamMembers}
              >
                <option value="">
                  {loadingTeamMembers
                    ? "Loading team..."
                    : "Select team member"}
                </option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                    {user?.id === member.id ? " (You)" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Defaults to you if not selected
              </p>
            </div>
          </div>

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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.client_name}
                  onChange={(e) => updateField("client_name", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter client name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+91 98765 43210"
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
                  placeholder="client@email.com"
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

          {/* Property Details Section */}
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
              <h3 className="font-semibold text-slate-900">Property Details</h3>
              <span className="text-xs text-slate-400">
                (can be added later)
              </span>
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
                  {availablePropertyTypes.map((type) => (
                    <option key={type} value={type}>
                      {PropLabels[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Community Type
                </label>
                <select
                  value={formData.property_subtype}
                  onChange={(e) =>
                    updateField("property_subtype", e.target.value)
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  disabled={!formData.property_category}
                >
                  <option value="">
                    {formData.property_category
                      ? "Select subtype"
                      : "Select category first"}
                  </option>
                  {availableSubtypes.map((subtype) => (
                    <option key={subtype} value={subtype}>
                      {SubtypeLabels[subtype]}
                    </option>
                  ))}
                </select>
              </div>
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
                  placeholder="e.g., Prestige Lakeside"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Flat/Unit Number
                </label>
                <input
                  type="text"
                  value={formData.unit_number}
                  onChange={(e) => updateField("unit_number", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., A-1502"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.property_address}
                  onChange={(e) =>
                    updateField("property_address", e.target.value)
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Street address"
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
                  Pincode
                </label>
                <input
                  type="text"
                  value={formData.property_pincode}
                  onChange={(e) =>
                    updateField("property_pincode", e.target.value)
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 560034"
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
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Lead Timeline Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-full flex items-center justify-center">
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Lead Timeline</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expected Start Date
                </label>
                <input
                  type="date"
                  value={formData.target_start_date}
                  onChange={(e) =>
                    updateField("target_start_date", e.target.value)
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expected End Date
                </label>
                <input
                  type="date"
                  value={formData.target_end_date}
                  min={getMinEndDate()}
                  onChange={(e) =>
                    updateField("target_end_date", e.target.value)
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {formData.target_start_date && (
                  <p className="text-xs text-slate-500 mt-1">
                    Minimum 1 month after start date
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Budget Range
                </label>
                <select
                  value={formData.budget_range}
                  onChange={(e) => updateField("budget_range", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Select budget range</option>
                  {Object.entries(BudgetRangeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
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

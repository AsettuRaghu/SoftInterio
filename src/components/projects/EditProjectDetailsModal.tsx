"use client";

import React from "react";
import {
  PropertyCategoryLabels,
  PropertySubtypeLabels,
} from "@/types/leads";
import { Project, ProjectStatusLabels } from "@/types/projects";
import { X } from "lucide-react";

// Property type options (aligned with property_type_v2 enum)
const propertyTypeOptions = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "independent_house", label: "Independent House" },
  { value: "penthouse", label: "Penthouse" },
  { value: "duplex", label: "Duplex" },
  { value: "row_house", label: "Row House" },
  { value: "farmhouse", label: "Farmhouse" },
  { value: "office", label: "Office" },
  { value: "retail_shop", label: "Retail Shop" },
  { value: "showroom", label: "Showroom" },
  { value: "restaurant_cafe", label: "Restaurant/Cafe" },
  { value: "clinic_hospital", label: "Clinic/Hospital" },
  { value: "hotel", label: "Hotel" },
  { value: "warehouse", label: "Warehouse" },
  { value: "co_working", label: "Co-working Space" },
  { value: "other", label: "Other" },
];

// Project category options (aligned with leads service_type)
const projectCategoryOptions = [
  { value: "turnkey", label: "Turnkey" },
  { value: "modular", label: "Modular" },
  { value: "renovation", label: "Renovation" },
  { value: "consultation", label: "Consultation" },
  { value: "commercial_fitout", label: "Commercial Fitout" },
  { value: "hybrid", label: "Hybrid (Turnkey + Modular)" },
  { value: "other", label: "Other" },
];

// Facing options
const facingOptions = [
  { value: "north", label: "North" },
  { value: "south", label: "South" },
  { value: "east", label: "East" },
  { value: "west", label: "West" },
  { value: "north_east", label: "North East" },
  { value: "north_west", label: "North West" },
  { value: "south_east", label: "South East" },
  { value: "south_west", label: "South West" },
];

// Furnishing status options
const furnishingOptions = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi_furnished", label: "Semi Furnished" },
  { value: "fully_furnished", label: "Fully Furnished" },
];

interface EditFormData {
  // Project Details
  // name and status were only editable in a second, separate modal that could
  // never be opened. They live here now so one dialog covers the whole record.
  name: string;
  status: string;
  description: string;
  notes: string;
  project_category: string;
  expected_start_date: string;
  expected_end_date: string;
  /**
   * Both were shown on the Overview tab and editable nowhere, so a project
   * arriving from a lead with no manager stayed that way - which is why both
   * projects on this tenant read "No project manager" on the report.
   */
  priority: string;
  project_manager_id: string;
  // Client Information
  client_name: string;
  client_email: string;
  client_phone: string;
  // Property Information
  property_name: string;
  property_type: string;
  flat_number: string;
  carpet_area_sqft: string;
  site_address: string;
  city: string;
  pincode: string;
  property_category: string;
  property_subtype: string;
}

interface EditProjectDetailsModalProps {
  isOpen: boolean;
  project: Project;
  /**
   * Who may be named project manager.
   *
   * Everyone on the team, not only holders of the Project Manager role. There
   * is an endpoint that filters by that role, and on this tenant it returns one
   * person of three - an Owner running their own projects could not be named,
   * which is the wrong answer in a small practice and contradicts the flat
   * permission model the rest of the app follows.
   */
  teamMembers?: { id: string; name: string; email?: string }[];
  onClose: () => void;
  onSave: (data: EditFormData) => Promise<void>;
  isSaving: boolean;
}

export function EditProjectDetailsModal({
  isOpen,
  project,
  teamMembers = [],
  onClose,
  onSave,
  isSaving,
}: EditProjectDetailsModalProps) {
  const [editForm, setEditForm] = React.useState<EditFormData>({
    // Project Details
    name: "",
    status: "new",
    description: "",
    notes: "",
    project_category: "turnkey",
    expected_start_date: "",
    expected_end_date: "",
    // Client Information
    priority: "medium",
    project_manager_id: "",
    client_name: "",
    client_email: "",
    client_phone: "",
    // Property Information
    property_name: "",
    property_type: "apartment",
    flat_number: "",
    carpet_area_sqft: "",
    site_address: "",
    city: "",
    pincode: "",
    property_category: "",
    property_subtype: "",
  });
  const [error, setError] = React.useState<string | null>(null);

  // Initialize form when modal opens or project changes
  React.useEffect(() => {
    if (isOpen && project) {
      setEditForm({
        // Project Details
        name: project.name || "",
        status: project.status || "new",
        description: project.description || "",
        notes: project.notes || "",
        project_category: project.project_category || "turnkey",
        priority: project.priority || "medium",
        project_manager_id: project.project_manager_id || "",
        expected_start_date: project.expected_start_date
          ? project.expected_start_date.split("T")[0]
          : "",
        expected_end_date: project.expected_end_date
          ? project.expected_end_date.split("T")[0]
          : "",
        // Client Information
        client_name: project.client?.name || project.client_name || "",
        client_email: project.client?.email || project.client_email || "",
        client_phone: project.client?.phone || project.client_phone || "",
        // Property Information
        property_name:
          project.property?.property_name || project.property_name || "",
        property_type:
          project.property?.property_type ||
          project.property_type ||
          "apartment",
        flat_number: project.property?.unit_number || project.flat_number || "",
        carpet_area_sqft: project.property?.carpet_area
          ? String(project.property.carpet_area)
          : project.carpet_area_sqft
          ? String(project.carpet_area_sqft)
          : "",
        site_address: project.property?.address_line1 || "",
        city: project.property?.city || "",
        pincode: project.property?.pincode || "",
        property_category: project.property?.category || "",
        property_subtype: project.property?.property_subtype || "",
      });
      setError(null);
    }
  }, [isOpen, project]);

  const handleInputChange = (field: keyof EditFormData, value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setError(null);

      // Validate mandatory fields
      const validationErrors: string[] = [];

      if (!editForm.client_name?.trim()) {
        validationErrors.push("Client name is required");
      }
      if (!editForm.client_phone?.trim()) {
        validationErrors.push("Client phone is required");
      }
      if (!editForm.client_email?.trim()) {
        validationErrors.push("Client email is required");
      }
      if (!editForm.property_name?.trim()) {
        validationErrors.push("Property name is required");
      }

      if (validationErrors.length > 0) {
        setError(validationErrors.join("\n"));
        return;
      }

      await onSave(editForm);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Edit Project Details
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Project:{" "}
              <span className="font-medium">{project.project_number}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-6">
          <div className="space-y-8">
            {/* CLIENT INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b border-slate-200">
                Client Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Client Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.client_name}
                    onChange={(e) =>
                      handleInputChange("client_name", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Client name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={editForm.client_email}
                    onChange={(e) =>
                      handleInputChange("client_email", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Email address"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={editForm.client_phone}
                    onChange={(e) =>
                      handleInputChange("client_phone", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Phone number"
                    required
                  />
                </div>
              </div>
            </div>

            {/* PROPERTY INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b border-slate-200">
                Property Information
              </h3>
              <div className="space-y-4">
                {/* Basic Property Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Category
                    </label>
                    <select
                      value={editForm.property_category}
                      onChange={(e) =>
                        handleInputChange("property_category", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select category</option>
                      {Object.entries(PropertyCategoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Subtype
                    </label>
                    <select
                      value={editForm.property_subtype}
                      onChange={(e) =>
                        handleInputChange("property_subtype", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select subtype</option>
                      {Object.entries(PropertySubtypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>
            </div>

            {/* PROJECT DETAILS */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b border-slate-200">
                Project Details
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Project name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Status
                    </label>
                    <select
                      value={editForm.status}
                      onChange={(e) =>
                        handleInputChange("status", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {(
                        [
                          "new",
                          "in_progress",
                          "on_hold",
                          "completed",
                          "cancelled",
                        ] as const
                      ).map((value) => (
                        <option key={value} value={value}>
                          {ProjectStatusLabels[value]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Project Category
                    </label>
                    <select
                      value={editForm.project_category}
                      onChange={(e) =>
                        handleInputChange("project_category", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {projectCategoryOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Project Manager
                    </label>
                    <select
                      value={editForm.project_manager_id}
                      onChange={(e) =>
                        handleInputChange("project_manager_id", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Nobody assigned</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    {teamMembers.length === 0 && (
                      <p className="mt-1 text-xs text-slate-400">
                        No team members loaded, so there is nobody to choose.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Priority
                    </label>
                    <select
                      value={editForm.priority}
                      onChange={(e) =>
                        handleInputChange("priority", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {(["low", "medium", "high", "urgent"] as const).map(
                        (value) => (
                          <option key={value} value={value}>
                            {value.charAt(0).toUpperCase() + value.slice(1)}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Expected Start Date
                    </label>
                    <input
                      type="date"
                      value={editForm.expected_start_date}
                      onChange={(e) =>
                        handleInputChange("expected_start_date", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Expected End Date
                    </label>
                    <input
                      type="date"
                      value={editForm.expected_end_date}
                      onChange={(e) =>
                        handleInputChange("expected_end_date", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Project description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Additional notes"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 shrink-0 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditProjectDetailsModal;

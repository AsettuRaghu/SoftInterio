"use client";

import React from "react";
import { Project } from "@/types/projects";
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
  description: string;
  notes: string;
  project_category: string;
  expected_start_date: string;
  expected_end_date: string;
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
  block_tower: string;
  built_up_area: string;
  super_built_up_area: string;
  bedrooms: string;
  bathrooms: string;
  balconies: string;
  floor_number: string;
  total_floors: string;
  facing: string;
  furnishing_status: string;
  parking_slots: string;
}

interface EditProjectDetailsModalProps {
  isOpen: boolean;
  project: Project;
  onClose: () => void;
  onSave: (data: EditFormData) => Promise<void>;
  isSaving: boolean;
}

export function EditProjectDetailsModal({
  isOpen,
  project,
  onClose,
  onSave,
  isSaving,
}: EditProjectDetailsModalProps) {
  const [editForm, setEditForm] = React.useState<EditFormData>({
    // Project Details
    description: "",
    notes: "",
    project_category: "turnkey",
    expected_start_date: "",
    expected_end_date: "",
    // Client Information
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
    block_tower: "",
    built_up_area: "",
    super_built_up_area: "",
    bedrooms: "",
    bathrooms: "",
    balconies: "",
    floor_number: "",
    total_floors: "",
    facing: "",
    furnishing_status: "",
    parking_slots: "",
  });
  const [error, setError] = React.useState<string | null>(null);

  // Initialize form when modal opens or project changes
  React.useEffect(() => {
    if (isOpen && project) {
      setEditForm({
        // Project Details
        description: project.description || "",
        notes: project.notes || "",
        project_category: project.project_category || "turnkey",
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
        block_tower: project.block_tower || "",
        built_up_area: project.built_up_area
          ? String(project.built_up_area)
          : "",
        super_built_up_area: project.super_built_up_area
          ? String(project.super_built_up_area)
          : "",
        bedrooms: project.bedrooms ? String(project.bedrooms) : "",
        bathrooms: project.bathrooms ? String(project.bathrooms) : "",
        balconies: project.balconies ? String(project.balconies) : "",
        floor_number: project.floor_number ? String(project.floor_number) : "",
        total_floors: project.total_floors ? String(project.total_floors) : "",
        facing: project.facing || "",
        furnishing_status: project.furnishing_status || "",
        parking_slots: project.parking_slots
          ? String(project.parking_slots)
          : "",
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
                      Property Type
                    </label>
                    <select
                      value={editForm.property_type}
                      onChange={(e) =>
                        handleInputChange("property_type", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {propertyTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Property Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.property_name}
                      onChange={(e) =>
                        handleInputChange("property_name", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., NCC Urban Mayfair"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Flat/Unit Number
                    </label>
                    <input
                      type="text"
                      value={editForm.flat_number}
                      onChange={(e) =>
                        handleInputChange("flat_number", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., E1302"
                    />
                  </div>
                </div>

                {/* Address Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      value={editForm.site_address}
                      onChange={(e) =>
                        handleInputChange("site_address", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Street address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) =>
                        handleInputChange("city", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="City"
                    />
                  </div>
                </div>

                {/* Area and Pincode */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Carpet Area (sqft)
                    </label>
                    <input
                      type="number"
                      value={editForm.carpet_area_sqft}
                      onChange={(e) =>
                        handleInputChange("carpet_area_sqft", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Pincode
                    </label>
                    <input
                      type="text"
                      value={editForm.pincode}
                      onChange={(e) =>
                        handleInputChange("pincode", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Pincode"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Block/Tower
                    </label>
                    <input
                      type="text"
                      value={editForm.block_tower}
                      onChange={(e) =>
                        handleInputChange("block_tower", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Block/Tower"
                    />
                  </div>
                </div>

                {/* Extended Property Details */}
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm font-semibold text-slate-600 mb-4">
                    Extended Details
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Built-up Area (sqft)
                      </label>
                      <input
                        type="number"
                        value={editForm.built_up_area}
                        onChange={(e) =>
                          handleInputChange("built_up_area", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Super Built-up (sqft)
                      </label>
                      <input
                        type="number"
                        value={editForm.super_built_up_area}
                        onChange={(e) =>
                          handleInputChange(
                            "super_built_up_area",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Bedrooms
                      </label>
                      <input
                        type="number"
                        value={editForm.bedrooms}
                        onChange={(e) =>
                          handleInputChange("bedrooms", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Bathrooms
                      </label>
                      <input
                        type="number"
                        value={editForm.bathrooms}
                        onChange={(e) =>
                          handleInputChange("bathrooms", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Balconies
                      </label>
                      <input
                        type="number"
                        value={editForm.balconies}
                        onChange={(e) =>
                          handleInputChange("balconies", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Floor Number
                      </label>
                      <input
                        type="text"
                        value={editForm.floor_number}
                        onChange={(e) =>
                          handleInputChange("floor_number", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Floor"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Total Floors
                      </label>
                      <input
                        type="number"
                        value={editForm.total_floors}
                        onChange={(e) =>
                          handleInputChange("total_floors", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Parking Slots
                      </label>
                      <input
                        type="number"
                        value={editForm.parking_slots}
                        onChange={(e) =>
                          handleInputChange("parking_slots", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Facing
                      </label>
                      <select
                        value={editForm.facing}
                        onChange={(e) =>
                          handleInputChange("facing", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select...</option>
                        {facingOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Furnishing
                      </label>
                      <select
                        value={editForm.furnishing_status}
                        onChange={(e) =>
                          handleInputChange("furnishing_status", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select...</option>
                        {furnishingOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

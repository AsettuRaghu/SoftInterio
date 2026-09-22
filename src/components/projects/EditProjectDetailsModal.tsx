"use client";

import React from "react";
import {
  PropertyCategoryLabels,
  PropertySubtypeLabels,
} from "@/types/leads";
import { Project, ProjectStatusLabels } from "@/types/projects";
import { SearchSelect } from "@/components/ui/SearchSelect";
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

/**
 * What a project must carry.
 *
 * A project comes from a **won** lead, and by that stage the lead modal already
 * required all of these - client name and phone, the property's category,
 * subtype, type, name, unit and carpet area, and both target dates. The data
 * therefore exists by the time a project is created, so a project asking for less
 * than the lead it came from is a gap rather than a kindness: it is how a record
 * that was complete at handover quietly loses fields afterwards.
 *
 * One list drives the asterisks and the validation, so a field cannot be marked
 * required and then not checked, or checked and not marked.
 *
 * Two of the lead's eleven are deliberately absent:
 *
 *   - **service_type** and **lead_source** have no column on `projects`. They
 *     live on the lead and are shown read-only on the Overview tab, so there is
 *     nothing here to require.
 *   - **budget_range** is money, which the project module does not carry.
 *
 * `client_email` goes further than the lead, which asks only for a name and
 * phone. Kept, because a project that has to be invoiced needs somewhere to send
 * it. Description and Notes stay optional: neither was ever required of a lead,
 * and demanding prose to save a date change is how people learn to type "n/a".
 */
const REQUIRED_FIELDS: Array<{ field: string; label: string }> = [
  { field: "name", label: "Project name" },
  { field: "client_name", label: "Client name" },
  { field: "client_phone", label: "Client phone" },
  { field: "client_email", label: "Client email" },
  { field: "property_category", label: "Property category" },
  { field: "property_subtype", label: "Property subtype" },
  { field: "property_type", label: "Property type" },
  { field: "property_name", label: "Property name" },
  { field: "flat_number", label: "Unit number" },
  { field: "carpet_area_sqft", label: "Carpet area" },
  { field: "city", label: "City" },
  { field: "expected_start_date", label: "Expected start date" },
  { field: "expected_end_date", label: "Expected end date" },
  /*
   * These four go beyond what the lead required.
   *
   * Status, Project Category and Priority are selects carrying a default, so in
   * practice they are always satisfied - marking them required states the rule
   * rather than changing behaviour, and stops a later change to those defaults
   * quietly making them optional.
   *
   * Project Manager is the one that bites: it defaults to empty, so an existing
   * project without one cannot be saved until somebody is chosen. That is the
   * intent - both projects on this tenant have no manager, which is what the
   * report flags as "nobody accountable" - but it does mean the first edit of
   * such a project now has to name one.
   */
  { field: "status", label: "Status" },
  { field: "project_category", label: "Service type" },
  { field: "project_manager_id", label: "Project manager" },
  { field: "priority", label: "Priority" },
  /*
   * Notes and Description are required too.
   *
   * The note is not paperwork here: every save writes it to the project's
   * timeline as a `note_added` entry, so it is the line somebody reads later to
   * find out why the dates moved. An edit with no explanation is what makes a
   * timeline useless.
   *
   * The cost is real and worth stating: a one-field correction now needs a
   * sentence with it, and people who are made to write something will sometimes
   * write nothing of value. The answer to that is the timeline being visibly
   * useful, not dropping the requirement.
   */
  { field: "description", label: "Description" },
  { field: "notes", label: "Notes" },
];

const REQUIRED_SET = new Set(REQUIRED_FIELDS.map((f) => f.field));

/** A red asterisk on anything REQUIRED_FIELDS names. */
function Star({ field }: { field: string }) {
  return REQUIRED_SET.has(field) ? <span className="text-red-500"> *</span> : null;
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

      /*
       * Everything the won lead already had to carry. Named, and all at once -
       * reporting the first missing field makes somebody press Save four times
       * to discover four problems.
       */
      const missing = REQUIRED_FIELDS.filter(({ field }) => {
        const value = editForm[field as keyof EditFormData];
        return !String(value ?? "").trim();
      }).map(({ label }) => label);

      if (missing.length > 0) {
        setError(
          missing.length === 1
            ? `${missing[0]} is required.`
            : `These are required: ${missing.join(", ")}.`
        );
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
                      Property Type<Star field="property_type" />
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
                      Flat/Unit Number<Star field="flat_number" />
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
                      City<Star field="city" />
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
                      Carpet Area (sqft)<Star field="carpet_area_sqft" />
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
                      Category<Star field="property_category" />
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
                      Subtype<Star field="property_subtype" />
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
                    Project Name<Star field="name" />
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
                      Status<Star field="status" />
                    </label>
                    {/* Status is changed with the button in the project
                        header, where each move has its own rules and dialog;
                        here it is only read. */}
                    <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-700">
                      {ProjectStatusLabels[editForm.status as keyof typeof ProjectStatusLabels] ?? editForm.status}
                      <span className="ml-2 text-xs text-slate-400">
                        {project.status === "new" && !project.kicked_off_at
                          ? "— kick off from the Plan tab"
                          : "— change it from the project header"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {/*
                        * Called Service Type, because that is what it is.
                        *
                        * `project_category` is set at conversion from the lead's
                        * `service_type` - the transition maps modular to modular
                        * and everything else to turnkey - and the two enums are
                        * the same list, project_category_enum merely adding
                        * `hybrid`. Two names for one thing is why nobody could
                        * tell whether the lead's Service Type had carried over.
                        */}
                      Service Type<Star field="project_category" />
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
                      Project Manager<Star field="project_manager_id" />
                    </label>
                    {/* Not "Nobody assigned", which reads as a choice
                        somebody made. This is required, so the empty state
                        is a prompt. */}
                    <SearchSelect
                      value={editForm.project_manager_id}
                      onChange={(v) => handleInputChange("project_manager_id", v)}
                      placeholder="Select a project manager"
                      options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
                      buttonClassName="px-3 py-2 border-slate-300"
                    />
                    {teamMembers.length === 0 && (
                      <p className="mt-1 text-xs text-slate-400">
                        No team members loaded, so there is nobody to choose.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Priority<Star field="priority" />
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
                      Expected Start Date<Star field="expected_start_date" />
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
                      Expected End Date<Star field="expected_end_date" />
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
                    Description<Star field="description" />
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
                    Notes<Star field="notes" />
                  </label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Why is this being changed? This goes on the project timeline."
                  />
                  {/* Say where it ends up. A required field with no stated
                      purpose reads as an obstacle. */}
                  <p className="mt-1 text-xs text-slate-400">
                    Saved to the project&apos;s timeline, so the reason for this
                    change is on the record.
                  </p>
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

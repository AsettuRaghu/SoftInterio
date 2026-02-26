import { Lead, LeadStage } from "@/types/leads";
import {
  LeadStageLabels,
  PropertyCategoryLabels,
  PropertyTypeLabels,
  PropertySubtypeLabels,
  PropertyTypesByCategory,
  PropertySubtypesByCategory,
  ServiceTypeLabels,
  LeadSourceLabels,
  BudgetRangeLabels,
  PropertyCategory,
} from "@/types/leads";
import React from "react";

export interface EditFormData {
  client_name: string;
  phone: string;
  email: string;
  property_name: string;
  unit_number: string;
  property_category: string;
  property_type: string;
  property_subtype: string;
  carpet_area: string;
  property_address: string;
  property_city: string;
  property_pincode: string;
  service_type: string;
  lead_source: string;
  budget_range: string;
  target_start_date: string;
  target_end_date: string;
  priority?: string;
  assigned_to?: string;
  won_amount?: string;
  contract_signed_date?: string;
  expected_project_start?: string;
}

const getRequiredFieldsForStage = (stage: LeadStage): string[] => {
  const newFields = ["client_name", "phone"];
  const qualifiedFields = [
    ...newFields,
    "property_category",
    "property_type",
    "property_subtype",
    "property_name",
    "service_type",
    "target_start_date",
    "target_end_date",
  ];
  const requirementFields = [
    ...qualifiedFields,
    "carpet_area",
    "unit_number",
    "budget_range",
  ];

  switch (stage) {
    case "new":
      return newFields;
    case "qualified":
      return qualifiedFields;
    case "requirement_discussion":
    case "proposal_discussion":
    case "won":
      return requirementFields;
    default:
      return newFields;
  }
};

export function EditLeadModal({
  lead,
  editForm,
  setEditForm,
  onClose,
  onSave,
  isSaving,
  validationError,
}: {
  lead: Lead;
  editForm: EditFormData;
  setEditForm: React.Dispatch<React.SetStateAction<EditFormData>>;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  validationError: string | null;
}) {
  const requiredFields = getRequiredFieldsForStage(lead.stage);
  const isRequired = (fieldName: string) => requiredFields.includes(fieldName);

  const RequiredStar = ({ field }: { field: string }) =>
    isRequired(field) ? <span className="text-red-500">*</span> : null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave();
  };

  const getMinStartDate = () => {
    const today = new Date().toISOString().split("T")[0];
    if (lead.target_start_date) {
      return lead.target_start_date;
    }
    return today;
  };

  const getMinEndDate = () => {
    if (!editForm.target_start_date) return "";
    const startDate = new Date(editForm.target_start_date);
    startDate.setMonth(startDate.getMonth() + 1);
    return startDate.toISOString().split("T")[0];
  };

  const handleEditStartDateChange = (value: string) => {
    const newForm = { ...editForm, target_start_date: value };
    if (value) {
      const minEnd = new Date(value);
      minEnd.setMonth(minEnd.getMonth() + 1);
      const minEndStr = minEnd.toISOString().split("T")[0];
      if (!editForm.target_end_date || editForm.target_end_date < minEndStr) {
        newForm.target_end_date = minEndStr;
      }
    }
    setEditForm(newForm);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Edit Lead</h2>
            <p className="text-sm text-slate-500 mt-1">
              Stage:{" "}
              <span className="font-medium">{LeadStageLabels[lead.stage]}</span>
              <span className="text-slate-400 ml-2">
                • Required fields depend on current stage
              </span>
            </p>
          </div>
          <button
            type="button"
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

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="overflow-y-auto flex-1 p-6">
            {/* Priority Section - Top */}
            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                Priority
              </h3>
              <div>
                <select
                  value={editForm.priority || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      priority: e.target.value || undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="">Select priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Client Information */}
              <div className="md:col-span-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Client Information
                </h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Client Name <RequiredStar field="client_name" />
                </label>
                <input
                  type="text"
                  required={isRequired("client_name")}
                  value={editForm.client_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, client_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone <RequiredStar field="phone" />
                </label>
                <input
                  type="tel"
                  required={isRequired("phone")}
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Service & Source */}
              <div className="md:col-span-3 mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Service & Source
                </h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Service Type <RequiredStar field="service_type" />
                </label>
                <select
                  required={isRequired("service_type")}
                  value={editForm.service_type}
                  onChange={(e) =>
                    setEditForm({ ...editForm, service_type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="">Select service type</option>
                  {Object.entries(ServiceTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Lead Source <RequiredStar field="lead_source" />
                </label>
                <select
                  required={isRequired("lead_source")}
                  value={editForm.lead_source}
                  onChange={(e) =>
                    setEditForm({ ...editForm, lead_source: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="">Select source</option>
                  {Object.entries(LeadSourceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Property Information */}
              <div className="md:col-span-3 mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Property Information
                </h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category <RequiredStar field="property_category" />
                </label>
                <select
                  required={isRequired("property_category")}
                  value={editForm.property_category}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      property_category: e.target.value,
                      property_type: "",
                      property_subtype: "",
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="">Select category</option>
                  {Object.entries(PropertyCategoryLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Type <RequiredStar field="property_type" />
                </label>
                <select
                  required={isRequired("property_type")}
                  value={editForm.property_type}
                  disabled={!editForm.property_category}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      property_type: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white disabled:bg-slate-50"
                >
                  <option value="">
                    {editForm.property_category
                      ? "Select type"
                      : "Select category first"}
                  </option>
                  {editForm.property_category &&
                    PropertyTypesByCategory[
                      editForm.property_category as PropertyCategory
                    ]?.map((type) => (
                      <option key={type} value={type}>
                        {PropertyTypeLabels[type]}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Community Type <RequiredStar field="property_subtype" />
                </label>
                <select
                  required={isRequired("property_subtype")}
                  value={editForm.property_subtype}
                  disabled={!editForm.property_category}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      property_subtype: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white disabled:bg-slate-50"
                >
                  <option value="">
                    {editForm.property_category
                      ? "Select subtype"
                      : "Select category first"}
                  </option>
                  {editForm.property_category &&
                    PropertySubtypesByCategory[
                      editForm.property_category as PropertyCategory
                    ]?.map((subtype) => (
                      <option key={subtype} value={subtype}>
                        {PropertySubtypeLabels[subtype]}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Name <RequiredStar field="property_name" />
                </label>
                <input
                  type="text"
                  required={isRequired("property_name")}
                  value={editForm.property_name}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      property_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., Prestige Lakeside"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={editForm.property_address}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      property_address: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Flat/Unit Number <RequiredStar field="unit_number" />
                </label>
                <input
                  type="text"
                  required={isRequired("unit_number")}
                  value={editForm.unit_number}
                  onChange={(e) =>
                    setEditForm({ ...editForm, unit_number: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Carpet Area (sq.ft) <RequiredStar field="carpet_area" />
                </label>
                <input
                  type="number"
                  required={isRequired("carpet_area")}
                  value={editForm.carpet_area}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      carpet_area: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={editForm.property_city}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      property_city: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pincode
                </label>
                <input
                  type="text"
                  value={editForm.property_pincode}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      property_pincode: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Budget & Value */}
              <div className="md:col-span-3 mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Budget & Value
                </h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Budget Range <RequiredStar field="budget_range" />
                </label>
                <select
                  required={isRequired("budget_range")}
                  value={editForm.budget_range}
                  onChange={(e) =>
                    setEditForm({ ...editForm, budget_range: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="">Select budget range</option>
                  {Object.entries(BudgetRangeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Timeline */}
              <div className="md:col-span-3 mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Timeline & Priority
                </h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Target Start Date <RequiredStar field="target_start_date" />
                </label>
                <input
                  type="date"
                  required={isRequired("target_start_date")}
                  value={editForm.target_start_date}
                  min={getMinStartDate()}
                  onChange={(e) => handleEditStartDateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
                {lead.target_start_date && (
                  <p className="text-xs text-slate-500 mt-1">
                    Cannot be earlier than original:{" "}
                    {new Date(lead.target_start_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Target End Date <RequiredStar field="target_end_date" />
                </label>
                <input
                  type="date"
                  required={isRequired("target_end_date")}
                  value={editForm.target_end_date}
                  min={getMinEndDate()}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      target_end_date: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
                {editForm.target_start_date && (
                  <p className="text-xs text-slate-500 mt-1">
                    Minimum 1 month after start date
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

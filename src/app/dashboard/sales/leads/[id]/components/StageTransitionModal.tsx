"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Lead,
  LeadStage,
  DisqualificationReason,
  LostReason,
  PropertyCategory,
  PropertyType,
  PropertySubtype,
} from "@/types/leads";
import {
  LeadStageLabels,
  LeadStageColors,
  PropertyCategoryLabels,
  PropertyTypeLabels,
  PropertySubtypeLabels,
  PropertyTypesByCategory,
  PropertySubtypesByCategory,
  ServiceTypeLabels,
  BudgetRangeLabels,
  DisqualificationReasonLabels,
  LostReasonLabels,
  ValidStageTransitions,
  getRequiredFieldsForTransition,
} from "@/types/leads";

interface StageTransitionFormData {
  service_type: string;
  lead_source: string;
  target_start_date: string;
  target_end_date: string;
  budget_range: string;
  project_scope: string;
  property_name: string;
  property_category: string;
  property_type: string;
  property_subtype: string;
  unit_number: string;
  carpet_area: string;
  disqualification_reason: DisqualificationReason | "";
  disqualification_notes: string;
  lost_reason: LostReason | "";
  lost_to_competitor: string;
  lost_notes: string;
  won_amount: string;
  contract_signed_date: string;
  expected_project_start: string;
  change_reason: string;
  selected_quotation_id: string;
}

export function StageTransitionModal({
  lead,
  quotations,
  onClose,
  onSuccess,
}: {
  lead: Lead;
  quotations: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [selectedStage, setSelectedStage] = useState<LeadStage | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showQuotationPrompt, setShowQuotationPrompt] = useState(false);
  const [formData, setFormData] = useState<StageTransitionFormData>({
    service_type: lead.service_type || "",
    lead_source: lead.lead_source || "",
    target_start_date: lead.target_start_date || "",
    target_end_date: lead.target_end_date || "",
    budget_range: lead.budget_range || "",
    project_scope: lead.project_scope || "",
    property_name: lead.property?.property_name || "",
    property_category: lead.property?.category || "",
    property_type: lead.property?.property_type || "",
    property_subtype: lead.property?.property_subtype || "",
    unit_number: lead.property?.unit_number || "",
    carpet_area: lead.property?.carpet_area?.toString() || "",
    disqualification_reason: "" as DisqualificationReason | "",
    disqualification_notes: "",
    lost_reason: "" as LostReason | "",
    lost_to_competitor: "",
    lost_notes: "",
    won_amount: "",
    contract_signed_date: "",
    expected_project_start: "",
    change_reason: "",
    selected_quotation_id: "",
  });

  // Get available property types based on selected category
  const availablePropertyTypes = formData.property_category
    ? PropertyTypesByCategory[formData.property_category as PropertyCategory]
    : [];

  // Get available subtypes based on selected category
  const availableSubtypes = formData.property_category
    ? PropertySubtypesByCategory[formData.property_category as PropertyCategory]
    : [];

  // Helper to determine if a field is required based on stage
  // Fields are cumulative: later stages require all previous stage fields
  const isQualifiedFieldRequired =
    selectedStage === "qualified" ||
    selectedStage === "requirement_discussion" ||
    selectedStage === "proposal_discussion";

  const isRequirementDiscussionFieldRequired =
    selectedStage === "requirement_discussion" ||
    selectedStage === "proposal_discussion";

  // Get minimum start date - cannot go earlier than original start date (if exists)
  // or today's date
  const getMinStartDate = () => {
    const today = new Date().toISOString().split("T")[0];
    // If lead already has a start date, it cannot be changed to an earlier date
    if (lead.target_start_date) {
      return lead.target_start_date;
    }
    return today;
  };

  // Calculate minimum end date (start date + 1 month)
  const getMinEndDate = () => {
    if (!formData.target_start_date) return "";
    const startDate = new Date(formData.target_start_date);
    startDate.setMonth(startDate.getMonth() + 1);
    return startDate.toISOString().split("T")[0];
  };

  // When start date changes, auto-set end date if needed
  const handleStartDateChange = (value: string) => {
    setFormData((prev) => {
      const newData = { ...prev, target_start_date: value };
      // If end date is not set or is before the new minimum, set it to start + 1 month
      if (value) {
        const minEnd = new Date(value);
        minEnd.setMonth(minEnd.getMonth() + 1);
        const minEndStr = minEnd.toISOString().split("T")[0];
        if (!prev.target_end_date || prev.target_end_date < minEndStr) {
          newData.target_end_date = minEndStr;
        }
      }
      return newData;
    });
  };

  const possibleTransitions = ValidStageTransitions[lead.stage] || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStage) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/sales/leads/${lead.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_stage: selectedStage,
          ...formData,
          carpet_area: formData.carpet_area
            ? parseFloat(formData.carpet_area)
            : undefined,
          won_amount: formData.won_amount
            ? parseFloat(formData.won_amount)
            : undefined,
          selected_quotation_id: formData.selected_quotation_id || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to transition stage");
      }

      // If moving to proposal_discussion, show quotation prompt
      if (selectedStage === "proposal_discussion") {
        // Fetch updated lead data to get the new quotation
        const leadResponse = await fetch(`/api/sales/leads/${lead.id}`);
        if (leadResponse.ok) {
          const leadData = await leadResponse.json();
          const newQuotations = leadData.quotations || [];

          if (newQuotations.length > 0) {
            setSuccessMessage(
              "Stage updated! A quotation has been created for this lead."
            );
            setShowQuotationPrompt(true);
          } else {
            setSuccessMessage("Stage updated successfully!");
            setTimeout(() => {
              onSuccess();
            }, 1500);
          }
        } else {
          onSuccess();
        }
      } else {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requiredFields = selectedStage
    ? getRequiredFieldsForTransition(lead.stage, selectedStage)
    : { fields: [], labels: [] };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            Change Lead Stage
          </h2>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-3">
              <svg
                className="w-5 h-5 text-green-500 shrink-0"
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
              <span>{successMessage}</span>
            </div>
          )}

          {/* Quotation Prompt - show when transitioning to proposal_discussion */}
          {showQuotationPrompt && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 mb-4">
                A quotation has been created for this lead. Would you like to
                proceed to the quotation now?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    // Fetch the latest quotation for this lead
                    const response = await fetch(`/api/sales/leads/${lead.id}`);
                    if (response.ok) {
                      const data = await response.json();
                      const quotationList = data.quotations || [];
                      if (quotationList.length > 0) {
                        // Navigate to the most recent quotation
                        const latestQuotation = quotationList[0];
                        router.push(
                          `/dashboard/quotations/${latestQuotation.id}`
                        );
                      }
                    }
                    onSuccess();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Yes, open quotation
                </button>
                <button
                  type="button"
                  onClick={onSuccess}
                  className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                >
                  No, stay here
                </button>
              </div>
            </div>
          )}

          {/* Only show the form fields if not showing quotation prompt */}
          {!showQuotationPrompt && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Current Stage
                </label>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full ${
                    LeadStageColors[lead.stage].bg
                  } ${LeadStageColors[lead.stage].text}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      LeadStageColors[lead.stage].dot
                    }`}
                  ></span>
                  {LeadStageLabels[lead.stage]}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Move to Stage <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {possibleTransitions.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => setSelectedStage(stage)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedStage === stage
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${LeadStageColors[stage].bg} ${LeadStageColors[stage].text}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${LeadStageColors[stage].dot}`}
                        ></span>
                        {LeadStageLabels[stage]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Show all fields when a stage is selected */}
              {selectedStage &&
                !["disqualified", "lost", "won"].includes(selectedStage) && (
                  <>
                    {/* Property Details Section */}
                    <div className="border-t border-slate-200 pt-4">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-slate-500"
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
                        Property Details
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Category{" "}
                              {isQualifiedFieldRequired && (
                                <span className="text-red-500">*</span>
                              )}
                            </label>
                            <select
                              required={isQualifiedFieldRequired}
                              value={formData.property_category}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  property_category: e.target
                                    .value as PropertyCategory,
                                  property_type: "",
                                  property_subtype: "",
                                })
                              }
                              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">Select category</option>
                              {Object.entries(PropertyCategoryLabels).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Property Type{" "}
                              {isQualifiedFieldRequired && (
                                <span className="text-red-500">*</span>
                              )}
                            </label>
                            <select
                              required={isQualifiedFieldRequired}
                              value={formData.property_type}
                              disabled={!formData.property_category}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  property_type: e.target.value as PropertyType,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50"
                            >
                              <option value="">
                                {formData.property_category
                                  ? "Select type"
                                  : "Select category first"}
                              </option>
                              {availablePropertyTypes.map((type) => (
                                <option key={type} value={type}>
                                  {PropertyTypeLabels[type]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Community Type{" "}
                              {isQualifiedFieldRequired && (
                                <span className="text-red-500">*</span>
                              )}
                            </label>
                            <select
                              required={isQualifiedFieldRequired}
                              value={formData.property_subtype}
                              disabled={!formData.property_category}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  property_subtype: e.target
                                    .value as PropertySubtype,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50"
                            >
                              <option value="">
                                {formData.property_category
                                  ? "Select subtype"
                                  : "Select category first"}
                              </option>
                              {availableSubtypes.map((subtype) => (
                                <option key={subtype} value={subtype}>
                                  {PropertySubtypeLabels[subtype]}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Property Name{" "}
                            {isQualifiedFieldRequired && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          <input
                            type="text"
                            required={isQualifiedFieldRequired}
                            value={formData.property_name}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                property_name: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Prestige Lakeside Habitat"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Flat/Unit Number{" "}
                              {isRequirementDiscussionFieldRequired && (
                                <span className="text-red-500">*</span>
                              )}
                            </label>
                            <input
                              type="text"
                              required={isRequirementDiscussionFieldRequired}
                              value={formData.unit_number}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  unit_number: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., A-1201"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Carpet Area (sq.ft){" "}
                              {isRequirementDiscussionFieldRequired && (
                                <span className="text-red-500">*</span>
                              )}
                            </label>
                            <input
                              type="number"
                              required={isRequirementDiscussionFieldRequired}
                              value={formData.carpet_area}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  carpet_area: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., 1500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Project Details Section */}
                    <div className="border-t border-slate-200 pt-4">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-slate-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                        Project Details
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Service Type{" "}
                              {isQualifiedFieldRequired && (
                                <span className="text-red-500">*</span>
                              )}
                            </label>
                            <select
                              required={isQualifiedFieldRequired}
                              value={formData.service_type}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  service_type: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">Select service type</option>
                              {Object.entries(ServiceTypeLabels).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Budget Range{" "}
                              {isRequirementDiscussionFieldRequired && (
                                <span className="text-red-500">*</span>
                              )}
                            </label>
                            <select
                              required={isRequirementDiscussionFieldRequired}
                              value={formData.budget_range}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  budget_range: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">Select budget range</option>
                              {Object.entries(BudgetRangeLabels).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Target Start Date{" "}
                              {isQualifiedFieldRequired && (
                                <span className="text-red-500">*</span>
                              )}
                            </label>
                            <input
                              type="date"
                              required={isQualifiedFieldRequired}
                              value={formData.target_start_date}
                              min={getMinStartDate()}
                              onChange={(e) =>
                                handleStartDateChange(e.target.value)
                              }
                              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            {lead.target_start_date && (
                              <p className="text-xs text-slate-500 mt-1">
                                Cannot be earlier than:{" "}
                                {new Date(
                                  lead.target_start_date
                                ).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Target End Date{" "}
                              {isQualifiedFieldRequired && (
                                <span className="text-red-500">*</span>
                              )}
                            </label>
                            <input
                              type="date"
                              required={isQualifiedFieldRequired}
                              value={formData.target_end_date}
                              min={getMinEndDate()}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  target_end_date: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            {formData.target_start_date && (
                              <p className="text-xs text-slate-500 mt-1">
                                Minimum 1 month after start date
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notes Section - Always visible */}
                    <div className="border-t border-slate-200 pt-4">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-slate-500"
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
                        Notes
                      </h3>
                      <textarea
                        required={selectedStage === "proposal_discussion"}
                        value={formData.change_reason}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            change_reason: e.target.value,
                          })
                        }
                        rows={3}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder={
                          selectedStage === "proposal_discussion"
                            ? "Required: Please provide notes for this stage transition..."
                            : "Optional: Add notes about this stage change..."
                        }
                      />
                      {selectedStage === "proposal_discussion" && (
                        <p className="text-xs text-red-500 mt-1">
                          * Notes are required for this stage transition
                        </p>
                      )}
                    </div>
                  </>
                )}

              {/* Disqualified stage fields */}
              {selectedStage === "disqualified" && (
                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                    Disqualification Details
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Disqualification Reason{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.disqualification_reason}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          disqualification_reason: e.target
                            .value as DisqualificationReason,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select reason</option>
                      {Object.entries(DisqualificationReasonLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={formData.disqualification_notes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          disqualification_notes: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional: Add any additional notes..."
                    />
                  </div>
                </div>
              )}

              {/* Lost stage fields */}
              {selectedStage === "lost" && (
                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Lost Deal Details
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Lost Reason <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.lost_reason}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lost_reason: e.target.value as LostReason,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select reason</option>
                      {Object.entries(LostReasonLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Lost to Competitor
                    </label>
                    <input
                      type="text"
                      value={formData.lost_to_competitor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lost_to_competitor: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Competitor name (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      value={formData.lost_notes}
                      onChange={(e) =>
                        setFormData({ ...formData, lost_notes: e.target.value })
                      }
                      rows={3}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Please provide details about why this lead was lost..."
                    />
                  </div>
                </div>
              )}

              {/* Won stage fields */}
              {selectedStage === "won" && (
                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-green-500"
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
                    Deal Won Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Won Amount <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.won_amount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            won_amount: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter amount in ₹"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Contract Signed Date{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.contract_signed_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contract_signed_date: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Expected Project Start{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.expected_project_start}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          expected_project_start: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Quotation Selection */}
                  {quotations.length > 0 ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Select Winning Quotation{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <p className="text-xs text-slate-500 mb-2">
                        Choose the quotation to attach to the new project
                      </p>
                      <select
                        required
                        value={formData.selected_quotation_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            selected_quotation_id: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Select a quotation</option>
                        {quotations
                          .sort((a, b) => {
                            // Sort by status priority: approved > sent > draft
                            const statusPriority = {
                              approved: 3,
                              signed: 3,
                              sent: 2,
                              draft: 1,
                            };
                            return (
                              (statusPriority[
                                b.status as keyof typeof statusPriority
                              ] || 0) -
                              (statusPriority[
                                a.status as keyof typeof statusPriority
                              ] || 0)
                            );
                          })
                          .map((quote) => (
                            <option key={quote.id} value={quote.id}>
                              {quote.quotation_number ||
                                `#${quote.id.slice(0, 8)}`}{" "}
                              v{quote.version} - ₹
                              {new Intl.NumberFormat("en-IN", {
                                maximumFractionDigits: 0,
                              }).format(
                                quote.grand_total || quote.total_amount || 0
                              )}{" "}
                              (
                              {quote.status?.charAt(0).toUpperCase() +
                                quote.status?.slice(1) || "Draft"}
                              )
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>No quotations available:</strong> You must
                        create at least one quotation before marking this lead
                        as won.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      value={formData.change_reason}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          change_reason: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Add any notes about this deal closure..."
                    />
                  </div>
                </div>
              )}

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
                  disabled={!selectedStage || isSubmitting}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Stage"
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import type {
  Lead,
  LeadStage,
  LeadActivity,
  LeadNote,
  LeadStageHistory,
  LeadTask,
  LeadDocument,
  LeadFamilyMember,
  BudgetRange,
  ServiceType,
  LeadSource,
  DisqualificationReason,
  LostReason,
  PropertyType,
} from "@/types/leads";
import {
  LeadStageLabels,
  LeadStageColors,
  PropertyTypeLabels,
  ServiceTypeLabels,
  LeadSourceLabels,
  BudgetRangeLabels,
  LeadActivityTypeLabels,
  DisqualificationReasonLabels,
  LostReasonLabels,
  ValidStageTransitions,
  getRequiredFieldsForTransition,
} from "@/types/leads";

type TabType =
  | "overview"
  | "timeline"
  | "tasks"
  | "documents"
  | "notes"
  | "quotations";

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const leadId = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [stageHistory, setStageHistory] = useState<LeadStageHistory[]>([]);
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [documents, setDocuments] = useState<LeadDocument[]>([]);
  const [familyMembers, setFamilyMembers] = useState<LeadFamilyMember[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [revisingId, setRevisingId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Modals
  const [showStageModal, setShowStageModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    client_name: "",
    phone: "",
    email: "",
    property_type: "",
    service_type: "",
    lead_source: "",
    property_name: "",
    flat_number: "",
    property_address: "",
    property_city: "",
    property_pincode: "",
    carpet_area_sqft: "",
    budget_range: "",
    estimated_value: "",
    project_scope: "",
    special_requirements: "",
    priority: "",
    target_start_date: "",
    target_end_date: "",
  });

  // Initialize edit form when lead is loaded
  useEffect(() => {
    if (lead) {
      setEditForm({
        client_name: lead.client_name || "",
        phone: lead.phone || "",
        email: lead.email || "",
        property_type: lead.property_type || "",
        service_type: lead.service_type || "",
        lead_source: lead.lead_source || "",
        property_name: lead.property_name || "",
        flat_number: lead.flat_number || "",
        property_address: lead.property_address || "",
        property_city: lead.property_city || "",
        property_pincode: lead.property_pincode || "",
        carpet_area_sqft: lead.carpet_area_sqft?.toString() || "",
        budget_range: lead.budget_range || "",
        estimated_value: lead.estimated_value?.toString() || "",
        project_scope: lead.project_scope || "",
        special_requirements: lead.special_requirements || "",
        priority: lead.priority || "medium",
        target_start_date: lead.target_start_date || "",
        target_end_date: lead.target_end_date || "",
      });
    }
  }, [lead]);

  // Save edited lead
  const handleSaveEdit = async () => {
    if (!lead) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/sales/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: editForm.client_name,
          phone: editForm.phone,
          email: editForm.email || null,
          property_type: editForm.property_type || null,
          service_type: editForm.service_type || null,
          lead_source: editForm.lead_source || null,
          property_name: editForm.property_name || null,
          flat_number: editForm.flat_number || null,
          property_address: editForm.property_address || null,
          property_city: editForm.property_city || null,
          property_pincode: editForm.property_pincode || null,
          carpet_area_sqft: editForm.carpet_area_sqft
            ? parseFloat(editForm.carpet_area_sqft)
            : null,
          budget_range: editForm.budget_range || null,
          estimated_value: editForm.estimated_value
            ? parseFloat(editForm.estimated_value)
            : null,
          project_scope: editForm.project_scope || null,
          special_requirements: editForm.special_requirements || null,
          priority: editForm.priority,
          target_start_date: editForm.target_start_date || null,
          target_end_date: editForm.target_end_date || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update lead");
      }

      await fetchLead();
      setShowEditModal(false);
    } catch (err) {
      console.error("Error updating lead:", err);
      alert(err instanceof Error ? err.message : "Failed to update lead");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle creating a quotation revision
  const handleRevise = async (quotationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (revisingId) return; // Prevent double-clicks

    try {
      setRevisingId(quotationId);
      const response = await fetch(`/api/quotations/${quotationId}/revision`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create revision");
      }

      const data = await response.json();
      // Navigate to the new revision
      router.push(`/dashboard/quotations/${data.id}/edit`);
    } catch (err) {
      console.error("Error creating revision:", err);
      alert(err instanceof Error ? err.message : "Failed to create revision");
    } finally {
      setRevisingId(null);
    }
  };

  // Fetch lead data
  const fetchLead = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sales/leads/${leadId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Lead not found");
        }
        throw new Error("Failed to fetch lead");
      }

      const data = await response.json();
      setLead(data.lead);
      setActivities(data.activities || []);
      setNotes(data.notes || []);
      setStageHistory(data.stageHistory || []);
      setTasks(data.tasks || []);
      setDocuments(data.documents || []);
      setFamilyMembers(data.familyMembers || []);
      setQuotations(data.quotations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  // Open stage modal if query param is present
  useEffect(() => {
    if (searchParams.get("openStageModal") === "true" && lead && !isLoading) {
      setShowStageModal(true);
      // Clear the query param from URL without navigation
      router.replace(`/dashboard/sales/leads/${leadId}`, { scroll: false });
    }
  }, [searchParams, lead, isLoading, leadId, router]);

  // Format helpers
  const formatCurrency = (amount: number | null) => {
    if (!amount) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <svg
          className="w-16 h-16 text-slate-300 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-lg font-medium text-slate-900 mb-2">
          {error || "Lead not found"}
        </p>
        <Link
          href="/dashboard/sales/leads"
          className="text-blue-600 hover:underline"
        >
          ← Back to Leads
        </Link>
      </div>
    );
  }

  const stageColors = LeadStageColors[lead.stage];
  const possibleTransitions = ValidStageTransitions[lead.stage] || [];
  const isTerminalStage = possibleTransitions.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500 shrink-0">
              <Link href="/dashboard/sales" className="hover:text-blue-600">
                Sales
              </Link>
              <span>/</span>
              <Link
                href="/dashboard/sales/leads"
                className="hover:text-blue-600"
              >
                Leads
              </Link>
              <span>/</span>
              <span className="text-slate-700 font-medium">
                {lead.lead_number}
              </span>
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-slate-200 shrink-0" />

            {/* Client Name */}
            <h1 className="text-xl font-bold text-slate-900 truncate">
              {lead.client_name}
            </h1>

            {/* Stage Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full shrink-0 ${stageColors.bg} ${stageColors.text}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${stageColors.dot}`}
              ></span>
              {LeadStageLabels[lead.stage]}
            </span>

            {/* Contact Pills - Only email, no call */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              {lead.phone && (
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-600 bg-slate-100 rounded-lg">
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
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  {lead.phone}
                </span>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
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
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="max-w-[180px] truncate">{lead.email}</span>
                </a>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {!isTerminalStage && (
              <>
                <button
                  onClick={() => setShowNoteModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
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
                  Note
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium">
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
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                  Task
                </button>
              </>
            )}
            {!isTerminalStage && (
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
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
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                Edit
              </button>
            )}
            {!isTerminalStage && (
              <button
                onClick={() => setShowStageModal(true)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Change Stage
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stage Progress Bar */}
      <div className="bg-white rounded-lg border border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between">
          {(
            [
              "new",
              "qualified",
              "requirement_discussion",
              "proposal_discussion",
              "won",
            ] as LeadStage[]
          ).map((stage, index, arr) => {
            const isActive = stage === lead.stage;
            const isPast = arr.indexOf(lead.stage) > index;

            return (
              <React.Fragment key={stage}>
                <div
                  className={`flex flex-col items-center ${
                    isActive
                      ? "text-blue-600"
                      : isPast
                      ? "text-green-600"
                      : "text-slate-400"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : isPast
                        ? "bg-green-600 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {isPast ? (
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className="text-xs mt-1 font-medium whitespace-nowrap">
                    {LeadStageLabels[stage]}
                  </span>
                </div>
                {index < arr.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded ${
                      isPast ? "bg-green-600" : "bg-slate-200"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        {(lead.stage === "lost" || lead.stage === "disqualified") && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              <strong>
                {lead.stage === "lost" ? "Lost" : "Disqualified"}:
              </strong>{" "}
              {lead.stage === "lost"
                ? LostReasonLabels[lead.lost_reason!]
                : DisqualificationReasonLabels[lead.disqualification_reason!]}
              {(lead.lost_notes || lead.disqualification_notes) &&
                ` - ${lead.lost_notes || lead.disqualification_notes}`}
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex">
            {(
              [
                { id: "overview", label: "Overview" },
                { id: "timeline", label: "Timeline" },
                { id: "tasks", label: `Tasks (${tasks.length})` },
                { id: "documents", label: `Documents (${documents.length})` },
                { id: "notes", label: `Notes (${notes.length})` },
                {
                  id: "quotations",
                  label: `Quotations (${quotations.length})`,
                },
              ] as { id: TabType; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-5">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Client & Contact Info */}
                <div className="space-y-5">
                  {/* Client Information Card */}
                  <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
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
                        </span>
                        Client Details
                      </h3>
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
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
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100">
                        <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-lg font-bold">
                          {getInitials(lead.client_name)}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-slate-900">
                            {lead.client_name}
                          </p>
                          <p className="text-sm text-slate-500">
                            Lead #{lead.lead_number}
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <div className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-slate-100">
                          <svg
                            className="w-5 h-5 text-slate-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                          </svg>
                          <span className="text-sm font-medium text-slate-700">
                            {lead.phone || "—"}
                          </span>
                        </div>
                        <a
                          href={lead.email ? `mailto:${lead.email}` : undefined}
                          className={`flex items-center gap-3 p-2.5 bg-white rounded-lg border border-slate-100 ${
                            lead.email
                              ? "hover:bg-blue-50 hover:border-blue-200"
                              : ""
                          }`}
                        >
                          <svg
                            className="w-5 h-5 text-slate-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                          <span className="text-sm font-medium text-slate-700 truncate">
                            {lead.email || "—"}
                          </span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Lead Attributes Card */}
                  <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
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
                              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                            />
                          </svg>
                        </span>
                        Lead Attributes
                      </h3>
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
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
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                    </div>
                    <dl className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">
                          Property Type
                        </dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {PropertyTypeLabels[lead.property_type]}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">Service Type</dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {lead.service_type
                            ? ServiceTypeLabels[lead.service_type]
                            : "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">Lead Source</dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {lead.lead_source
                            ? LeadSourceLabels[lead.lead_source]
                            : "—"}
                        </dd>
                      </div>
                      {lead.lead_source_detail && (
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                          <dt className="text-sm text-slate-500">
                            Source Detail
                          </dt>
                          <dd className="text-sm font-semibold text-slate-900">
                            {lead.lead_source_detail}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2">
                        <dt className="text-sm text-slate-500">Priority</dt>
                        <dd>
                          <span
                            className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                              lead.priority === "urgent"
                                ? "bg-red-100 text-red-700"
                                : lead.priority === "high"
                                ? "bg-orange-100 text-orange-700"
                                : lead.priority === "medium"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {lead.priority.charAt(0).toUpperCase() +
                              lead.priority.slice(1)}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Middle Column - Property & Assignment */}
                <div className="space-y-5">
                  {/* Property Information Card */}
                  <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
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
                        </span>
                        Property Details
                      </h3>
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
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
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                    </div>
                    <dl className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">
                          Property Name
                        </dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {lead.property_name || "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">Flat/Unit</dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {lead.flat_number || "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">Carpet Area</dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {lead.carpet_area_sqft
                            ? `${lead.carpet_area_sqft} sq.ft`
                            : "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">City</dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {lead.property_city || "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">Pincode</dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {lead.property_pincode || "—"}
                        </dd>
                      </div>
                      {lead.property_address && (
                        <div className="pt-2">
                          <dt className="text-sm text-slate-500 mb-1">
                            Full Address
                          </dt>
                          <dd className="text-sm font-medium text-slate-700 bg-slate-50 rounded-lg p-2">
                            {lead.property_address}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Assignment Card */}
                  <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                    <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center">
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
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      </span>
                      Assignment
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-sm font-bold">
                          {lead.assigned_user
                            ? getInitials(lead.assigned_user.name)
                            : "?"}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {lead.assigned_user?.name || "Unassigned"}
                          </p>
                          <p className="text-xs text-blue-600">Assigned To</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="w-10 h-10 rounded-full bg-linear-to-br from-slate-400 to-slate-600 text-white flex items-center justify-center text-sm font-bold">
                          {lead.created_user
                            ? getInitials(lead.created_user.name)
                            : "?"}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {lead.created_user?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-slate-500">Created By</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Budget & Timeline */}
                <div className="space-y-5">
                  {/* Budget & Value Card */}
                  <div className="bg-linear-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
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
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </span>
                        Budget & Value
                      </h3>
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
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
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-4 border border-emerald-100">
                        <p className="text-sm text-slate-500 mb-1">
                          Estimated Value
                        </p>
                        <p className="text-2xl font-bold text-emerald-700">
                          {formatCurrency(lead.estimated_value)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <dt className="text-sm text-slate-500">Budget Range</dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {lead.budget_range
                            ? BudgetRangeLabels[lead.budget_range]
                            : "—"}
                        </dd>
                      </div>
                      {lead.won_amount && (
                        <div className="bg-green-100 rounded-lg p-4 border border-green-200">
                          <p className="text-sm text-green-700 mb-1">
                            Won Amount
                          </p>
                          <p className="text-xl font-bold text-green-800">
                            {formatCurrency(lead.won_amount)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline Card */}
                  <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
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
                        </span>
                        Timeline
                      </h3>
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
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
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                    </div>
                    <dl className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">Created</dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {formatDateTime(lead.created_at)}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">Last Updated</dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {formatDateTime(lead.updated_at)}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">
                          Last Activity
                        </dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {formatDateTime(lead.last_activity_at)}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">
                          Stage Changed
                        </dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {formatDateTime(lead.stage_changed_at)}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">Target Start</dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {formatDate(lead.target_start_date)}
                        </dd>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <dt className="text-sm text-slate-500">Target End</dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {formatDate(lead.target_end_date)}
                        </dd>
                      </div>
                      {lead.next_followup_date && (
                        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 mt-2">
                          <p className="text-xs text-amber-600 font-medium">
                            Next Follow-up
                          </p>
                          <p className="text-sm font-bold text-amber-800">
                            {formatDate(lead.next_followup_date)}
                          </p>
                          {lead.next_followup_notes && (
                            <p className="text-xs text-amber-700 mt-1">
                              {lead.next_followup_notes}
                            </p>
                          )}
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              </div>

              {/* Project Scope & Special Requirements - Full Width */}
              {(lead.project_scope || lead.special_requirements) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {lead.project_scope && (
                    <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
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
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                              />
                            </svg>
                          </span>
                          Project Scope
                        </h3>
                        <button
                          onClick={() => setShowEditModal(true)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
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
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
                        {lead.project_scope}
                      </p>
                    </div>
                  )}
                  {lead.special_requirements && (
                    <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center">
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
                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                              />
                            </svg>
                          </span>
                          Special Requirements
                        </h3>
                        <button
                          onClick={() => setShowEditModal(true)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
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
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
                        {lead.special_requirements}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === "timeline" && (
            <div className="space-y-3">
              {activities.length === 0 && stageHistory.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  No activity recorded yet
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    ...activities.map((a) => ({
                      ...a,
                      type: "activity" as const,
                    })),
                    ...stageHistory.map((s) => ({
                      ...s,
                      type: "stage" as const,
                    })),
                  ]
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex gap-4 p-4 bg-slate-50 rounded-lg"
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            item.type === "stage"
                              ? "bg-purple-100 text-purple-600"
                              : "bg-blue-100 text-blue-600"
                          }`}
                        >
                          {item.type === "stage" ? (
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
                                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                              />
                            </svg>
                          ) : (
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
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {item.type === "stage"
                              ? `Stage changed to ${
                                  LeadStageLabels[
                                    (item as LeadStageHistory).to_stage
                                  ]
                                }`
                              : (item as LeadActivity).title}
                          </p>
                          {item.type === "activity" &&
                            (item as LeadActivity).description && (
                              <p className="text-xs text-slate-600 mt-1">
                                {(item as LeadActivity).description}
                              </p>
                            )}
                          <p className="text-xs text-slate-400 mt-1.5">
                            {formatDateTime(item.created_at)}
                            {item.type === "stage" &&
                              (item as LeadStageHistory).changed_user && (
                                <>
                                  {" "}
                                  by{" "}
                                  {
                                    (item as LeadStageHistory).changed_user
                                      ?.name
                                  }
                                </>
                              )}
                            {item.type === "activity" &&
                              (item as LeadActivity).created_user && (
                                <>
                                  {" "}
                                  by {(item as LeadActivity).created_user?.name}
                                </>
                              )}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">Notes</h3>
                <button
                  onClick={() => setShowNoteModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  + Add Note
                </button>
              </div>
              {notes.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  No notes yet
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="p-4 bg-slate-50 rounded-lg">
                      {note.is_pinned && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 mb-2">
                          <svg
                            className="w-3 h-3"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" />
                          </svg>
                          Pinned
                        </span>
                      )}
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        {formatDateTime(note.created_at)} by{" "}
                        {note.created_user?.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === "tasks" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">Tasks</h3>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                  + Add Task
                </button>
              </div>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  No tasks yet
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg"
                    >
                      <input
                        type="checkbox"
                        checked={task.status === "completed"}
                        className="w-5 h-5 rounded border-slate-300"
                        readOnly
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            task.status === "completed"
                              ? "text-slate-400 line-through"
                              : "text-slate-900"
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.due_date && (
                          <p className="text-xs text-slate-500 mt-1">
                            Due: {formatDate(task.due_date)}
                          </p>
                        )}
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          task.priority === "urgent"
                            ? "bg-red-100 text-red-700"
                            : task.priority === "high"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === "documents" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">
                  Documents
                </h3>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                  + Upload
                </button>
              </div>
              {documents.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  No documents uploaded yet
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <svg
                          className="w-8 h-8 text-slate-400 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {doc.file_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {doc.document_type || "Document"}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {formatDate(doc.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quotations Tab */}
          {activeTab === "quotations" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">
                  Quotations
                </h3>
              </div>

              {/* Info message - only show when no quotations exist */}
              {quotations.length === 0 && (
                <p className="text-sm text-slate-500 italic">
                  Quotations are created automatically when this lead moves to
                  the Proposal & Negotiation stage.
                </p>
              )}

              {quotations.length === 0 ? (
                <div className="text-center py-12">
                  <svg
                    className="w-16 h-16 text-slate-300 mx-auto mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-base font-medium text-slate-700 mb-2">
                    No quotations yet
                  </p>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto">
                    {lead.stage === "new" ||
                    lead.stage === "qualified" ||
                    lead.stage === "requirement_discussion"
                      ? "Move this lead to Proposal & Negotiation stage to auto-create the first quotation."
                      : "A quotation will be created when the lead moves to Proposal & Negotiation."}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                            Quote #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                            Version
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                            Valid Until
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                            Created
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                            Assigned To
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {quotations.map((quote) => (
                          <tr
                            key={quote.id}
                            className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                            onClick={() =>
                              router.push(`/dashboard/quotations/${quote.id}`)
                            }
                          >
                            <td className="px-4 py-3">
                              <p className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                                {quote.quotation_number ||
                                  `#${quote.id.slice(0, 8)}`}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                                v{quote.version || 1}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold text-sm text-slate-900">
                                  {formatCurrency(
                                    quote.grand_total || quote.total_amount
                                  )}
                                </p>
                                {quote.discount_amount &&
                                  quote.discount_amount > 0 && (
                                    <p className="text-xs text-green-600">
                                      -{formatCurrency(quote.discount_amount)}{" "}
                                      off
                                    </p>
                                  )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                  quote.status === "approved"
                                    ? "bg-green-100 text-green-700"
                                    : quote.status === "sent"
                                    ? "bg-blue-100 text-blue-700"
                                    : quote.status === "rejected"
                                    ? "bg-red-100 text-red-700"
                                    : quote.status === "expired"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {quote.status?.charAt(0).toUpperCase() +
                                  quote.status?.slice(1) || "Draft"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-slate-600">
                                {formatDate(quote.valid_until)}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-slate-600">
                                {formatDate(quote.created_at)}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              {quote.assigned_to_name ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium shrink-0">
                                    {quote.assigned_to_name?.[0]?.toUpperCase()}
                                  </div>
                                  <span className="text-sm text-slate-700 truncate">
                                    {quote.assigned_to_name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-slate-400 italic">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <Link
                                  href={`/dashboard/quotations/${quote.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="View quotation"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                    />
                                  </svg>
                                  View
                                </Link>
                                <Link
                                  href={`/dashboard/quotations/${quote.id}/edit`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit quotation"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
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
                                  Edit
                                </Link>
                                <button
                                  onClick={(e) => handleRevise(quote.id, e)}
                                  disabled={revisingId === quote.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded transition-colors disabled:opacity-50"
                                  title="Create new revision"
                                >
                                  {revisingId === quote.id ? (
                                    <div className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <svg
                                      className="w-3.5 h-3.5"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                      />
                                    </svg>
                                  )}
                                  Revise
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stage Transition Modal */}
      {showStageModal && (
        <StageTransitionModal
          lead={lead}
          quotations={quotations}
          onClose={() => setShowStageModal(false)}
          onSuccess={() => {
            setShowStageModal(false);
            fetchLead();
          }}
        />
      )}

      {/* Add Note Modal */}
      {showNoteModal && (
        <AddNoteModal
          leadId={lead.id}
          onClose={() => setShowNoteModal(false)}
          onSuccess={() => {
            setShowNoteModal(false);
            fetchLead();
          }}
        />
      )}

      {/* Edit Lead Modal */}
      {showEditModal && (
        <EditLeadModal
          lead={lead}
          editForm={editForm}
          setEditForm={setEditForm}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveEdit}
          isSaving={isSaving}
          validationError={null}
        />
      )}
    </div>
  );
}

// Stage Transition Modal
function StageTransitionModal({
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
  const [formData, setFormData] = useState({
    service_type: lead.service_type || "",
    lead_source: lead.lead_source || "",
    target_start_date: lead.target_start_date || "",
    target_end_date: lead.target_end_date || "",
    budget_range: lead.budget_range || "",
    project_scope: lead.project_scope || "",
    property_name: lead.property_name || "",
    property_type: lead.property_type || "",
    flat_number: lead.flat_number || "",
    carpet_area_sqft: lead.carpet_area_sqft?.toString() || "",
    disqualification_reason: "" as DisqualificationReason | "",
    disqualification_notes: "",
    lost_reason: "" as LostReason | "",
    lost_to_competitor: "",
    lost_notes: "",
    won_amount: "",
    contract_signed_date: "",
    expected_project_start: "",
    change_reason: "",
  });

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
          carpet_area_sqft: formData.carpet_area_sqft
            ? parseFloat(formData.carpet_area_sqft)
            : undefined,
          won_amount: formData.won_amount
            ? parseFloat(formData.won_amount)
            : undefined,
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

              {/* Dynamic fields based on selected stage */}
              {selectedStage === "qualified" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Property Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.property_type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          property_type: e.target.value as PropertyType,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select property type</option>
                      {Object.entries(PropertyTypeLabels).map(
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
                      Service Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
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
                      Property Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
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
                        Target Start Date{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.target_start_date}
                        min={getMinStartDate()}
                        onChange={(e) => handleStartDateChange(e.target.value)}
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
                        Target End Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
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
                </>
              )}

              {selectedStage === "requirement_discussion" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Flat/Unit Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.flat_number}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          flat_number: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., A-1201"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Carpet Area (sq.ft){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.carpet_area_sqft}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          carpet_area_sqft: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 1500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Budget Range <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
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
                </>
              )}

              {/* Proposal & Negotiation stage requires notes */}
              {selectedStage === "proposal_discussion" && (
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
                    placeholder="Please provide notes for this stage transition..."
                  />
                </div>
              )}

              {selectedStage === "disqualified" && (
                <>
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
                      rows={2}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {selectedStage === "lost" && (
                <>
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
                        setFormData({
                          ...formData,
                          lost_notes: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Please provide details about why this lead was lost..."
                    />
                  </div>
                </>
              )}

              {selectedStage === "won" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Won Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.won_amount}
                      onChange={(e) =>
                        setFormData({ ...formData, won_amount: e.target.value })
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
                </>
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

// Add Note Modal
function AddNoteModal({
  leadId,
  onClose,
  onSuccess,
}: {
  leadId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/sales/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to add note");
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
      <div className="bg-white rounded-2xl w-full max-w-lg">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Add Note</h2>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Note
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your note..."
              required
            />
          </div>

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
              disabled={!content.trim() || isSubmitting}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Adding..." : "Add Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Lead Modal with dynamic required fields based on stage
interface EditFormData {
  client_name: string;
  phone: string;
  email: string;
  property_type: string;
  service_type: string;
  lead_source: string;
  property_name: string;
  flat_number: string;
  property_address: string;
  property_city: string;
  property_pincode: string;
  carpet_area_sqft: string;
  budget_range: string;
  estimated_value: string;
  project_scope: string;
  special_requirements: string;
  priority: string;
  target_start_date: string;
  target_end_date: string;
}

// Define required fields per stage
// New lead - Client Name, Phone Number
// Qualified - Property Type, Service Type, Property Name, Target Start Date, Target End Date
// Requirement Discussion - Carpet Area, Flat Number, Budget Range (plus all from previous stages)
// Proposal & Negotiation - Same as Requirement Discussion
const getRequiredFieldsForStage = (stage: LeadStage): string[] => {
  // Base fields always required (New stage)
  const newFields = ["client_name", "phone"];

  // Qualified stage adds these
  const qualifiedFields = [
    ...newFields,
    "property_type",
    "service_type",
    "property_name",
    "target_start_date",
    "target_end_date",
  ];

  // Requirement Discussion stage adds these
  const requirementFields = [
    ...qualifiedFields,
    "carpet_area_sqft",
    "flat_number",
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

function EditLeadModal({
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
  setEditForm: (form: EditFormData) => void;
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

  // Get minimum start date - cannot go earlier than original start date
  // In later stages, we preserve the original start date constraint
  const getMinStartDate = () => {
    const today = new Date().toISOString().split("T")[0];
    // If lead already has a start date, it cannot be changed to an earlier date
    if (lead.target_start_date) {
      return lead.target_start_date;
    }
    return today;
  };

  // Get minimum end date - must be at least 1 month after start date
  const getMinEndDate = () => {
    if (!editForm.target_start_date) return "";
    const startDate = new Date(editForm.target_start_date);
    startDate.setMonth(startDate.getMonth() + 1);
    return startDate.toISOString().split("T")[0];
  };

  // Handle start date change - auto-adjust end date if needed
  const handleEditStartDateChange = (value: string) => {
    const newForm = { ...editForm, target_start_date: value };
    // If end date is not set or is before the new minimum, set it to start + 1 month
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
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client Information */}
              <div className="md:col-span-2">
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  value={editForm.priority}
                  onChange={(e) =>
                    setEditForm({ ...editForm, priority: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Service & Source */}
              <div className="md:col-span-2 mt-4">
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
              <div className="md:col-span-2 mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Property Information
                </h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Type <RequiredStar field="property_type" />
                </label>
                <select
                  required={isRequired("property_type")}
                  value={editForm.property_type}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      property_type: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="">Select property type</option>
                  {Object.entries(PropertyTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
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
                  Flat/Unit Number <RequiredStar field="flat_number" />
                </label>
                <input
                  type="text"
                  required={isRequired("flat_number")}
                  value={editForm.flat_number}
                  onChange={(e) =>
                    setEditForm({ ...editForm, flat_number: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Carpet Area (sq.ft) <RequiredStar field="carpet_area_sqft" />
                </label>
                <input
                  type="number"
                  required={isRequired("carpet_area_sqft")}
                  value={editForm.carpet_area_sqft}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      carpet_area_sqft: e.target.value,
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
              <div className="md:col-span-2 mt-4">
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Estimated Value (₹)
                </label>
                <input
                  type="number"
                  value={editForm.estimated_value}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      estimated_value: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Timeline */}
              <div className="md:col-span-2 mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Timeline
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

              {/* Project Details */}
              <div className="md:col-span-2 mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Project Details
                </h3>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project Scope <RequiredStar field="project_scope" />
                </label>
                <textarea
                  rows={3}
                  required={isRequired("project_scope")}
                  value={editForm.project_scope}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      project_scope: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Describe the scope of work..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Special Requirements
                </label>
                <textarea
                  rows={3}
                  value={editForm.special_requirements}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      special_requirements: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Any special requirements..."
                />
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

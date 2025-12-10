"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  User,
  Calendar,
  DollarSign,
  Edit2,
  Save,
  X,
  Home,
  Briefcase,
  Target,
  Clock,
  FileText,
  TrendingUp,
} from "lucide-react";
import { Project } from "@/types/projects";

// Property type options (aligned with leads)
const propertyTypeOptions = [
  { value: "apartment_gated", label: "Apartment (Gated)" },
  { value: "apartment_non_gated", label: "Apartment (Non-Gated)" },
  { value: "villa_gated", label: "Villa (Gated)" },
  { value: "villa_non_gated", label: "Villa (Non-Gated)" },
  { value: "independent_house", label: "Independent House" },
  { value: "commercial_office", label: "Commercial Office" },
  { value: "commercial_retail", label: "Commercial Retail" },
  { value: "commercial_restaurant", label: "Commercial Restaurant" },
  { value: "commercial_other", label: "Commercial Other" },
  { value: "unknown", label: "Unknown" },
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

// Budget range options
const budgetRangeOptions = [
  { value: "5-10L", label: "₹5-10 Lakhs" },
  { value: "10-15L", label: "₹10-15 Lakhs" },
  { value: "15-25L", label: "₹15-25 Lakhs" },
  { value: "25-40L", label: "₹25-40 Lakhs" },
  { value: "40-60L", label: "₹40-60 Lakhs" },
  { value: "60L-1Cr", label: "₹60 Lakhs - 1 Crore" },
  { value: "1Cr+", label: "₹1 Crore+" },
];

// Lead source options
const leadSourceOptions = [
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "social_media", label: "Social Media" },
  { value: "advertisement", label: "Advertisement" },
  { value: "walk_in", label: "Walk In" },
  { value: "builder_partnership", label: "Builder Partnership" },
  { value: "real_estate_agent", label: "Real Estate Agent" },
  { value: "exhibition", label: "Exhibition" },
  { value: "other", label: "Other" },
];

// Project status options
const projectStatusOptions = [
  { value: "planning", label: "Planning" },
  { value: "design", label: "Design" },
  { value: "procurement", label: "Procurement" },
  { value: "execution", label: "Execution" },
  { value: "finishing", label: "Finishing" },
  { value: "handover", label: "Handover" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
  { value: "cancelled", label: "Cancelled" },
];

interface ProjectOverviewTabProps {
  project: Project;
  onUpdate?: (updates: Partial<Project>) => Promise<void>;
  isFinanceUser?: boolean;
}

interface EditFormData {
  // Client Info
  client_name: string;
  client_email: string;
  client_phone: string;
  // Property Info
  property_type: string;
  property_name: string;
  flat_number: string;
  carpet_area_sqft: string;
  // Location
  site_address: string;
  city: string;
  pincode: string;
  // Project Classification
  project_category: string;
  status: string;
  // Dates
  start_date: string;
  expected_end_date: string;
  // Financials
  quoted_amount: string;
  budget_amount: string;
  budget_range: string;
  // Lead Tracking
  lead_source: string;
  lead_source_detail: string;
  lead_won_date: string;
  // Other
  description: string;
  notes: string;
}

export function ProjectOverviewTab({
  project,
  onUpdate,
  isFinanceUser = false,
}: ProjectOverviewTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalForm, setOriginalForm] = useState<EditFormData | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    client_name: "",
    client_email: "",
    client_phone: "",
    property_type: "",
    property_name: "",
    flat_number: "",
    carpet_area_sqft: "",
    site_address: "",
    city: "",
    pincode: "",
    project_category: "",
    status: "",
    start_date: "",
    expected_end_date: "",
    quoted_amount: "",
    budget_amount: "",
    budget_range: "",
    lead_source: "",
    lead_source_detail: "",
    lead_won_date: "",
    description: "",
    notes: "",
  });

  // Initialize form when project loads or changes
  useEffect(() => {
    if (project) {
      const initialForm: EditFormData = {
        client_name: project.client_name || "",
        client_email: project.client_email || "",
        client_phone: project.client_phone || "",
        property_type: project.property_type || "unknown",
        property_name: project.property_name || "",
        flat_number: project.flat_number || "",
        carpet_area_sqft: project.carpet_area_sqft?.toString() || "",
        site_address: project.site_address || "",
        city: project.city || "",
        pincode: project.pincode || "",
        project_category: project.project_category || "turnkey",
        status: project.status || "planning",
        start_date: project.start_date ? project.start_date.split("T")[0] : "",
        expected_end_date: project.expected_end_date
          ? project.expected_end_date.split("T")[0]
          : "",
        quoted_amount: project.quoted_amount?.toString() || "",
        budget_amount: project.budget_amount?.toString() || "",
        budget_range: project.budget_range || "",
        lead_source: project.lead_source || "",
        lead_source_detail: project.lead_source_detail || "",
        lead_won_date: project.lead_won_date
          ? project.lead_won_date.split("T")[0]
          : "",
        description: project.description || "",
        notes: project.notes || "",
      };
      setEditForm(initialForm);
      setOriginalForm(initialForm);
      setHasChanges(false);
    }
  }, [project]);

  const handleInputChange = (field: keyof EditFormData, value: string) => {
    setEditForm((prev) => {
      const newForm = { ...prev, [field]: value };
      // Check if any field differs from original
      if (originalForm) {
        const changed = Object.keys(newForm).some(
          (key) =>
            newForm[key as keyof EditFormData] !==
            originalForm[key as keyof EditFormData]
        );
        setHasChanges(changed);
      }
      return newForm;
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const updateData = {
        client_name: editForm.client_name || null,
        client_email: editForm.client_email || null,
        client_phone: editForm.client_phone || null,
        property_type: editForm.property_type || null,
        property_name: editForm.property_name || null,
        flat_number: editForm.flat_number || null,
        carpet_area_sqft: editForm.carpet_area_sqft
          ? parseFloat(editForm.carpet_area_sqft)
          : null,
        site_address: editForm.site_address || null,
        city: editForm.city || null,
        pincode: editForm.pincode || null,
        project_category: editForm.project_category || null,
        status: editForm.status || null,
        start_date: editForm.start_date || null,
        expected_end_date: editForm.expected_end_date || null,
        quoted_amount: editForm.quoted_amount
          ? parseFloat(editForm.quoted_amount)
          : null,
        budget_amount: editForm.budget_amount
          ? parseFloat(editForm.budget_amount)
          : null,
        budget_range: editForm.budget_range || null,
        lead_source: editForm.lead_source || null,
        lead_source_detail: editForm.lead_source_detail || null,
        lead_won_date: editForm.lead_won_date || null,
        description: editForm.description || null,
        notes: editForm.notes || null,
      };

      // Use the parent's updateProject function if available
      if (onUpdate) {
        await onUpdate(updateData as Partial<Project>);
      } else {
        // Fallback to direct API call if no onUpdate provided
        const response = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update project");
        }
      }

      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original project values
    if (project) {
      setEditForm({
        client_name: project.client_name || "",
        client_email: project.client_email || "",
        client_phone: project.client_phone || "",
        property_type: project.property_type || "unknown",
        property_name: project.property_name || "",
        flat_number: project.flat_number || "",
        carpet_area_sqft: project.carpet_area_sqft?.toString() || "",
        site_address: project.site_address || "",
        city: project.city || "",
        pincode: project.pincode || "",
        project_category: project.project_category || "turnkey",
        status: project.status || "planning",
        start_date: project.start_date ? project.start_date.split("T")[0] : "",
        expected_end_date: project.expected_end_date
          ? project.expected_end_date.split("T")[0]
          : "",
        quoted_amount: project.quoted_amount?.toString() || "",
        budget_amount: project.budget_amount?.toString() || "",
        budget_range: project.budget_range || "",
        lead_source: project.lead_source || "",
        lead_source_detail: project.lead_source_detail || "",
        lead_won_date: project.lead_won_date
          ? project.lead_won_date.split("T")[0]
          : "",
        description: project.description || "",
        notes: project.notes || "",
      });
    }
    setIsEditing(false);
    setError(null);
    setHasChanges(false);
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getPropertyTypeLabel = (value: string | undefined) => {
    if (!value) return "—";
    const option = propertyTypeOptions.find((opt) => opt.value === value);
    return option?.label || value;
  };

  const getProjectCategoryLabel = (value: string | undefined) => {
    if (!value) return "—";
    const option = projectCategoryOptions.find((opt) => opt.value === value);
    return option?.label || value;
  };

  const getBudgetRangeLabel = (value: string | undefined) => {
    if (!value) return "—";
    const option = budgetRangeOptions.find((opt) => opt.value === value);
    return option?.label || value;
  };

  const getLeadSourceLabel = (value: string | undefined) => {
    if (!value) return "—";
    const option = leadSourceOptions.find((opt) => opt.value === value);
    return option?.label || value;
  };

  const getStatusLabel = (value: string | undefined) => {
    if (!value) return "—";
    const option = projectStatusOptions.find((opt) => opt.value === value);
    return option?.label || value;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: "bg-blue-100 text-blue-800",
      design: "bg-purple-100 text-purple-800",
      procurement: "bg-orange-100 text-orange-800",
      execution: "bg-yellow-100 text-yellow-800",
      finishing: "bg-teal-100 text-teal-800",
      handover: "bg-indigo-100 text-indigo-800",
      completed: "bg-green-100 text-green-800",
      on_hold: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  // Render field - shows input in edit mode, display value otherwise
  const renderField = (
    label: string,
    value: string,
    field: keyof EditFormData,
    icon: React.ReactNode,
    type:
      | "text"
      | "email"
      | "tel"
      | "number"
      | "date"
      | "select"
      | "textarea" = "text",
    options?: { value: string; label: string }[]
  ) => {
    if (isEditing) {
      return (
        <div className="space-y-2 py-1">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            {icon}
            {label}
          </label>
          {type === "select" && options ? (
            <select
              value={editForm[field]}
              onChange={(e) => handleInputChange(field, e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select...</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : type === "textarea" ? (
            <textarea
              value={editForm[field]}
              onChange={(e) => handleInputChange(field, e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          ) : (
            <input
              type={type}
              value={editForm[field]}
              onChange={(e) => handleInputChange(field, e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}
        </div>
      );
    }

    return (
      <div className="flex items-start justify-between py-1.5 gap-2">
        <span className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
          {icon}
          {label}
        </span>
        <span className="text-sm font-medium text-slate-900 text-right">
          {value || "—"}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Edit Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Project Overview
        </h2>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  hasChanges
                    ? "text-white bg-blue-600 hover:bg-blue-700"
                    : "text-slate-400 bg-slate-100 cursor-not-allowed"
                }`}
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit Details
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Column 1: Property Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
            <Home className="w-4 h-4 text-blue-500" />
            Property Details
          </h3>
          <div className="divide-y divide-slate-100">
            {renderField(
              "Property Type",
              getPropertyTypeLabel(project.property_type),
              "property_type",
              <Building2 className="w-3.5 h-3.5" />,
              "select",
              propertyTypeOptions
            )}
            {renderField(
              "Property Name",
              project.property_name || "—",
              "property_name",
              <Building2 className="w-3.5 h-3.5" />,
              "text"
            )}
            {renderField(
              "Flat/Unit Number",
              project.flat_number || "—",
              "flat_number",
              <Home className="w-3.5 h-3.5" />,
              "text"
            )}
            {renderField(
              "Carpet Area (sq.ft)",
              project.carpet_area_sqft?.toString() || "—",
              "carpet_area_sqft",
              <Target className="w-3.5 h-3.5" />,
              "number"
            )}
            <div className="pt-3 border-t border-slate-100">
              {renderField(
                "Site Address",
                project.site_address || "—",
                "site_address",
                <MapPin className="w-3.5 h-3.5" />,
                "text"
              )}
              {renderField(
                "City",
                project.city || "—",
                "city",
                <MapPin className="w-3.5 h-3.5" />,
                "text"
              )}
              {renderField(
                "Pincode",
                project.pincode || "—",
                "pincode",
                <MapPin className="w-3.5 h-3.5" />,
                "text"
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Project Classification & Financials */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
            <Briefcase className="w-4 h-4 text-blue-500" />
            Project Classification
          </h3>
          <div className="divide-y divide-slate-100">
            {renderField(
              "Project Category",
              getProjectCategoryLabel(project.project_category),
              "project_category",
              <Briefcase className="w-3.5 h-3.5" />,
              "select",
              projectCategoryOptions
            )}
            {renderField(
              "Budget Range",
              getBudgetRangeLabel(project.budget_range),
              "budget_range",
              <DollarSign className="w-3.5 h-3.5" />,
              "select",
              budgetRangeOptions
            )}
            <div className="pt-3 border-t border-slate-100">
              <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-3">
                <DollarSign className="w-3.5 h-3.5 text-green-500" />
                Financials
              </h4>
              {renderField(
                "Quoted Amount",
                formatCurrency(project.quoted_amount),
                "quoted_amount",
                <TrendingUp className="w-3.5 h-3.5" />,
                "number"
              )}
              {renderField(
                "Budget Amount",
                formatCurrency(project.budget_amount),
                "budget_amount",
                <DollarSign className="w-3.5 h-3.5" />,
                "number"
              )}
              {!isEditing && (
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <DollarSign className="w-3.5 h-3.5" />
                    Actual Cost
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {formatCurrency(project.actual_cost)}
                  </p>
                </div>
              )}
            </div>
            <div className="pt-3 border-t border-slate-100">
              <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-3">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Timeline
              </h4>
              {renderField(
                "Start Date",
                formatDate(project.start_date),
                "start_date",
                <Calendar className="w-3.5 h-3.5" />,
                "date"
              )}
              {renderField(
                "Expected End Date",
                formatDate(project.expected_end_date),
                "expected_end_date",
                <Clock className="w-3.5 h-3.5" />,
                "date"
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Client & Lead Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
            <User className="w-4 h-4 text-blue-500" />
            Client Information
          </h3>
          <div className="divide-y divide-slate-100">
            {renderField(
              "Client Name",
              project.client_name || "—",
              "client_name",
              <User className="w-3.5 h-3.5" />,
              "text"
            )}
            {renderField(
              "Email",
              project.client_email || "—",
              "client_email",
              <Mail className="w-3.5 h-3.5" />,
              "email"
            )}
            {renderField(
              "Phone",
              project.client_phone || "—",
              "client_phone",
              <Phone className="w-3.5 h-3.5" />,
              "tel"
            )}
            <div className="pt-3 border-t border-slate-100">
              <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-3">
                <Target className="w-3.5 h-3.5 text-orange-500" />
                Lead Tracking
              </h4>
              {renderField(
                "Lead Source",
                getLeadSourceLabel(project.lead_source),
                "lead_source",
                <Target className="w-3.5 h-3.5" />,
                "select",
                leadSourceOptions
              )}
              {renderField(
                "Source Detail",
                project.lead_source_detail || "—",
                "lead_source_detail",
                <FileText className="w-3.5 h-3.5" />,
                "text"
              )}
              {renderField(
                "Lead Won Date",
                formatDate(project.lead_won_date),
                "lead_won_date",
                <Calendar className="w-3.5 h-3.5" />,
                "date"
              )}
              {!isEditing && project.sales_rep_id && (
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <User className="w-3.5 h-3.5" />
                    Sales Representative
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {project.project_manager?.name || "Assigned"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description & Notes Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
            <FileText className="w-4 h-4 text-blue-500" />
            Project Description
          </h3>
          {isEditing ? (
            <textarea
              value={editForm.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={4}
              placeholder="Add project description..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          ) : (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">
              {project.description || "No description added."}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
            <FileText className="w-4 h-4 text-blue-500" />
            Internal Notes
          </h3>
          {isEditing ? (
            <textarea
              value={editForm.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              rows={4}
              placeholder="Add internal notes..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          ) : (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">
              {project.notes || "No notes added."}
            </p>
          )}
        </div>
      </div>

      {/* Project Meta Information */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500">
          <span>
            <strong>Project Number:</strong> {project.project_number}
          </span>
          <span>
            <strong>Created:</strong> {formatDate(project.created_at)}
          </span>
          <span>
            <strong>Last Updated:</strong> {formatDate(project.updated_at)}
          </span>
          {project.converted_from_lead_id && (
            <span className="text-blue-600">
              <strong>Converted from Lead</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectOverviewTab;

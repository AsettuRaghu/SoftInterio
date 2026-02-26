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
  Home,
  Briefcase,
  Target,
  Clock,
  FileText,
  TrendingUp,
  Building,
  Droplets,
  Wind,
  Maximize,
  Layers,
} from "lucide-react";
import { Project, ProjectPropertyType } from "@/types/projects";
import { EditProjectDetailsModal } from "./EditProjectDetailsModal";

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

// Budget range options (aligned with DB enum and UI requirements)
const budgetRangeOptions = [
  { value: "below_10l", label: "Below ₹10 Lakhs" },
  { value: "around_10l", label: "~₹10 Lakhs" },
  { value: "around_20l", label: "~₹20 Lakhs" },
  { value: "around_30l", label: "~₹30 Lakhs" },
  { value: "around_40l", label: "~₹40 Lakhs" },
  { value: "around_50l", label: "~₹50 Lakhs" },
  { value: "above_50l", label: "₹50+ Lakhs" },
  { value: "not_disclosed", label: "Not Disclosed" },
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
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

// Facing options (Enum in DB)
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

interface ProjectOverviewTabProps {
  project: Project;
  onUpdate?: (updates: Partial<Project>) => Promise<void>;
  isFinanceUser?: boolean;
}

interface EditFormData {
  // Project Details
  description: string;
  notes: string;
  status: string;
  expected_start_date: string;
  expected_end_date: string;
  project_category: string;
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

export function ProjectOverviewTab({
  project,
  onUpdate,
  isFinanceUser = false,
}: ProjectOverviewTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveModal = async (
    editForm: Parameters<typeof EditProjectDetailsModal>[0]["onSave"] extends (
      data: infer T,
    ) => Promise<void>
      ? T
      : never,
  ) => {
    try {
      setIsSaving(true);

      const updateData: any = {
        // Project Details
        project_category: editForm.project_category || null,
        description: editForm.description || null,
        notes: editForm.notes || null,
        expected_start_date: editForm.expected_start_date || null,
        expected_end_date: editForm.expected_end_date || null,
        // Client Information
        client_name: editForm.client_name || null,
        client_email: editForm.client_email || null,
        client_phone: editForm.client_phone || null,
        // Property Information
        property_name: editForm.property_name || null,
        property_type: editForm.property_type || null,
        flat_number: editForm.flat_number || null,
        carpet_area_sqft: editForm.carpet_area_sqft
          ? parseInt(editForm.carpet_area_sqft)
          : null,
        site_address: editForm.site_address || null,
        city: editForm.city || null,
        pincode: editForm.pincode || null,
        block_tower: editForm.block_tower || null,
        built_up_area: editForm.built_up_area
          ? parseInt(editForm.built_up_area)
          : null,
        super_built_up_area: editForm.super_built_up_area
          ? parseInt(editForm.super_built_up_area)
          : null,
        bedrooms: editForm.bedrooms ? parseInt(editForm.bedrooms) : null,
        bathrooms: editForm.bathrooms ? parseInt(editForm.bathrooms) : null,
        balconies: editForm.balconies ? parseInt(editForm.balconies) : null,
        floor_number: editForm.floor_number || null,
        total_floors: editForm.total_floors
          ? parseInt(editForm.total_floors)
          : null,
        facing: editForm.facing || null,
        furnishing_status: editForm.furnishing_status || null,
        parking_slots: editForm.parking_slots
          ? parseInt(editForm.parking_slots)
          : null,
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
    } finally {
      setIsSaving(false);
    }
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

  const formatLabel = (value: string | undefined | null) => {
    if (!value) return "—";
    // First try to find in specific options map if passed (not generic here, but used in specific getters)
    // If not found or no map, convert snake_case to Title Case
    return value
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getPropertyTypeLabel = (value: string | undefined) => {
    if (!value) return "—";
    const option = propertyTypeOptions.find((opt) => opt.value === value);
    return option?.label || formatLabel(value);
  };

  const getProjectCategoryLabel = (value: string | undefined) => {
    if (!value) return "—";
    const option = projectCategoryOptions.find((opt) => opt.value === value);
    return option?.label || formatLabel(value);
  };

  const getBudgetRangeLabel = (value: string | undefined) => {
    if (!value) return "—";
    const option = budgetRangeOptions.find((opt) => opt.value === value);
    return option?.label || formatLabel(value);
  };

  const getLeadSourceLabel = (value: string | undefined) => {
    if (!value) return "—";
    const option = leadSourceOptions.find((opt) => opt.value === value);
    return option?.label || formatLabel(value);
  };

  const getStatusLabel = (value: string | undefined) => {
    if (!value) return "—";
    const option = projectStatusOptions.find((opt) => opt.value === value);
    return option?.label || formatLabel(value);
  };

  const getFacingLabel = (value: string | undefined) => {
    if (!value) return "—";
    const option = facingOptions.find((opt) => opt.value === value);
    return option?.label || formatLabel(value);
  };

  const getFurnishingLabel = (value: string | undefined) => {
    if (!value) return "—";
    const option = furnishingOptions.find((opt) => opt.value === value);
    return option?.label || formatLabel(value);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-100 text-blue-800",
      in_progress: "bg-yellow-100 text-yellow-800",
      on_hold: "bg-gray-100 text-gray-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  // Render read-only field for display purposes
  const renderReadOnlyField = (
    label: string,
    value: React.ReactNode,
    icon: React.ReactNode,
  ) => (
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

  return (
    <div className="space-y-6">
      {/* Modal for editing */}
      <EditProjectDetailsModal
        isOpen={isModalOpen}
        project={project}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModal}
        isSaving={isSaving}
      />

      {/* Edit Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
        >
          <Edit2 className="inline w-4 h-4 mr-1" />
          Edit Details
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* CLIENT INFORMATION */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                Client Information
              </h3>
              {project.client ? (
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">Name</dt>
                    <dd className="text-sm font-medium text-slate-900">
                      {project.client.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">Email</dt>
                    <dd className="text-sm text-slate-700">
                      {project.client.email || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">Phone</dt>
                    <dd className="text-sm text-slate-700">
                      {project.client.phone || "—"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-slate-500">No client linked</p>
              )}
            </div>

            {/* PROPERTY INFORMATION */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                Property Information
              </h3>
              {project.property ? (
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">Type</dt>
                    <dd className="text-sm font-medium text-slate-900">
                      {getPropertyTypeLabel(project.property.property_type)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">
                      Property Name
                    </dt>
                    <dd className="text-sm text-slate-700">
                      {project.property.property_name || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">Unit</dt>
                    <dd className="text-sm text-slate-700">
                      {project.property.unit_number || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">
                      Configuration
                    </dt>
                    <dd className="text-sm text-slate-700">
                      {[
                        project.property.bedrooms &&
                          `${project.property.bedrooms} BHK`,
                        project.property.carpet_area &&
                          `${project.property.carpet_area} sqft`,
                      ]
                        .filter(Boolean)
                        .join(" • ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">Location</dt>
                    <dd className="text-sm text-slate-700">
                      {[project.property.city, project.property.pincode]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-slate-500">No property linked</p>
              )}
            </div>

            {/* LEAD INFORMATION */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                Lead Information
              </h3>
              {project.lead ? (
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">Lead Number</dt>
                    <dd className="text-sm font-medium text-slate-900">
                      <a
                        href={`/dashboard/sales/leads/${project.lead.id}`}
                        className="text-blue-600 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {project.lead.lead_number || "—"}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">
                      Service Type
                    </dt>
                    <dd className="text-sm text-slate-700">
                      {project.lead.service_type
                        ?.replace("_", " ")
                        .split(" ")
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(" ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">Source</dt>
                    <dd className="text-sm text-slate-700">
                      {getLeadSourceLabel(project.lead.lead_source)}
                    </dd>
                  </div>
                  {project.lead.won_amount && (
                    <div>
                      <dt className="text-xs text-slate-500 mb-1">
                        Won Amount
                      </dt>
                      <dd className="text-sm font-semibold text-green-700">
                        {formatCurrency(project.lead.won_amount)}
                      </dd>
                    </div>
                  )}
                  {project.lead.budget_range && (
                    <div>
                      <dt className="text-xs text-slate-500 mb-1">Budget</dt>
                      <dd className="text-sm text-slate-700">
                        {getBudgetRangeLabel(project.lead.budget_range)}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-slate-500">No lead linked</p>
              )}
            </div>
          </div>

          {/* PROJECT DETAILS */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div>
                <dt className="text-xs text-slate-500 mb-1">Status</dt>
                <dd>
                  <span
                    className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-md ${getStatusColor(
                      project.status,
                    )}`}
                  >
                    {formatLabel(project.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 mb-1">Category</dt>
                <dd className="text-sm font-medium text-slate-900">
                  {getProjectCategoryLabel(project.project_category)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 mb-1">Start Date</dt>
                <dd className="text-sm text-slate-700">
                  {formatDate(project.expected_start_date)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 mb-1">Expected End</dt>
                <dd className="text-sm text-slate-700">
                  {formatDate(project.expected_end_date)}
                </dd>
              </div>
            </div>

            {(project.description || project.notes) && (
              <div className="space-y-4">
                {project.description && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-600 mb-2">
                      Description
                    </h4>
                    <p className="text-sm text-slate-700">
                      {project.description}
                    </p>
                  </div>
                )}
                {project.notes && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-600 mb-2">
                      Notes
                    </h4>
                    <p className="text-sm text-slate-700">{project.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectOverviewTab;

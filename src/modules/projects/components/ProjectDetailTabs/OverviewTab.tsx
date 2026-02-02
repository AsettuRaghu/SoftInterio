"use client";

import Link from "next/link";
import { Project } from "@/types/projects";
import {
  ProjectCategoryLabels,
  ProjectPropertyTypeLabels,
  ProjectStatusLabels,
} from "@/types/projects";
import { ServiceTypeLabels } from "@/types/leads";
import { formatCurrency, formatDate } from "@/modules/projects/utils";
import { EditProjectDetailsModal } from "@/components/projects/EditProjectDetailsModal";

interface OverviewTabProps {
  project: Project;
  isModalOpen?: boolean;
  onModalClose?: () => void;
}

export default function OverviewTab({
  project,
  isModalOpen = false,
  onModalClose,
}: OverviewTabProps) {
  const handleSaveModal = async (
    editForm: Parameters<typeof EditProjectDetailsModal>[0]["onSave"] extends (
      data: infer T
    ) => Promise<void>
      ? T
      : never
  ) => {
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

    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to update project");
    }

    // Close modal and reload
    onModalClose?.();
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      {/* Modal for editing */}
      <EditProjectDetailsModal
        isOpen={isModalOpen}
        project={project}
        onClose={onModalClose || (() => {})}
        onSave={handleSaveModal}
        isSaving={false}
      />

      {/* CLIENT DETAILS BLOCK */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-linear-to-r from-blue-50 to-blue-50 px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-blue-500 text-white flex items-center justify-center">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
              </svg>
            </div>
            Client Details
          </h3>
        </div>
        <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Name</span> :{" "}
              {project.client_name || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Phone</span> :{" "}
              {project.client_phone || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900 break-all">
              <span className="text-slate-500">Email</span> :{" "}
              {project.client_email || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* PROPERTY DETAILS BLOCK */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-linear-to-r from-purple-50 to-purple-50 px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-purple-500 text-white flex items-center justify-center">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.5 1.5H5.75A2.25 2.25 0 003.5 3.75v12.5A2.25 2.25 0 005.75 18.5h8.5a2.25 2.25 0 002.25-2.25V6.5m-10-3v3m6-3v3m-8 7h10" />
              </svg>
            </div>
            Property Details
          </h3>
        </div>
        <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Property</span> :{" "}
              {project.property_name || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Type</span> :{" "}
              {project.property?.property_type
                ? ProjectPropertyTypeLabels[
                    project.property
                      .property_type as keyof typeof ProjectPropertyTypeLabels
                  ] || "—"
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Area</span> :{" "}
              {project.property?.carpet_area
                ? `${project.property.carpet_area.toLocaleString()} sq.ft`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Unit Number</span> :{" "}
              {project.property?.unit_number || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Property Subtype</span> :{" "}
              {project.property?.property_subtype || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">City</span> :{" "}
              {project.property?.city || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Pincode</span> :{" "}
              {project.property?.pincode || "—"}
            </p>
          </div>
          <div className="lg:col-span-3">
            <p className="text-sm font-medium text-slate-900 break-word">
              <span className="text-slate-500">Address</span> :{" "}
              {project.property?.address_line1 || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* PROJECT DETAILS BLOCK */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-linear-to-r from-green-50 to-green-50 px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-green-500 text-white flex items-center justify-center">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 3.062v6.018a1 1 0 01-.5.866v3.026a1 1 0 01-1 1h-2a1 1 0 01-1-1v-1h-2v1a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3.026a1 1 0 01-.5-.866V6.517A3.066 3.066 0 016.267 3.455z"
                />
              </svg>
            </div>
            Project Details
          </h3>
        </div>
        <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Project Number</span> :{" "}
              {project.project_number || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Category</span> :{" "}
              {project.project_category
                ? ProjectCategoryLabels[
                    project.project_category as keyof typeof ProjectCategoryLabels
                  ]
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Status</span> :{" "}
              {project.status
                ? ProjectStatusLabels[
                    project.status as keyof typeof ProjectStatusLabels
                  ]
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Priority</span> :{" "}
              <span className="capitalize">{project.priority || "—"}</span>
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Current Phase</span> :{" "}
              {project.current_phase || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Project Manager</span> :{" "}
              {project.project_manager?.name || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Start Date</span> :{" "}
              {project.expected_start_date
                ? formatDate(project.expected_start_date)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Expected End Date</span> :{" "}
              {project.expected_end_date
                ? formatDate(project.expected_end_date)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Actual End Date</span> :{" "}
              {project.actual_end_date
                ? formatDate(project.actual_end_date)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Quoted Amount</span> :{" "}
              {project.quoted_amount
                ? formatCurrency(project.quoted_amount)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Actual Cost</span> :{" "}
              {project.actual_cost ? formatCurrency(project.actual_cost) : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Won Amount</span> :{" "}
              {project.won_amount ? formatCurrency(project.won_amount) : "—"}
            </p>
          </div>

          {/* Separator Line */}
          <div className="lg:col-span-3 border-t border-slate-200 pt-4 mt-2"></div>

          {/* Additional Details */}
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Created At</span> :{" "}
              {project.created_at ? formatDate(project.created_at) : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Updated At</span> :{" "}
              {project.updated_at ? formatDate(project.updated_at) : "—"}
            </p>
          </div>
          {project.lead_id && (
            <div>
              <p className="text-sm font-medium text-slate-900">
                <span className="text-slate-500">Linked Lead</span> :{" "}
                <Link
                  href={`/dashboard/sales/leads/${project.lead_id}`}
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  {project.lead?.lead_number || "View Lead"}
                </Link>
              </p>
            </div>
          )}
          {project.description && (
            <div className="lg:col-span-3">
              <p className="text-sm font-medium text-slate-900">
                <span className="text-slate-500">Description</span> :{" "}
                {project.description}
              </p>
            </div>
          )}
          {project.notes && (
            <div className="lg:col-span-3">
              <p className="text-sm font-medium text-slate-900">
                <span className="text-slate-500">Notes</span> : {project.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

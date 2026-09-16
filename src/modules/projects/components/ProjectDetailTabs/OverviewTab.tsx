"use client";

import { useState } from "react";
import Link from "next/link";
import { Project } from "@/types/projects";
import {
  ProjectCategoryLabels,
  ProjectPropertyTypeLabels,
  ProjectStatusLabels,
} from "@/types/projects";
import { formatCurrency, formatDate } from "@/modules/projects/utils";
import { EditProjectDetailsModal } from "@/components/projects/EditProjectDetailsModal";

interface OverviewTabProps {
  project: Project;
  isModalOpen?: boolean;
  onModalClose?: () => void;
  onUpdate?: (updates: Partial<Project>) => Promise<void>;
  /** Who may be named project manager. The page already loads these. */
  teamMembers?: { id: string; name: string; email?: string }[];
  /** Confirm the save on the page behind, once the dialog has closed. */
  onSaved?: (message: string) => void;
}

export default function OverviewTab({
  project,
  isModalOpen = false,
  onModalClose,
  onUpdate,
  teamMembers = [],
  onSaved,
}: OverviewTabProps) {
  /*
   * The dialog has always rendered "Saving..." and disabled its button off this
   * flag - and this component passed `isSaving={false}` as a literal, so it never
   * moved. Pressing Save Changes looked like pressing nothing for the second or
   * so the PATCH and the refetch took, which is why it felt as though nothing
   * had been saved.
   */
  const [isSaving, setIsSaving] = useState(false);
  const handleSaveModal = async (
    editForm: Parameters<typeof EditProjectDetailsModal>[0]["onSave"] extends (
      data: infer T,
    ) => Promise<void>
      ? T
      : never,
  ) => {
    const updateData: Record<string, unknown> = {
      /*
       * Project details.
       *
       * `name` and `status` were collected by the modal and left out of this
       * payload, so editing either did nothing at all - the dialog's own comment
       * says they were moved here "so one dialog covers the whole record", and
       * then they were dropped on the way to the server.
       *
       * `priority` and `project_manager_id` are new. Both were shown on this tab
       * and editable nowhere, which is why a project converted from a lead kept
       * "No project manager" forever. The PATCH route has accepted both all
       * along.
       */
      name: editForm.name || null,
      status: editForm.status || null,
      priority: editForm.priority || null,
      project_manager_id: editForm.project_manager_id || null,
      project_category: editForm.project_category || null,
      description: editForm.description || null,
      notes: editForm.notes || null,
      expected_start_date: editForm.expected_start_date || null,
      expected_end_date: editForm.expected_end_date || null,
      // Client Information
      client_name: editForm.client_name || null,
      client_email: editForm.client_email || null,
      client_phone: editForm.client_phone || null,
      // Property Information. The ten "extended" fields - built-up area,
      // bedrooms, facing, parking and the rest - were removed with the block
      // that collected them; nothing on this page displayed them.
      property_name: editForm.property_name || null,
      property_type: editForm.property_type || null,
      flat_number: editForm.flat_number || null,
      carpet_area_sqft: editForm.carpet_area_sqft
        ? parseInt(editForm.carpet_area_sqft)
        : null,
      site_address: editForm.site_address || null,
      city: editForm.city || null,
      pincode: editForm.pincode || null,
      /*
       * The two the lead also edits. `properties.category` is what the lead
       * calls property_category; the route maps the name.
       *
       * `block_tower` used to be here and is gone: there is no such column on
       * `properties`, and PostgREST rejects a whole UPDATE for one unknown
       * column - so sending it refused every property edit made from a project,
       * and the route logged the error and carried on.
       */
      property_category: editForm.property_category || null,
      property_subtype: editForm.property_subtype || null,
    };

    /*
     * Through the page's own updater, which PATCHes and then refetches quietly.
     * This used to do its own fetch and finish with window.location.reload() -
     * a full page load to show a changed field, which also threw away whichever
     * tab and scroll position the person was on.
     *
     * The flag is cleared in a `finally`, and the throw is deliberately not
     * caught: the dialog is waiting on this promise and turns a rejection into
     * its own error line. Swallowing it here would close the dialog on a failed
     * save.
     */
    setIsSaving(true);
    try {
      if (onUpdate) {
        await onUpdate(updateData as Partial<Project>);
      } else {
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

    /*
     * The dialog closes itself once this resolves, which lands the person back on
     * the Overview tab looking at what they just changed. The confirmation is
     * raised there rather than in the dialog, because the dialog is gone by then
     * and a save nobody sees confirmed is a save nobody trusts.
     */
    onSaved?.("Project updated.");
  };

  return (
    <div className="space-y-4">
      {/* Modal for editing */}
      <EditProjectDetailsModal
        isOpen={isModalOpen}
        project={project}
        teamMembers={teamMembers}
        onClose={onModalClose || (() => {})}
        onSave={handleSaveModal}
        isSaving={isSaving}
      />

      {/* CLIENT DETAILS BLOCK */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
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
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
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
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
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
              <span className="text-slate-500">Service Type</span> :{" "}
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
          {/*
            * Where the client came from. `lead_source` has no column on
            * `projects`, so it is read from the lead and read-only.
            *
            * The Service row that used to sit here has gone: `project_category`
            * above IS the service type, carried from the lead at conversion, and
            * showing both meant one screen displaying the same fact twice under
            * two names.
            */}
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Source</span> :{" "}
              {project.lead?.lead_source
                ? project.lead.lead_source
                    .split("_")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Project Manager</span> :{" "}
              {project.project_manager?.name || "—"}
            </p>
          </div>
          {/* Three sets of dates, named for what they are. "Promised at sale"
              is what Sales told the client and never moves; "Agreed plan" is
              what the PM committed to at kick-off; "Current plan" is where
              the steps stand today. Until kick-off there is only the promise. */}
          {project.kicked_off_at ? (
            <>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  <span className="text-slate-500">Promised at sale</span> :{" "}
                  {project.committed_start_date ? formatDate(project.committed_start_date) : "—"}
                  {" → "}
                  {project.committed_end_date ? formatDate(project.committed_end_date) : "—"}
                </p>
              </div>
              {project.agreed_plan && (
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    <span className="text-slate-500">Agreed plan v{project.agreed_plan.version}</span> :{" "}
                    {project.agreed_plan.start ? formatDate(project.agreed_plan.start) : "—"}
                    {" → "}
                    {project.agreed_plan.end ? formatDate(project.agreed_plan.end) : "—"}
                    <span className="text-xs text-slate-400"> (set {formatDate(project.agreed_plan.set_at)})</span>
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-slate-900">
                  <span className="text-slate-500">Current plan</span> :{" "}
                  {project.expected_start_date ? formatDate(project.expected_start_date) : "—"}
                  {" → "}
                  {project.expected_end_date ? formatDate(project.expected_end_date) : "—"}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  <span className="text-slate-500">Planned start</span> :{" "}
                  {project.expected_start_date ? formatDate(project.expected_start_date) : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  <span className="text-slate-500">Planned end</span> :{" "}
                  {project.expected_end_date ? formatDate(project.expected_end_date) : "—"}
                </p>
              </div>
            </>
          )}
          <div>
            <p className="text-sm font-medium text-slate-900">
              {/* The column has always existed and was displayed nowhere, so a
                  project that had started looked as though it had not. */}
              <span className="text-slate-500">Actual Start Date</span> :{" "}
              {project.actual_start_date
                ? formatDate(project.actual_start_date)
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
              <span className="text-slate-500">Contract Value</span> :{" "}
              {project.contract_value
                ? formatCurrency(project.contract_value)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Actual Cost</span> :{" "}
              {project.actual_cost ? formatCurrency(project.actual_cost) : "—"}
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

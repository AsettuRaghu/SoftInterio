"use client";

import { Lead } from "@/types/leads";
import {
  PropertyCategoryLabels,
  PropertyTypeLabels,
  PropertySubtypeLabels,
  ServiceTypeLabels,
  LeadSourceLabels,
  BudgetRangeLabels,
} from "@/types/leads";
import { formatCurrency, formatDate } from "@/modules/sales/utils/formatters";
import { LeadActivity } from "@/types/leads";

interface OverviewTabProps {
  lead: Lead;
  activities: LeadActivity[];
  leadClosed: boolean;
  onEditClick: () => void;
  onAddMeetingClick: () => void;
  formatDateTime: (date: string) => string;
}

export default function OverviewTab({ lead }: OverviewTabProps) {
  return (
    <div className="space-y-4">
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
              {lead.client?.name || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Phone</span> :{" "}
              {lead.client?.phone || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900 break-all">
              <span className="text-slate-500">Email</span> :{" "}
              {lead.client?.email || "—"}
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
              {lead.property?.property_name || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Unit</span> :{" "}
              {lead.property?.unit_number || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Category</span> :{" "}
              {lead.property?.category
                ? PropertyCategoryLabels[lead.property.category]
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Type</span> :{" "}
              {lead.property?.property_type
                ? PropertyTypeLabels[lead.property.property_type]
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Community</span> :{" "}
              {lead.property?.property_subtype
                ? PropertySubtypeLabels[lead.property.property_subtype]
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Area</span> :{" "}
              {lead.property?.carpet_area
                ? `${lead.property.carpet_area.toLocaleString()} sq.ft`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">City</span> :{" "}
              {lead.property?.city || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Pincode</span> :{" "}
              {lead.property?.pincode || "—"}
            </p>
          </div>
          <div className="lg:col-span-3">
            <p className="text-sm font-medium text-slate-900 break-word">
              <span className="text-slate-500">Address</span> :{" "}
              {lead.property?.address_line1 || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* LEAD DETAILS BLOCK */}
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
            Lead Details
          </h3>
        </div>
        <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Service</span> :{" "}
              {lead.service_type ? ServiceTypeLabels[lead.service_type] : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Source</span> :{" "}
              {lead.lead_source ? LeadSourceLabels[lead.lead_source] : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Stage</span> :{" "}
              <span className="capitalize">{lead.stage || "—"}</span>
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Priority</span> :{" "}
              <span className="capitalize">{lead.priority || "—"}</span>
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Budget</span> :{" "}
              {lead.budget_range ? BudgetRangeLabels[lead.budget_range] : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Expected Start Date</span> :{" "}
              {lead.target_start_date
                ? formatDate(lead.target_start_date)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Expected End Date</span> :{" "}
              {lead.target_end_date ? formatDate(lead.target_end_date) : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Assigned To</span> :{" "}
              {lead.assigned_user?.name || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Created By</span> :{" "}
              {lead.created_user?.name || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Created At</span> :{" "}
              {lead.created_at ? formatDate(lead.created_at) : "—"}
            </p>
          </div>

          {/* Separator Line */}
          <div className="lg:col-span-3 border-t border-slate-200 pt-4 mt-2"></div>

          {/* Additional Details */}
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Won Amount</span> :{" "}
              {lead.won_amount ? formatCurrency(lead.won_amount) : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Contract Signed Date</span> :{" "}
              {lead.contract_signed_date
                ? formatDate(lead.contract_signed_date)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">
                Projected Project Start Date
              </span>{" "}
              :{" "}
              {lead.expected_project_start
                ? formatDate(lead.expected_project_start)
                : "—"}
            </p>
          </div>
          <div className="lg:col-span-3">
            <p className="text-sm font-medium text-slate-900">
              <span className="text-slate-500">Project</span> :{" "}
              {lead.project?.name || "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

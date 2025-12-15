"use client";

import React, { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface Lead {
  id: string;
  lead_number: string;
  stage: string;
  client_name?: string;
  property_name?: string;
  client?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  property?: {
    id: string;
    property_name?: string;
    unit_number?: string;
  };
}

interface Project {
  id: string;
  project_number: string;
  name: string;
  client_name?: string;
  status: string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  spaces_count?: number;
  components_count?: number;
}

interface CreateQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    source: "lead" | "project" | "standalone";
    leadId?: string;
    projectId?: string;
    templateId?: string;
  }) => Promise<void>;
  leads: Lead[];
  projects: Project[];
  templates: Template[];
  isLoading?: boolean;
  isCreating?: boolean;
}

export function CreateQuotationModal({
  isOpen,
  onClose,
  onCreate,
  leads,
  projects,
  templates,
  isLoading = false,
  isCreating = false,
}: CreateQuotationModalProps) {
  const [source, setSource] = useState<"lead" | "project" | "standalone">(
    "lead"
  );
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (source === "lead" && !selectedLeadId) {
      alert("Please select a lead");
      return;
    }
    if (source === "project" && !selectedProjectId) {
      alert("Please select a project");
      return;
    }

    try {
      await onCreate({
        source,
        leadId: selectedLeadId || undefined,
        projectId: selectedProjectId || undefined,
        templateId: selectedTemplateId || undefined,
      });
      // Reset form
      setSource("lead");
      setSelectedLeadId("");
      setSelectedProjectId("");
      setSelectedTemplateId("");
    } catch (error) {
      console.error("Error creating quotation:", error);
    }
  };

  const isDisabled =
    isCreating ||
    (source === "lead" && !selectedLeadId) ||
    (source === "project" && !selectedProjectId) ||
    (source === "standalone" && isLoading);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">
              Create New Quotation
            </h3>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {isLoading ? (
              <div className="py-8 text-center text-slate-500">Loading...</div>
            ) : (
              <>
                {/* Source Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Create quotation for
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSource("lead");
                        setSelectedProjectId("");
                      }}
                      className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        source === "lead"
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Lead
                    </button>
                    <button
                      onClick={() => {
                        setSource("project");
                        setSelectedLeadId("");
                      }}
                      className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        source === "project"
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Project
                    </button>
                    <button
                      onClick={() => {
                        setSource("standalone");
                        setSelectedLeadId("");
                        setSelectedProjectId("");
                      }}
                      className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        source === "standalone"
                          ? "bg-slate-700 border-slate-700 text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Standalone
                    </button>
                  </div>
                </div>

                {/* Lead Selection */}
                {source === "lead" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Lead <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedLeadId}
                      onChange={(e) => setSelectedLeadId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    >
                      <option value="">Choose a lead...</option>
                      {leads.map((lead) => {
                        const clientName =
                          lead.client?.name || lead.client_name || "No client";
                        const propertyName =
                          lead.property?.property_name ||
                          lead.property?.unit_number ||
                          lead.property_name;
                        return (
                          <option key={lead.id} value={lead.id}>
                            {lead.lead_number} - {clientName}
                            {propertyName ? ` (${propertyName})` : ""}
                          </option>
                        );
                      })}
                    </select>
                    {leads.length === 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        No leads in Proposal Discussion or Negotiation stage
                      </p>
                    )}
                  </div>
                )}

                {/* Project Selection */}
                {source === "project" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Project <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    >
                      <option value="">Choose a project...</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.project_number} - {project.name}
                          {project.client_name
                            ? ` (${project.client_name})`
                            : ""}
                        </option>
                      ))}
                    </select>
                    {projects.length === 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        No projects in Execution stage
                      </p>
                    )}
                  </div>
                )}

                {/* Standalone Info */}
                {source === "standalone" && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">Standalone quotation</span>{" "}
                      — This quotation will not be linked to any lead or
                      project. You can add client and property details manually
                      in the quotation editor.
                    </p>
                  </div>
                )}

                {/* Template Selection (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Load from Template{" "}
                    <span className="text-slate-400 font-normal">
                      (optional)
                    </span>
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  >
                    <option value="">Start from scratch</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.spaces_count
                          ? ` (${template.spaces_count} spaces, ${
                              template.components_count || 0
                            } components)`
                          : ""}
                      </option>
                    ))}
                  </select>
                  {templates.length === 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      No templates available.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isDisabled}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Quotation"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

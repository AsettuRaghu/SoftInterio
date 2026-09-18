"use client";

import React, { useState } from "react";
import { KnownPartnerHint, type KnownPartner } from "@/components/partners/KnownPartnerHint";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { LeadStageLabels, type LeadStage } from "@/types/leads";
import { ProjectStatusLabels, type ProjectStatus } from "@/types/projects";

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
  property_name?: string | null;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  spaces_count?: number;
  components_count?: number;
}

/** One shape for both pickers: customer · number · property · where it stands. */
function entityLabel(customer: string, number: string, property?: string | null, standing?: string) {
  return [customer, number, property || null, standing || null].filter(Boolean).join(" · ");
}

interface CreateQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    source: "lead" | "project" | "standalone";
    leadId?: string;
    projectId?: string;
    templateId?: string;
    fromScope?: boolean;
    /** A standalone quotation's customer, typed here - or a partner we already know. */
    client?: { name: string; phone?: string; email?: string; address?: string; partner_id?: string };
    /** Optional. No expiry unless chosen. */
    validUntil?: string;
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
  // On by default: a lead that reached this point usually has its rooms listed,
  // and starting from them beats an empty quotation. A template overrides it,
  // since choosing one is a deliberate statement about contents.
  const [useScope, setUseScope] = useState(true);
  // Validation belongs beside the control it is about. An alert() for "pick a
  // lead" is an OS-level interruption for a field the person is looking at.
  const [validationError, setValidationError] = useState<string | null>(null);
  // The customer on a standalone quotation. A quotation holds only a
  // client_id, so without this a standalone one had no name to print.
  const [client, setClient] = useState({ name: "", phone: "", email: "", address: "" });
  const [knownPartner, setKnownPartner] = useState<KnownPartner | null>(null);
  const [validUntil, setValidUntil] = useState("");

  if (!isOpen) return null;

  const handleCreate = async () => {
    setValidationError(null);
    if (source === "lead" && !selectedLeadId) {
      setValidationError("Choose a lead before creating the quotation.");
      return;
    }
    if (source === "project" && !selectedProjectId) {
      setValidationError("Choose a project before creating the quotation.");
      return;
    }
    if (source === "standalone" && !client.name.trim()) {
      setValidationError("Give the customer's name - it is what the quotation is addressed to.");
      return;
    }

    try {
      await onCreate({
        source,
        leadId: selectedLeadId || undefined,
        projectId: selectedProjectId || undefined,
        templateId: selectedTemplateId || undefined,
        fromScope: useScope && !selectedTemplateId,
        validUntil: validUntil || undefined,
        client:
          source === "standalone"
            ? {
                name: client.name.trim(),
                phone: client.phone.trim() || undefined,
                email: client.email.trim() || undefined,
                address: client.address.trim() || undefined,
                partner_id: knownPartner?.id,
              }
            : undefined,
      });
      // Reset form
      setSource("lead");
      setSelectedLeadId("");
      setSelectedProjectId("");
      setSelectedTemplateId("");
      setUseScope(true);
      setClient({ name: "", phone: "", email: "", address: "" });
      setKnownPartner(null);
      setValidUntil("");
    } catch (error) {
      console.error("Error creating quotation:", error);
    }
  };

  const isDisabled =
    isCreating ||
    (source === "lead" && !selectedLeadId) ||
    (source === "project" && !selectedProjectId) ||
    (source === "standalone" && (isLoading || !client.name.trim()));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg transform transition-all overflow-hidden">
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
                      className="w-full max-w-full truncate px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    >
                      <option value="">Choose a lead...</option>
                      {leads.map((lead) => {
                        const clientName =
                          lead.client?.name || lead.client_name || "No client";
                        const propertyName =
                          lead.property?.property_name ||
                          lead.property?.unit_number ||
                          lead.property_name;
                        // The customer first - that is how the team knows
                        // the work - then the number, the property and
                        // where the lead stands.
                        const stage = LeadStageLabels[lead.stage as LeadStage] ?? lead.stage;
                        return (
                          <option key={lead.id} value={lead.id}>
                            {entityLabel(clientName, lead.lead_number, propertyName, stage)}
                          </option>
                        );
                      })}
                    </select>
                    {leads.length === 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        No leads at the Proposal & Negotiation stage
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
                      className="w-full max-w-full truncate px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    >
                      <option value="">Choose a project...</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {entityLabel(
                            project.client_name || project.name,
                            project.project_number,
                            project.property_name === "Unknown Property" ? null : project.property_name,
                            ProjectStatusLabels[project.status as ProjectStatus] ?? project.status
                          )}
                        </option>
                      ))}
                    </select>
                    {projects.length === 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        No projects in progress or on hold
                      </p>
                    )}
                  </div>
                )}

                {/* Standalone: who it is for. Not linked to a lead or a
                    project - a vendor's quotation handed to the customer,
                    an accessory sold on its own. */}
                {source === "standalone" && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">
                      Not linked to a lead or project - it lives on this list. Who is it for?
                    </p>
                    <input
                      type="text"
                      value={client.name}
                      onChange={(e) => setClient((c) => ({ ...c, name: e.target.value }))}
                      placeholder="Customer name *"
                      autoFocus
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="tel"
                        value={client.phone}
                        onChange={(e) => setClient((c) => ({ ...c, phone: e.target.value }))}
                        placeholder="Phone"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                      <input
                        type="email"
                        value={client.email}
                        onChange={(e) => setClient((c) => ({ ...c, email: e.target.value }))}
                        placeholder="Email"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                    </div>
                    <KnownPartnerHint
                      phone={client.phone}
                      email={client.email}
                      chosen={knownPartner}
                      onChoose={(p) => {
                        setKnownPartner(p);
                        if (p) setClient((c) => ({ ...c, name: p.name, phone: p.phone ?? c.phone, email: p.email ?? c.email }));
                      }}
                    />
                    <input
                      type="text"
                      value={client.address}
                      onChange={(e) => setClient((c) => ({ ...c, address: e.target.value }))}
                      placeholder="Site address (optional)"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                  </div>
                )}

                {/* Validity - optional. A quotation has no expiry unless the
                    person raising it decides one. */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Valid until{" "}
                    <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={validUntil}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                    {validUntil ? (
                      <button type="button" onClick={() => setValidUntil("")} className="text-xs text-slate-500 hover:text-slate-800">
                        No expiry
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Leave blank for no expiry</span>
                    )}
                  </div>
                </div>

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
                    className="w-full max-w-full truncate px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
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

                {/* Only meaningful without a template, and only for a lead or
                    project - a standalone quotation has no property to read. */}
                {!selectedTemplateId && source !== "standalone" && (
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useScope}
                      onChange={(e) => setUseScope(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <span className="block text-sm text-slate-700">
                        Build from the Spaces tab
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        Creates the rooms and components already listed there,
                        with their measurements. You can change anything
                        afterwards without affecting the Spaces tab.
                      </span>
                    </span>
                  </label>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
            {validationError && (
              <p className="mr-auto text-sm text-red-600">{validationError}</p>
            )}
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

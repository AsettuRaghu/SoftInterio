"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Building2,
  User,
  Calendar,
  MapPin,
  LinkIcon,
  Search,
  Check,
  X,
} from "lucide-react";
import {
  ProjectCategory,
  ProjectType,
  PROJECT_CATEGORY_OPTIONS,
  PROJECT_TYPE_OPTIONS,
} from "@/types/projects";

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface WonLead {
  id: string;
  lead_number: string;
  client_name: string;
  phone: string;
  email: string;
  property_name: string | null;
  property_type: string;
  property_address: string | null;
  property_city: string | null;
  property_pincode: string | null;
  service_type: string | null;
  won_amount: number | null;
  expected_project_start: string | null;
  target_end_date: string | null;
  project_scope: string | null;
  project_id: string | null;
}

// Inner component that uses useSearchParams
function NewProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadIdParam = searchParams.get("lead_id");

  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [wonLeads, setWonLeads] = useState<WonLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [selectedLead, setSelectedLead] = useState<WonLead | null>(null);
  const [showLeadSelector, setShowLeadSelector] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [createMode, setCreateMode] = useState<"from_lead" | "manual">(
    leadIdParam ? "from_lead" : "manual"
  );

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    client_name: "",
    client_email: "",
    client_phone: "",
    site_address: "",
    city: "",
    state: "",
    pincode: "",
    project_type: "residential" as ProjectType,
    project_category: "turnkey" as ProjectCategory,
    start_date: "",
    expected_end_date: "",
    quoted_amount: "",
    budget_amount: "",
    project_manager_id: "",
    notes: "",
    initialize_phases: true,
    lead_id: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch team members and won leads
  useEffect(() => {
    fetchTeamMembers();
    fetchWonLeads();
  }, []);

  // Load lead from URL param
  useEffect(() => {
    if (leadIdParam && wonLeads.length > 0) {
      const lead = wonLeads.find((l) => l.id === leadIdParam);
      if (lead) {
        selectLead(lead);
      }
    }
  }, [leadIdParam, wonLeads]);

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch("/api/team");
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.members || []);
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

  const fetchWonLeads = async () => {
    setLoadingLeads(true);
    try {
      // Fetch won leads that don't have a project yet
      const response = await fetch("/api/sales/leads?stage=won&limit=100");
      if (response.ok) {
        const data = await response.json();
        // Filter leads that don't have a project yet
        const leadsWithoutProject = (data.leads || []).filter(
          (l: WonLead) => !l.project_id
        );
        setWonLeads(leadsWithoutProject);
      }
    } catch (error) {
      console.error("Error fetching won leads:", error);
    } finally {
      setLoadingLeads(false);
    }
  };

  const selectLead = (lead: WonLead) => {
    setSelectedLead(lead);
    setShowLeadSelector(false);
    setCreateMode("from_lead");

    // Map lead data to form
    const projectType = mapPropertyTypeToProjectType(lead.property_type);
    const projectCategory =
      lead.service_type === "modular" ? "modular" : "turnkey";

    setFormData((prev) => ({
      ...prev,
      name: lead.property_name || `${lead.client_name} - Interior Project`,
      description: lead.project_scope || "",
      client_name: lead.client_name,
      client_email: lead.email || "",
      client_phone: lead.phone || "",
      site_address: lead.property_address || "",
      city: lead.property_city || "",
      pincode: lead.property_pincode || "",
      project_type: projectType,
      project_category: projectCategory,
      start_date: lead.expected_project_start
        ? lead.expected_project_start.split("T")[0]
        : "",
      expected_end_date: lead.target_end_date
        ? lead.target_end_date.split("T")[0]
        : "",
      quoted_amount: lead.won_amount ? lead.won_amount.toString() : "",
      budget_amount: lead.won_amount ? lead.won_amount.toString() : "",
      lead_id: lead.id,
    }));
  };

  const mapPropertyTypeToProjectType = (propertyType: string): ProjectType => {
    if (propertyType?.includes("apartment")) return "apartment";
    if (propertyType?.includes("villa")) return "villa";
    if (propertyType === "independent_house") return "residential";
    if (propertyType?.includes("commercial_office")) return "office";
    if (propertyType?.includes("commercial_retail")) return "retail";
    if (propertyType?.includes("commercial")) return "commercial";
    return "residential";
  };

  const clearSelectedLead = () => {
    setSelectedLead(null);
    setCreateMode("manual");
    setFormData((prev) => ({
      ...prev,
      lead_id: "",
    }));
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    const newValue =
      type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({ ...prev, [name]: newValue }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "Project name is required";
    }
    if (!formData.client_name.trim()) {
      newErrors.client_name = "Client name is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          quoted_amount: formData.quoted_amount
            ? parseFloat(formData.quoted_amount)
            : 0,
          budget_amount: formData.budget_amount
            ? parseFloat(formData.budget_amount)
            : 0,
          project_manager_id: formData.project_manager_id || null,
          lead_id: formData.lead_id || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create project");
      }

      const data = await response.json();
      router.push(`/dashboard/projects/${data.project.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Filter leads by search
  const filteredLeads = wonLeads.filter(
    (lead) =>
      lead.client_name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      lead.lead_number.toLowerCase().includes(leadSearch.toLowerCase()) ||
      lead.property_name?.toLowerCase().includes(leadSearch.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/projects"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Project</h1>
          <p className="text-slate-600 mt-1">
            Create a new interior design project
          </p>
        </div>
      </div>

      {/* Creation Mode Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-slate-400" />
          Project Source
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* From Lead Option */}
          <button
            type="button"
            onClick={() => {
              setCreateMode("from_lead");
              setShowLeadSelector(true);
            }}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              createMode === "from_lead"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  createMode === "from_lead" ? "bg-blue-100" : "bg-slate-100"
                }`}
              >
                <LinkIcon
                  className={`w-5 h-5 ${
                    createMode === "from_lead"
                      ? "text-blue-600"
                      : "text-slate-400"
                  }`}
                />
              </div>
              <div>
                <p className="font-medium text-slate-900">From Won Lead</p>
                <p className="text-sm text-slate-500">
                  Import details from a closed lead
                </p>
              </div>
            </div>
            {selectedLead && createMode === "from_lead" && (
              <div className="mt-3 p-2 bg-white rounded border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {selectedLead.client_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedLead.lead_number}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelectedLead();
                  }}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            )}
          </button>

          {/* Manual Option */}
          <button
            type="button"
            onClick={() => {
              setCreateMode("manual");
              clearSelectedLead();
            }}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              createMode === "manual"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  createMode === "manual" ? "bg-blue-100" : "bg-slate-100"
                }`}
              >
                <Building2
                  className={`w-5 h-5 ${
                    createMode === "manual" ? "text-blue-600" : "text-slate-400"
                  }`}
                />
              </div>
              <div>
                <p className="font-medium text-slate-900">Manual Entry</p>
                <p className="text-sm text-slate-500">
                  Enter all details manually
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Lead Selector Modal */}
        {showLeadSelector && (
          <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-3 bg-slate-50 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search won leads..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {loadingLeads ? (
                <div className="p-4 text-center text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading leads...
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  {wonLeads.length === 0
                    ? "No won leads available for project creation"
                    : "No leads match your search"}
                </div>
              ) : (
                filteredLeads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => selectLead(lead)}
                    className="w-full p-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {lead.client_name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {lead.lead_number} •{" "}
                        {lead.property_name || "No property name"}
                      </p>
                      {lead.won_amount && (
                        <p className="text-sm text-green-600 font-medium">
                          ₹{(lead.won_amount / 100000).toFixed(1)}L
                        </p>
                      )}
                    </div>
                    {selectedLead?.id === lead.id && (
                      <Check className="w-5 h-5 text-blue-600" />
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="p-2 bg-slate-50 border-t">
              <button
                type="button"
                onClick={() => setShowLeadSelector(false)}
                className="w-full py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-400" />
            Project Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Kumar Villa Interior"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.name ? "border-red-500" : "border-slate-300"
                }`}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Project Type
              </label>
              <select
                name="project_type"
                value={formData.project_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {PROJECT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Project Category
              </label>
              <select
                name="project_category"
                value={formData.project_category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {PROJECT_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {formData.project_category === "turnkey"
                  ? "Full interior work including civil, electrical, plumbing, etc."
                  : formData.project_category === "modular"
                  ? "Only modular furniture design and installation"
                  : "Combination of turnkey and modular work"}
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Brief description of the project scope..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Client Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-slate-400" />
            Client Information
            {selectedLead && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-2">
                From Lead
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="client_name"
                value={formData.client_name}
                onChange={handleChange}
                placeholder="Full name"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.client_name ? "border-red-500" : "border-slate-300"
                }`}
              />
              {errors.client_name && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.client_name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client Email
              </label>
              <input
                type="email"
                name="client_email"
                value={formData.client_email}
                onChange={handleChange}
                placeholder="email@example.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client Phone
              </label>
              <input
                type="tel"
                name="client_phone"
                value={formData.client_phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Site Address */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-slate-400" />
            Site Address
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Address
              </label>
              <input
                type="text"
                name="site_address"
                value={formData.site_address}
                onChange={handleChange}
                placeholder="Flat No, Building Name, Street..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Hyderabad"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                State
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="Telangana"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Pincode
              </label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                placeholder="500001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Timeline & Budget */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            Timeline & Budget
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Expected End Date
              </label>
              <input
                type="date"
                name="expected_end_date"
                value={formData.expected_end_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Quoted Amount (₹)
              </label>
              <input
                type="number"
                name="quoted_amount"
                value={formData.quoted_amount}
                onChange={handleChange}
                placeholder="1500000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Budget Amount (₹)
              </label>
              <input
                type="number"
                name="budget_amount"
                value={formData.budget_amount}
                onChange={handleChange}
                placeholder="1200000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Internal budget for cost tracking
              </p>
            </div>
          </div>
        </div>

        {/* Assignment & Options */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Assignment & Options
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Project Manager
              </label>
              <select
                name="project_manager_id"
                value={formData.project_manager_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Project Manager</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="initialize_phases"
                  checked={formData.initialize_phases}
                  onChange={handleChange}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">
                  Initialize project phases from templates
                </span>
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">
                This will create all default phases and sub-phases based on the
                project category ({formData.project_category})
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any additional notes..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/dashboard/projects"
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Project
          </button>
        </div>
      </form>
    </div>
  );
}

// Loading fallback component
function NewProjectLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Main export wrapped in Suspense
export default function NewProjectPage() {
  return (
    <Suspense fallback={<NewProjectLoading />}>
      <NewProjectForm />
    </Suspense>
  );
}

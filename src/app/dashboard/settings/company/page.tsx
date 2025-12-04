"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Tenant, TenantSettings } from "@/types/database.types";
import { FieldDisplay } from "@/components/ui/FieldDisplay";
import { FieldInput } from "@/components/ui/FieldInput";
import {
  BuildingOfficeIcon,
  PencilIcon,
  XMarkIcon,
  ChevronUpDownIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

interface CompanyFormData {
  company_name: string;
  company_registration_number: string;
  phone: string;
  gst_number: string;
  address_line1: string;
  postal_code: string;
  tenant_type: string;
  timezone: string;
  currency: string;
}

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GST)" },
  { value: "Asia/Singapore", label: "Singapore Time (SGT)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET)" },
];

const CURRENCY_OPTIONS = [
  { value: "INR", label: "Indian Rupee (₹)" },
  { value: "USD", label: "US Dollar ($)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "GBP", label: "British Pound (£)" },
  { value: "AED", label: "UAE Dirham (د.إ)" },
  { value: "SGD", label: "Singapore Dollar (S$)" },
  { value: "AUD", label: "Australian Dollar (A$)" },
];

const TENANT_TYPE_OPTIONS = [
  { value: "client", label: "Client" },
  { value: "architect", label: "Architecture Firm" },
  { value: "interiors", label: "Interior Design Studio" },
  { value: "vendor", label: "Vendor / Supplier" },
  { value: "factory", label: "Factory / Manufacturer" },
];

const STATUS_LABELS: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  trial: { label: "Trial", color: "text-amber-700", bgColor: "bg-amber-100" },
  active: { label: "Active", color: "text-green-700", bgColor: "bg-green-100" },
  suspended: {
    label: "Inactive",
    color: "text-slate-700",
    bgColor: "bg-slate-100",
  },
  expired: {
    label: "Inactive",
    color: "text-slate-700",
    bgColor: "bg-slate-100",
  },
  closed: { label: "Blocked", color: "text-red-700", bgColor: "bg-red-100" },
};

// Enhanced FieldSelect with portal-based dropdown
function FieldSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    ready: false,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = Math.min(options.length * 36 + 56, 280); // 56 for search box padding
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      return {
        top:
          spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove
            ? rect.bottom + 4
            : rect.top - dropdownHeight - 4,
        left: rect.left,
        width: rect.width,
        ready: true,
      };
    }
    return { top: 0, left: 0, width: 0, ready: false };
  };

  const handleOpen = () => {
    if (!isOpen) {
      setPosition(calculatePosition());
      setSearchQuery("");
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  const dropdownContent =
    isOpen && position.ready && typeof window !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
            style={{
              top: position.top,
              left: position.left,
              width: Math.max(position.width, 220),
            }}
          >
            {/* Search input */}
            {options.length > 5 && (
              <div className="p-2 border-b border-slate-100">
                <div className="relative">
                  <svg
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            {/* Options list */}
            <div className="py-1 max-h-52 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-slate-500">No options found</p>
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = value === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleSelect(option.value)}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
                        isSelected
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex-1 truncate">{option.label}</span>
                      {isSelected && (
                        <CheckIcon className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs text-left transition-all flex items-center justify-between gap-2 ${
          isOpen
            ? "border-blue-400 ring-2 ring-blue-500/20"
            : "border-slate-300 hover:border-slate-400"
        }`}
      >
        <span className={selectedOption ? "text-slate-900" : "text-slate-400"}>
          {selectedOption?.label || placeholder || "Select..."}
        </span>
        <ChevronUpDownIcon
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
            isOpen ? "text-blue-500" : ""
          }`}
        />
      </button>
      {dropdownContent}
    </div>
  );
}

export default function CompanySettingsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [company, setCompany] = useState<Tenant | null>(null);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(
    null
  );

  const [formData, setFormData] = useState<CompanyFormData>({
    company_name: "",
    company_registration_number: "",
    phone: "",
    gst_number: "",
    address_line1: "",
    postal_code: "",
    tenant_type: "",
    timezone: "Asia/Kolkata",
    currency: "INR",
  });
  const [originalFormData, setOriginalFormData] = useState<CompanyFormData>({
    company_name: "",
    company_registration_number: "",
    phone: "",
    gst_number: "",
    address_line1: "",
    postal_code: "",
    tenant_type: "",
    timezone: "Asia/Kolkata",
    currency: "INR",
  });

  const supabase = createClient();

  const hasChanges = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(originalFormData);
  }, [formData, originalFormData]);

  useEffect(() => {
    fetchCompanyDetails();
  }, []);

  const fetchCompanyDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !authUser) {
        setError("Unable to get authenticated user");
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", authUser.id)
        .single();

      if (userError || !userData) {
        setError("Failed to get user tenant");
        return;
      }

      const tenantId = userData.tenant_id;

      const [tenantResult, settingsResult] = await Promise.all([
        supabase.from("tenants").select("*").eq("id", tenantId).single(),
        supabase
          .from("tenant_settings")
          .select("*")
          .eq("tenant_id", tenantId)
          .single(),
      ]);

      if (tenantResult.error) {
        setError("Failed to load company details");
        return;
      }

      const tenantData = tenantResult.data;
      setCompany(tenantData);

      if (!settingsResult.error && settingsResult.data) {
        setTenantSettings(settingsResult.data);
      }

      const formValues: CompanyFormData = {
        company_name: tenantData.company_name || "",
        company_registration_number:
          tenantData.company_registration_number || "",
        phone: tenantData.phone || "",
        gst_number: tenantData.gst_number || "",
        address_line1: tenantData.address_line1 || "",
        postal_code: tenantData.postal_code || "",
        tenant_type: tenantData.tenant_type || "",
        timezone: settingsResult.data?.timezone || "Asia/Kolkata",
        currency: settingsResult.data?.currency || "INR",
      };
      setFormData(formValues);
      setOriginalFormData(formValues);
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!company || !hasChanges) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const validationErrors: string[] = [];
      if (!formData.company_name.trim())
        validationErrors.push("Company name is required");
      if (!formData.phone.trim())
        validationErrors.push("Phone number is required");
      if (!formData.postal_code.trim())
        validationErrors.push("Pin code is required");
      if (!formData.tenant_type)
        validationErrors.push("Company type is required");

      if (validationErrors.length > 0) {
        setError(validationErrors.join(", "));
        setIsSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("tenants")
        .update({
          company_name: formData.company_name.trim(),
          company_registration_number:
            formData.company_registration_number.trim() || null,
          phone: formData.phone.trim(),
          gst_number: formData.gst_number.trim() || null,
          address_line1: formData.address_line1.trim() || null,
          postal_code: formData.postal_code.trim(),
          tenant_type: formData.tenant_type,
          updated_at: new Date().toISOString(),
        })
        .eq("id", company.id);

      if (updateError) {
        setError("Failed to update company: " + updateError.message);
        return;
      }

      await supabase
        .from("tenant_settings")
        .upsert(
          {
            tenant_id: company.id,
            timezone: formData.timezone,
            currency: formData.currency,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id" }
        );

      const updatedAt = new Date().toISOString();
      setCompany({
        ...company,
        company_name: formData.company_name.trim(),
        company_registration_number:
          formData.company_registration_number.trim() || null,
        phone: formData.phone.trim(),
        gst_number: formData.gst_number.trim() || null,
        address_line1: formData.address_line1.trim() || null,
        postal_code: formData.postal_code.trim(),
        tenant_type: formData.tenant_type as Tenant["tenant_type"],
        updated_at: updatedAt,
      });

      setTenantSettings((prev) =>
        prev
          ? {
              ...prev,
              timezone: formData.timezone,
              currency: formData.currency,
              updated_at: updatedAt,
            }
          : null
      );
      setOriginalFormData({ ...formData });
      setIsEditing(false);
      setSuccess("Company details updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({ ...originalFormData });
    setIsEditing(false);
    setError(null);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getTenantTypeLabel = (type: string) => {
    return TENANT_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;
  };

  const getTimezoneLabel = (tz: string) => {
    return TIMEZONE_OPTIONS.find((o) => o.value === tz)?.label || tz;
  };

  const getCurrencyLabel = (currency: string) => {
    return (
      CURRENCY_OPTIONS.find((o) => o.value === currency)?.label || currency
    );
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusInfo = (status: string | undefined) => {
    return STATUS_LABELS[status || "suspended"] || STATUS_LABELS.suspended;
  };

  if (isLoading) {
    return (
      <div className="h-full bg-slate-50/50">
        <div className="h-full flex flex-col px-4 py-4">
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-500">
                  Loading company details...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(company?.status);

  return (
    <div className="h-full bg-slate-50/50">
      {isSaving && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl flex items-center gap-4">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium text-slate-700">
              Saving changes...
            </span>
          </div>
        </div>
      )}

      <div className="h-full flex flex-col px-4 py-4">
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
              <Link href="/dashboard" className="hover:text-slate-700">
                Dashboard
              </Link>
              <svg
                className="w-3 h-3 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <Link href="/dashboard/settings" className="hover:text-slate-700">
                Settings
              </Link>
              <svg
                className="w-3 h-3 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <span className="text-slate-700 font-medium">Company</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-sm">
                  <BuildingOfficeIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-slate-800 leading-tight">
                    Company Settings
                  </h1>
                  <p className="text-[11px] text-slate-500">
                    Manage your organization details
                  </p>
                </div>
                <span
                  className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}
                >
                  <span className="w-1 h-1 rounded-full bg-current"></span>
                  {statusInfo.label}
                </span>
              </div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !hasChanges}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-medium rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {hasChanges && (
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                    )}
                    Save Changes
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-medium rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                  Edit Company
                </button>
              )}
            </div>
          </div>

          {/* Alerts */}
          {(error || success) && (
            <div className="px-4 pt-3 shrink-0">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                  <svg
                    className="w-4 h-4 shrink-0"
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
                  {success}
                </div>
              )}
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-4">
              {/* Company Card - FULL WIDTH */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Company Card
                  </h2>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 shrink-0 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center text-white text-base font-bold shadow-lg">
                      {company ? getInitials(company.company_name) : "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {company?.company_name || "Company"}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">
                        {company?.email}
                      </p>
                      <span className="inline-flex mt-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-700">
                        {getTenantTypeLabel(company?.tenant_type || "")}
                      </span>
                    </div>
                    <div className="hidden md:flex items-center gap-8 pl-6 border-l border-slate-200">
                      <FieldDisplay
                        label="Account Created"
                        value={formatDateTime(company?.created_at)}
                      />
                      <FieldDisplay
                        label="Last Updated"
                        value={formatDateTime(company?.updated_at)}
                      />
                    </div>
                  </div>
                  <div className="md:hidden pt-3 mt-3 border-t border-slate-200 grid grid-cols-2 gap-x-4 gap-y-2">
                    <FieldDisplay
                      label="Account Created"
                      value={formatDateTime(company?.created_at)}
                    />
                    <FieldDisplay
                      label="Last Updated"
                      value={formatDateTime(company?.updated_at)}
                    />
                  </div>
                </div>
              </div>

              {/* Company Information - FULL WIDTH */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Company Information
                  </h2>
                  <p className="text-[10px] text-slate-500">
                    Basic information about your organization
                  </p>
                </div>
                <div className="p-4">
                  {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FieldInput
                        label="Registered Company Name"
                        value={formData.company_name}
                        onChange={(v) =>
                          setFormData({ ...formData, company_name: v })
                        }
                        placeholder="Enter registered company name"
                        required
                      />
                      <FieldInput
                        label="Registration Number"
                        value={formData.company_registration_number}
                        onChange={(v) =>
                          setFormData({
                            ...formData,
                            company_registration_number: v,
                          })
                        }
                        placeholder="CIN / Company Registration No."
                      />
                      <FieldInput
                        label="Company Phone Number"
                        value={formData.phone}
                        onChange={(v) => setFormData({ ...formData, phone: v })}
                        placeholder="+91 98765 43210"
                        type="tel"
                        required
                      />
                      <FieldInput
                        label="GST Number"
                        value={formData.gst_number}
                        onChange={(v) =>
                          setFormData({
                            ...formData,
                            gst_number: v.toUpperCase(),
                          })
                        }
                        placeholder="22AAAAA0000A1Z5"
                      />
                      <FieldInput
                        label="Company Address"
                        value={formData.address_line1}
                        onChange={(v) =>
                          setFormData({ ...formData, address_line1: v })
                        }
                        placeholder="Street address, building, etc."
                      />
                      <FieldInput
                        label="Company Pin Code"
                        value={formData.postal_code}
                        onChange={(v) =>
                          setFormData({ ...formData, postal_code: v })
                        }
                        placeholder="560001"
                        required
                      />
                      <FieldSelect
                        label="Company Type"
                        value={formData.tenant_type}
                        onChange={(v) =>
                          setFormData({ ...formData, tenant_type: v })
                        }
                        options={TENANT_TYPE_OPTIONS}
                        placeholder="Select company type"
                        required
                      />
                      <FieldSelect
                        label="Time Zone"
                        value={formData.timezone}
                        onChange={(v) =>
                          setFormData({ ...formData, timezone: v })
                        }
                        options={TIMEZONE_OPTIONS}
                        required
                      />
                      <FieldSelect
                        label="Currency"
                        value={formData.currency}
                        onChange={(v) =>
                          setFormData({ ...formData, currency: v })
                        }
                        options={CURRENCY_OPTIONS}
                        required
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FieldDisplay
                        label="Registered Company Name"
                        value={company?.company_name}
                        required
                      />
                      <FieldDisplay
                        label="Registration Number"
                        value={company?.company_registration_number}
                      />
                      <FieldDisplay
                        label="Company Email Address"
                        value={company?.email}
                        required
                      />
                      <FieldDisplay
                        label="Company Phone Number"
                        value={company?.phone}
                        required
                      />
                      <FieldDisplay
                        label="GST Number"
                        value={company?.gst_number}
                      />
                      <FieldDisplay
                        label="Company Address"
                        value={company?.address_line1}
                      />
                      <FieldDisplay
                        label="Company Pin Code"
                        value={company?.postal_code}
                        required
                      />
                      <FieldDisplay
                        label="Company Type"
                        value={getTenantTypeLabel(company?.tenant_type || "")}
                        required
                      />
                      <FieldDisplay
                        label="Time Zone"
                        value={getTimezoneLabel(
                          tenantSettings?.timezone || "Asia/Kolkata"
                        )}
                        required
                      />
                      <FieldDisplay
                        label="Currency"
                        value={getCurrencyLabel(
                          tenantSettings?.currency || "INR"
                        )}
                        required
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

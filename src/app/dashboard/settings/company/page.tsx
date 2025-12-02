"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Tenant, TenantSettings } from "@/types/database.types";

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

// Reusable Field Display Component
function FieldDisplay({
  label,
  value,
  required = false,
}: {
  label: string;
  value: string | null | undefined | React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="text-sm text-slate-900 font-medium py-1">
        {value || (
          <span className="text-slate-400 font-normal italic">Not set</span>
        )}
      </div>
    </div>
  );
}

// Reusable Field Input Component
function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  maxLength,
  hint,
  locked = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
  hint?: string;
  locked?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {locked ? (
        <div className="flex items-center justify-between px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600">
          <span>{value || "Not set"}</span>
          <svg
            className="w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) =>
            onChange?.(
              type === "text" && maxLength
                ? e.target.value.slice(0, maxLength)
                : e.target.value
            )
          }
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      )}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// Reusable Select Input Component
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
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: "right 0.5rem center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "1.5em 1.5em",
          paddingRight: "2.5rem",
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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

      await supabase.from("tenant_settings").upsert(
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
    if (!dateString) return "-";
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
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-16 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(company?.status);

  return (
    <div className="space-y-4">
      {/* Saving Overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl flex items-center gap-4">
            <svg
              className="w-6 h-6 animate-spin text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm font-medium text-slate-700">
              Saving changes...
            </span>
          </div>
        </div>
      )}

      {/* Page Header - Matching Team page style */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <Link href="/dashboard/settings" className="hover:text-blue-600">
                Settings
              </Link>
              <span>/</span>
              <span className="text-slate-700">Company</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-900">
              Company Settings
            </h1>
          </div>

          {/* Status pill in header */}
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
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
            Edit Company
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
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
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
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

      {/* Section 1: Company Details */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Section Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-slate-700 to-slate-900 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {company ? getInitials(company.company_name) : "?"}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Company Details
              </h2>
              <p className="text-sm text-slate-500">
                Basic information about your organization
              </p>
            </div>
          </div>
        </div>

        {/* Section Content */}
        <div className="p-5">
          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <FieldInput
                label="Registered Company Name"
                value={formData.company_name}
                onChange={(v) => setFormData({ ...formData, company_name: v })}
                placeholder="Enter registered company name"
                required
              />
              <FieldInput
                label="Registration Number"
                value={formData.company_registration_number}
                onChange={(v) =>
                  setFormData({ ...formData, company_registration_number: v })
                }
                placeholder="CIN / Company Registration No."
              />
              <FieldInput
                label="Company Email Address"
                value={company?.email || ""}
                locked
                required
                hint="Contact support to change email"
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
                  setFormData({ ...formData, gst_number: v.toUpperCase() })
                }
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
              <FieldInput
                label="Company Address"
                value={formData.address_line1}
                onChange={(v) => setFormData({ ...formData, address_line1: v })}
                placeholder="Street address, building, etc."
              />
              <FieldInput
                label="Company Pin Code"
                value={formData.postal_code}
                onChange={(v) => setFormData({ ...formData, postal_code: v })}
                placeholder="560001"
                maxLength={10}
                required
              />
              <FieldSelect
                label="Company Type"
                value={formData.tenant_type}
                onChange={(v) => setFormData({ ...formData, tenant_type: v })}
                options={TENANT_TYPE_OPTIONS}
                placeholder="Select company type"
                required
              />
              <FieldInput
                label="Account Created"
                value={formatDateTime(company?.created_at)}
                locked
                required
              />
              <FieldInput
                label="Last Updated"
                value={formatDateTime(company?.updated_at)}
                locked
                required
              />
              <FieldSelect
                label="Time Zone"
                value={formData.timezone}
                onChange={(v) => setFormData({ ...formData, timezone: v })}
                options={TIMEZONE_OPTIONS}
                required
              />
              <FieldSelect
                label="Currency"
                value={formData.currency}
                onChange={(v) => setFormData({ ...formData, currency: v })}
                options={CURRENCY_OPTIONS}
                required
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
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
              <FieldDisplay label="GST Number" value={company?.gst_number} />
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
                label="Account Created"
                value={formatDateTime(company?.created_at)}
                required
              />
              <FieldDisplay
                label="Last Updated"
                value={formatDateTime(company?.updated_at)}
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
                value={getCurrencyLabel(tenantSettings?.currency || "INR")}
                required
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

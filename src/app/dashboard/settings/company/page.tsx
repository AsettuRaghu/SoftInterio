"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tenant, TenantSettings } from "@/types/database.types";
import { FieldDisplay } from "@/components/ui/FieldDisplay";
import { FieldInput } from "@/components/ui/FieldInput";
import { FieldSelect } from "@/components/ui/FieldSelect";
import { Alert } from "@/components/ui/Alert";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatusBadge,
} from "@/components/ui/PageLayout";
import { uiLogger } from "@/lib/logger";
import {
  BuildingOfficeIcon,
  PencilIcon,
  XMarkIcon,
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

export default function CompanySettingsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [company, setCompany] = useState<Tenant | null>(null);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(
    null,
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
      uiLogger.debug("Fetching company details", { action: "fetch_company" });
      setIsLoading(true);
      setError(null);

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !authUser) {
        uiLogger.error("Unable to get authenticated user", authError, {
          action: "fetch_company",
        });
        setError("Unable to get authenticated user");
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", authUser.id)
        .single();

      if (userError || !userData) {
        uiLogger.error("Failed to get user tenant", userError, {
          action: "fetch_company",
        });
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
        uiLogger.error("Failed to load company details", tenantResult.error, {
          action: "fetch_company",
        });
        setError("Failed to load company details");
        return;
      }

      const tenantData = tenantResult.data;
      setCompany(tenantData);
      uiLogger.debug("Company details loaded", {
        companyName: tenantData.company_name,
      });

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
      uiLogger.error("Unexpected error loading company", err, {
        action: "fetch_company",
      });
      setError("An unexpected error occurred");
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
      uiLogger.info("Saving company details", { action: "save_company" });
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
        uiLogger.warn("Company validation failed", {
          errors: validationErrors,
          action: "save_company",
        });
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
        uiLogger.error("Failed to update company", updateError, {
          action: "save_company",
        });
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
        { onConflict: "tenant_id" },
      );

      uiLogger.info("Company details saved successfully", {
        action: "save_company",
      });
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
          : null,
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

  // Map company status to StatusBadge format
  const getStatusForBadge = (status: string | undefined): string => {
    const statusMap: Record<string, string> = {
      trial: "active",
      active: "active",
      suspended: "inactive",
      expired: "inactive",
      closed: "disabled",
    };
    return statusMap[status || "suspended"] || "inactive";
  };

  return (
    <PageLayout
      isLoading={isLoading}
      loadingText="Loading company details..."
      isSaving={isSaving}
      savingText="Saving changes..."
    >
      <PageHeader
        title="Company Settings"
        subtitle="Manage your organization details"
        basePath={{ label: "Settings", href: "/dashboard/settings" }}
        breadcrumbs={[{ label: "Company" }]}
        icon={<BuildingOfficeIcon className="w-4 h-4 text-white" />}
        iconBgClass="from-slate-600 to-slate-700"
        status={getStatusForBadge(company?.status)}
        actions={
          isEditing ? (
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-blue-600 to-blue-500 text-white text-xs font-medium rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-blue-600 to-blue-500 text-white text-xs font-medium rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md"
            >
              <PencilIcon className="w-3.5 h-3.5" />
              Edit Company
            </button>
          )
        }
      />
      <PageContent>
        <div className="space-y-4">
          {/* Alerts */}
          {error && (
            <Alert
              variant="error"
              message={error}
              onDismiss={() => setError(null)}
            />
          )}
          {success && (
            <Alert
              variant="success"
              message={success}
              onDismiss={() => setSuccess(null)}
            />
          )}

          {/* Company Card - FULL WIDTH */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Company Card
              </h2>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 shrink-0 bg-linear-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center text-white text-base font-bold shadow-lg">
                  {company ? getInitials(company.company_name) : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {company?.company_name || "Company"}
                    </h3>
                    <span className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 text-purple-700 shrink-0">
                      {getTenantTypeLabel(company?.tenant_type || "")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {company?.email}
                  </p>
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
                      tenantSettings?.timezone || "Asia/Kolkata",
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
      </PageContent>
    </PageLayout>
  );
}

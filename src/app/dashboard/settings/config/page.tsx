"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/components/ui/PageLayout";
import { Alert } from "@/components/ui/Alert";
import { uiLogger } from "@/lib/logger";
import {
  AdjustmentsHorizontalIcon,
  PencilIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

/**
 * Tenant-level feature switches.
 *
 * One page for the decisions a business makes about how the product behaves,
 * as opposed to Company (who the business is), Team (who works there) and
 * Billing (what they pay for). Every switch here is a column on
 * tenant_settings.
 *
 * To add another, add a row to FLAGS. Nothing else needs to change: the load,
 * the save, the dirty check and the rendering are all driven from it. Only add
 * a flag once something actually reads it - tenant_settings already carries
 * require_quotation_for_project, which is read nowhere and so is deliberately
 * not offered here.
 */

/** Columns on tenant_settings that this page owns. */
type FlagKey = "allow_direct_project_create" | "auto_create_project_on_won";

interface FlagDefinition {
  key: FlagKey;
  group: string;
  label: string;
  description: string;
  /** Value to assume when the column is null or the row is missing. */
  fallback: boolean;
}

const FLAGS: FlagDefinition[] = [
  {
    key: "auto_create_project_on_won",
    group: "Projects",
    label: "Open a project automatically when a lead is won",
    description:
      "The project is created as part of the won transition, carrying the client, property, quotation and scope across. Turn this off to win a lead without starting delivery straight away.",
    fallback: true,
  },
  {
    key: "allow_direct_project_create",
    group: "Projects",
    label: "Allow creating projects directly",
    description:
      "Adds a New Project button to the projects list that starts from a blank form. Off by default: a project made this way has no lead, quotation or scope behind it.",
    fallback: false,
  },
];

type FlagState = Record<FlagKey, boolean>;

const defaults = (): FlagState =>
  FLAGS.reduce((acc, f) => {
    acc[f.key] = f.fallback;
    return acc;
  }, {} as FlagState);

export default function SettingsConfigPage() {
  const [values, setValues] = useState<FlagState>(defaults);
  const [original, setOriginal] = useState<FlagState>(defaults);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const hasChanges = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(original),
    [values, original]
  );

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You are not signed in");
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!userData?.tenant_id) {
        setError("Your account is not linked to an organisation");
        return;
      }
      setTenantId(userData.tenant_id);

      const { data, error: settingsError } = await supabase
        .from("tenant_settings")
        .select(FLAGS.map((f) => f.key).join(", "))
        .eq("tenant_id", userData.tenant_id)
        .maybeSingle();

      if (settingsError) {
        uiLogger.error("Failed to load configuration", settingsError, {
          action: "fetch_tenant_config",
        });
        setError("Could not load your configuration");
        return;
      }

      // A tenant with no settings row yet falls back to the defaults; saving
      // creates the row.
      const loaded = FLAGS.reduce((acc, f) => {
        const raw = (data as Record<string, unknown> | null)?.[f.key];
        acc[f.key] = typeof raw === "boolean" ? raw : f.fallback;
        return acc;
      }, {} as FlagState);

      setValues(loaded);
      setOriginal(loaded);
    } catch (err) {
      uiLogger.error("Unexpected error loading configuration", err, {
        action: "fetch_tenant_config",
      });
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId || !hasChanges) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const supabase = createClient();
      const { error: saveError } = await supabase
        .from("tenant_settings")
        .upsert(
          {
            tenant_id: tenantId,
            ...values,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id" }
        );

      if (saveError) {
        uiLogger.error("Failed to save configuration", saveError, {
          action: "save_tenant_config",
        });
        setError("Could not save your changes: " + saveError.message);
        return;
      }

      uiLogger.info("Tenant configuration saved", {
        action: "save_tenant_config",
      });
      setOriginal(values);
      setIsEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      uiLogger.error("Unexpected error saving configuration", err, {
        action: "save_tenant_config",
      });
      setError("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setValues(original);
    setIsEditing(false);
    setError(null);
  };

  const groups = useMemo(() => {
    const byGroup = new Map<string, FlagDefinition[]>();
    for (const flag of FLAGS) {
      const list = byGroup.get(flag.group) ?? [];
      list.push(flag);
      byGroup.set(flag.group, list);
    }
    return [...byGroup.entries()];
  }, []);

  return (
    <PageLayout isLoading={isLoading} loadingText="Loading configuration...">
      <PageHeader
        title="Configuration"
        subtitle="Feature switches for your organisation"
        basePath={{ label: "Settings", href: "/dashboard/settings" }}
        breadcrumbs={[{ label: "Config" }]}
        icon={<AdjustmentsHorizontalIcon className="w-4 h-4 text-white" />}
        iconBgClass="from-slate-600 to-slate-700"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-all"
            >
              <PencilIcon className="w-3.5 h-3.5" />
              Edit
            </button>
          )
        }
      />

      <PageContent>
        <div className="space-y-4">
          {error && <Alert variant="error" message={error} />}
          {saved && !error && (
            <Alert variant="success" message="Configuration saved." />
          )}

          {groups.map(([group, flags]) => (
            <div
              key={group}
              className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden"
            >
              <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">{group}</h2>
                <p className="text-[10px] text-slate-500">
                  How {group.toLowerCase()} behave for everyone in your
                  organisation
                </p>
              </div>
              <div className="divide-y divide-slate-200">
                {flags.map((flag) => (
                  <label
                    key={flag.key}
                    className={`flex items-start gap-3 p-4 ${
                      isEditing ? "cursor-pointer hover:bg-white/60" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={values[flag.key]}
                      disabled={!isEditing}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [flag.key]: e.target.checked,
                        }))
                      }
                      className="mt-0.5 w-4 h-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">
                        {flag.label}
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        {flag.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PageContent>
    </PageLayout>
  );
}

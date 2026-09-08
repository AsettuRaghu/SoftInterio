"use client";

/**
 * Playbooks - reusable workflows with enforced completion gates.
 * Replaces the Task Templates page, which could spawn tasks but enforce
 * nothing.
 */

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PageLayout, PageHeader } from "@/components/ui/PageLayout";
import { Toast } from "@/components/ui/Toast";
import {
} from "@/components/playbooks";
import { TaskRelatedTypeLabels } from "@/types/tasks";
import type { PlaybookDefinition } from "@/types/playbooks";

export default function PlaybooksPage() {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const [playbooks, setPlaybooks] = useState<PlaybookDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/playbooks?include_inactive=true");
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error || "Could not load playbooks");
        return;
      }
      const data = await response.json();
      setPlaybooks(data.playbooks || []);
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (p: PlaybookDefinition) => {
    if (
      !(await confirm({
        title: `Delete "${p.name}"?`,
        message: "This cannot be undone.",
      }))
    ) {
      return;
    }
    const response = await fetch(`/api/playbooks/${p.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Usually "it has been run N times" - the API refuses rather than
      // orphaning run history.
      setError(data.error || "Could not delete the playbook");
      return;
    }
    void load();
  };

  /**
   * Take a copy so it can be adapted.
   *
   * A protected playbook is one SoftInterio ships, and editing it in place
   * would change the process under every business using it. Adapting one means
   * owning a copy - which is what makes "we propose the practice, you decide
   * how you work" true rather than a slogan.
   */
  const copy = async (p: PlaybookDefinition) => {
    const res = await fetch(`/api/playbooks/${p.id}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not copy the playbook");
      return;
    }
    router.push(`/dashboard/settings/playbooks/${data.playbook.id}`);
  };

  return (
    <PageLayout isLoading={isLoading} loadingText="Loading playbooks...">
      <PageHeader
        title="Playbooks"
        subtitle="How your team works: ordered steps with gates, which become tasks when a playbook is run on a project, lead or quotation"
        basePath={{ label: "Settings", href: "/dashboard/settings" }}
        breadcrumbs={[{ label: "Playbooks" }]}
        actions={
          <button
            type="button"
            onClick={() => router.push("/dashboard/settings/playbooks/new")}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            + New Playbook
          </button>
        }
      />

      <div className="mt-4" />
      <Toast message={error} onDismiss={() => setError(null)} />

      {playbooks.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            No playbooks yet. Create one to describe how your team works, or
            copy one of the standard playbooks and adapt it.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Name", "Applies to", "For", "Steps", "Versions", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {playbooks.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/dashboard/settings/playbooks/${p.id}`)
                      }
                      className="text-left"
                    >
                      <span className="block font-medium text-slate-900 hover:text-blue-600">
                        {p.name}
                        {p.status !== "committed" && (
                          <span
                            className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                              p.status === "retired"
                                ? "bg-slate-100 text-slate-500"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {p.status === "retired" ? "retired" : "draft"}
                          </span>
                        )}
                      </span>
                      {p.description && (
                        <span className="block text-xs text-slate-500">
                          {p.description}
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                      {TaskRelatedTypeLabels[p.applies_to]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-500">
                      {p.tenant_type
                        ? p.tenant_type.charAt(0).toUpperCase() +
                          p.tenant_type.slice(1)
                        : "Any"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.step_count ?? 0}
                  </td>
                  {/* Every version, so the freeze is legible: which one is in
                      service, what is being drafted beside it, and what came
                      before. */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(p.versions ?? [{ id: p.id, version: p.version, status: p.status }]).map(
                        (v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() =>
                              router.push(`/dashboard/settings/playbooks/${v.id}`)
                            }
                            title={
                              v.status === "committed"
                                ? "In service"
                                : v.status === "draft"
                                  ? "Being written — cannot be used yet"
                                  : v.status === "retired"
                                    ? "Retired"
                                    : "Superseded by a later version"
                            }
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              v.status === "committed"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : v.status === "draft"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-50 text-slate-500 border-slate-200"
                            }`}
                          >
                            v{v.version}
                          </button>
                        )
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => void copy(p)}
                      className="text-xs text-blue-600 hover:underline mr-3"
                      title="Take an editable copy of this playbook"
                    >
                      Copy
                    </button>
                    {p.is_protected ? (
                      <span
                        className="text-xs text-slate-400"
                        title="Provided with SoftInterio. Copy it to make your own version."
                      >
                        Standard
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void remove(p)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirmDialog}
    </PageLayout>
  );
}

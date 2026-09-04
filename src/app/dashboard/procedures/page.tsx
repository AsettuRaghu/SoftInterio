"use client";

/**
 * Procedures - reusable workflows with enforced completion gates.
 * Replaces the Task Templates page, which could spawn tasks but enforce
 * nothing.
 */

import React, { useCallback, useEffect, useState } from "react";
import { PageLayout, PageHeader } from "@/components/ui/PageLayout";
import { Toast } from "@/components/ui/Toast";
import {
  ProcedureBuilderModal,
} from "@/components/procedures";
import { TaskRelatedTypeLabels } from "@/types/tasks";
import type { ProcedureDefinition } from "@/types/procedures";

export default function ProceduresPage() {
  const [procedures, setProcedures] = useState<ProcedureDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/procedures?include_inactive=true");
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error || "Could not load procedures");
        return;
      }
      const data = await response.json();
      setProcedures(data.procedures || []);
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (p: ProcedureDefinition) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    const response = await fetch(`/api/procedures/${p.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Usually "it has been run N times" - the API refuses rather than
      // orphaning run history.
      setError(data.error || "Could not delete the procedure");
      return;
    }
    void load();
  };

  return (
    <PageLayout isLoading={isLoading} loadingText="Loading procedures...">
      <PageHeader
        title="Procedures"
        subtitle="Reusable workflows whose steps become tasks, with gates that must be met before a step can complete"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Procedures" },
        ]}
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setIsBuilderOpen(true);
            }}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            + New Procedure
          </button>
        }
      />

      <div className="mt-4" />
      <Toast message={error} onDismiss={() => setError(null)} />

      {procedures.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            No procedures yet. Create one to define a workflow your team must
            follow.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Name", "Applies to", "Steps", "Version", ""].map((h) => (
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
              {procedures.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(p.id);
                        setIsBuilderOpen(true);
                      }}
                      className="text-left"
                    >
                      <span className="block font-medium text-slate-900 hover:text-blue-600">
                        {p.name}
                        {!p.is_active && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500">
                            inactive
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
                  <td className="px-4 py-3 text-slate-600">
                    {p.step_count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    v{p.version}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void remove(p)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProcedureBuilderModal
        isOpen={isBuilderOpen}
        procedureId={editingId}
        onClose={() => setIsBuilderOpen(false)}
        onSaved={load}
      />
    </PageLayout>
  );
}

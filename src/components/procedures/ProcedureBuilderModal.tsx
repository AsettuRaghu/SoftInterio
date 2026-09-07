"use client";

/**
 * Create or edit a procedure.
 *
 * Steps are held as a FLAT list with a parent index rather than a tree. The
 * data is only ever two levels deep, and a flat list makes reordering and
 * indenting trivial - a nested structure would need rebuilding on every move.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { TaskRelatedType } from "@/types/tasks";
import {
  ProcedureActionColors,
  ProcedureActionLabels,
  type ProcedureActionType,
  type ProcedureDefinition,
} from "@/types/procedures";

interface DraftStep {
  title: string;
  action_type: ProcedureActionType;
  /** Index of the parent in this same array; null = top level. */
  parent_index: number | null;
  is_required: boolean;
  can_skip: boolean;
  assign_to_role: string | null;
  /** How long the step takes. Dates are derived from this, not typed. */
  duration_days: number | null;
  instructions: string | null;
  /** Who signs a step off. Only meaningful for an approval step. */
  approval_role: string | null;
  /** What must be attached before an upload step can complete. */
  required_upload_types: string[] | null;
  /** May run alongside its siblings instead of waiting for them. */
  allow_parallel: boolean;
  /** Skipping has to be explained. */
  skip_requires_reason: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Omit to create a new one. */
  procedureId?: string | null;
  onSaved?: () => void;
}

const ACTION_TYPES: ProcedureActionType[] = [
  "manual",
  "upload",
  "checklist",
  "form",
  "approval",
  "meeting",
  "handover",
];

const ENTITY_TYPES: { value: TaskRelatedType; label: string }[] = [
  { value: "project", label: "Project" },
  { value: "lead", label: "Lead" },
  { value: "quotation", label: "Quotation" },
  { value: "client", label: "Client" },
];

/**
 * parent_index points at an array position, so any reorder invalidates it.
 * Rebuild by matching each child back to the object identity of its old
 * parent - object identity survives the shuffle, indices do not.
 */
function reindex(next: DraftStep[], prev: DraftStep[]): DraftStep[] {
  const oldParentOf = new Map<DraftStep, DraftStep>();
  prev.forEach((s) => {
    if (s.parent_index !== null) oldParentOf.set(s, prev[s.parent_index]);
  });
  return next.map((s) => {
    const parent = oldParentOf.get(s);
    if (!parent) return { ...s, parent_index: null };
    const idx = next.indexOf(parent);
    return { ...s, parent_index: idx >= 0 ? idx : null };
  });
}

const blankStep = (): DraftStep => ({
  title: "",
  action_type: "manual",
  parent_index: null,
  is_required: true,
  can_skip: false,
  assign_to_role: null,
  duration_days: null,
  instructions: null,
  approval_role: null,
  required_upload_types: null,
  allow_parallel: false,
  skip_requires_reason: true,
});

export function ProcedureBuilderModal({
  isOpen,
  onClose,
  procedureId,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [appliesTo, setAppliesTo] = useState<TaskRelatedType>("project");
  // Which kind of business this playbook is written for. An interiors firm
  // and an architecture practice run different processes; leaving it blank
  // says the playbook suits either.
  const [tenantType, setTenantType] = useState<string>("");
  const [steps, setSteps] = useState<DraftStep[]>([blankStep()]);
  const [enforceOrder, setEnforceOrder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<ProcedureDefinition | null>(null);

  const reset = useCallback(() => {
    setName("");
    setDescription("");
    setAppliesTo("project");
    setSteps([blankStep()]);
    setTenantType("");
    setEnforceOrder(false);
    setError(null);
    setExisting(null);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (!procedureId) {
      reset();
      return;
    }

    setIsLoading(true);
    (async () => {
      try {
        const response = await fetch(`/api/procedures/${procedureId}`);
        if (!response.ok) {
          setError("Could not load the procedure");
          return;
        }
        const data = await response.json();
        setExisting(data.procedure);
        setName(data.procedure.name);
        setDescription(data.procedure.description || "");
        setAppliesTo(data.procedure.applies_to);
        setTenantType(data.procedure.tenant_type ?? "");
        setEnforceOrder(data.procedure.enforce_order === true);

        // Flatten: parents in order, each followed by its children, so the
        // editor's parent_index refers to a position in this same array.
        const raw = data.steps || [];
        const tops = raw.filter((s: any) => !s.parent_step_id);
        const flat: DraftStep[] = [];
        const idToIndex = new Map<string, number>();
        for (const t of tops) {
          idToIndex.set(t.id, flat.length);
          flat.push({
            title: t.title,
            action_type: t.action_type,
            parent_index: null,
            is_required: t.is_required,
            can_skip: t.can_skip,
            assign_to_role: t.assign_to_role,
            duration_days: t.duration_days ?? t.relative_due_days,
            instructions: t.instructions,
            approval_role: t.approval_role ?? null,
            required_upload_types: t.required_upload_types ?? null,
            allow_parallel: t.allow_parallel === true,
            skip_requires_reason: t.skip_requires_reason !== false,
          });
          for (const c of raw.filter((s: any) => s.parent_step_id === t.id)) {
            flat.push({
              title: c.title,
              action_type: c.action_type,
              parent_index: idToIndex.get(t.id) ?? null,
              is_required: c.is_required,
              can_skip: c.can_skip,
              assign_to_role: c.assign_to_role,
              duration_days: c.duration_days ?? c.relative_due_days,
              instructions: c.instructions,
              approval_role: c.approval_role ?? null,
              required_upload_types: c.required_upload_types ?? null,
              allow_parallel: c.allow_parallel === true,
              skip_requires_reason: c.skip_requires_reason !== false,
            });
          }
        }
        setSteps(flat.length ? flat : [blankStep()]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isOpen, procedureId, reset]);

  const update = (i: number, patch: Partial<DraftStep>) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const addStep = () => setSteps((prev) => [...prev, blankStep()]);

  const removeStep = (i: number) =>
    setSteps((prev) => {
      // Children of a removed parent would be orphaned, so drop them too and
      // re-base every remaining parent_index onto the new positions.
      const doomed = new Set<number>([i]);
      prev.forEach((s, idx) => {
        if (s.parent_index === i) doomed.add(idx);
      });
      const kept = prev.filter((_, idx) => !doomed.has(idx));
      const remap = new Map<number, number>();
      let n = 0;
      prev.forEach((_, idx) => {
        if (!doomed.has(idx)) remap.set(idx, n++);
      });
      return kept.map((s) => ({
        ...s,
        parent_index:
          s.parent_index !== null ? remap.get(s.parent_index) ?? null : null,
      }));
    });

  /**
   * Move a step up or down.
   *
   * A top-level step travels WITH its children - moving a parent past its own
   * child would be meaningless, and leaving children behind would re-parent
   * them to whatever now sits above. A child moves only within its own
   * sibling group.
   */
  const moveStep = (i: number, direction: -1 | 1) => {
    setSteps((prev) => {
      const step = prev[i];

      if (step.parent_index !== null) {
        // Child: swap with the adjacent sibling under the same parent.
        const siblings = prev
          .map((s, idx) => ({ s, idx }))
          .filter(({ s }) => s.parent_index === step.parent_index)
          .map(({ idx }) => idx);
        const at = siblings.indexOf(i);
        const target = siblings[at + direction];
        if (target === undefined) return prev;
        const next = [...prev];
        [next[i], next[target]] = [next[target], next[i]];
        return reindex(next, prev);
      }

      // Top-level: move the whole block (the step plus its children).
      const blockEnd = (() => {
        let end = i;
        while (end + 1 < prev.length && prev[end + 1].parent_index === i) end++;
        return end;
      })();
      const block = prev.slice(i, blockEnd + 1);
      const rest = [...prev.slice(0, i), ...prev.slice(blockEnd + 1)];

      // Where the previous / next top-level block starts.
      const tops = rest
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => s.parent_index === null)
        .map(({ idx }) => idx);
      const before = tops.filter((idx) => idx < i);
      const after = tops.filter((idx) => idx >= i);

      let insertAt: number;
      if (direction === -1) {
        if (before.length === 0) return prev;
        insertAt = before[before.length - 1];
      } else {
        if (after.length === 0) return prev;
        const nextTop = after[0];
        let nextEnd = nextTop;
        while (
          nextEnd + 1 < rest.length &&
          rest[nextEnd + 1].parent_index !== null
        )
          nextEnd++;
        insertAt = nextEnd + 1;
      }

      const next = [
        ...rest.slice(0, insertAt),
        ...block,
        ...rest.slice(insertAt),
      ];
      return reindex(next, prev);
    });
  };

  /** Indent = become a child of the nearest top-level step above. */
  const toggleIndent = (i: number) => {
    setSteps((prev) => {
      const step = prev[i];
      if (step.parent_index !== null) {
        return prev.map((s, idx) =>
          idx === i ? { ...s, parent_index: null } : s
        );
      }
      let parent: number | null = null;
      for (let j = i - 1; j >= 0; j--) {
        if (prev[j].parent_index === null) {
          parent = j;
          break;
        }
      }
      if (parent === null) return prev; // nothing above to nest under
      // A step with children cannot itself become a child - only two levels.
      if (prev.some((s) => s.parent_index === i)) return prev;
      return prev.map((s, idx) =>
        idx === i ? { ...s, parent_index: parent } : s
      );
    });
  };

  const save = async () => {
    const cleaned = steps.filter((s) => s.title.trim());
    if (!name.trim()) {
      setError("Give the procedure a name");
      return;
    }
    if (cleaned.length === 0) {
      setError("Add at least one step");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(
        procedureId ? `/api/procedures/${procedureId}` : "/api/procedures",
        {
          method: procedureId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            applies_to: appliesTo,
        tenant_type: tenantType || null,
            enforce_order: enforceOrder,
            steps: cleaned,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not save the procedure");
        return;
      }
      onSaved?.();
      onClose();
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={procedureId ? "Edit procedure" : "New procedure"}
      subtitle={
        existing && existing.version > 1
          ? `Version ${existing.version}. Editing the steps creates a new version; runs already under way keep the rules they started with.`
          : "Steps become tasks when the procedure is run."
      }
      size="3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-slate-400">
            {steps.filter((s) => s.title.trim()).length} step(s)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void save()}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : procedureId ? "Save changes" : "Create"}
            </button>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Site Measurement Visit"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Applies to
              </label>
              <select
                value={appliesTo}
                onChange={(e) =>
                  setAppliesTo(e.target.value as TaskRelatedType)
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Business type
              </label>
              <select
                value={tenantType}
                onChange={(e) => setTenantType(e.target.value)}
                title="Who this playbook is written for. Blank suits any."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Any</option>
                <option value="interiors">Interiors</option>
                <option value="architect">Architect</option>
                <option value="vendor">Vendor</option>
                <option value="factory">Factory</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this procedure for?"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <label className="flex items-start gap-2 px-3 py-2 rounded-md bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={enforceOrder}
              onChange={(e) => setEnforceOrder(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-slate-600">
              <span className="font-medium text-slate-700">
                Steps must be done in order
              </span>
              <span className="block text-slate-500">
                A step cannot start until the ones before it are finished,
                cancelled or skipped. Leave off to let the team work in any
                order.
              </span>
            </span>
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Steps
              </label>
              <span className="text-[11px] text-slate-400">
                ▲▼ reorder · → nest · days = how long the step takes
              </span>
            </div>

            <div className="space-y-1.5">
              {steps.map((step, i) => {
                const colors = ProcedureActionColors[step.action_type];
                const isChild = step.parent_index !== null;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-1.5 ${isChild ? "pl-8" : ""}`}
                  >
                    <div className="mt-1 shrink-0 flex flex-col">
                      <button
                        type="button"
                        onClick={() => moveStep(i, -1)}
                        title="Move up"
                        className="w-6 h-4 flex items-center justify-center rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 text-[10px]"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(i, 1)}
                        title="Move down"
                        className="w-6 h-4 flex items-center justify-center rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 text-[10px]"
                      >
                        ▼
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleIndent(i)}
                      title={isChild ? "Move out" : "Nest under the step above"}
                      className="mt-1.5 shrink-0 w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50"
                    >
                      {isChild ? "←" : "→"}
                    </button>

                    <div className="flex-1 space-y-1.5">
                      <div className="flex gap-1.5">
                        <input
                          value={step.title}
                          onChange={(e) => update(i, { title: e.target.value })}
                          placeholder={`Step ${i + 1}`}
                          className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <select
                          value={step.action_type}
                          onChange={(e) =>
                            update(i, {
                              action_type: e.target
                                .value as ProcedureActionType,
                            })
                          }
                          className={`px-2 py-1.5 text-xs font-medium rounded-md border ${colors.bg} ${colors.text} ${colors.border} focus:outline-none`}
                        >
                          {ACTION_TYPES.map((a) => (
                            <option key={a} value={a}>
                              {ProcedureActionLabels[a]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeStep(i)}
                          title="Remove"
                          className="shrink-0 w-8 flex items-center justify-center rounded-md text-slate-300 hover:text-red-600 hover:bg-red-50"
                        >
                          ×
                        </button>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={step.can_skip}
                            onChange={(e) =>
                              update(i, { can_skip: e.target.checked })
                            }
                          />
                          Skippable
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={step.is_required}
                            onChange={(e) =>
                              update(i, { is_required: e.target.checked })
                            }
                          />
                          Required
                        </label>
                        <span className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            value={step.duration_days ?? ""}
                            onChange={(e) =>
                              update(i, {
                                duration_days: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            placeholder="—"
                            title="How many days this step takes. Due dates are worked out from this."
                            className="w-12 px-1.5 py-0.5 border border-slate-200 rounded text-center"
                          />
                          <span>days</span>
                        </span>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={step.allow_parallel}
                            onChange={(e) =>
                              update(i, { allow_parallel: e.target.checked })
                            }
                          />
                          <span title="May run alongside its siblings instead of waiting its turn.">
                            Parallel
                          </span>
                        </label>
                        {step.can_skip && (
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={step.skip_requires_reason}
                              onChange={(e) =>
                                update(i, {
                                  skip_requires_reason: e.target.checked,
                                })
                              }
                            />
                            <span title="Skipping this step has to be explained.">
                              Reason to skip
                            </span>
                          </label>
                        )}
                      </div>

                      {/* The gate for this step, shown only where it applies -
                          an upload step needs to say what file, an approval
                          step needs to say who signs. */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        {step.action_type === "upload" && (
                          <span className="flex items-center gap-1.5 flex-1">
                            <span className="text-blue-600 whitespace-nowrap">
                              needs a file:
                            </span>
                            <input
                              type="text"
                              value={(step.required_upload_types ?? []).join(", ")}
                              onChange={(e) =>
                                update(i, {
                                  required_upload_types: e.target.value
                                    .split(",")
                                    .map((v) => v.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="drawing, photo — leave blank for any"
                              className="flex-1 px-1.5 py-0.5 border border-slate-200 rounded"
                            />
                          </span>
                        )}
                        {step.action_type === "approval" && (
                          <span className="flex items-center gap-1.5 flex-1">
                            <span className="text-amber-600 whitespace-nowrap">
                              signed off by:
                            </span>
                            <input
                              type="text"
                              value={step.approval_role ?? ""}
                              onChange={(e) =>
                                update(i, {
                                  approval_role: e.target.value || null,
                                })
                              }
                              placeholder="role slug, e.g. design_manager"
                              className="flex-1 px-1.5 py-0.5 border border-slate-200 rounded"
                            />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addStep}
              className="mt-2 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              + Add step
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default ProcedureBuilderModal;

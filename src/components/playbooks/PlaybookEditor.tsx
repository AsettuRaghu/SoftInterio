"use client";

/**
 * Create or edit a playbook.
 *
 * Steps are held as a FLAT list with a parent index rather than a tree. The
 * data is only ever two levels deep, and a flat list makes reordering and
 * indenting trivial - a nested structure would need rebuilding on every move.
 */

import React, { useCallback, useEffect, useState } from "react";
import type { TaskRelatedType } from "@/types/tasks";
import {
  PlaybookActionColors,
  PlaybookActionLabels,
  type PlaybookActionType,
  type PlaybookDefinition,
} from "@/types/playbooks";

interface DraftStep {
  /**
   * Identity while being edited, for collapsing and dragging.
   *
   * Not the database id - a step being written has none - and not the array
   * index, which changes the moment anything is reordered.
   */
  uid: string;
  /** Present for a step that already exists; absent for a new one. */
  step_key?: string;
  title: string;
  action_type: PlaybookActionType;
  /** Index of the parent in this same array; null = top level. */
  parent_index: number | null;
  is_required: boolean;
  can_skip: boolean;
  assign_to_role: string | null;
  /** The person who does this step, chosen when the playbook is written. */
  assign_to_user: string | null;
  priority: string;
  estimated_hours: number | null;
  /** How long the step takes. Dates are derived from this, not typed. */
  duration_days: number | null;
  instructions: string | null;
  /** Who signs a step off. Only meaningful for an approval step. */
  approval_role: string | null;
  /** What must be attached before an upload step can complete. */
  required_upload_types: string[] | null;
  checklist_items: string[] | null;
  /** Indexes of steps that must finish first. Holds whatever the ordering says. */
  depends_on: number[];
  /**
   * Carried through untouched.
   *
   * The editor has no control for these, and a save rebuilds every step from
   * this object - so anything not held here is silently dropped the first time
   * somebody edits the playbook for an unrelated reason.
   */
  description?: string | null;
  form_schema?: Record<string, unknown> | null;
  /** May run alongside its siblings instead of waiting for them. */
  allow_parallel: boolean;
  /** Skipping has to be explained. */
  skip_requires_reason: boolean;
}

interface Props {
  /** Called when the user backs out without saving. */
  onCancel: () => void;
  /** Omit to create a new one. */
  playbookId?: string | null;
  onSaved?: () => void;
}

const ACTION_TYPES: PlaybookActionType[] = [
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
/**
 * Re-derive every child's parent from where it now sits.
 *
 * Nesting is one level deep, so a child belongs to the nearest top-level step
 * above it. Deriving that after a move means dragging a child under a
 * different parent needs no special handling - it simply lands somewhere else
 * and belongs to whatever it landed under.
 */
function renest(next: DraftStep[]): DraftStep[] {
  let lastTop = -1;
  return next.map((s, i) => {
    if (s.parent_index === null) {
      lastTop = i;
      return s;
    }
    return { ...s, parent_index: lastTop >= 0 ? lastTop : null };
  });
}

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

let uidCounter = 0;
const newUid = () => `s${++uidCounter}`;

const blankStep = (): DraftStep => ({
  uid: newUid(),
  title: "",
  action_type: "manual",
  parent_index: null,
  is_required: true,
  // Skippable by default, with a reason required. A step nobody can skip and
  // nobody can delete has no honest way out, and people answer that by marking
  // work complete that never happened.
  can_skip: true,
  assign_to_role: null,
  assign_to_user: null,
  priority: "medium",
  estimated_hours: null,
  duration_days: null,
  instructions: null,
  approval_role: null,
  required_upload_types: null,
  checklist_items: null,
  depends_on: [],
  allow_parallel: false,
  skip_requires_reason: true,
});

/**
 * Authoring a playbook is a page, not a dialog.
 *
 * A real process is twenty-five nested steps, each carrying an owner, a gate,
 * a duration, a priority and an effort. That never fitted a modal, and the
 * things still to come - a field builder for form steps, a dependency picker -
 * need more room again, not less.
 */
export function PlaybookEditor({ onCancel, playbookId, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [appliesTo, setAppliesTo] = useState<TaskRelatedType>("project");
  // Which kind of business this playbook is written for. An interiors firm
  // and an architecture practice run different processes; leaving it blank
  // says the playbook suits either.
  const [tenantType, setTenantType] = useState<string>("");
  const [steps, setSteps] = useState<DraftStep[]>([blankStep()]);
  // Naming a person is the point of configuring a playbook once: adopt it,
  // start it, and the work is already on the right desks.
  const [people, setPeople] = useState<
    { id: string; name: string; roles: string[] }[]
  >([]);
  const [roles, setRoles] = useState<{ slug: string; name: string }[]>([]);
  const [enforceOrder, setEnforceOrder] = useState(false);
  const [status, setStatus] = useState<
    "draft" | "committed" | "superseded" | "retired"
  >("draft");
  const [autoStart, setAutoStart] = useState(false);
  const [autoStartCategory, setAutoStartCategory] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<PlaybookDefinition | null>(null);

  const reset = useCallback(() => {
    setName("");
    setDescription("");
    setAppliesTo("project");
    setSteps([blankStep()]);
    setTenantType("");
    setStatus("draft");
    setAutoStart(false);
    setAutoStartCategory("");
    setEnforceOrder(false);
    setError(null);
    setExisting(null);
  }, []);

  useEffect(() => {
    if (!playbookId) {
      reset();
      return;
    }

    setIsLoading(true);
    (async () => {
      try {
        const response = await fetch(`/api/playbooks/${playbookId}`);
        if (!response.ok) {
          setError("Could not load the playbook");
          return;
        }
        const data = await response.json();
        setExisting(data.playbook);
        setName(data.playbook.name);
        setDescription(data.playbook.description || "");
        setAppliesTo(data.playbook.applies_to);
        setTenantType(data.playbook.tenant_type ?? "");
        setEnforceOrder(data.playbook.enforce_order === true);
        setStatus(data.playbook.status ?? "draft");
        setAutoStart(data.playbook.auto_start === true);
        setAutoStartCategory(data.playbook.auto_start_project_category ?? "");

        // Flatten: parents in order, each followed by its children, so the
        // editor's parent_index refers to a position in this same array.
        const raw = data.steps || [];
        const tops = raw.filter((s: any) => !s.parent_step_id);
        const flat: DraftStep[] = [];
        const idToIndex = new Map<string, number>();
        // Where each database row ended up, so dependencies can be resolved by
        // identity rather than by matching titles.
        const indexOfRawId = new Map<string, number>();
        for (const t of tops) {
          idToIndex.set(t.id, flat.length);
          indexOfRawId.set(t.id, flat.length);
          flat.push({
            uid: newUid(),
            step_key: t.step_key,
            title: t.title,
            action_type: t.action_type,
            parent_index: null,
            is_required: t.is_required,
            can_skip: t.can_skip,
            assign_to_role: t.assign_to_role,
            assign_to_user: t.assign_to_user ?? null,
            priority: t.priority || "medium",
            estimated_hours: t.estimated_hours ?? null,
            // Legacy; hours drive the date now. Cleared on edit so the
            // number shown is the number that applies.
            duration_days: null,
            instructions: t.instructions,
            approval_role: t.approval_role ?? null,
            required_upload_types: t.required_upload_types ?? null,
            checklist_items: t.checklist_items ?? null,
            description: t.description ?? null,
            form_schema: t.form_schema ?? null,
            depends_on: [],
            allow_parallel: t.allow_parallel === true,
            skip_requires_reason: t.skip_requires_reason !== false,
          });
          for (const c of raw.filter((s: any) => s.parent_step_id === t.id)) {
            indexOfRawId.set(c.id, flat.length);
            flat.push({
              uid: newUid(),
              step_key: c.step_key,
              title: c.title,
              action_type: c.action_type,
              parent_index: idToIndex.get(t.id) ?? null,
              is_required: c.is_required,
              can_skip: c.can_skip,
              assign_to_role: c.assign_to_role,
              assign_to_user: c.assign_to_user ?? null,
              priority: c.priority || "medium",
              estimated_hours: c.estimated_hours ?? null,
              duration_days: null,
              instructions: c.instructions,
              approval_role: c.approval_role ?? null,
              required_upload_types: c.required_upload_types ?? null,
              checklist_items: c.checklist_items ?? null,
              description: c.description ?? null,
              form_schema: c.form_schema ?? null,
              depends_on: [],
              allow_parallel: c.allow_parallel === true,
              skip_requires_reason: c.skip_requires_reason !== false,
            });
          }
        }
        /**
         * Dependencies arrive as step ids; the editor works in indexes,
         * because a step being written has no id yet.
         *
         * The position is recorded as each step is flattened. Matching on the
         * title instead - which this did - puts every "Internal Review" on the
         * first one of them, and this playbook has four.
         */
        raw.forEach((r: any) => {
          const at = indexOfRawId.get(r.id);
          if (at === undefined) return;
          flat[at].depends_on = (r.depends_on_step_ids || [])
            .map((id: string) => indexOfRawId.get(id))
            .filter((n: number | undefined): n is number => n !== undefined);
        });

        setSteps(flat.length ? flat : [blankStep()]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [playbookId, reset]);

  const update = (i: number, patch: Partial<DraftStep>) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const addStep = () => setSteps((prev) => [...prev, blankStep()]);

  // Collapsed parents, by uid. Twenty-five steps do not fit on a screen, and
  // moving a phase is much easier when its children are folded away.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const parentUids = steps
    .filter((s) => s.parent_index === null)
    .map((s) => s.uid);
  const allCollapsed =
    parentUids.length > 0 && parentUids.every((u) => collapsed.has(u));

  const toggleCollapse = (uid: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const collapseAll = () => setCollapsed(new Set(parentUids));
  const expandAll = () => setCollapsed(new Set());

  /**
   * Drop a step, or a whole phase, where it was dragged.
   *
   * A top-level step brings its children with it - moving a phase means moving
   * the work under it, not stranding it. A child moves alone and belongs to
   * whatever phase it lands under, which renest works out from position.
   */
  const handleDrop = (targetIndex: number) => {
    setDropTarget(null);
    const uid = dragging;
    setDragging(null);
    if (!uid) return;

    setSteps((prev) => {
      const from = prev.findIndex((s) => s.uid === uid);
      if (from < 0) return prev;

      const isParent = prev[from].parent_index === null;
      let end = from;
      if (isParent) {
        while (end + 1 < prev.length && prev[end + 1].parent_index !== null) {
          end += 1;
        }
      }

      const block = prev.slice(from, end + 1);
      const rest = [...prev.slice(0, from), ...prev.slice(end + 1)];

      // The target was measured against the original array, so anything after
      // the block that was lifted out has shifted down by its length.
      let at = targetIndex;
      if (targetIndex > end) at = targetIndex - block.length;
      at = Math.max(0, Math.min(at, rest.length));

      return renest([...rest.slice(0, at), ...block, ...rest.slice(at)]);
    });
  };

  /**
   * Commit, revise or retire. Revising opens the next version so the steps can
   * change again; plans already running keep the version they started under.
   */
  const lifecycle = async (action: "commit" | "revise" | "retire") => {
    if (!playbookId) return;
    setError(null);
    const res = await fetch(`/api/playbooks/${playbookId}/lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not change the playbook");
      return;
    }
    // Revising opens the next version beside this one, so the editor follows
    // it. The version still in service is left exactly as it was.
    if (data.draftId) {
      window.location.href = `/dashboard/settings/playbooks/${data.draftId}`;
      return;
    }
    setStatus(data.status);
  };

  React.useEffect(() => {
    void (async () => {
      try {
        const [membersRes, rolesRes] = await Promise.all([
          fetch("/api/team/members"),
          fetch("/api/team/roles"),
        ]);
        const members = await membersRes.json();
        if (membersRes.ok && members.success && members.data) {
          setPeople(
            members.data.map((m: any) => ({
              id: m.id,
              name: m.name,
              roles: (m.roles || []).map((r: any) => r.slug),
            })),
          );
        }
        const roleData = await rolesRes.json();
        if (rolesRes.ok && roleData.success && roleData.data) {
          setRoles(
            roleData.data.map((r: any) => ({ slug: r.slug, name: r.name })),
          );
        }
      } catch {
        // Without the list a step simply cannot name anyone yet.
      }
    })();
  }, []);

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
    // Dropping untitled rows shifts every index after them, and both
    // parent_index and depends_on are indexes into this list. Remap rather
    // than let a blank row in the middle silently re-parent the steps below
    // it - which it would have done before.
    const keptIndexes = steps
      .map((s, i) => (s.title.trim() ? i : -1))
      .filter((i) => i >= 0);
    const newIndexOf = new Map<number, number>(
      keptIndexes.map((old, next) => [old, next])
    );
    const cleaned = keptIndexes.map((old) => {
      const s = steps[old];
      return {
        ...s,
        parent_index:
          s.parent_index === null
            ? null
            : (newIndexOf.get(s.parent_index) ?? null),
        depends_on: s.depends_on
          .map((d) => newIndexOf.get(d))
          .filter((d): d is number => d !== undefined),
      };
    });
    if (!name.trim()) {
      setError("Give the playbook a name");
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
        playbookId ? `/api/playbooks/${playbookId}` : "/api/playbooks",
        {
          method: playbookId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            applies_to: appliesTo,
        tenant_type: tenantType || null,
            enforce_order: enforceOrder,
            auto_start: autoStart,
            auto_start_project_category: autoStartCategory || null,
            steps: cleaned,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not save the playbook");
        return;
      }
      onSaved?.();
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {existing && existing.version > 1 && (
        <p className="text-xs text-slate-500">
          Version {existing.version}. Editing the steps creates a new version;
          runs already under way keep the rules they started with.
        </p>
      )}

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
              placeholder="What is this playbook for?"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {playbookId && (
            <div className="flex items-start gap-3 px-3 py-2 rounded-md bg-slate-50 border border-slate-200">
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  status === "committed"
                    ? "bg-green-100 text-green-700"
                    : status === "retired"
                      ? "bg-slate-200 text-slate-600"
                      : "bg-amber-100 text-amber-700"
                }`}
              >
                {status === "committed"
                  ? "In service"
                  : status === "retired"
                    ? "Retired"
                    : status === "superseded"
                      ? "Superseded"
                      : "Draft"}
              </span>
              <span className="text-xs text-slate-500 flex-1">
                {status === "draft"
                  ? "Being written. The steps can change, and it cannot be run until it is put into service."
                  : status === "committed"
                    ? "In service. Revising opens the next version beside this one — this stays adoptable while you write it."
                    : status === "superseded"
                      ? "Superseded by a later version. Plans that adopted it carry on following it."
                      : "Retired. Plans already running it carry on untouched; no new project will adopt it."}
              </span>
              <div className="flex gap-2 shrink-0">
                {status === "draft" && (
                  <button
                    type="button"
                    onClick={() => void lifecycle("commit")}
                    className="px-2 py-1 text-xs font-medium rounded border border-green-300 text-green-700 hover:bg-green-50"
                  >
                    Put into service
                  </button>
                )}
                {status === "committed" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void lifecycle("revise")}
                      className="px-2 py-1 text-xs font-medium rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      Revise
                    </button>
                    <button
                      type="button"
                      onClick={() => void lifecycle("retire")}
                      className="px-2 py-1 text-xs font-medium rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                    >
                      Retire
                    </button>
                  </>
                )}
                {status === "retired" && (
                  <button
                    type="button"
                    onClick={() => void lifecycle("commit")}
                    className="px-2 py-1 text-xs font-medium rounded border border-green-300 text-green-700 hover:bg-green-50"
                  >
                    Put back into service
                  </button>
                )}
              </div>
            </div>
          )}

          {appliesTo === "project" && (
            <div className="px-3 py-2 rounded-md bg-slate-50 border border-slate-200">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoStart}
                  onChange={(e) => setAutoStart(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-xs text-slate-600">
                  <span className="font-medium text-slate-700">
                    Start this automatically on new projects
                  </span>
                  <span className="block text-slate-500">
                    A won lead becoming a project picks this up by itself, so
                    adopting the process does not mean remembering to apply it.
                  </span>
                </span>
              </label>
              {autoStart && (
                <div className="mt-2 pl-6 flex items-center gap-2">
                  <span className="text-xs text-slate-500">for</span>
                  <select
                    value={autoStartCategory}
                    onChange={(e) => setAutoStartCategory(e.target.value)}
                    className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                  >
                    <option value="">any project</option>
                    {[
                      "turnkey",
                      "modular",
                      "renovation",
                      "consultation",
                      "commercial_fitout",
                      "hybrid",
                      "other",
                    ].map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, " ")} projects
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-400">
                    A playbook naming a category wins over one taking any.
                  </span>
                </div>
              )}
            </div>
          )}

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
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400">
                  drag ⠿ to move · → nest · a phase moves with its steps · ▲▼ on hover
                </span>
                {parentUids.length > 0 && (
                  <button
                    type="button"
                    onClick={() => (allCollapsed ? expandAll() : collapseAll())}
                    className="text-[11px] font-medium text-blue-600 hover:underline"
                  >
                    {allCollapsed ? "Expand all" : "Collapse all"}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              {steps.map((step, i) => {
                const colors = PlaybookActionColors[step.action_type];
                const isChild = step.parent_index !== null;

                // A child of a folded phase is not rendered at all, so the
                // list shows the shape of the process rather than every line.
                const parentUid =
                  isChild && step.parent_index !== null
                    ? steps[step.parent_index]?.uid
                    : null;
                if (parentUid && collapsed.has(parentUid)) return null;

                const childCount = isChild
                  ? 0
                  : steps.filter((c) => c.parent_index === i).length;
                const isCollapsed = collapsed.has(step.uid);

                return (
                  <div
                    key={step.uid}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dropTarget !== i) setDropTarget(i);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(i);
                    }}
                    className={`group flex items-start gap-1.5 ${isChild ? "pl-8" : ""} ${
                      dragging === step.uid ? "opacity-40" : ""
                    } ${
                      dropTarget === i && dragging && dragging !== step.uid
                        ? "border-t-2 border-blue-400"
                        : "border-t-2 border-transparent"
                    }`}
                  >
                    <div className="mt-1 shrink-0 flex flex-col">
                      <span
                        draggable
                        onDragStart={() => setDragging(step.uid)}
                        onDragEnd={() => {
                          setDragging(null);
                          setDropTarget(null);
                        }}
                        title="Drag to move"
                        className="w-6 h-4 flex items-center justify-center text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing select-none"
                      >
                        ⠿
                      </span>
                      <button
                        type="button"
                        onClick={() => moveStep(i, -1)}
                        title="Move up"
                        className="w-6 h-4 flex items-center justify-center rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 text-[10px] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(i, 1)}
                        title="Move down"
                        className="w-6 h-4 flex items-center justify-center rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 text-[10px] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
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

                    {!isChild && childCount > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleCollapse(step.uid)}
                        title={
                          isCollapsed
                            ? `Show ${childCount} step${childCount === 1 ? "" : "s"}`
                            : "Fold this phase away"
                        }
                        className="mt-1.5 shrink-0 h-6 px-1 flex items-center justify-center rounded text-[10px] text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                      >
                        {isCollapsed ? `▸ ${childCount}` : "▾"}
                      </button>
                    )}

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
                                .value as PlaybookActionType,
                            })
                          }
                          className={`px-2 py-1.5 text-xs font-medium rounded-md border ${colors.bg} ${colors.text} ${colors.border} focus:outline-none`}
                        >
                          {ACTION_TYPES.map((a) => (
                            <option key={a} value={a}>
                              {PlaybookActionLabels[a]}
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

                      {/* Who does it. The role narrows the assignee list, so
                          picking "Project Manager" leaves only the people who
                          are one. Setting the role but not the person is the
                          useful middle: the template fixes the discipline and
                          the project decides the name. */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="text-slate-400">Owner</span>
                        <select
                          value={step.assign_to_role ?? ""}
                          onChange={(e) => {
                            const role = e.target.value || null;
                            // Drop an assignee who does not hold the new role,
                            // rather than leaving a contradiction on screen.
                            const keeps =
                              !role ||
                              !step.assign_to_user ||
                              people.some(
                                (p) =>
                                  p.id === step.assign_to_user &&
                                  p.roles.includes(role),
                              );
                            update(i, {
                              assign_to_role: role,
                              assign_to_user: keeps ? step.assign_to_user : null,
                            });
                          }}
                          title="Any role, or one that narrows who can be picked"
                          className="px-1.5 py-0.5 border border-slate-200 rounded bg-white max-w-[9rem]"
                        >
                          <option value="">Any role</option>
                          {roles.map((r) => (
                            <option key={r.slug} value={r.slug}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={step.assign_to_user ?? ""}
                          onChange={(e) =>
                            update(i, {
                              assign_to_user: e.target.value || null,
                            })
                          }
                          title="Leave unassigned to let the project decide who"
                          className="px-1.5 py-0.5 border border-slate-200 rounded bg-white max-w-[9rem]"
                        >
                          <option value="">
                            {step.assign_to_role
                              ? "Decide per project"
                              : "Unassigned"}
                          </option>
                          {people
                            .filter(
                              (p) =>
                                !step.assign_to_role ||
                                p.roles.includes(step.assign_to_role),
                            )
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>

                        <span className="text-slate-300">|</span>
                        <select
                          value={step.priority}
                          onChange={(e) => update(i, { priority: e.target.value })}
                          title="Priority of the task this step becomes"
                          className="px-1.5 py-0.5 border border-slate-200 rounded bg-white"
                        >
                          {["low", "medium", "high", "urgent"].map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* What has to finish first. A named dependency holds
                          whether or not the playbook enforces order, which is
                          how "3D waits on the layout sign-off but the ceiling
                          quote runs alongside" gets said. */}
                      {i > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="text-slate-400">Waits for</span>
                          {steps.slice(0, i).some((s) => s.title.trim()) ? (
                            <>
                              <select
                                value=""
                                onChange={(e) => {
                                  const n = Number(e.target.value);
                                  if (Number.isNaN(n)) return;
                                  if (step.depends_on.includes(n)) return;
                                  update(i, {
                                    depends_on: [...step.depends_on, n],
                                  });
                                }}
                                className="px-1.5 py-0.5 border border-slate-200 rounded bg-white max-w-[12rem]"
                              >
                                <option value="">add a step…</option>
                                {steps.slice(0, i).map((s, n) =>
                                  s.title.trim() &&
                                  !step.depends_on.includes(n) ? (
                                    <option key={n} value={n}>
                                      {s.title}
                                    </option>
                                  ) : null,
                                )}
                              </select>
                              {step.depends_on.length === 0 && (
                                <span className="text-slate-400">
                                  nothing — starts when its turn comes
                                </span>
                              )}
                              {step.depends_on.map((n) => (
                                <span
                                  key={n}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
                                >
                                  {steps[n]?.title || `Step ${n + 1}`}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      update(i, {
                                        depends_on: step.depends_on.filter(
                                          (x) => x !== n,
                                        ),
                                      })
                                    }
                                    className="text-amber-500 hover:text-amber-800"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </>
                          ) : (
                            <span className="text-slate-400">
                              name an earlier step first
                            </span>
                          )}
                        </div>
                      )}

                      {/* One number, in hours. It is what actual_hours is
                          measured against afterwards, which is how a team sees
                          where the time really goes. The due date is derived
                          from it. */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="text-slate-400">Expected</span>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={step.estimated_hours ?? ""}
                            onChange={(e) =>
                              update(i, {
                                estimated_hours: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            placeholder="—"
                            title="How long this should take. Compared against the hours actually logged, so overruns show up."
                            className="w-14 px-1.5 py-0.5 border border-slate-200 rounded text-center"
                          />
                          <span>hours to complete</span>
                        </span>
                        {step.estimated_hours ? (
                          <span className="text-slate-400">
                            due about{" "}
                            {Math.max(1, Math.ceil(step.estimated_hours / 8))} day
                            {Math.max(1, Math.ceil(step.estimated_hours / 8)) === 1
                              ? ""
                              : "s"}{" "}
                            after it starts
                          </span>
                        ) : null}

                        <span className="text-slate-300">|</span>
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
                        {step.action_type === "checklist" && (
                          <span className="flex items-center gap-1.5 flex-1">
                            <span className="text-emerald-600 whitespace-nowrap">
                              must tick:
                            </span>
                            <input
                              type="text"
                              value={(step.checklist_items ?? []).join(", ")}
                              onChange={(e) =>
                                update(i, {
                                  checklist_items: e.target.value
                                    .split(",")
                                    .map((v) => v.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="comma separated, e.g. site cleared, power on, access granted"
                              className="flex-1 px-1.5 py-0.5 border border-slate-200 rounded"
                            />
                          </span>
                        )}
                        {step.action_type === "meeting" && (
                          <span className="text-violet-600">
                            asks for confirmation that the meeting took place —
                            it does not book anything
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
      <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {steps.filter((s) => s.title.trim()).length} step(s)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
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
            {isSaving ? "Saving..." : playbookId ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlaybookEditor;

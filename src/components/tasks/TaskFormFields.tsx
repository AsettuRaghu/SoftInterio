"use client";

/**
 * The fields a playbook form step asks for, on the task itself.
 *
 * The last of the eight action types to become real. `form` created a
 * requirement only when `form_schema` was set, nothing could set it, and
 * nothing would have rendered it if something had - so a form step was a
 * manual step wearing a different label.
 *
 * Deliberately plain text inputs. What a form step is for is capturing the few
 * facts that have to exist before work counts as done - a measurement, a site
 * contact, a batch number - and typing them is faster than any widget. A field
 * marked required blocks the task until it has an answer; the rest are there
 * because somebody wanted them recorded.
 */

import { useCallback, useEffect, useState } from "react";
import { uiLogger } from "@/lib/logger";

interface FormField {
  key: string;
  label: string;
  required?: boolean;
}

export function TaskFormFields({
  taskId,
  readOnly = false,
  onSaved,
}: {
  taskId: string;
  readOnly?: boolean;
  onSaved?: () => void;
}) {
  const [fields, setFields] = useState<FormField[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState<string>("{}");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/form`);
      if (!res.ok) {
        // Not a form step, which is the normal case - render nothing.
        setFields([]);
        return;
      }
      const json = await res.json();
      const loaded: Record<string, string> = {};
      for (const [k, v] of Object.entries(json.data.answers ?? {})) {
        loaded[k] = v == null ? "" : String(v);
      }
      setFields(json.data.fields ?? []);
      setAnswers(loaded);
      setBaseline(JSON.stringify(loaded));
    } catch (err) {
      uiLogger.error("Failed to load task form", err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = JSON.stringify(answers) !== baseline;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/form`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save");
      setBaseline(JSON.stringify(answers));
      setMissing(json.data.missing ?? []);
      onSaved?.();
    } catch (err: any) {
      uiLogger.error("Failed to save task form", err);
      setError(err.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading || fields.length === 0) return null;

  return (
    <div className="mt-2 rounded-md border border-sky-200 bg-sky-50/40 px-2.5 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 mb-1.5">
        Details to record
      </p>

      <div className="space-y-1.5">
        {fields.map((field) => (
          <label key={field.key} className="block">
            <span className="block text-[11px] text-slate-600 mb-0.5">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
            <input
              type="text"
              disabled={readOnly}
              value={answers[field.key] ?? ""}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 disabled:bg-slate-50"
            />
          </label>
        ))}
      </div>

      {error && <p className="mt-1.5 text-[11px] text-red-600">{error}</p>}

      {missing.length > 0 && (
        <p className="mt-1.5 text-[11px] text-amber-700">
          Still needed before this task can be completed:{" "}
          {missing.join(", ")}
        </p>
      )}

      {!readOnly && (
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={save}
          className="mt-2 px-2.5 py-1 rounded text-[11px] font-medium border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : dirty ? "Save details" : "Saved"}
        </button>
      )}
    </div>
  );
}

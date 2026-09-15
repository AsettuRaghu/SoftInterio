"use client";

/**
 * The project's delivery stages, in the header.
 *
 * Replaces three dots that tracked the record's status - new, in progress,
 * completed - where "in progress" covered everything from the first drawing to
 * the last snag. The question people actually ask is "where is this?", and the
 * page could not answer it.
 *
 * The stages are the tenant's own: top-level steps of whatever playbook the
 * project is running. Nothing here knows what an interiors project looks like,
 * which is the point - an architect practice's stages come from their playbook
 * and need no code change.
 *
 * A project with no playbook has no stages, and the strip says so rather than
 * inventing any.
 */

import { useCallback, useEffect, useState } from "react";
import { uiLogger } from "@/lib/logger";
import type { DerivedStages, ProjectStage } from "@/lib/projects/stages";

const DOT: Record<ProjectStage["status"], string> = {
  completed: "bg-emerald-500",
  in_progress: "bg-blue-600",
  not_started: "bg-slate-200",
  skipped: "bg-slate-300",
  cancelled: "bg-red-300",
};

const LABEL: Record<ProjectStage["status"], string> = {
  completed: "done",
  in_progress: "in progress",
  not_started: "not started",
  skipped: "skipped",
  cancelled: "cancelled",
};

export function StageStrip({
  projectId,
  onStageClick,
}: {
  projectId: string;
  /** Optional: jump to the plan when a stage is clicked. */
  onStageClick?: () => void;
}) {
  const [data, setData] = useState<DerivedStages | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/stages`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load stages");
      setData(json.data);
    } catch (err) {
      // A header decoration must never take the page down with it.
      uiLogger.error("Failed to load project stages", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="h-5 w-40 bg-slate-100 rounded animate-pulse" />;
  }

  // No playbook: say nothing rather than render an empty rail.
  if (!data || data.source === "none" || data.stages.length === 0) {
    return null;
  }

  const current = data.stages[data.currentIndex];

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="flex items-center gap-1"
        role="img"
        aria-label={`Stage ${data.currentIndex + 1} of ${data.stages.length}: ${current?.name ?? ""}`}
      >
        {data.stages.map((stage, index) => (
          <span
            key={stage.id}
            onClick={onStageClick}
            title={`${stage.name} — ${LABEL[stage.status]}${
              stage.stepCount
                ? ` (${stage.stepsDone}/${stage.stepCount} steps)`
                : ""
            }`}
            className={`h-1.5 rounded-full transition-all ${
              onStageClick ? "cursor-pointer" : ""
            } ${DOT[stage.status]} ${
              index === data.currentIndex ? "w-6" : "w-3"
            }`}
          />
        ))}
      </div>

      {current && (
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-700 truncate">
            {current.name}
          </p>
          <p className="text-[11px] text-slate-500">
            Stage {data.currentIndex + 1} of {data.stages.length}
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

/**
 * Pick a lost lead back up.
 *
 * A customer who went quiet in March rings back in September, and everything
 * that made the first conversation worth having is still on the record: the Scope
 * Sheet, the quotations, the notes, the pictures they liked. A stage change
 * touches none of it, so reopening is not a copy or a new lead - it is the same
 * lead, with its number and its whole history, carried on.
 *
 * Two stages are offered, because those are the two places a returning customer
 * actually rejoins: back to discussing what they want, or straight back to the
 * price. Anything earlier would ask again for facts the lead already holds.
 */

/**
 * Where it rejoins, and it depends on how it closed. A LOST lead was a real
 * opportunity, so it resumes mid-pipeline; a DISQUALIFIED one may never have
 * passed qualification, so it comes back through it. Kept in step with
 * `ValidStageTransitions`, which is what actually refuses.
 */
const STAGES: Record<string, { key: string; label: string; hint: string }[]> = {
  lost: [
    {
      key: "requirement_discussion",
      label: "Requirement Discussion",
      hint: "What they want is being worked out again - the Scope Sheet is where you carry on.",
    },
    {
      key: "proposal_discussion",
      label: "Proposal & Negotiation",
      hint: "Straight back to the price. The existing quotations are still here; a new one is created only if this lead never had one.",
    },
  ],
  disqualified: [
    {
      key: "qualified",
      label: "Qualified",
      hint: "It comes back through qualification, because a disqualified lead may never have passed it.",
    },
  ],
};

export default function ReopenLeadModal({
  isOpen,
  onClose,
  leadNumber,
  wasStage,
  lostReason,
  onReopen,
}: {
  isOpen: boolean;
  onClose: () => void;
  leadNumber: string | null;
  /** lost or disqualified - what it is being picked up from. */
  wasStage: string;
  lostReason?: string | null;
  onReopen: (toStage: string, note: string) => Promise<void>;
}) {
  const choices = STAGES[wasStage] ?? STAGES.lost;
  const [stage, setStage] = useState<string>(choices[0].key);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!note.trim()) {
      setError("Say why it is being reopened - it is the line somebody reads later.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onReopen(stage, note.trim());
      onClose();
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reopen this lead");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reopen ${leadNumber ?? "this lead"}`}
      subtitle={`It was marked ${wasStage === "lost" ? "lost" : "disqualified"}${lostReason ? ` - ${lostReason}` : ""}.`}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className={cn(buttonVariants({ variant: "outline" }))}>
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={() => void submit()} className={cn(buttonVariants())}>
            {busy ? "Reopening…" : "Reopen lead"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Pick up at</label>
          <div className="space-y-2">
            {choices.map((s) => (
              <label
                key={s.key}
                className={cn(
                  "flex gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer",
                  stage === s.key ? "border-blue-400 bg-blue-50/50" : "border-slate-200 hover:bg-slate-50"
                )}
              >
                <input
                  type="radio"
                  name="reopen-stage"
                  className="mt-0.5"
                  checked={stage === s.key}
                  onChange={() => setStage(s.key)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">{s.label}</span>
                  <span className="block text-xs text-slate-500">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Why is it being reopened? <span className="text-red-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            autoFocus
            placeholder="They rang back - the builder handed over and they want to restart the kitchen."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Goes on the timeline. The reason it was {wasStage === "lost" ? "lost" : "disqualified"} stays in the
            stage history, so both halves of the story are on record.
          </p>
        </div>

        {/* Said plainly, because it is the one thing that does not come back. */}
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Tasks and follow-ups cancelled when it closed do not return - a reopened lead starts a fresh
          conversation, not an old backlog. Everything else is untouched: the Scope Sheet, the quotations, the
          notes and the documents are all still here.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

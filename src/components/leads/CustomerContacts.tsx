"use client";

import { useCallback, useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { sortContacts } from "@/lib/partners/contacts";
import type { PartnerContact } from "@/types/partners";

/**
 * The people at a customer, where the conversation happens.
 *
 * A sale is rarely to one person: the wife chooses the finishes, the husband
 * approves the quotation, the father-in-law pays, and the brother-in-law is an
 * architect with opinions. Until now a lead held exactly one name and one
 * number - the `clients` row - and `partner_contacts` sat behind the Partners
 * screen with 30 partners holding 30 contacts, because the person on the call
 * is Sales and Sales holds no `partners.*` key.
 *
 * **Two facts, not one.** *Main contact* is who we ring, and there is exactly
 * one (a partial unique index holds it). *Decides* is who signs off, and any
 * number of people may. Collapsing them would lose the case the whole block
 * exists for.
 *
 * `contacts` seeds the list and then this component owns it: every add, edit
 * and delete takes the row the server returns, and nothing refetches the lead.
 * A follow-up tick used to reload the entire lead - thirteen queries over six
 * round trips - and a change this small must not do the same.
 */

interface Props {
  /** Where the writes go: the lead-scoped route, gated on lead access. */
  basePath: string;
  contacts: PartnerContact[];
  /** Whether the server would accept a write from this caller. */
  canEdit: boolean;
  /** The customer's own name, for the empty state. */
  customerName?: string | null;
}

type Draft = {
  name: string;
  designation: string;
  phone: string;
  email: string;
  notes: string;
  is_primary: boolean;
  is_decision_maker: boolean;
};

const BLANK: Draft = {
  name: "",
  designation: "",
  phone: "",
  email: "",
  notes: "",
  is_primary: false,
  is_decision_maker: false,
};

export default function CustomerContacts({ basePath, contacts, canEdit, customerName }: Props) {
  const [people, setPeople] = useState<PartnerContact[]>(() => sortContacts(contacts ?? []));
  /** null = closed, "new" = the add form, otherwise the id being edited. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const openAdd = () => {
    setDraft(BLANK);
    setEditing("new");
  };

  const openEdit = (c: PartnerContact) => {
    setDraft({
      name: c.name ?? "",
      designation: c.designation ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      notes: c.notes ?? "",
      is_primary: !!c.is_primary,
      is_decision_maker: !!c.is_decision_maker,
    });
    setEditing(c.id);
  };

  /** The server's sentence, not "something went wrong". */
  const why = useCallback(async (res: Response, fallback: string) => {
    const json = await res.json().catch(() => null);
    return (json?.error as string) || fallback;
  }, []);

  const save = async () => {
    if (busy) return;
    const name = draft.name.trim();
    if (!name) {
      setNotice("Give the contact a name");
      return;
    }
    if (!draft.phone.trim() && !draft.email.trim()) {
      setNotice("Add a phone number or an email, so there is a way to reach them");
      return;
    }
    setBusy(true);
    try {
      const isNew = editing === "new";
      const res = await fetch(isNew ? basePath : `${basePath}/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, name }),
      });
      if (!res.ok) {
        setNotice(await why(res, "Could not save the contact"));
        return;
      }
      const { data } = await res.json();
      setPeople((prev) => {
        // A new main contact demotes the old one, which the server did in the
        // same request - mirrored here so the list is right without a refetch.
        const demoted = data.is_primary
          ? prev.map((p) => (p.id === data.id ? p : { ...p, is_primary: false }))
          : prev;
        const without = demoted.filter((p) => p.id !== data.id);
        return sortContacts([...without, data]);
      });
      setEditing(null);
      setDraft(BLANK);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: PartnerContact) => {
    const ok = await confirm({
      title: `Remove ${c.name}?`,
      message: "They come off this customer everywhere, not just this lead.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`${basePath}/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        setNotice(await why(res, "Could not remove the contact"));
        return;
      }
      setPeople((prev) => prev.filter((p) => p.id !== c.id));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-slate-200 px-4 py-4">
      {confirmDialog}
      <Toast message={notice} onDismiss={() => setNotice(null)} />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          People we talk to
          {people.length > 0 && <span className="ml-1.5 text-slate-400">({people.length})</span>}
        </h4>
        {canEdit && editing !== "new" && (
          <button
            type="button"
            onClick={openAdd}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            + Add a person
          </button>
        )}
      </div>

      {people.length === 0 && editing !== "new" && (
        <p className="text-sm text-slate-500">
          Only {customerName || "one person"} so far.
          {canEdit && " Add the others who are part of this decision - a spouse, a parent, their architect."}
        </p>
      )}

      <div className="space-y-2">
        {people.map((c) =>
          editing === c.id ? (
            <ContactForm
              key={c.id}
              draft={draft}
              setDraft={setDraft}
              busy={busy}
              onSave={save}
              onCancel={() => setEditing(null)}
              isOnlyContact={people.length === 1}
            />
          ) : (
            <div
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-900">{c.name}</span>
                  {c.designation && <span className="text-xs text-slate-500">{c.designation}</span>}
                  {c.is_primary && (
                    <span
                      className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                      title="Who we ring about this customer"
                    >
                      Main contact
                    </span>
                  )}
                  {c.is_decision_maker && (
                    <span
                      className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                      title="This person signs off"
                    >
                      Decides
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-600">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="hover:text-blue-600 hover:underline">
                      {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="hover:text-blue-600 hover:underline break-all">
                      {c.email}
                    </a>
                  )}
                </div>
                {c.notes && <p className="mt-0.5 text-xs text-slate-500">{c.notes}</p>}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="text-xs text-slate-500 hover:text-slate-900 hover:underline"
                  >
                    Edit
                  </button>
                  {/* The main contact cannot be removed - somebody has to own the
                      relationship. Shown disabled with the reason rather than
                      hidden, so "why can I not remove this one" has an answer. */}
                  <button
                    type="button"
                    onClick={() => void remove(c)}
                    disabled={c.is_primary}
                    title={
                      c.is_primary
                        ? "Make somebody else the main contact first"
                        : `Remove ${c.name}`
                    }
                    className="text-xs text-slate-400 hover:text-red-600 hover:underline disabled:text-slate-300 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )
        )}

        {editing === "new" && (
          <ContactForm
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            onSave={save}
            onCancel={() => setEditing(null)}
            isOnlyContact={false}
          />
        )}
      </div>
    </div>
  );
}

function ContactForm({
  draft,
  setDraft,
  busy,
  onSave,
  onCancel,
  isOnlyContact,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** The last contact standing cannot stop being the main one. */
  isOnlyContact: boolean;
}) {
  const field =
    "w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 px-3 py-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          className={field}
          placeholder="Name"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          autoFocus
        />
        <input
          className={field}
          placeholder="Who they are — Wife, Father, their architect"
          value={draft.designation}
          onChange={(e) => set({ designation: e.target.value })}
        />
        <input
          className={field}
          placeholder="Phone"
          value={draft.phone}
          onChange={(e) => set({ phone: e.target.value })}
        />
        <input
          className={field}
          placeholder="Email"
          value={draft.email}
          onChange={(e) => set({ email: e.target.value })}
        />
      </div>
      <input
        className={field}
        placeholder="Anything worth remembering — best reached after 7pm"
        value={draft.notes}
        onChange={(e) => set({ notes: e.target.value })}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <label className="flex items-center gap-1.5 text-xs text-slate-700">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={draft.is_primary}
            disabled={isOnlyContact}
            onChange={(e) => set({ is_primary: e.target.checked })}
          />
          Main contact
          <span className="text-slate-400">— who we ring</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-700">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={draft.is_decision_maker}
            onChange={(e) => set({ is_decision_maker: e.target.checked })}
          />
          Decides
          <span className="text-slate-400">— signs off</span>
        </label>
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

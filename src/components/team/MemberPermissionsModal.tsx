"use client";

/**
 * Grant or revoke a single permission for one person.
 *
 * The point of this screen is that giving somebody one capability - approving
 * a quotation, say - should not mean inventing a role for them or editing a
 * role three other people share.
 *
 * Every permission shows where its current answer comes from, because "can
 * Raghu approve a quotation" and "why" are different questions and the second
 * one is what people actually ask. Three states:
 *
 *   from role   a role grants it; nothing has been decided for this person
 *   granted     given to this person directly, whatever their roles say
 *   revoked     taken from this person directly, even though a role grants it
 *
 * Clearing an override is deliberately distinct from revoking. Clearing hands
 * the decision back to their roles, which usually still grant it.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PERMISSIONS_BY_MODULE,
  type PermissionDefinition,
  type PermissionModule,
} from "@/types/roles-permissions";
import { XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { uiLogger } from "@/lib/logger";

interface OverrideRow {
  granted: boolean;
  reason: string | null;
  permission: { key: string } | { key: string }[] | null;
}

interface Props {
  memberId: string;
  memberName: string;
  onClose: () => void;
}

/** PostgREST types a to-one embed as an array often enough to be worth this. */
function keyOf(row: OverrideRow): string | null {
  const p = Array.isArray(row.permission) ? row.permission[0] : row.permission;
  return p?.key ?? null;
}

export function MemberPermissionsModal({ memberId, memberName, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [effective, setEffective] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [openModule, setOpenModule] = useState<PermissionModule | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/members/${memberId}/permissions`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Could not load permissions");
      }
      setEffective(new Set<string>(json.data.effective));
      setOverrides(
        new Map(
          (json.data.overrides as OverrideRow[])
            .map((row) => [keyOf(row), row.granted] as const)
            .filter((entry): entry is readonly [string, boolean] => !!entry[0])
        )
      );
      setIsSuperAdmin(!!json.data.isSuperAdmin);
      setError(null);
    } catch (err: any) {
      uiLogger.error("Failed to load member permissions", err);
      setError(err.message || "Could not load permissions");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  // Escape closes, which every other dialog in the app does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function apply(key: string, action: "grant" | "revoke" | "clear") {
    setSaving(key);
    setError(null);
    try {
      const res =
        action === "clear"
          ? await fetch(
              `/api/team/members/${memberId}/permissions?key=${encodeURIComponent(key)}`,
              { method: "DELETE" }
            )
          : await fetch(`/api/team/members/${memberId}/permissions`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key, granted: action === "grant" }),
            });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Could not save");
      }

      setEffective(new Set<string>(json.data.effective));
      setOverrides((prev) => {
        const next = new Map(prev);
        if (action === "clear") next.delete(key);
        else next.set(key, action === "grant");
        return next;
      });
    } catch (err: any) {
      uiLogger.error("Failed to change a member permission", err);
      setError(err.message || "Could not save");
    } finally {
      setSaving(null);
    }
  }

  const modules = useMemo(
    () =>
      (Object.keys(PERMISSIONS_BY_MODULE) as PermissionModule[]).sort((a, b) =>
        a.localeCompare(b)
      ),
    []
  );

  const query = search.trim().toLowerCase();

  const visible = useMemo(() => {
    const out = new Map<PermissionModule, PermissionDefinition[]>();
    for (const mod of modules) {
      const matches = PERMISSIONS_BY_MODULE[mod].filter(
        (p) =>
          !query ||
          p.key.toLowerCase().includes(query) ||
          (p.description ?? "").toLowerCase().includes(query)
      );
      if (matches.length) out.set(mod, matches);
    }
    return out;
  }, [modules, query]);

  const overrideCount = overrides.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Permissions for {memberName}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {overrideCount === 0
                ? "Everything below follows their roles. Grant or revoke to change one."
                : `${overrideCount} permission${overrideCount === 1 ? "" : "s"} set for this person directly.`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {isSuperAdmin && (
          <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This person is a super admin, so they already have every permission
            and nothing set here will change that.
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* search */}
        <div className="px-6 pt-4 pb-3">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search permissions, e.g. approve"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="space-y-2 py-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg" />
              ))}
            </div>
          ) : visible.size === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              No permission matches &ldquo;{search}&rdquo;.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {[...visible.entries()].map(([mod, perms]) => {
                // A search narrows things enough that collapsing hurts; without
                // one, 253 permissions in a flat list is unusable.
                const expanded = !!query || openModule === mod;
                return (
                  <div
                    key={mod}
                    className="border border-slate-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenModule(expanded && !query ? null : mod)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                    >
                      <span className="text-sm font-semibold text-slate-700 capitalize">
                        {mod}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {perms.filter((p) => effective.has(p.key)).length}/
                        {perms.length}
                      </span>
                    </button>

                    {expanded && (
                      <ul className="divide-y divide-slate-100">
                        {perms.map((perm) => {
                          const override = overrides.get(perm.key);
                          const held = effective.has(perm.key);
                          const busy = saving === perm.key;

                          return (
                            <li
                              key={perm.key}
                              className="flex items-center gap-3 px-4 py-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-slate-800 font-mono truncate">
                                  {perm.key}
                                </p>
                                {perm.description && (
                                  <p className="text-xs text-slate-500 truncate">
                                    {perm.description}
                                  </p>
                                )}
                              </div>

                              <span
                                className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded shrink-0 ${
                                  override === true
                                    ? "bg-blue-50 text-blue-700"
                                    : override === false
                                      ? "bg-red-50 text-red-700"
                                      : held
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {override === true
                                  ? "Granted"
                                  : override === false
                                    ? "Revoked"
                                    : held
                                      ? "From role"
                                      : "Not held"}
                              </span>

                              <div className="flex items-center gap-1 shrink-0">
                                {override === undefined ? (
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      apply(perm.key, held ? "revoke" : "grant")
                                    }
                                    className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                  >
                                    {busy ? "…" : held ? "Revoke" : "Grant"}
                                  </button>
                                ) : (
                                  <button
                                    disabled={busy}
                                    onClick={() => apply(perm.key, "clear")}
                                    className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                    title="Stop overriding this and follow their roles again"
                                  >
                                    {busy ? "…" : "Reset to role"}
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

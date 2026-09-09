"use client";

/**
 * Settings -> Roles.
 *
 * What each role may do, and where a tenant departs from what SoftInterio
 * ships. The roles seeded with the product are shared by every business on the
 * platform, so they are read-only here: the first edit takes a copy the tenant
 * owns and moves their people onto it. That happens on save rather than behind
 * a separate "customise" step, but it is said plainly before anyone saves.
 *
 * The per-person overlay lives elsewhere, on Settings -> Team. This screen is
 * about what a role means; that one is about one individual's exceptions.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  PERMISSIONS_BY_MODULE,
  type PermissionModule,
} from "@/types/roles-permissions";
import { uiLogger } from "@/lib/logger";
import {
  ShieldCheckIcon,
  PlusIcon,
  TrashIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

interface RoleSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hierarchyLevel: number;
  isSystem: boolean;
  isOwn: boolean;
  isLocked: boolean;
  /** True when this caller may not change this role - see lib/auth/role-guard. */
  isRestricted: boolean;
  restrictedReason: string | null;
  permissionCount: number;
  memberCount: number;
}

const TIER_LABEL: Record<number, string> = {
  0: "Owner",
  1: "Administrator",
  2: "Manager",
  3: "Staff",
  4: "Limited",
};

export default function RolesPage() {
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canManage = hasPermission("team.roles.manage");
  // Owner is locked for everyone, so the editor is read-only on it regardless
  // of who is looking. The server and the database both refuse it too; this
  // just means nobody gets as far as a save button that cannot work.
  const canEditSelected = (role: RoleSummary | null) =>
    canManage && !!role && !role.isLocked && !role.isRestricted;

  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [baselineKeys, setBaselineKeys] = useState<Set<string>>(new Set());
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  const loadRoles = useCallback(async (keepId?: string) => {
    try {
      const res = await fetch("/api/team/roles/manage");
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not load roles");
      setRoles(json.data.roles);
      setSelectedId((prev) => keepId ?? prev ?? json.data.roles[0]?.id ?? null);
      setError(null);
    } catch (err: any) {
      uiLogger.error("Failed to load roles", err);
      setError(err.message || "Could not load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Load the selected role's permissions.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    (async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/team/roles/${selectedId}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Could not load role");
        if (cancelled) return;
        const keys = new Set<string>(json.data.keys);
        setSelectedKeys(keys);
        setBaselineKeys(new Set(keys));
      } catch (err: any) {
        if (!cancelled) {
          uiLogger.error("Failed to load role detail", err);
          setError(err.message || "Could not load role");
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const dirty = useMemo(() => {
    if (selectedKeys.size !== baselineKeys.size) return true;
    for (const k of selectedKeys) if (!baselineKeys.has(k)) return true;
    return false;
  }, [selectedKeys, baselineKeys]);

  function toggle(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleModule(mod: PermissionModule, on: boolean) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const p of PERMISSIONS_BY_MODULE[mod]) {
        on ? next.add(p.key) : next.delete(p.key);
      }
      return next;
    });
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/team/roles/${selected.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: Array.from(selectedKeys) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not save");

      setBaselineKeys(new Set(selectedKeys));
      setNotice(json.message || "Role updated");
      // A shipped role becomes a different row on first edit, so follow the id
      // the server actually wrote rather than the one we asked about.
      await loadRoles(json.data.roleId);
      setSelectedId(json.data.roleId);
    } catch (err: any) {
      uiLogger.error("Failed to save role", err);
      setError(err.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function createRole() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/team/roles/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, hierarchyLevel: 3 }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not create");
      setCreating(false);
      setNewName("");
      setNotice(`Created ${name}. It has no permissions yet — tick what it should be able to do.`);
      await loadRoles(json.data.role.id);
      setSelectedId(json.data.role.id);
    } catch (err: any) {
      setError(err.message || "Could not create the role");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role: RoleSummary) {
    if (!confirm(`Delete the ${role.name} role? This cannot be undone.`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/roles/${role.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not delete");
      setNotice(`${role.name} deleted`);
      setSelectedId(null);
      await loadRoles();
    } catch (err: any) {
      setError(err.message || "Could not delete the role");
    } finally {
      setSaving(false);
    }
  }

  const query = search.trim().toLowerCase();
  const modules = useMemo(
    () => (Object.keys(PERMISSIONS_BY_MODULE) as PermissionModule[]).sort(),
    []
  );

  const visibleModules = useMemo(() => {
    const out = new Map<PermissionModule, typeof PERMISSIONS_BY_MODULE[PermissionModule]>();
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

  if (permsLoading) {
    return <div className="p-4 text-sm text-slate-500">Loading…</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Roles</h1>
          <p className="text-sm text-slate-500">
            What each role can do. For one person&rsquo;s exceptions, use{" "}
            <Link href="/dashboard/settings/team" className="text-blue-600 hover:underline">
              Team
            </Link>
            .
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New role
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {creating && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[16rem]">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Role name
            </label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createRole()}
              placeholder="e.g. Factory Supervisor"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>
          <button
            onClick={createRole}
            disabled={saving || !newName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            Create
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-4 items-start">
        {/* role list */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-9 bg-slate-100 rounded" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
              {roles.map((role) => (
                <li key={role.id}>
                  <button
                    onClick={() => setSelectedId(role.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      role.id === selectedId ? "bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 truncate">
                        {role.name}
                      </span>
                      {role.isSystem && (
                        <LockClosedIcon
                          className={`w-3.5 h-3.5 shrink-0 ${role.isLocked ? "text-slate-600" : "text-slate-400"}`}
                          title={role.isLocked ? "Locked — cannot be changed" : "Provided by SoftInterio"}
                        />
                      )}
                      {role.isOwn && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">
                          Yours
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {TIER_LABEL[role.hierarchyLevel] ?? `Level ${role.hierarchyLevel}`} ·{" "}
                      {role.permissionCount} permission{role.permissionCount === 1 ? "" : "s"}
                      {role.memberCount > 0 && ` · ${role.memberCount} member${role.memberCount === 1 ? "" : "s"}`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* permission editor */}
        <div className="bg-white rounded-lg border border-slate-200">
          {!selected ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <ShieldCheckIcon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              Pick a role to see what it can do.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-800">{selected.name}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedKeys.size} of {PERMISSION_TOTAL} permissions
                    {selected.memberCount > 0 &&
                      ` · held by ${selected.memberCount} ${selected.memberCount === 1 ? "person" : "people"}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canEditSelected(selected) && selected.isOwn && (
                    <button
                      onClick={() => deleteRole(selected)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                  {canEditSelected(selected) && (
                    <button
                      onClick={save}
                      disabled={!dirty || saving || detailLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg transition-colors"
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  )}
                </div>
              </div>

              {selected.isSystem && !selected.isLocked && canManage && (
                <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <strong className="font-semibold">{selected.name}</strong> is provided by
                  SoftInterio and shared with every business using it. Saving a change here
                  creates your own copy of this role and moves your team onto it — nobody
                  else is affected.
                </div>
              )}

              {!selected.isLocked && selected.isRestricted && (
                <div className="mx-4 mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 flex items-start gap-2">
                  <LockClosedIcon className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                  <span>{selected.restrictedReason}</span>
                </div>
              )}

              {selected.isLocked && (
                <div className="mx-4 mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 flex items-start gap-2">
                  <LockClosedIcon className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                  <span>
                    The Owner role holds every permission and is locked — nobody can
                    change it, including an administrator or the owner themselves. It
                    picks up each new permission automatically. To move this access,
                    transfer ownership.
                  </span>
                </div>
              )}

              {!canManage && !selected.isLocked && (
                <div className="mx-4 mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  You can see what this role does, but changing it needs the
                  &ldquo;Create, edit and delete roles&rdquo; permission.
                </div>
              )}

              <div className="p-4">
                <div className="relative mb-3">
                  <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search permissions"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                {detailLoading ? (
                  <div className="space-y-2">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="h-9 bg-slate-100 rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {[...visibleModules.entries()].map(([mod, perms]) => {
                      const on = perms.filter((p) => selectedKeys.has(p.key)).length;
                      return (
                        <div key={mod} className="border border-slate-200 rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-50">
                            <span className="text-sm font-semibold text-slate-700 capitalize">
                              {mod}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-500 font-mono">
                                {on}/{perms.length}
                              </span>
                              {canEditSelected(selected) && (
                                <button
                                  onClick={() => toggleModule(mod, on < perms.length)}
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  {on < perms.length ? "Select all" : "Clear"}
                                </button>
                              )}
                            </div>
                          </div>
                          <ul className="divide-y divide-slate-100">
                            {perms.map((perm) => (
                              <li key={perm.key}>
                                <label
                                  className={`flex items-start gap-3 px-4 py-2.5 ${
                                    canEditSelected(selected) ? "cursor-pointer hover:bg-slate-50" : ""
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedKeys.has(perm.key)}
                                    disabled={!canEditSelected(selected)}
                                    onChange={() => toggle(perm.key)}
                                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                                  />
                                  <span className="min-w-0">
                                    <span className="block text-sm text-slate-800 font-mono truncate">
                                      {perm.key}
                                    </span>
                                    {perm.description && (
                                      <span className="block text-xs text-slate-500">
                                        {perm.description}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const PERMISSION_TOTAL = Object.values(PERMISSIONS_BY_MODULE).reduce(
  (n, list) => n + list.length,
  0
);

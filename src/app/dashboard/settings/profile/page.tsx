"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { User } from "@/types/database.types";
import { FieldDisplay } from "@/components/ui/FieldDisplay";
import { FieldInput } from "@/components/ui/FieldInput";
import {
  UserIcon,
  PencilIcon,
  XMarkIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

interface UserRole {
  id: string;
  name: string;
  slug: string;
  hierarchy_level: number;
}

interface UserWithRoles extends User {
  roles?: UserRole[];
}

export default function ProfileSettingsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [profile, setProfile] = useState<UserWithRoles | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "" });
  const [originalFormData, setOriginalFormData] = useState({ name: "", phone: "" });

  const [passwordData, setPasswordData] = useState({ newPassword: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const supabase = createClient();

  const hasChanges = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(originalFormData);
  }, [formData, originalFormData]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        setError("Unable to get authenticated user");
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (userError) {
        setError("Failed to load profile");
        return;
      }

      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("roles(id, name, slug, hierarchy_level)")
        .eq("user_id", authUser.id);

      const roles = userRoles?.map((ur: any) => ur.roles).filter(Boolean) || [];

      setProfile({ ...userData, roles });
      const formValues = { name: userData.name || "", phone: userData.phone || "" };
      setFormData(formValues);
      setOriginalFormData(formValues);
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile || !hasChanges) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      if (!formData.name.trim()) {
        setError("Name is required");
        setIsSaving(false);
        return;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setError("You must be logged in to update your profile");
        return;
      }

      const { error: updateError } = await supabase
        .from("users")
        .update({
          name: formData.name.trim(),
          phone: formData.phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", authUser.id);

      if (updateError) {
        setError("Failed to update profile: " + updateError.message);
        return;
      }

      setProfile((prev) => prev ? { ...prev, name: formData.name.trim(), phone: formData.phone.trim() || null } : null);
      setOriginalFormData({ ...formData });
      setIsEditing(false);
      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({ ...originalFormData });
    setIsEditing(false);
    setError(null);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError("Please fill in all password fields");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    try {
      setIsChangingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });

      if (error) {
        setPasswordError(error.message);
        return;
      }

      setPasswordSuccess("Password changed successfully!");
      setPasswordData({ newPassword: "", confirmPassword: "" });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(null);
      }, 2000);
    } catch (err) {
      setPasswordError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
    });
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getStatusInfo = (status: string | undefined) => {
    const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
      active: { label: "Active", color: "text-green-700", bgColor: "bg-green-100" },
      pending_verification: { label: "Pending", color: "text-amber-700", bgColor: "bg-amber-100" },
      invited: { label: "Invited", color: "text-blue-700", bgColor: "bg-blue-100" },
      disabled: { label: "Inactive", color: "text-slate-700", bgColor: "bg-slate-100" },
    };
    return statusMap[status || ""] || { label: status || "Unknown", color: "text-slate-700", bgColor: "bg-slate-100" };
  };

  if (isLoading) {
    return (
      <div className="h-full bg-slate-50/50">
        <div className="h-full flex flex-col px-4 py-4">
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-500">Loading profile...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(profile?.status);

  return (
    <div className="h-full bg-slate-50/50">
      {isSaving && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl flex items-center gap-4">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium text-slate-700">Saving changes...</span>
          </div>
        </div>
      )}

      <div className="h-full flex flex-col px-4 py-4">
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
              <Link href="/dashboard" className="hover:text-slate-700">Dashboard</Link>
              <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <Link href="/dashboard/settings" className="hover:text-slate-700">Settings</Link>
              <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-slate-700 font-medium">My Profile</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-slate-800 leading-tight">My Profile</h1>
                  <p className="text-[11px] text-slate-500">Manage your personal information</p>
                </div>
                <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
                  <span className="w-1 h-1 rounded-full bg-current"></span>
                  {statusInfo.label}
                </span>
              </div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <button onClick={handleCancel} disabled={isSaving} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50">
                    <XMarkIcon className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={isSaving || !hasChanges} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-medium rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                    {hasChanges && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>}
                    Save Changes
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsEditing(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-medium rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md">
                  <PencilIcon className="w-3.5 h-3.5" />
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* Alerts */}
          {(error || success) && (
            <div className="px-4 pt-3 shrink-0">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {success}
                </div>
              )}
            </div>
          )}

          {/* Content Area - All sections full width */}
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-4">
              {/* Profile Card - FULL WIDTH */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-900">Profile Card</h2>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-base font-bold shadow-lg shadow-blue-500/20">
                      {profile ? getInitials(profile.name || "U") : "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">{profile?.name || "User"}</h3>
                        {profile?.roles && profile.roles.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {profile.is_super_admin && (
                              <span className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 text-purple-700">Owner</span>
                            )}
                            {profile.roles.filter((role) => !(profile.is_super_admin && role.slug === "owner")).map((role) => (
                              <span key={role.id} className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${role.slug === "admin" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700"}`}>
                                {role.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-8 pl-6 border-l border-slate-200">
                      <FieldDisplay label="Member Since" value={formatDate(profile?.created_at)} />
                      <FieldDisplay label="Last Login" value={formatDateTime(profile?.last_login_at) || "Never"} />
                    </div>
                  </div>
                  <div className="md:hidden pt-3 mt-3 border-t border-slate-200 grid grid-cols-2 gap-x-4 gap-y-2">
                    <FieldDisplay label="Member Since" value={formatDate(profile?.created_at)} />
                    <FieldDisplay label="Last Login" value={formatDateTime(profile?.last_login_at) || "Never"} />
                  </div>
                </div>
              </div>

              {/* Personal Information - FULL WIDTH */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-900">Personal Information</h2>
                  <p className="text-[10px] text-slate-500">Manage your account details</p>
                </div>
                <div className="p-4">
                  {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FieldInput label="Full Name" value={formData.name} onChange={(v) => setFormData({ ...formData, name: v })} placeholder="Enter your full name" required />
                      <FieldInput label="Email Address" value={profile?.email || ""} locked required hint="Email cannot be changed" />
                      <FieldInput label="Phone Number" value={formData.phone} onChange={(v) => setFormData({ ...formData, phone: v })} placeholder="+91 98765 43210" type="tel" />
                      <FieldInput label="Account Created" value={formatDateTime(profile?.created_at) || "-"} locked />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FieldDisplay label="Full Name" value={profile?.name} required />
                      <FieldDisplay label="Email Address" value={profile?.email} required />
                      <FieldDisplay label="Phone Number" value={profile?.phone} />
                      <FieldDisplay label="Account Created" value={formatDateTime(profile?.created_at)} />
                    </div>
                  )}
                </div>
              </div>

              {/* Security Settings - FULL WIDTH */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-900">Security Settings</h2>
                  <p className="text-[10px] text-slate-500">Manage your password and account security</p>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                        <LockClosedIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">Password</p>
                        <p className="text-[10px] text-slate-500">Update your account password</p>
                      </div>
                    </div>
                    <button onClick={() => setShowPasswordModal(true)} className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors">
                      Change Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Change Password</h3>
              <p className="text-[10px] text-slate-500">Enter a new password for your account</p>
            </div>
            <div className="p-4 space-y-3">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {passwordSuccess}
                </div>
              )}
              <FieldInput label="New Password" value={passwordData.newPassword} onChange={(v) => setPasswordData({ ...passwordData, newPassword: v })} placeholder="Enter new password (min 8 characters)" type="password" required />
              <FieldInput label="Confirm New Password" value={passwordData.confirmPassword} onChange={(v) => setPasswordData({ ...passwordData, confirmPassword: v })} placeholder="Confirm new password" type="password" required />
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex gap-2">
              <button onClick={() => { setShowPasswordModal(false); setPasswordError(null); setPasswordSuccess(null); setPasswordData({ newPassword: "", confirmPassword: "" }); }} className="flex-1 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-xs font-medium">Cancel</button>
              <button onClick={handleChangePassword} disabled={isChangingPassword} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-3 py-1.5 rounded-lg hover:from-blue-700 hover:to-blue-600 text-xs font-medium disabled:opacity-50">
                {isChangingPassword ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

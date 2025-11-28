"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { User } from "@/types/database.types";
import { FieldDisplay } from "@/components/ui/FieldDisplay";
import { FieldInput } from "@/components/ui/FieldInput";

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
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });
  const [originalFormData, setOriginalFormData] = useState({
    name: "",
    phone: "",
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
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

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !authUser) {
        setError("Unable to get authenticated user");
        return;
      }

      // Fetch user details
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (userError) {
        setError("Failed to load profile");
        return;
      }

      // Fetch user roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("roles(id, name, slug, hierarchy_level)")
        .eq("user_id", authUser.id);

      const roles = userRoles?.map((ur: any) => ur.roles).filter(Boolean) || [];

      setProfile({ ...userData, roles });
      const formValues = {
        name: userData.name || "",
        phone: userData.phone || "",
      };
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

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
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

      // Update local state
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: formData.name.trim(),
              phone: formData.phone.trim() || null,
            }
          : null
      );
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

      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

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
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusInfo = (status: string | undefined) => {
    const statusMap: Record<
      string,
      { label: string; color: string; bgColor: string }
    > = {
      active: {
        label: "Active",
        color: "text-green-700",
        bgColor: "bg-green-100",
      },
      pending_verification: {
        label: "Pending",
        color: "text-amber-700",
        bgColor: "bg-amber-100",
      },
      invited: {
        label: "Invited",
        color: "text-blue-700",
        bgColor: "bg-blue-100",
      },
      disabled: {
        label: "Inactive",
        color: "text-slate-700",
        bgColor: "bg-slate-100",
      },
    };
    return (
      statusMap[status || ""] || {
        label: status || "Unknown",
        color: "text-slate-700",
        bgColor: "bg-slate-100",
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-200 rounded-full shrink-0"></div>
              <div className="flex-1">
                <div className="h-5 bg-slate-200 rounded w-32 mb-2"></div>
                <div className="h-4 bg-slate-200 rounded w-48"></div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-slate-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(profile?.status);

  return (
    <div className="space-y-4">
      {/* Saving Overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl flex items-center gap-4">
            <svg
              className="w-6 h-6 animate-spin text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm font-medium text-slate-700">
              Saving changes...
            </span>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <Link href="/dashboard/settings" className="hover:text-blue-600">
                Settings
              </Link>
              <span>/</span>
              <span className="text-slate-700">My Profile</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-900">My Profile</h1>
          </div>

          {/* Status pill in header */}
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {hasChanges && (
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
              )}
              Save Changes
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            Edit Profile
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {success}
        </div>
      )}

      {/* Profile Card + Personal Information */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Profile Card - Horizontal Layout */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Profile Card
            </h2>
          </div>
          <div className="p-5">
            {/* Avatar + Name Section */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-16 h-16 shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-blue-500/20">
                {profile ? getInitials(profile.name) : "?"}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 truncate">
                  {profile?.name || "User"}
                </h3>
                <p className="text-sm text-slate-500 truncate">
                  {profile?.email}
                </p>
                {profile?.roles && profile.roles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {profile.is_super_admin && (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                        Owner
                      </span>
                    )}
                    {profile.roles
                      .filter(
                        (role) =>
                          !(profile.is_super_admin && role.slug === "owner")
                      )
                      .map((role) => (
                        <span
                          key={role.id}
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            role.slug === "admin"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {role.name}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Account Stats - Compact Grid */}
            <div className="pt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <FieldDisplay
                label="Member Since"
                value={formatDate(profile?.created_at)}
              />
              <FieldDisplay
                label="Last Login"
                value={formatDateTime(profile?.last_login_at) || "Never"}
              />
            </div>
          </div>
        </div>

        {/* Personal Information - More Compact */}
        <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Personal Information
            </h2>
            <p className="text-sm text-slate-500">
              Manage your account details
            </p>
          </div>
          <div className="p-5">
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldInput
                  label="Full Name"
                  value={formData.name}
                  onChange={(v) => setFormData({ ...formData, name: v })}
                  placeholder="Enter your full name"
                  required
                />
                <FieldInput
                  label="Email Address"
                  value={profile?.email || ""}
                  locked
                  required
                  hint="Email cannot be changed"
                />
                <FieldInput
                  label="Phone Number"
                  value={formData.phone}
                  onChange={(v) => setFormData({ ...formData, phone: v })}
                  placeholder="+91 98765 43210"
                  type="tel"
                />
                <FieldInput
                  label="Account Created"
                  value={formatDateTime(profile?.created_at) || "-"}
                  locked
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <FieldDisplay
                  label="Full Name"
                  value={profile?.name}
                  required
                />
                <FieldDisplay
                  label="Email Address"
                  value={profile?.email}
                  required
                />
                <FieldDisplay label="Phone Number" value={profile?.phone} />
                <FieldDisplay
                  label="Account Created"
                  value={formatDateTime(profile?.created_at)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Security Settings
          </h2>
          <p className="text-sm text-slate-500">
            Manage your password and account security
          </p>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900">Password</p>
                <p className="text-sm text-slate-500">
                  Update your account password
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Change Password
              </h3>
              <p className="text-sm text-slate-500">
                Enter a new password for your account
              </p>
            </div>

            <div className="p-5 space-y-4">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {passwordSuccess}
                </div>
              )}

              <FieldInput
                label="New Password"
                value={passwordData.newPassword}
                onChange={(v) =>
                  setPasswordData({ ...passwordData, newPassword: v })
                }
                placeholder="Enter new password (min 8 characters)"
                type="password"
                required
              />
              <FieldInput
                label="Confirm New Password"
                value={passwordData.confirmPassword}
                onChange={(v) =>
                  setPasswordData({ ...passwordData, confirmPassword: v })
                }
                placeholder="Confirm new password"
                type="password"
                required
              />
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError(null);
                  setPasswordSuccess(null);
                  setPasswordData({ newPassword: "", confirmPassword: "" });
                }}
                className="flex-1 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={isChangingPassword}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                {isChangingPassword ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

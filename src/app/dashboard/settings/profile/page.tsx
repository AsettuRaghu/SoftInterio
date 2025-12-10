"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@/types/database.types";
import { FieldDisplay } from "@/components/ui/FieldDisplay";
import { FieldInput } from "@/components/ui/FieldInput";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import {
  SettingsPageLayout,
  SettingsPageHeader,
  SettingsPageContent,
} from "@/components/ui/SettingsPageLayout";
import {
  UserIcon,
  PencilIcon,
  XMarkIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

// =====================================================
// TYPES
// =====================================================

interface UserRole {
  id: string;
  name: string;
  slug: string;
  hierarchy_level: number;
}

interface UserWithRoles extends User {
  roles?: UserRole[];
}

interface ProfileFormData {
  name: string;
  phone: string;
}

interface PasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const formatDateTime = (
  dateString: string | null | undefined
): string | null => {
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

const formatDate = (dateString: string | null | undefined): string | null => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// =====================================================
// ROLE BADGE COMPONENT
// =====================================================

function RoleBadge({ role, isOwner }: { role: UserRole; isOwner?: boolean }) {
  const isAdminRole = role.slug === "admin" || role.slug === "owner";
  return (
    <span
      className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${
        isAdminRole
          ? "bg-purple-100 text-purple-700"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {isOwner && role.slug === "owner" ? "Owner" : role.name}
    </span>
  );
}

// =====================================================
// PROFILE AVATAR COMPONENT
// =====================================================

function ProfileAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-10 h-10 text-sm",
    md: "w-14 h-14 text-base",
    lg: "w-20 h-20 text-xl",
  };

  return (
    <div
      className={`${sizeClasses[size]} shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20`}
    >
      {getInitials(name || "U")}
    </div>
  );
}

// =====================================================
// PASSWORD CHANGE MODAL COMPONENT
// =====================================================

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function PasswordChangeModal({ isOpen, onClose }: PasswordModalProps) {
  const [formData, setFormData] = useState<PasswordFormData>({
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isChanging, setIsChanging] = useState(false);

  const supabase = createClient();

  const resetState = useCallback(() => {
    setFormData({ newPassword: "", confirmPassword: "" });
    setError(null);
    setSuccess(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!formData.newPassword || !formData.confirmPassword) {
      setError("Please fill in all password fields");
      return;
    }

    if (formData.newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    try {
      setIsChanging(true);
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess("Password changed successfully!");
      setTimeout(handleClose, 2000);
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Change Password"
      subtitle="Enter a new password for your account"
      size="md"
      footer={
        <>
          <button
            onClick={handleClose}
            className="flex-1 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-xs font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isChanging}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-3 py-1.5 rounded-lg hover:from-blue-700 hover:to-blue-600 text-xs font-medium disabled:opacity-50"
          >
            {isChanging ? "Changing..." : "Change Password"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert variant="error" message={error} />}
        {success && <Alert variant="success" message={success} />}
        <FieldInput
          label="New Password"
          value={formData.newPassword}
          onChange={(v) => setFormData((prev) => ({ ...prev, newPassword: v }))}
          placeholder="Enter new password (min 8 characters)"
          type="password"
          required
        />
        <FieldInput
          label="Confirm New Password"
          value={formData.confirmPassword}
          onChange={(v) =>
            setFormData((prev) => ({ ...prev, confirmPassword: v }))
          }
          placeholder="Confirm new password"
          type="password"
          required
        />
      </div>
    </Modal>
  );
}

// =====================================================
// PROFILE CARD SECTION
// =====================================================

interface ProfileCardProps {
  profile: UserWithRoles | null;
}

function ProfileCard({ profile }: ProfileCardProps) {
  if (!profile) return null;

  const roles = profile.roles || [];
  const displayRoles = roles.filter(
    (role) => !(profile.is_super_admin && role.slug === "owner")
  );

  return (
    <Card title="Profile Card">
      <div className="flex items-center gap-4">
        <ProfileAvatar name={profile.name || "User"} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {profile.name || "User"}
            </h3>
            {roles.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {profile.is_super_admin && (
                  <RoleBadge
                    role={{
                      id: "",
                      name: "Owner",
                      slug: "owner",
                      hierarchy_level: 0,
                    }}
                    isOwner
                  />
                )}
                {displayRoles.map((role) => (
                  <RoleBadge key={role.id} role={role} />
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">{profile.email}</p>
        </div>
        <div className="hidden md:flex items-center gap-8 pl-6 border-l border-slate-200">
          <FieldDisplay
            label="Member Since"
            value={formatDate(profile.created_at)}
          />
          <FieldDisplay
            label="Last Login"
            value={formatDateTime(profile.last_login_at) || "Never"}
          />
        </div>
      </div>
      {/* Mobile view for dates */}
      <div className="md:hidden pt-3 mt-3 border-t border-slate-200 grid grid-cols-2 gap-x-4 gap-y-2">
        <FieldDisplay
          label="Member Since"
          value={formatDate(profile.created_at)}
        />
        <FieldDisplay
          label="Last Login"
          value={formatDateTime(profile.last_login_at) || "Never"}
        />
      </div>
    </Card>
  );
}

// =====================================================
// PERSONAL INFO SECTION
// =====================================================

interface PersonalInfoProps {
  profile: UserWithRoles | null;
  isEditing: boolean;
  formData: ProfileFormData;
  onFormChange: (data: ProfileFormData) => void;
}

function PersonalInfoSection({
  profile,
  isEditing,
  formData,
  onFormChange,
}: PersonalInfoProps) {
  if (!profile) return null;

  return (
    <Card
      title="Personal Information"
      description="Manage your account details"
    >
      {isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FieldInput
            label="Full Name"
            value={formData.name}
            onChange={(v) => onFormChange({ ...formData, name: v })}
            placeholder="Enter your full name"
            required
          />
          <FieldInput
            label="Email Address"
            value={profile.email || ""}
            locked
            required
            hint="Email cannot be changed"
          />
          <FieldInput
            label="Phone Number"
            value={formData.phone}
            onChange={(v) => onFormChange({ ...formData, phone: v })}
            placeholder="+91 98765 43210"
            type="tel"
          />
          <FieldInput
            label="Account Created"
            value={formatDateTime(profile.created_at) || "-"}
            locked
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FieldDisplay label="Full Name" value={profile.name} required />
          <FieldDisplay label="Email Address" value={profile.email} required />
          <FieldDisplay label="Phone Number" value={profile.phone} />
          <FieldDisplay
            label="Account Created"
            value={formatDateTime(profile.created_at)}
          />
        </div>
      )}
    </Card>
  );
}

// =====================================================
// SECURITY SECTION
// =====================================================

interface SecuritySectionProps {
  onChangePassword: () => void;
}

function SecuritySection({ onChangePassword }: SecuritySectionProps) {
  return (
    <Card
      title="Security Settings"
      description="Manage your password and account security"
    >
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
            <LockClosedIcon className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">Password</p>
            <p className="text-[10px] text-slate-500">
              Update your account password
            </p>
          </div>
        </div>
        <button
          onClick={onChangePassword}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors"
        >
          Change Password
        </button>
      </div>
    </Card>
  );
}

// =====================================================
// MAIN PROFILE PAGE COMPONENT
// =====================================================

export default function ProfileSettingsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [profile, setProfile] = useState<UserWithRoles | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: "",
    phone: "",
  });
  const [originalFormData, setOriginalFormData] = useState<ProfileFormData>({
    name: "",
    phone: "",
  });

  const supabase = createClient();

  const hasChanges = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(originalFormData);
  }, [formData, originalFormData]);

  const fetchProfile = useCallback(async () => {
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
  }, [supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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

  // Action buttons for header
  const headerActions = isEditing ? (
    <>
      <button
        onClick={handleCancel}
        disabled={isSaving}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50"
      >
        <XMarkIcon className="w-3.5 h-3.5" />
        Cancel
      </button>
      <button
        onClick={handleSave}
        disabled={isSaving || !hasChanges}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-medium rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {hasChanges && (
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
        )}
        Save Changes
      </button>
    </>
  ) : (
    <button
      onClick={() => setIsEditing(true)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-medium rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md"
    >
      <PencilIcon className="w-3.5 h-3.5" />
      Edit Profile
    </button>
  );

  return (
    <SettingsPageLayout
      isLoading={isLoading}
      loadingText="Loading profile..."
      isSaving={isSaving}
    >
      <SettingsPageHeader
        title="My Profile"
        subtitle="Manage your personal information"
        breadcrumbs={[{ label: "My Profile" }]}
        icon={<UserIcon className="w-4 h-4 text-white" />}
        status={profile?.status}
        actions={headerActions}
      />

      {/* Alerts */}
      {(error || success) && (
        <div className="px-4 pt-3 shrink-0">
          {error && (
            <Alert
              variant="error"
              message={error}
              onDismiss={() => setError(null)}
            />
          )}
          {success && <Alert variant="success" message={success} />}
        </div>
      )}

      <SettingsPageContent>
        <ProfileCard profile={profile} />
        <PersonalInfoSection
          profile={profile}
          isEditing={isEditing}
          formData={formData}
          onFormChange={setFormData}
        />
        <SecuritySection onChangePassword={() => setShowPasswordModal(true)} />
      </SettingsPageContent>

      <PasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </SettingsPageLayout>
  );
}

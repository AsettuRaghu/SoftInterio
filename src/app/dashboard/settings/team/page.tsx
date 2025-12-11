"use client";

import React, { useState, useEffect, useMemo } from "react";
import { SortIcon as SortIconBase } from "@/components/ui/DataTable";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  SettingsPageLayout,
  SettingsPageHeader,
  SettingsPageContent,
} from "@/components/ui/SettingsPageLayout";
import { uiLogger } from "@/lib/logger";
import { UsersIcon } from "@heroicons/react/24/outline";

interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  hierarchy_level: number;
  is_default?: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  status:
    | "active"
    | "invited"
    | "pending_verification"
    | "disabled"
    | "deleted";
  is_super_admin: boolean;
  last_login_at?: string;
  created_at: string;
  roles: Role[];
}

interface Invitation {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  expires_at: string;
  created_at: string;
  role?: Role;
  invited_by?: { name: string; email: string };
}

type SortField = "name" | "email" | "role" | "status" | "created_at";
type SortDirection = "asc" | "desc" | null;
type FilterStatus = "Active" | "Invited" | "Inactive";

// Format date only (for Date Joined column)
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function TeamSettingsPage() {
  const { hasPermission, hierarchyLevel, isOwner } = useUserPermissions();

  // Multi-select filter - default to Active and Invited
  const [selectedFilters, setSelectedFilters] = useState<FilterStatus[]>([
    "Active",
    "Invited",
  ]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmStyle: "danger" | "primary";
    onConfirm: () => void;
  }>({
    show: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    confirmStyle: "danger",
    onConfirm: () => {},
  });

  // Credentials modal state (for showing invite credentials)
  const [credentialsModal, setCredentialsModal] = useState<{
    show: boolean;
    email: string;
    password: string;
    loginUrl: string;
    shareMessage: string;
  }>({
    show: false,
    email: "",
    password: "",
    loginUrl: "",
    shareMessage: "",
  });

  // Edit member modal state
  const [editModal, setEditModal] = useState<{
    show: boolean;
    member: TeamMember | null;
    selectedRoleIds: string[];
    originalRoleIds: string[];
    isSaving: boolean;
  }>({
    show: false,
    member: null,
    selectedRoleIds: [],
    originalRoleIds: [],
    isSaving: false,
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    roleIds: [] as string[],
    password: "",
  });

  // Fetch data on mount
  useEffect(() => {
    fetchData();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      uiLogger.debug("Fetching current user", { action: "fetch_current_user" });
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      if (data.success && data.data?.id) {
        setCurrentUserId(data.data.id);
        uiLogger.debug("Current user fetched", { userId: data.data.id });
      }
    } catch (err) {
      uiLogger.error("Failed to fetch current user", err, {
        action: "fetch_current_user",
      });
    }
  };

  const fetchData = async () => {
    uiLogger.debug("Fetching team data", { action: "fetch_team_data" });
    setIsLoading(true);
    setError(null);

    try {
      const [membersRes, invitesRes, rolesRes] = await Promise.all([
        fetch("/api/team/members"),
        fetch("/api/team/invite"),
        fetch("/api/team/roles"),
      ]);

      const membersData = await membersRes.json();
      const invitesData = await invitesRes.json();
      const rolesData = await rolesRes.json();

      if (membersData.success) {
        setTeamMembers(membersData.data || []);
        uiLogger.debug("Team members loaded", {
          count: membersData.data?.length || 0,
        });
      }

      if (invitesData.success) {
        setInvitations(invitesData.data || []);
        uiLogger.debug("Invitations loaded", {
          count: invitesData.data?.length || 0,
        });
      }

      if (rolesData.success) {
        setRoles(rolesData.data || []);
        uiLogger.debug("Roles loaded", { count: rolesData.data?.length || 0 });
        if (rolesData.data?.length > 0 && inviteForm.roleIds.length === 0) {
          const defaultRole =
            rolesData.data.find((r: Role) => r.is_default) || rolesData.data[0];
          setInviteForm((prev) => ({ ...prev, roleIds: [defaultRole.id] }));
        }
      }
    } catch (err) {
      uiLogger.error("Failed to load team data", err, {
        action: "fetch_team_data",
      });
      setError("Failed to load team data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    uiLogger.info("Sending team invitation", {
      action: "send_invite",
      email: inviteForm.email,
    });
    setIsSending(true);
    setModalError(null);

    if (!inviteForm.firstName.trim() || !inviteForm.lastName.trim()) {
      uiLogger.warn("Invite validation failed: missing name", {
        action: "send_invite",
      });
      setModalError("Please enter first and last name");
      setIsSending(false);
      return;
    }

    if (!inviteForm.email.trim()) {
      uiLogger.warn("Invite validation failed: missing email", {
        action: "send_invite",
      });
      setModalError("Please enter an email address");
      setIsSending(false);
      return;
    }

    if (inviteForm.roleIds.length === 0) {
      uiLogger.warn("Invite validation failed: no roles selected", {
        action: "send_invite",
      });
      setModalError("Please select at least one role");
      setIsSending(false);
      return;
    }

    if (!inviteForm.password || inviteForm.password.length < 8) {
      uiLogger.warn("Invite validation failed: password too short", {
        action: "send_invite",
      });
      setModalError("Please enter a password (min 8 characters)");
      setIsSending(false);
      return;
    }

    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: inviteForm.firstName.trim(),
          lastName: inviteForm.lastName.trim(),
          email: inviteForm.email.trim().toLowerCase(),
          roleIds: inviteForm.roleIds,
          password: inviteForm.password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        uiLogger.info("Team invitation sent successfully", {
          action: "send_invite",
          email: inviteForm.email,
        });
        setShowInviteModal(false);
        setModalError(null);

        // Show credentials modal
        if (data.data?.credentials) {
          setCredentialsModal({
            show: true,
            email: data.data.credentials.email,
            password: data.data.credentials.password,
            loginUrl: data.data.credentials.loginUrl,
            shareMessage: data.data.shareMessage,
          });
          // Refresh the team list
          fetchData();
        }

        // Reset form
        setInviteForm({
          firstName: "",
          lastName: "",
          email: "",
          roleIds: roles.find((r) => r.is_default)?.id
            ? [roles.find((r) => r.is_default)!.id]
            : roles[0]?.id
            ? [roles[0].id]
            : [],
          password: "",
        });
      } else {
        uiLogger.error("Failed to send invitation", new Error(data.error), {
          action: "send_invite",
        });
        setModalError(data.error || "Failed to send invitation");
      }
    } catch (err: unknown) {
      const error = err as Error;
      uiLogger.error("Exception sending invitation", error, {
        action: "send_invite",
      });
      setModalError(error.message || "Failed to send invitation");
    } finally {
      setIsSending(false);
    }
  };

  const handleResendInvite = async (invitationId: string) => {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/team/invite", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Invitation email resent successfully!");
        fetchData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to resend invitation");
      }
    } catch (err: any) {
      setError(err.message || "Failed to resend invitation");
    }
  };

  const handleCancelInvite = async (invitationId: string, email: string) => {
    setConfirmModal({
      show: true,
      title: "Cancel Invitation",
      message: `Are you sure you want to cancel the invitation for ${email}? This action cannot be undone.`,
      confirmText: "Cancel Invitation",
      confirmStyle: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, show: false }));
        setIsProcessing(true);
        setError(null);
        setSuccess(null);

        try {
          const response = await fetch(`/api/team/invite?id=${invitationId}`, {
            method: "DELETE",
          });

          const data = await response.json();

          if (data.success) {
            setSuccess("Invitation cancelled successfully!");
            setInvitations((prev) =>
              prev.filter((inv) => inv.id !== invitationId)
            );
            setTeamMembers((prev) =>
              prev.filter((m) => m.email.toLowerCase() !== email.toLowerCase())
            );
            setTimeout(() => setSuccess(null), 3000);
          } else {
            setError(data.error || "Failed to cancel invitation");
          }
        } catch (err: any) {
          setError(err.message || "Failed to cancel invitation");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    // Check if trying to delete self
    if (memberId === currentUserId) {
      setError("You cannot remove yourself from the team");
      return;
    }

    setConfirmModal({
      show: true,
      title: "Deactivate Team Member",
      message: `Are you sure you want to deactivate ${memberName}? They will no longer have access to the system but their data will be preserved.`,
      confirmText: "Deactivate",
      confirmStyle: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, show: false }));
        setIsProcessing(true);
        setError(null);
        setSuccess(null);

        try {
          const response = await fetch(`/api/team/members?id=${memberId}`, {
            method: "DELETE",
          });

          const data = await response.json();

          if (data.success) {
            setSuccess(data.message || "Member deactivated successfully!");
            // Update status in local state so they appear in Inactive filter
            setTeamMembers((prev) =>
              prev.map((m) =>
                m.id === memberId ? { ...m, status: "disabled" } : m
              )
            );
            setTimeout(() => setSuccess(null), 3000);
          } else {
            setError(data.error || "Failed to deactivate member");
          }
        } catch (err: any) {
          setError(err.message || "Failed to deactivate member");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const handleReactivateMember = async (
    memberId: string,
    memberName: string
  ) => {
    setConfirmModal({
      show: true,
      title: "Reactivate Team Member",
      message: `Are you sure you want to reactivate ${memberName}? They will regain access to the system with their previous roles.`,
      confirmText: "Reactivate",
      confirmStyle: "primary" as any,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, show: false }));
        setIsProcessing(true);
        setError(null);
        setSuccess(null);

        try {
          const response = await fetch(
            `/api/team/members/${memberId}/reactivate`,
            {
              method: "PUT",
            }
          );

          const data = await response.json();

          if (data.success) {
            setSuccess(data.message || "Member reactivated successfully!");
            // Update status in local state so they appear in Active filter
            setTeamMembers((prev) =>
              prev.map((m) =>
                m.id === memberId ? { ...m, status: "active" } : m
              )
            );
            setTimeout(() => setSuccess(null), 3000);
          } else {
            setError(data.error || "Failed to reactivate member");
          }
        } catch (err: any) {
          setError(err.message || "Failed to reactivate member");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const handleTransferOwnership = async (
    memberId: string,
    memberName: string
  ) => {
    setConfirmModal({
      show: true,
      title: "⚠️ Transfer Ownership",
      message: `Are you absolutely sure you want to transfer ownership to ${memberName}?\n\nThis action will:\n• Make ${memberName} the new Owner with full control\n• Demote you to Admin role\n• This action cannot be undone by you\n\nOnly proceed if you fully trust this person.`,
      confirmText: "Transfer Ownership",
      confirmStyle: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, show: false }));
        setIsProcessing(true);
        setError(null);
        setSuccess(null);

        try {
          const response = await fetch(
            `/api/team/members/${memberId}/transfer-ownership`,
            {
              method: "PUT",
            }
          );

          const data = await response.json();

          if (data.success) {
            setSuccess(data.message || "Ownership transferred successfully!");
            // Refresh the page to reflect the changes
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            setError(data.error || "Failed to transfer ownership");
          }
        } catch (err: any) {
          setError(err.message || "Failed to transfer ownership");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const handleEditMember = (member: TeamMember) => {
    const memberRoleIds = member.roles.map((r) => r.id);
    setEditModal({
      show: true,
      member,
      selectedRoleIds: [...memberRoleIds],
      originalRoleIds: [...memberRoleIds],
      isSaving: false,
    });
  };

  const handleEditRoleToggle = (roleId: string) => {
    setEditModal((prev) => {
      const isSelected = prev.selectedRoleIds.includes(roleId);
      const newRoleIds = isSelected
        ? prev.selectedRoleIds.filter((id) => id !== roleId)
        : [...prev.selectedRoleIds, roleId];
      return { ...prev, selectedRoleIds: newRoleIds };
    });
  };

  const hasEditChanges = useMemo(() => {
    if (!editModal.show) return false;
    const original = [...editModal.originalRoleIds].sort();
    const current = [...editModal.selectedRoleIds].sort();
    if (original.length !== current.length) return true;
    return original.some((id, idx) => id !== current[idx]);
  }, [editModal]);

  const handleSaveRoles = async () => {
    if (!editModal.member || !hasEditChanges) return;

    setEditModal((prev) => ({ ...prev, isSaving: true }));
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/team/members/${editModal.member.id}/roles`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleIds: editModal.selectedRoleIds }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setSuccess("Roles updated successfully!");
        // Update local state
        setTeamMembers((prev) =>
          prev.map((m) =>
            m.id === editModal.member?.id
              ? {
                  ...m,
                  roles: roles.filter((r) =>
                    editModal.selectedRoleIds.includes(r.id)
                  ),
                }
              : m
          )
        );
        setEditModal({
          show: false,
          member: null,
          selectedRoleIds: [],
          originalRoleIds: [],
          isSaving: false,
        });
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to update roles");
        setEditModal((prev) => ({ ...prev, isSaving: false }));
      }
    } catch (err: any) {
      setError(err.message || "Failed to update roles");
      setEditModal((prev) => ({ ...prev, isSaving: false }));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const toggleFilter = (filter: FilterStatus) => {
    setSelectedFilters((prev) => {
      if (prev.includes(filter)) {
        // Don't allow deselecting all filters
        if (prev.length === 1) return prev;
        return prev.filter((f) => f !== filter);
      } else {
        return [...prev, filter];
      }
    });
    setCurrentPage(1);
  };

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      active: { label: "Active", color: "bg-green-100 text-green-700" },
      pending_verification: {
        label: "Pending",
        color: "bg-amber-100 text-amber-700",
      },
      invited: { label: "Invited", color: "bg-blue-100 text-blue-700" },
      disabled: { label: "Inactive", color: "bg-slate-100 text-slate-700" },
      pending: { label: "Pending", color: "bg-amber-100 text-amber-700" },
      expired: { label: "Expired", color: "bg-red-100 text-red-700" },
      cancelled: { label: "Cancelled", color: "bg-slate-100 text-slate-700" },
      accepted: { label: "Accepted", color: "bg-green-100 text-green-700" },
    };
    return (
      statusMap[status] || {
        label: status,
        color: "bg-slate-100 text-slate-700",
      }
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const avatarColors = [
    "from-blue-500 to-blue-600",
    "from-purple-500 to-purple-600",
    "from-green-500 to-green-600",
    "from-amber-500 to-amber-600",
    "from-rose-500 to-rose-600",
    "from-indigo-500 to-indigo-600",
    "from-teal-500 to-teal-600",
    "from-slate-500 to-slate-600",
  ];

  const pendingInvites = invitations.filter((inv) => inv.status === "pending");

  // Filter, sort, and paginate data
  const processedData = useMemo(() => {
    let allItems = [
      ...teamMembers.map((m) => ({ type: "member" as const, data: m })),
      ...pendingInvites.map((i) => ({ type: "invite" as const, data: i })),
    ];

    // Apply multi-select status filter
    allItems = allItems.filter((item) => {
      if (selectedFilters.length === 0) return true;

      const isActive = item.type === "member" && item.data.status === "active";
      const isInvited =
        item.type === "invite" ||
        (item.type === "member" && item.data.status === "pending_verification");
      const isInactive =
        item.type === "member" && item.data.status === "disabled";

      return (
        (selectedFilters.includes("Active") && isActive) ||
        (selectedFilters.includes("Invited") && isInvited) ||
        (selectedFilters.includes("Inactive") && isInactive)
      );
    });

    // Apply search filter (includes status column)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      allItems = allItems.filter((item) => {
        if (item.type === "member") {
          const member = item.data as TeamMember;
          const statusLabel = getStatusDisplay(
            member.status
          ).label.toLowerCase();
          return (
            member.name.toLowerCase().includes(query) ||
            member.email.toLowerCase().includes(query) ||
            member.roles.some((r) => r.name.toLowerCase().includes(query)) ||
            statusLabel.includes(query)
          );
        } else {
          const invite = item.data as Invitation;
          const statusLabel = getStatusDisplay(
            invite.status
          ).label.toLowerCase();
          return (
            invite.email.toLowerCase().includes(query) ||
            statusLabel.includes(query)
          );
        }
      });
    }

    // Sort
    allItems.sort((a, b) => {
      let aValue: string | number = "";
      let bValue: string | number = "";

      if (sortField === "name") {
        aValue =
          a.type === "member"
            ? (a.data as TeamMember).name
            : (a.data as Invitation).email;
        bValue =
          b.type === "member"
            ? (b.data as TeamMember).name
            : (b.data as Invitation).email;
      } else if (sortField === "email") {
        aValue =
          a.type === "member"
            ? (a.data as TeamMember).email
            : (a.data as Invitation).email;
        bValue =
          b.type === "member"
            ? (b.data as TeamMember).email
            : (b.data as Invitation).email;
      } else if (sortField === "role") {
        aValue =
          a.type === "member"
            ? (a.data as TeamMember).roles[0]?.name || "Member"
            : (a.data as Invitation).role?.name || "Member";
        bValue =
          b.type === "member"
            ? (b.data as TeamMember).roles[0]?.name || "Member"
            : (b.data as Invitation).role?.name || "Member";
      } else if (sortField === "status") {
        aValue = a.data.status;
        bValue = b.data.status;
      } else if (sortField === "created_at") {
        aValue = new Date(a.data.created_at).getTime();
        bValue = new Date(b.data.created_at).getTime();
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      return sortDirection === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return allItems;
  }, [
    teamMembers,
    pendingInvites,
    selectedFilters,
    searchQuery,
    sortField,
    sortDirection,
  ]);

  // Pagination
  const totalItems = processedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = processedData.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Check if current user can edit a member based on hierarchy
  const canEditMember = (member: TeamMember): boolean => {
    // Cannot edit yourself
    if (member.id === currentUserId) return false;
    // Only owner can edit owner (for ownership transfer)
    if (member.is_super_admin) return isOwner;

    // Get member's minimum hierarchy level
    const memberMinHierarchy = member.roles.reduce(
      (min, role) => Math.min(min, role.hierarchy_level),
      999
    );

    return hierarchyLevel < memberMinHierarchy;
  };

  // Check if current user can delete a member based on hierarchy
  const canDeleteMember = (member: TeamMember): boolean => {
    if (member.is_super_admin) return false;
    if (member.id === currentUserId) return false;

    // Get member's minimum hierarchy level
    const memberMinHierarchy = member.roles.reduce(
      (min, role) => Math.min(min, role.hierarchy_level),
      999
    );

    return hierarchyLevel < memberMinHierarchy;
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <SortIconBase
      direction={sortField === field ? sortDirection : null}
      active={sortField === field}
    />
  );

  // Stats for header
  const stats = {
    total: teamMembers.length + pendingInvites.length,
    active: teamMembers.filter((m) => m.status === "active").length,
    pending:
      pendingInvites.length +
      teamMembers.filter((m) => m.status === "pending_verification").length,
    roles: roles.length,
  };

  return (
    <SettingsPageLayout
      isLoading={isLoading}
      loadingText="Loading team data..."
    >
      <SettingsPageHeader
        title="Team Management"
        subtitle={`${stats.total} members • ${stats.active} active • ${stats.pending} pending`}
        breadcrumbs={[{ label: "Team" }]}
        icon={<UsersIcon className="w-4 h-4 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        actions={
          <button
            onClick={() => setShowInviteModal(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all text-xs font-medium flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            Invite Member
          </button>
        }
      />
      <SettingsPageContent>
        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* Filters Row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Multi-select Status Filter Pills */}
          <div className="flex gap-1.5">
            {(["Active", "Invited", "Inactive"] as FilterStatus[]).map(
              (status) => {
                const isSelected = selectedFilters.includes(status);
                return (
                  <button
                    key={status}
                    onClick={() => toggleFilter(status)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {status}
                  </button>
                );
              }
            )}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, role, status..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Items per page */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-xs border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "35%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "15%" }} />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th
                    onClick={() => handleSort("name")}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                  >
                    <div className="flex items-center">
                      Member
                      <SortIcon field="name" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("role")}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                  >
                    <div className="flex items-center">
                      Roles
                      <SortIcon field="role" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("status")}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                  >
                    <div className="flex items-center">
                      Status
                      <SortIcon field="status" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("created_at")}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                  >
                    <div className="flex items-center">
                      Date Joined
                      <SortIcon field="created_at" />
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500 text-sm"
                    >
                      No team members found
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item, index) => {
                    if (item.type === "member") {
                      const member = item.data as TeamMember;
                      const statusInfo = getStatusDisplay(member.status);
                      const globalIndex = startIndex + index;

                      return (
                        <tr key={member.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-full bg-linear-to-br ${
                                  avatarColors[
                                    globalIndex % avatarColors.length
                                  ]
                                } flex items-center justify-center text-white font-medium text-xs shrink-0`}
                              >
                                {getInitials(member.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-slate-900 truncate">
                                  {member.name}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  {member.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {member.is_super_admin && (
                                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                                  Owner
                                </span>
                              )}
                              {member.roles.length > 0 ? (
                                member.roles
                                  // Filter out Owner role if user is already super_admin (to avoid duplicate)
                                  .filter(
                                    (role) =>
                                      !(
                                        member.is_super_admin &&
                                        role.slug === "owner"
                                      )
                                  )
                                  .map((role) => {
                                    // Color code Admin role purple, others slate
                                    const isAdminRole =
                                      role.slug === "admin" ||
                                      role.name.toLowerCase() === "admin";
                                    const roleColor = isAdminRole
                                      ? "bg-purple-100 text-purple-700"
                                      : "bg-slate-100 text-slate-700";
                                    return (
                                      <span
                                        key={role.id}
                                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${roleColor}`}
                                      >
                                        {role.name}
                                      </span>
                                    );
                                  })
                              ) : !member.is_super_admin ? (
                                <span className="text-sm text-slate-500">
                                  Member
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="text-sm text-slate-600">
                              {formatDate(member.created_at)}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canEditMember(member) && (
                                <button
                                  onClick={() => handleEditMember(member)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit Member"
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
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    } else {
                      const invite = item.data as Invitation;
                      const statusInfo = getStatusDisplay(invite.status);

                      return (
                        <tr
                          key={invite.id}
                          className="hover:bg-slate-50 bg-amber-50/30"
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-linear-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white shrink-0">
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
                                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                  />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-slate-900">
                                  Pending Invitation
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  {invite.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {invite.role ? (
                              <span
                                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                  invite.role.slug === "admin" ||
                                  invite.role.name.toLowerCase() === "admin"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {invite.role.name}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-500">
                                Member
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div>
                              <p className="text-sm text-slate-600">
                                {formatDate(invite.created_at)}
                              </p>
                              <p className="text-xs text-slate-400">
                                Expires {formatDate(invite.expires_at)}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleResendInvite(invite.id)}
                                className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                              >
                                Resend
                              </button>
                              <button
                                onClick={() =>
                                  handleCancelInvite(invite.id, invite.email)
                                }
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                title="Cancel invitation"
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
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalItems > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <p className="text-xs text-slate-600">
                Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
                <span className="font-medium">
                  {Math.min(startIndex + itemsPerPage, totalItems)}
                </span>{" "}
                of <span className="font-medium">{totalItems}</span> results
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        currentPage === pageNum
                          ? "bg-blue-600 text-white"
                          : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">
                  Invite Team Member
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Send an invitation to join your organization
                </p>
              </div>

              <div className="p-5 space-y-4">
                {modalError && (
                  <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <svg
                      className="w-4 h-4 text-red-600 shrink-0 mt-0.5"
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
                    <p className="text-sm text-red-700">{modalError}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={inviteForm.firstName}
                      onChange={(e) =>
                        setInviteForm({
                          ...inviteForm,
                          firstName: e.target.value,
                        })
                      }
                      placeholder="Enter first name"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={inviteForm.lastName}
                      onChange={(e) =>
                        setInviteForm({
                          ...inviteForm,
                          lastName: e.target.value,
                        })
                      }
                      placeholder="Enter last name"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, email: e.target.value })
                    }
                    placeholder="name@company.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="text"
                    value={inviteForm.password}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, password: e.target.value })
                    }
                    placeholder="Set a password (min 8 characters)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    minLength={8}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    You'll share this password with the user after they're
                    added.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Roles & Permissions *
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Select one or more roles. Multiple roles combine their
                    permissions.
                  </p>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {roles.map((role) => {
                      const isSelected = inviteForm.roleIds.includes(role.id);
                      return (
                        <label
                          key={role.id}
                          className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                            isSelected ? "bg-blue-50/50" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setInviteForm({
                                  ...inviteForm,
                                  roleIds: [...inviteForm.roleIds, role.id],
                                });
                              } else {
                                setInviteForm({
                                  ...inviteForm,
                                  roleIds: inviteForm.roleIds.filter(
                                    (id) => id !== role.id
                                  ),
                                });
                              }
                            }}
                            className="mt-0.5 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900">
                                {role.name}
                              </span>
                              <span className="text-xs text-slate-400">
                                Level {role.hierarchy_level}
                              </span>
                            </div>
                            {role.description && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {role.description}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {inviteForm.roleIds.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {inviteForm.roleIds.map((roleId) => {
                        const role = roles.find((r) => r.id === roleId);
                        if (!role) return null;
                        return (
                          <span
                            key={roleId}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"
                          >
                            {role.name}
                            <button
                              type="button"
                              onClick={() =>
                                setInviteForm({
                                  ...inviteForm,
                                  roleIds: inviteForm.roleIds.filter(
                                    (id) => id !== roleId
                                  ),
                                })
                              }
                              className="hover:text-blue-900"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-2.5 p-3 bg-blue-50 rounded-lg">
                  <svg
                    className="w-4 h-4 text-blue-600 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="text-xs text-blue-700">
                    <p className="font-medium">What happens next?</p>
                    <p className="text-blue-600 mt-0.5">
                      The user account will be created immediately. You'll
                      receive the login credentials to share with them.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setModalError(null);
                  }}
                  className="flex-1 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  disabled={isSending}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <>
                      <svg
                        className="w-4 h-4 animate-spin"
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
                      Sending...
                    </>
                  ) : (
                    <>
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Add Team Member
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {confirmModal.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">
                  {confirmModal.title}
                </h2>
              </div>
              <div className="p-5">
                <p className="text-sm text-slate-600">{confirmModal.message}</p>
              </div>
              <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() =>
                    setConfirmModal((prev) => ({ ...prev, show: false }))
                  }
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                    confirmModal.confirmStyle === "danger"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Credentials Modal - Shows login info for new team member */}
        {credentialsModal.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
              <div className="px-5 py-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Team Member Added!
                    </h2>
                    <p className="text-sm text-slate-500">
                      Share these credentials with the new member
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Email
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded border border-slate-200">
                        {credentialsModal.email}
                      </code>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(credentialsModal.email)
                        }
                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                        title="Copy email"
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
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Temporary Password
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded border border-slate-200">
                        {credentialsModal.password}
                      </code>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(
                            credentialsModal.password
                          )
                        }
                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                        title="Copy password"
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
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Login URL
                    </label>
                    <div className="mt-1">
                      <code className="block text-sm font-mono bg-white px-3 py-2 rounded border border-slate-200 text-blue-600 break-all">
                        {credentialsModal.loginUrl}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        credentialsModal.shareMessage
                      );
                      setSuccess("Credentials copied to clipboard!");
                      setTimeout(() => setSuccess(null), 2000);
                    }}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
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
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy All to Share
                  </button>
                </div>

                <p className="text-xs text-slate-500 text-center">
                  The user should change their password after first login.
                </p>
              </div>
              <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() =>
                    setCredentialsModal((prev) => ({ ...prev, show: false }))
                  }
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-60">
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
                Processing...
              </span>
            </div>
          </div>
        )}

        {/* Edit Member Roles Modal */}
        {editModal.show && editModal.member && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">
                  Edit Team Member
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Manage roles for this member
                </p>
              </div>

              <div className="p-5 space-y-5">
                {/* Member Info - Read Only */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div
                    className={`w-12 h-12 rounded-full bg-linear-to-br ${avatarColors[0]} flex items-center justify-center text-white font-medium text-sm shrink-0`}
                  >
                    {getInitials(editModal.member.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {editModal.member.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {editModal.member.email}
                    </p>
                  </div>
                  {editModal.member.is_super_admin && (
                    <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                      Owner
                    </span>
                  )}
                </div>

                {/* Roles Section */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Assigned Roles
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    Click on roles to toggle them. Active roles are highlighted.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => {
                      const isSelected = editModal.selectedRoleIds.includes(
                        role.id
                      );
                      const isOwnerRole = role.slug === "owner";
                      const memberIsOwner = editModal.member?.is_super_admin;

                      // Owner role can only be for super_admin users
                      if (isOwnerRole && !memberIsOwner) return null;
                      // Don't show owner role as editable - it's linked to is_super_admin
                      if (isOwnerRole) {
                        return (
                          <span
                            key={role.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-purple-100 text-purple-700 cursor-not-allowed"
                            title="Owner role cannot be changed"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {role.name}
                          </span>
                        );
                      }

                      return (
                        <button
                          key={role.id}
                          onClick={() => handleEditRoleToggle(role.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-3.5 h-3.5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          {role.name}
                        </button>
                      );
                    })}
                  </div>
                  {editModal.selectedRoleIds.length === 0 &&
                    !editModal.member?.is_super_admin && (
                      <p className="mt-2 text-xs text-amber-600">
                        ⚠️ User should have at least one role assigned
                      </p>
                    )}
                </div>

                {/* Danger Zone / Status Section */}
                {canDeleteMember(editModal.member) && (
                  <div className="pt-4 border-t border-slate-200">
                    <label
                      className={`block text-xs font-semibold uppercase tracking-wide mb-3 ${
                        editModal.member?.status === "disabled"
                          ? "text-slate-500"
                          : "text-red-500"
                      }`}
                    >
                      {editModal.member?.status === "disabled"
                        ? "Member Status"
                        : "Danger Zone"}
                    </label>
                    {editModal.member?.status === "disabled" ? (
                      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-green-700">
                            Reactivate User
                          </p>
                          <p className="text-xs text-green-600">
                            Restore access to the system
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setEditModal({
                              show: false,
                              member: null,
                              selectedRoleIds: [],
                              originalRoleIds: [],
                              isSaving: false,
                            });
                            handleReactivateMember(
                              editModal.member!.id,
                              editModal.member!.name
                            );
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-green-700 bg-white border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          Reactivate
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-red-700">
                            Deactivate User
                          </p>
                          <p className="text-xs text-red-600">
                            Remove access to the system
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setEditModal({
                              show: false,
                              member: null,
                              selectedRoleIds: [],
                              originalRoleIds: [],
                              isSaving: false,
                            });
                            handleDeleteMember(
                              editModal.member!.id,
                              editModal.member!.name
                            );
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          Deactivate
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Ownership Transfer - Only visible to Owner for active non-owner members */}
                {isOwner &&
                  editModal.member &&
                  !editModal.member.is_super_admin &&
                  editModal.member.status === "active" && (
                    <div className="pt-4 border-t border-slate-200">
                      <label className="block text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">
                        ⚠️ Critical Action
                      </label>
                      <div className="p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-red-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-red-700">
                              Transfer Ownership
                            </p>
                            <p className="text-xs text-red-600 mt-1">
                              Make <strong>{editModal.member.name}</strong> the
                              new Owner. You will be demoted to Admin and lose
                              ownership privileges. This cannot be undone by
                              you.
                            </p>
                            <button
                              onClick={() => {
                                setEditModal({
                                  show: false,
                                  member: null,
                                  selectedRoleIds: [],
                                  originalRoleIds: [],
                                  isSaving: false,
                                });
                                handleTransferOwnership(
                                  editModal.member!.id,
                                  editModal.member!.name
                                );
                              }}
                              className="mt-3 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                            >
                              Transfer Ownership to{" "}
                              {editModal.member.name.split(" ")[0]}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
                <button
                  onClick={() =>
                    setEditModal({
                      show: false,
                      member: null,
                      selectedRoleIds: [],
                      originalRoleIds: [],
                      isSaving: false,
                    })
                  }
                  disabled={editModal.isSaving}
                  className="flex-1 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRoles}
                  disabled={editModal.isSaving || !hasEditChanges}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    hasEditChanges
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  } disabled:opacity-50`}
                >
                  {editModal.isSaving ? (
                    <>
                      <svg
                        className="w-4 h-4 animate-spin"
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
                      Saving...
                    </>
                  ) : hasEditChanges ? (
                    <>
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                      Save Changes
                    </>
                  ) : (
                    "Edit Roles"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </SettingsPageContent>
    </SettingsPageLayout>
  );
}

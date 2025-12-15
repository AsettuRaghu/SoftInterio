"use client";

import React, { useState, useEffect, useMemo } from "react";
import { SortIcon as SortIconBase } from "@/components/ui/DataTable";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { InviteTeamMemberModal } from "@/components/team/InviteTeamMemberModal";
import { ConfirmationModal } from "@/components/team/ConfirmationModal";
import { CredentialsModal } from "@/components/team/CredentialsModal";
import { EditMemberModal } from "@/components/team/EditMemberModal";
import { ProcessingOverlay } from "@/components/ui/ProcessingOverlay";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/components/ui/PageLayout";
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
    <PageLayout isLoading={isLoading} loadingText="Loading team data...">
      <PageHeader
        title="Team Management"
        subtitle={`${stats.total} members • ${stats.active} active • ${stats.pending} pending`}
        basePath={{ label: "Settings", href: "/dashboard/settings" }}
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
      <PageContent>
        <div className="space-y-4">
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
                  Showing <span className="font-medium">{startIndex + 1}</span>{" "}
                  to{" "}
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

          {/* Team Member Modals */}
          <InviteTeamMemberModal
            isOpen={showInviteModal}
            onClose={() => {
              setShowInviteModal(false);
              setModalError(null);
            }}
            inviteForm={inviteForm}
            onFormChange={(updates) =>
              setInviteForm({ ...inviteForm, ...updates })
            }
            roles={roles}
            modalError={modalError}
            isSending={isSending}
            onSubmit={handleInvite}
          />

          <ConfirmationModal
            isOpen={confirmModal.show}
            title={confirmModal.title}
            message={confirmModal.message}
            confirmText={confirmModal.confirmText}
            confirmStyle={confirmModal.confirmStyle}
            onConfirm={confirmModal.onConfirm}
            onCancel={() =>
              setConfirmModal((prev) => ({ ...prev, show: false }))
            }
          />

          <CredentialsModal
            isOpen={credentialsModal.show}
            email={credentialsModal.email}
            password={credentialsModal.password}
            loginUrl={credentialsModal.loginUrl}
            shareMessage={credentialsModal.shareMessage}
            onClose={() =>
              setCredentialsModal((prev) => ({ ...prev, show: false }))
            }
            onCopyAll={() => {
              navigator.clipboard.writeText(credentialsModal.shareMessage);
              setSuccess("Credentials copied to clipboard!");
              setTimeout(() => setSuccess(null), 2000);
            }}
          />

          <EditMemberModal
            isOpen={editModal.show}
            member={editModal.member}
            selectedRoleIds={editModal.selectedRoleIds}
            originalRoleIds={editModal.originalRoleIds}
            isSaving={editModal.isSaving}
            roles={roles}
            isOwner={isOwner}
            onClose={() =>
              setEditModal({
                show: false,
                member: null,
                selectedRoleIds: [],
                originalRoleIds: [],
                isSaving: false,
              })
            }
            onRoleToggle={handleEditRoleToggle}
            onSave={handleSaveRoles}
            onDelete={handleDeleteMember}
            onReactivate={handleReactivateMember}
            onTransferOwnership={handleTransferOwnership}
          />

          {/* Processing Overlay */}
          <ProcessingOverlay isVisible={isProcessing} message="Processing..." />
        </div>
      </PageContent>
    </PageLayout>
  );
}

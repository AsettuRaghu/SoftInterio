"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  XMarkIcon,
  CloudArrowUpIcon,
  PaperClipIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  UserCircleIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  TrashIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";

// Types
interface ChecklistItem {
  id: string;
  name: string;
  is_completed: boolean;
  completed_at?: string;
  completed_by?: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  file_size: number;
  attachment_type: string;
  description?: string;
  uploaded_by: { id: string; name: string };
  uploaded_at: string;
}

interface Comment {
  id: string;
  comment_type: string;
  content: string;
  created_by: { id: string; name: string };
  created_at: string;
  is_internal: boolean;
}

interface Approval {
  id: string;
  status: "pending" | "approved" | "rejected" | "revision_requested";
  requested_by: { id: string; name: string };
  requested_at: string;
  request_notes?: string;
  approver?: { id: string; name: string };
  responded_at?: string;
  response_notes?: string;
}

interface SubPhaseDetail {
  id: string;
  name: string;
  status: string;
  action_type?: string;
  progress_percentage: number;
  instructions?: string;
  assigned_to?: { id: string; name: string };
  due_date?: string;
  started_at?: string;
  started_by?: { id: string; name: string };
  completed_at?: string;
  completed_by?: { id: string; name: string };
  skipped?: boolean;
  skip_reason?: string;
  can_skip?: boolean;
  checklist_items?: ChecklistItem[];
  attachments?: Attachment[];
  comments?: Comment[];
  approvals?: Approval[];
}

interface SubPhaseDetailPanelProps {
  isOpen: boolean;
  projectId: string;
  phaseId: string;
  subPhaseId: string;
  onClose: () => void;
  onUpdate: () => void;
}

// Action type labels and icons
const ACTION_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  manual: {
    label: "Manual",
    icon: <CheckCircleIcon className="w-4 h-4" />,
    color: "slate",
  },
  approval: {
    label: "Approval Required",
    icon: <HandThumbUpIcon className="w-4 h-4" />,
    color: "purple",
  },
  upload: {
    label: "File Upload Required",
    icon: <CloudArrowUpIcon className="w-4 h-4" />,
    color: "blue",
  },
  assignment: {
    label: "Assignment Required",
    icon: <UserCircleIcon className="w-4 h-4" />,
    color: "indigo",
  },
  checklist: {
    label: "Checklist",
    icon: <DocumentTextIcon className="w-4 h-4" />,
    color: "green",
  },
  form: {
    label: "Form Entry",
    icon: <PencilIcon className="w-4 h-4" />,
    color: "orange",
  },
  meeting: {
    label: "Meeting Required",
    icon: <UserCircleIcon className="w-4 h-4" />,
    color: "teal",
  },
  handover: {
    label: "Team Handover",
    icon: <ForwardIcon className="w-4 h-4" />,
    color: "amber",
  },
};

// Format helpers
const formatDate = (dateString?: string) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (dateString?: string) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function SubPhaseDetailPanel({
  isOpen,
  projectId,
  phaseId,
  subPhaseId,
  onClose,
  onUpdate,
}: SubPhaseDetailPanelProps) {
  const [subPhase, setSubPhase] = useState<SubPhaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "details" | "files" | "comments" | "activity"
  >("details");
  const [uploading, setUploading] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [showSkipModal, setShowSkipModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && subPhaseId) {
      fetchSubPhaseDetails();
    }
  }, [subPhaseId, isOpen]);

  const fetchSubPhaseDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/sub-phases/${subPhaseId}`
      );
      if (!response.ok) throw new Error("Failed to fetch sub-phase details");
      const data = await response.json();
      setSubPhase(data.subPhase);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleStartSubPhase = async () => {
    // Check if there's an assignee before trying to start
    if (!subPhase?.assigned_to) {
      alert("Please assign someone to this sub-phase before starting it.");
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/sub-phases/${subPhaseId}/start`,
        { method: "POST" }
      );
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || data.reason || "Cannot start sub-phase");
        return;
      }
      await fetchSubPhaseDetails();
      onUpdate();
    } catch (err) {
      console.error("Error starting sub-phase:", err);
    }
  };

  const handleCompleteSubPhase = async () => {
    // Prompt for completion notes (required)
    const notes = prompt("Please provide completion notes (required):");
    if (!notes?.trim()) {
      alert("Completion notes are required.");
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/sub-phases/${subPhaseId}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: notes.trim() }),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || data.reason || "Cannot complete sub-phase");
        return;
      }
      await fetchSubPhaseDetails();
      onUpdate();
    } catch (err) {
      console.error("Error completing sub-phase:", err);
    }
  };

  const handleSkipSubPhase = async () => {
    if (!skipReason.trim()) {
      alert("Please provide a reason for skipping");
      return;
    }
    try {
      const response = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/sub-phases/${subPhaseId}/skip`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: skipReason }),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || data.reason || "Cannot skip sub-phase");
        return;
      }
      setShowSkipModal(false);
      setSkipReason("");
      await fetchSubPhaseDetails();
      onUpdate();
    } catch (err) {
      console.error("Error skipping sub-phase:", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      formData.append("attachment_type", "document");

      const response = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/sub-phases/${subPhaseId}/attachments`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to upload files");
        return;
      }

      await fetchSubPhaseDetails();
      onUpdate();
    } catch (err) {
      console.error("Error uploading files:", err);
      alert("Failed to upload files");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/sub-phases/${subPhaseId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: newComment,
            comment_type: "note",
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to add comment");
        return;
      }

      setNewComment("");
      await fetchSubPhaseDetails();
    } catch (err) {
      console.error("Error adding comment:", err);
      alert("Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleChecklistToggle = async (
    itemId: string,
    currentValue: boolean
  ) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/sub-phases/${subPhaseId}/checklist/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_completed: !currentValue }),
        }
      );

      if (!response.ok) throw new Error("Failed to update checklist item");
      await fetchSubPhaseDetails();
      onUpdate();
    } catch (err) {
      console.error("Error updating checklist item:", err);
    }
  };

  const handleRequestApproval = async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/sub-phases/${subPhaseId}/approvals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request_notes: "Requesting approval to proceed",
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to request approval");
        return;
      }

      await fetchSubPhaseDetails();
    } catch (err) {
      console.error("Error requesting approval:", err);
      alert("Failed to request approval");
    }
  };

  const actionConfig = subPhase?.action_type
    ? ACTION_TYPE_CONFIG[subPhase.action_type] || ACTION_TYPE_CONFIG.manual
    : ACTION_TYPE_CONFIG.manual;

  // Early return if not open
  if (!isOpen) {
    return null;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div
          className="ml-auto w-full max-w-xl bg-white shadow-xl animate-slide-in-right relative z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/2 mb-4" />
            <div className="space-y-3">
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !subPhase) {
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div
          className="ml-auto w-full max-w-xl bg-white shadow-xl relative z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-slate-600">{error || "Sub-phase not found"}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div
        className="ml-auto w-full max-w-xl bg-white shadow-xl flex flex-col h-full overflow-hidden animate-slide-in-right relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg bg-${actionConfig.color}-100 text-${actionConfig.color}-600`}
            >
              {actionConfig.icon}
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">{subPhase.name}</h2>
              <p className="text-xs text-slate-500">{actionConfig.label}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Status Badge */}
            <span
              className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                subPhase.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : subPhase.status === "in_progress"
                  ? "bg-blue-100 text-blue-700"
                  : subPhase.status === "skipped"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {subPhase.status === "completed"
                ? "Completed"
                : subPhase.status === "in_progress"
                ? "In Progress"
                : subPhase.status === "skipped"
                ? "Skipped"
                : "Not Started"}
            </span>

            {/* Progress */}
            <div className="flex items-center gap-2">
              <div className="w-20 bg-slate-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${
                    subPhase.status === "completed"
                      ? "bg-green-500"
                      : "bg-blue-500"
                  }`}
                  style={{ width: `${subPhase.progress_percentage}%` }}
                />
              </div>
              <span className="text-xs text-slate-600">
                {subPhase.progress_percentage}%
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {subPhase.status === "not_started" && (
              <>
                <button
                  onClick={handleStartSubPhase}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                >
                  <PlayIcon className="w-3.5 h-3.5" />
                  Start
                </button>
                {subPhase.can_skip !== false && (
                  <button
                    onClick={() => setShowSkipModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-300"
                  >
                    <ForwardIcon className="w-3.5 h-3.5" />
                    Skip
                  </button>
                )}
              </>
            )}
            {subPhase.status === "in_progress" && (
              <button
                onClick={handleCompleteSubPhase}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
              >
                <CheckCircleIcon className="w-3.5 h-3.5" />
                Complete
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 border-b border-slate-200 flex gap-4">
          {(
            [
              { key: "details", label: "Details" },
              {
                key: "files",
                label: "Files",
                badge: subPhase.attachments?.length,
              },
              {
                key: "comments",
                label: "Comments",
                badge: subPhase.comments?.length,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
              {"badge" in tab && tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-slate-200 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* DETAILS TAB */}
          {activeTab === "details" && (
            <div className="space-y-4">
              {/* Instructions */}
              {subPhase.instructions && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <InformationCircleIcon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800 mb-1">
                        Instructions
                      </p>
                      <p className="text-sm text-blue-700">
                        {subPhase.instructions}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline Info */}
              <div className="grid grid-cols-2 gap-3">
                {subPhase.assigned_to && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Assigned To</p>
                    <p className="text-sm font-medium text-slate-900">
                      {subPhase.assigned_to.name}
                    </p>
                  </div>
                )}
                {subPhase.due_date && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Due Date</p>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDate(subPhase.due_date)}
                    </p>
                  </div>
                )}
                {subPhase.started_at && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Started</p>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDateTime(subPhase.started_at)}
                    </p>
                    {subPhase.started_by && (
                      <p className="text-xs text-slate-500">
                        by {subPhase.started_by.name}
                      </p>
                    )}
                  </div>
                )}
                {subPhase.completed_at && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 mb-1">Completed</p>
                    <p className="text-sm font-medium text-green-900">
                      {formatDateTime(subPhase.completed_at)}
                    </p>
                    {subPhase.completed_by && (
                      <p className="text-xs text-green-600">
                        by {subPhase.completed_by.name}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Skipped Info */}
              {subPhase.skipped && subPhase.skip_reason && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-600 mb-1">Skipped</p>
                  <p className="text-sm text-amber-800">
                    {subPhase.skip_reason}
                  </p>
                </div>
              )}

              {/* Approval Section (for approval-type sub-phases) */}
              {subPhase.action_type === "approval" && (
                <div className="border border-slate-200 rounded-lg">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                    <h4 className="text-sm font-medium text-slate-900">
                      Approval Status
                    </h4>
                  </div>
                  <div className="p-3">
                    {subPhase.approvals && subPhase.approvals.length > 0 ? (
                      <div className="space-y-3">
                        {subPhase.approvals.map((approval) => (
                          <div
                            key={approval.id}
                            className={`p-3 rounded-lg ${
                              approval.status === "approved"
                                ? "bg-green-50 border border-green-200"
                                : approval.status === "rejected"
                                ? "bg-red-50 border border-red-200"
                                : "bg-yellow-50 border border-yellow-200"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  approval.status === "approved"
                                    ? "bg-green-100 text-green-700"
                                    : approval.status === "rejected"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}
                              >
                                {approval.status.charAt(0).toUpperCase() +
                                  approval.status.slice(1)}
                              </span>
                              <span className="text-xs text-slate-500">
                                {formatDateTime(approval.requested_at)}
                              </span>
                            </div>
                            {approval.response_notes && (
                              <p className="text-sm text-slate-700">
                                {approval.response_notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <HandThumbUpIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 mb-3">
                          No approval requested yet
                        </p>
                        {subPhase.status === "in_progress" && (
                          <button
                            onClick={handleRequestApproval}
                            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
                          >
                            Request Approval
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Checklist Section */}
              {subPhase.checklist_items &&
                subPhase.checklist_items.length > 0 && (
                  <div className="border border-slate-200 rounded-lg">
                    <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-slate-900">
                        Checklist
                      </h4>
                      <span className="text-xs text-slate-500">
                        {
                          subPhase.checklist_items.filter((i) => i.is_completed)
                            .length
                        }{" "}
                        / {subPhase.checklist_items.length}
                      </span>
                    </div>
                    <div className="p-3 space-y-2">
                      {subPhase.checklist_items.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={item.is_completed}
                            onChange={() =>
                              handleChecklistToggle(item.id, item.is_completed)
                            }
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span
                            className={`text-sm ${
                              item.is_completed
                                ? "text-slate-400 line-through"
                                : "text-slate-700"
                            }`}
                          >
                            {item.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* FILES TAB */}
          {activeTab === "files" && (
            <div className="space-y-4">
              {/* Upload Area */}
              <div
                className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <CloudArrowUpIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 mb-1">
                  {uploading ? "Uploading..." : "Click to upload files"}
                </p>
                <p className="text-xs text-slate-400">
                  PDF, Images, Documents (max 10MB)
                </p>
              </div>

              {/* File List */}
              {subPhase.attachments && subPhase.attachments.length > 0 ? (
                <div className="space-y-2">
                  {subPhase.attachments.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      <div className="p-2 bg-slate-100 rounded-lg">
                        <PaperClipIcon className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {file.file_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatFileSize(file.file_size)} •{" "}
                          {file.uploaded_by.name} •{" "}
                          {formatDate(file.uploaded_at)}
                        </p>
                      </div>
                      <a
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <PaperClipIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    No files uploaded yet
                  </p>
                </div>
              )}
            </div>
          )}

          {/* COMMENTS TAB */}
          {activeTab === "comments" && (
            <div className="space-y-4">
              {/* Add Comment */}
              <div className="border border-slate-200 rounded-lg p-3">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full text-sm border-0 focus:ring-0 resize-none"
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || submittingComment}
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingComment ? "Posting..." : "Post Comment"}
                  </button>
                </div>
              </div>

              {/* Comments List */}
              {subPhase.comments && subPhase.comments.length > 0 ? (
                <div className="space-y-3">
                  {subPhase.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3 border border-slate-200 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                          <UserCircleIcon className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {comment.created_by.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(comment.created_at)}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 ml-9">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ChatBubbleLeftRightIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No comments yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Skip Modal */}
      {showSkipModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowSkipModal(false)}
          />
          <div className="relative bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Skip Sub-Phase
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Please provide a reason for skipping &quot;{subPhase.name}&quot;
            </p>
            <textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="Enter reason..."
              className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowSkipModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSkipSubPhase}
                disabled={!skipReason.trim()}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                Skip Sub-Phase
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

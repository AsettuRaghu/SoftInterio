"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type {
  TaskPriority,
  TaskRelatedType,
  CreateTaskInput,
  TaskTag,
} from "@/types/tasks";
import {
  TaskPriorityLabels,
  TaskPriorityColors,
  TaskRelatedTypeLabels,
} from "@/types/tasks";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Icons
const XIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const UserIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const TagIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
    />
  </svg>
);

const LinkIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    />
  </svg>
);

const FlagIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
    />
  </svg>
);

const SearchIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

const ChevronUpIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 15l7-7 7 7"
    />
  </svg>
);

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface LinkedEntity {
  id: string;
  name: string;
  type: TaskRelatedType;
  number?: string;
}

interface SubtaskItem {
  id: string;
  title: string;
  priority: TaskPriority;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parentTaskId?: string;
  parentTaskTitle?: string;
  relatedType?: TaskRelatedType;
  relatedId?: string;
  relatedName?: string;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSuccess,
  parentTaskId,
  parentTaskTitle,
  relatedType,
  relatedId,
  relatedName,
}: CreateTaskModalProps) {
  const { user: currentUser } = useCurrentUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [tags, setTags] = useState<TaskTag[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Linked entities state
  const [leads, setLeads] = useState<LinkedEntity[]>([]);
  const [quotations, setQuotations] = useState<LinkedEntity[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);
  const [entitySearchQuery, setEntitySearchQuery] = useState("");

  // Subtasks state
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [taskRelatedType, setTaskRelatedType] = useState<TaskRelatedType | "">(
    relatedType || ""
  );
  const [taskRelatedId, setTaskRelatedId] = useState(relatedId || "");
  const [selectedEntityName, setSelectedEntityName] = useState(
    relatedName || ""
  );

  // Get today's date in YYYY-MM-DD format for min attribute and default
  const today = useMemo(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  }, []);

  // Fetch team members
  useEffect(() => {
    if (isOpen) {
      setIsLoadingMembers(true);
      fetch("/api/team/members")
        .then((res) => res.json())
        .then((data) => {
          // API returns data in 'data' field, not 'members'
          setTeamMembers(data.data || data.members || []);
        })
        .catch(console.error)
        .finally(() => setIsLoadingMembers(false));

      // Fetch tags
      fetch("/api/tasks/tags")
        .then((res) => res.json())
        .then((data) => setTags(data.tags || []))
        .catch(() => setTags([])); // Tags API might not exist yet

      // Fetch linkable entities (leads and quotations)
      setIsLoadingEntities(true);
      Promise.all([
        fetch("/api/sales/leads?limit=100")
          .then((res) => res.json())
          .catch(() => ({ leads: [] })),
        fetch("/api/quotations?limit=100")
          .then((res) => res.json())
          .catch(() => ({ quotations: [] })),
      ])
        .then(([leadsData, quotationsData]) => {
          // Transform leads
          const leadsEntities: LinkedEntity[] = (leadsData.leads || []).map(
            (lead: any) => ({
              id: lead.id,
              name: lead.client_name || "Unnamed Lead",
              type: "lead" as TaskRelatedType,
              number: lead.lead_number,
            })
          );
          setLeads(leadsEntities);

          // Transform quotations
          const quotationEntities: LinkedEntity[] = (
            quotationsData.quotations || []
          ).map((q: any) => ({
            id: q.id,
            name: q.title || q.client_name || "Unnamed Quotation",
            type: "quotation" as TaskRelatedType,
            number: q.quotation_number,
          }));
          setQuotations(quotationEntities);
        })
        .finally(() => setIsLoadingEntities(false));
    }
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      // Default start date to today
      setStartDate(today);
      setDueDate("");
      setEstimatedHours("");
      // Default assignee to current user if available
      setAssignedTo(currentUser?.id || "");
      setSelectedTags([]);
      setTaskRelatedType(relatedType || "");
      setTaskRelatedId(relatedId || "");
      setSelectedEntityName(relatedName || "");
      setEntitySearchQuery("");
      setSubtasks([]);
      setNewSubtaskTitle("");
      setIsSubtasksExpanded(false);
      setError(null);
    }
  }, [isOpen, relatedType, relatedId, relatedName, today, currentUser?.id]);

  // Add subtask
  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        title: newSubtaskTitle.trim(),
        priority: "medium",
      },
    ]);
    setNewSubtaskTitle("");
  };

  // Remove subtask
  const removeSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((st) => st.id !== id));
  };

  // Update subtask priority
  const updateSubtaskPriority = (id: string, newPriority: TaskPriority) => {
    setSubtasks((prev) =>
      prev.map((st) => (st.id === id ? { ...st, priority: newPriority } : st))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError("Task title is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: CreateTaskInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        parent_task_id: parentTaskId || undefined,
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
        estimated_hours: estimatedHours
          ? parseFloat(estimatedHours)
          : undefined,
        assigned_to: assignedTo || undefined,
        related_type: taskRelatedType || undefined,
        related_id: taskRelatedId || undefined,
        tag_ids: selectedTags.length > 0 ? selectedTags : undefined,
      };

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create task");
      }

      const { task: createdTask } = await response.json();

      // Create subtasks if any
      if (subtasks.length > 0 && createdTask?.id) {
        await Promise.all(
          subtasks.map((subtask) =>
            fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: subtask.title,
                priority: subtask.priority,
                parent_task_id: createdTask.id,
                assigned_to: assignedTo || undefined,
              }),
            })
          )
        );
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Modal Panel - Slide from right */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg">
        <div className="h-full flex flex-col bg-white shadow-xl">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {parentTaskId ? "Create Subtask" : "Create New Task"}
                </h2>
                {parentTaskTitle && (
                  <p className="text-sm text-blue-100 mt-0.5">
                    Parent: {parentTaskTitle}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  <svg
                    className="w-5 h-5 shrink-0"
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

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter task title..."
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={3}
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* Priority Selection */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                  <FlagIcon className="w-4 h-4 text-slate-500" />
                  Priority
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(TaskPriorityLabels) as TaskPriority[]).map(
                    (p) => {
                      const colors = TaskPriorityColors[p];
                      const isSelected = priority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`
                            relative px-3 py-2.5 text-xs font-medium rounded-xl border-2 transition-all
                            ${
                              isSelected
                                ? `${colors.bg} ${colors.text} border-current shadow-sm`
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                            }
                          `}
                        >
                          <span className="flex items-center justify-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isSelected ? colors.dot : "bg-slate-300"
                              }`}
                            />
                            {TaskPriorityLabels[p]}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Date Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                    <CalendarIcon className="w-4 h-4 text-slate-500" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    min={today}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      // If due date is before new start date, clear it
                      if (dueDate && e.target.value > dueDate) {
                        setDueDate("");
                      }
                    }}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                    <CalendarIcon className="w-4 h-4 text-red-400" />
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    min={startDate || today}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Estimated Hours */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                  <ClockIcon className="w-4 h-4 text-slate-500" />
                  Estimated Hours
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="e.g., 4"
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Assignee */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                  <UserIcon className="w-4 h-4 text-slate-500" />
                  Assign To
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  disabled={isLoadingMembers}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white disabled:bg-slate-100"
                >
                  <option value="">
                    {isLoadingMembers
                      ? "Loading team members..."
                      : "Unassigned"}
                  </option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
                {teamMembers.length === 0 && !isLoadingMembers && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    No team members found. Add members in Settings → Team.
                  </p>
                )}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                    <TagIcon className="w-4 h-4 text-slate-500" />
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                          selectedTags.includes(tag.id)
                            ? "ring-2 ring-offset-1 ring-blue-500"
                            : "hover:scale-105"
                        }`}
                        style={{
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtasks Section - Only show if not creating a subtask */}
              {!parentTaskId && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsSubtasksExpanded(!isSubtasksExpanded)}
                    className="w-full flex items-center justify-between text-sm font-medium text-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <PlusIcon className="w-4 h-4 text-slate-500" />
                      Subtasks {subtasks.length > 0 && `(${subtasks.length})`}
                    </span>
                    {isSubtasksExpanded ? (
                      <ChevronUpIcon className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  {isSubtasksExpanded && (
                    <div className="mt-3 space-y-3">
                      {/* Add Subtask Input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addSubtask();
                            }
                          }}
                          placeholder="Add a subtask..."
                          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <button
                          type="button"
                          onClick={addSubtask}
                          disabled={!newSubtaskTitle.trim()}
                          className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Add
                        </button>
                      </div>

                      {/* Subtasks List */}
                      {subtasks.length > 0 && (
                        <div className="space-y-2">
                          {subtasks.map((subtask, index) => (
                            <div
                              key={subtask.id}
                              className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200"
                            >
                              <span className="text-xs text-slate-400 font-mono w-5">
                                {index + 1}.
                              </span>
                              <span className="flex-1 text-sm text-slate-700 truncate">
                                {subtask.title}
                              </span>
                              <select
                                value={subtask.priority}
                                onChange={(e) =>
                                  updateSubtaskPriority(
                                    subtask.id,
                                    e.target.value as TaskPriority
                                  )
                                }
                                className="text-xs px-2 py-1 border border-slate-200 rounded bg-white"
                              >
                                {(
                                  Object.keys(
                                    TaskPriorityLabels
                                  ) as TaskPriority[]
                                ).map((p) => (
                                  <option key={p} value={p}>
                                    {TaskPriorityLabels[p]}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeSubtask(subtask.id)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {subtasks.length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-2">
                          No subtasks added yet. Subtasks will be created with
                          the same assignee.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Related Entity */}
              {!relatedType && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                    <LinkIcon className="w-4 h-4 text-slate-500" />
                    Link to Entity (Optional)
                  </label>

                  {/* Entity Type Selection */}
                  <div className="mb-3">
                    <select
                      value={taskRelatedType}
                      onChange={(e) => {
                        setTaskRelatedType(
                          e.target.value as TaskRelatedType | ""
                        );
                        setTaskRelatedId("");
                        setSelectedEntityName("");
                        setEntitySearchQuery("");
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select entity type...</option>
                      <option value="lead">Lead</option>
                      <option value="quotation">Quotation</option>
                      <option value="project">Project</option>
                      <option value="client">Client</option>
                    </select>
                  </div>

                  {/* Entity Search & Selection */}
                  {taskRelatedType &&
                    (taskRelatedType === "lead" ||
                      taskRelatedType === "quotation") && (
                      <div>
                        {/* Search Input */}
                        <div className="relative mb-2">
                          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={entitySearchQuery}
                            onChange={(e) =>
                              setEntitySearchQuery(e.target.value)
                            }
                            placeholder={`Search ${
                              taskRelatedType === "lead"
                                ? "leads"
                                : "quotations"
                            }...`}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Entity List */}
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                          {isLoadingEntities ? (
                            <div className="p-3 text-sm text-slate-500 text-center">
                              Loading...
                            </div>
                          ) : (
                            <>
                              {(taskRelatedType === "lead" ? leads : quotations)
                                .filter(
                                  (entity) =>
                                    entity.name
                                      .toLowerCase()
                                      .includes(
                                        entitySearchQuery.toLowerCase()
                                      ) ||
                                    (entity.number &&
                                      entity.number
                                        .toLowerCase()
                                        .includes(
                                          entitySearchQuery.toLowerCase()
                                        ))
                                )
                                .slice(0, 10)
                                .map((entity) => (
                                  <button
                                    key={entity.id}
                                    type="button"
                                    onClick={() => {
                                      setTaskRelatedId(entity.id);
                                      setSelectedEntityName(entity.name);
                                      setEntitySearchQuery("");
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors ${
                                      taskRelatedId === entity.id
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-slate-700"
                                    }`}
                                  >
                                    <span className="font-medium">
                                      {entity.name}
                                    </span>
                                    {entity.number && (
                                      <span className="ml-2 text-xs text-slate-500">
                                        #{entity.number}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              {(taskRelatedType === "lead"
                                ? leads
                                : quotations
                              ).filter(
                                (entity) =>
                                  entity.name
                                    .toLowerCase()
                                    .includes(
                                      entitySearchQuery.toLowerCase()
                                    ) ||
                                  (entity.number &&
                                    entity.number
                                      .toLowerCase()
                                      .includes(
                                        entitySearchQuery.toLowerCase()
                                      ))
                              ).length === 0 && (
                                <div className="p-3 text-sm text-slate-500 text-center">
                                  No{" "}
                                  {taskRelatedType === "lead"
                                    ? "leads"
                                    : "quotations"}{" "}
                                  found
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Selected Entity Display */}
                        {taskRelatedId && selectedEntityName && (
                          <div className="mt-2 flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                            <span className="text-sm text-blue-700">
                              <span className="font-medium">Selected:</span>{" "}
                              {selectedEntityName}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setTaskRelatedId("");
                                setSelectedEntityName("");
                              }}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Manual ID input for project/client (since we don't have those APIs yet) */}
                  {taskRelatedType &&
                    (taskRelatedType === "project" ||
                      taskRelatedType === "client") && (
                      <div>
                        <input
                          type="text"
                          value={taskRelatedId}
                          onChange={(e) => setTaskRelatedId(e.target.value)}
                          placeholder={`Enter ${taskRelatedType} ID...`}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="mt-1.5 text-xs text-slate-500">
                          Projects and clients search coming soon. For now,
                          enter the ID manually.
                        </p>
                      </div>
                    )}
                </div>
              )}

              {/* Pre-filled related entity */}
              {relatedType && relatedId && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700">
                      Linked to {TaskRelatedTypeLabels[relatedType]}:{" "}
                      <strong>{relatedName || relatedId}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
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
                      Creating...
                    </>
                  ) : (
                    <>
                      <PlusIcon className="w-4 h-4" />
                      Create Task
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

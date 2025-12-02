"use client";

import React, { useState, useEffect } from "react";
import type {
  TaskPriority,
  TaskTemplateCategory,
  CreateTaskTemplateInput,
  CreateTaskTemplateItemInput,
} from "@/types/tasks";
import {
  TaskPriorityLabels,
  TaskPriorityColors,
  TaskTemplateCategoryLabels,
  TaskTemplateCategoryColors,
} from "@/types/tasks";

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

const GripIcon = ({ className }: { className?: string }) => (
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
      d="M4 8h16M4 16h16"
    />
  </svg>
);

const TemplateIcon = ({ className }: { className?: string }) => (
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
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
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
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
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

const ChevronRightIcon = ({ className }: { className?: string }) => (
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
      d="M9 5l7 7-7 7"
    />
  </svg>
);

interface TemplateItem {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  relative_due_days: string;
  estimated_hours: string;
  children: TemplateItem[];
  isExpanded: boolean;
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function createEmptyItem(): TemplateItem {
  return {
    id: generateId(),
    title: "",
    description: "",
    priority: "medium",
    relative_due_days: "",
    estimated_hours: "",
    children: [],
    isExpanded: true,
  };
}

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTemplateModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateTemplateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TaskTemplateCategory>("general");
  const [defaultPriority, setDefaultPriority] =
    useState<TaskPriority>("medium");
  const [isProtected, setIsProtected] = useState(false);
  const [items, setItems] = useState<TemplateItem[]>([]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setCategory("general");
      setDefaultPriority("medium");
      setIsProtected(false);
      setItems([]);
      setError(null);
    }
  }, [isOpen]);

  const addItem = () => {
    setItems([...items, createEmptyItem()]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof TemplateItem, value: any) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addSubtask = (parentId: string) => {
    setItems(
      items.map((item) =>
        item.id === parentId
          ? {
              ...item,
              children: [...item.children, createEmptyItem()],
              isExpanded: true,
            }
          : item
      )
    );
  };

  const removeSubtask = (parentId: string, subtaskId: string) => {
    setItems(
      items.map((item) =>
        item.id === parentId
          ? {
              ...item,
              children: item.children.filter((c) => c.id !== subtaskId),
            }
          : item
      )
    );
  };

  const updateSubtask = (
    parentId: string,
    subtaskId: string,
    field: keyof TemplateItem,
    value: any
  ) => {
    setItems(
      items.map((item) =>
        item.id === parentId
          ? {
              ...item,
              children: item.children.map((c) =>
                c.id === subtaskId ? { ...c, [field]: value } : c
              ),
            }
          : item
      )
    );
  };

  const toggleExpand = (id: string) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, isExpanded: !item.isExpanded } : item
      )
    );
  };

  const convertItemsToInput = (
    items: TemplateItem[]
  ): CreateTaskTemplateItemInput[] => {
    return items
      .filter((item) => item.title.trim())
      .map((item, index) => ({
        title: item.title.trim(),
        description: item.description.trim() || undefined,
        priority: item.priority,
        relative_due_days: item.relative_due_days
          ? parseInt(item.relative_due_days)
          : undefined,
        estimated_hours: item.estimated_hours
          ? parseFloat(item.estimated_hours)
          : undefined,
        sort_order: index,
        children:
          item.children.length > 0
            ? convertItemsToInput(item.children)
            : undefined,
      }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Template name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: CreateTaskTemplateInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        default_priority: defaultPriority,
        is_protected: isProtected,
        items: convertItemsToInput(items),
      };

      const response = await fetch("/api/tasks/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create template");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create template"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTaskItem = (
    item: TemplateItem,
    isSubtask: boolean = false,
    parentId?: string
  ) => (
    <div
      key={item.id}
      className={`
        group border rounded-xl transition-all
        ${
          isSubtask
            ? "bg-slate-50 border-slate-200 ml-8"
            : "bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm"
        }
      `}
    >
      <div className="p-4">
        {/* Item Header */}
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <div className="mt-2.5 cursor-move text-slate-300 hover:text-slate-400">
            <GripIcon className="w-4 h-4" />
          </div>

          {/* Expand/Collapse for parent items */}
          {!isSubtask && item.children.length > 0 && (
            <button
              type="button"
              onClick={() => toggleExpand(item.id)}
              className="mt-2.5 text-slate-400 hover:text-slate-600"
            >
              {item.isExpanded ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Main Content */}
          <div className="flex-1 space-y-3">
            {/* Title */}
            <input
              type="text"
              value={item.title}
              onChange={(e) =>
                isSubtask && parentId
                  ? updateSubtask(parentId, item.id, "title", e.target.value)
                  : updateItem(item.id, "title", e.target.value)
              }
              placeholder={isSubtask ? "Subtask title..." : "Task title..."}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {/* Row 2: Priority, Due Days, Hours */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Priority */}
              <select
                value={item.priority}
                onChange={(e) =>
                  isSubtask && parentId
                    ? updateSubtask(
                        parentId,
                        item.id,
                        "priority",
                        e.target.value as TaskPriority
                      )
                    : updateItem(
                        item.id,
                        "priority",
                        e.target.value as TaskPriority
                      )
                }
                className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {(Object.keys(TaskPriorityLabels) as TaskPriority[]).map(
                  (p) => (
                    <option key={p} value={p}>
                      {TaskPriorityLabels[p]}
                    </option>
                  )
                )}
              </select>

              {/* Due Days */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={item.relative_due_days}
                  onChange={(e) =>
                    isSubtask && parentId
                      ? updateSubtask(
                          parentId,
                          item.id,
                          "relative_due_days",
                          e.target.value
                        )
                      : updateItem(item.id, "relative_due_days", e.target.value)
                  }
                  placeholder="Days"
                  className="w-16 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-500">days after start</span>
              </div>

              {/* Hours */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.5"
                  value={item.estimated_hours}
                  onChange={(e) =>
                    isSubtask && parentId
                      ? updateSubtask(
                          parentId,
                          item.id,
                          "estimated_hours",
                          e.target.value
                        )
                      : updateItem(item.id, "estimated_hours", e.target.value)
                  }
                  placeholder="Hrs"
                  className="w-14 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-500">hours</span>
              </div>

              {/* Add Subtask Button (only for parent items) */}
              {!isSubtask && (
                <button
                  type="button"
                  onClick={() => addSubtask(item.id)}
                  className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-3 h-3" />
                  Subtask
                </button>
              )}
            </div>
          </div>

          {/* Delete Button */}
          <button
            type="button"
            onClick={() =>
              isSubtask && parentId
                ? removeSubtask(parentId, item.id)
                : removeItem(item.id)
            }
            className="mt-1 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subtasks */}
      {!isSubtask && item.isExpanded && item.children.length > 0 && (
        <div className="px-4 pb-4 space-y-2">
          {item.children.map((child) => renderTaskItem(child, true, item.id))}
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Modal Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl">
        <div className="h-full flex flex-col bg-white shadow-xl">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Create Task Template
                </h2>
                <p className="text-sm text-blue-100 mt-0.5">
                  Define reusable task workflows
                </p>
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
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
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

              {/* Template Info Section */}
              <div className="p-5 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">
                  Template Information
                </h3>

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., New Project Checklist"
                      className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-slate-400"
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
                      placeholder="Describe when to use this template..."
                      rows={2}
                      className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-slate-400 resize-none"
                    />
                  </div>

                  {/* Category & Priority Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) =>
                          setCategory(e.target.value as TaskTemplateCategory)
                        }
                        className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                      >
                        {(
                          Object.keys(
                            TaskTemplateCategoryLabels
                          ) as TaskTemplateCategory[]
                        ).map((cat) => (
                          <option key={cat} value={cat}>
                            {TaskTemplateCategoryLabels[cat]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Default Priority
                      </label>
                      <select
                        value={defaultPriority}
                        onChange={(e) =>
                          setDefaultPriority(e.target.value as TaskPriority)
                        }
                        className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                      >
                        {(
                          Object.keys(TaskPriorityLabels) as TaskPriority[]
                        ).map((p) => (
                          <option key={p} value={p}>
                            {TaskPriorityLabels[p]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Protected Toggle */}
                  <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-3">
                      <ShieldIcon className="w-5 h-5 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          Protected Template
                        </p>
                        <p className="text-xs text-slate-500">
                          Tasks from protected templates have restricted editing
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsProtected(!isProtected)}
                      className={`
                        relative w-12 h-6 rounded-full transition-colors
                        ${isProtected ? "bg-amber-500" : "bg-slate-200"}
                      `}
                    >
                      <span
                        className={`
                          absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                          ${isProtected ? "left-7" : "left-1"}
                        `}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tasks Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Template Tasks
                  </h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Task
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                    <TemplateIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm text-slate-500 mb-3">
                      No tasks added yet
                    </p>
                    <button
                      type="button"
                      onClick={addItem}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add First Task
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => renderTaskItem(item))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {items.length} task{items.length !== 1 ? "s" : ""} •{" "}
                  {items.reduce((acc, item) => acc + item.children.length, 0)}{" "}
                  subtask
                  {items.reduce(
                    (acc, item) => acc + item.children.length,
                    0
                  ) !== 1
                    ? "s"
                    : ""}
                </p>
                <div className="flex items-center gap-3">
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
                    disabled={isSubmitting || !name.trim()}
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
                        Create Template
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

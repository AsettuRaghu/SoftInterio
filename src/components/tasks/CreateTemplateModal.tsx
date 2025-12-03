"use client";

import React, { useState, useEffect, useRef } from "react";
import type {
  TaskPriority,
  TaskTemplateCategory,
  CreateTaskTemplateInput,
  CreateTaskTemplateItemInput,
} from "@/types/tasks";
import { TaskPriorityLabels, TaskTemplateCategoryLabels } from "@/types/tasks";
import { PriorityBadge } from "./ui";

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

const GripIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
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
  priority: TaskPriority;
  children: TemplateItem[];
  isExpanded: boolean;
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function createEmptyItem(title: string = ""): TemplateItem {
  return {
    id: generateId(),
    title,
    priority: "medium",
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
  const [items, setItems] = useState<TemplateItem[]>([]);

  // Inline add state
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  // Drag state
  const [draggedItem, setDraggedItem] = useState<{
    id: string;
    parentId?: string;
  } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{
    id: string;
    parentId?: string;
    position: "before" | "after";
  } | null>(null);

  const taskInputRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setCategory("general");
      setDefaultPriority("medium");
      setItems([]);
      setError(null);
      setShowAddTask(false);
      setNewTaskTitle("");
      setAddingSubtaskFor(null);
      setNewSubtaskTitle("");
    }
  }, [isOpen]);

  // Focus inputs when they appear
  useEffect(() => {
    if (showAddTask && taskInputRef.current) {
      taskInputRef.current.focus();
    }
  }, [showAddTask]);

  useEffect(() => {
    if (addingSubtaskFor && subtaskInputRef.current) {
      subtaskInputRef.current.focus();
    }
  }, [addingSubtaskFor]);

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    setItems([...items, createEmptyItem(newTaskTitle.trim())]);
    setNewTaskTitle("");
  };

  const removeTask = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateTaskPriority = (id: string, priority: TaskPriority | null) => {
    if (!priority) return; // Ignore null priority
    setItems(
      items.map((item) => (item.id === id ? { ...item, priority } : item))
    );
  };

  const addSubtask = (parentId: string) => {
    if (!newSubtaskTitle.trim()) return;
    setItems(
      items.map((item) =>
        item.id === parentId
          ? {
              ...item,
              children: [
                ...item.children,
                createEmptyItem(newSubtaskTitle.trim()),
              ],
              isExpanded: true,
            }
          : item
      )
    );
    setNewSubtaskTitle("");
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

  const updateSubtaskPriority = (
    parentId: string,
    subtaskId: string,
    priority: TaskPriority | null
  ) => {
    if (!priority) return; // Ignore null priority
    setItems(
      items.map((item) =>
        item.id === parentId
          ? {
              ...item,
              children: item.children.map((c) =>
                c.id === subtaskId ? { ...c, priority } : c
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

  // Drag and drop handlers
  const handleDragStart = (
    e: React.DragEvent,
    id: string,
    parentId?: string
  ) => {
    setDraggedItem({ id, parentId });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (
    e: React.DragEvent,
    id: string,
    parentId?: string
  ) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === id) return;
    if (!draggedItem.parentId && parentId === draggedItem.id) return;

    const rect = (e.target as HTMLElement)
      .closest("[data-task-item]")
      ?.getBoundingClientRect();
    if (!rect) return;

    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? "before" : "after";

    setDragOverItem({ id, parentId, position });
  };

  const handleDragEnd = () => {
    if (!draggedItem || !dragOverItem) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    if (draggedItem.parentId !== dragOverItem.parentId) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    if (draggedItem.parentId) {
      setItems(
        items.map((item) => {
          if (item.id !== draggedItem.parentId) return item;

          const children = [...item.children];
          const draggedIndex = children.findIndex(
            (c) => c.id === draggedItem.id
          );
          const targetIndex = children.findIndex(
            (c) => c.id === dragOverItem.id
          );

          if (draggedIndex === -1 || targetIndex === -1) return item;

          const [removed] = children.splice(draggedIndex, 1);
          const insertIndex =
            dragOverItem.position === "before" ? targetIndex : targetIndex + 1;
          children.splice(
            draggedIndex < targetIndex ? insertIndex - 1 : insertIndex,
            0,
            removed
          );

          return { ...item, children };
        })
      );
    } else {
      const newItems = [...items];
      const draggedIndex = newItems.findIndex((i) => i.id === draggedItem.id);
      const targetIndex = newItems.findIndex((i) => i.id === dragOverItem.id);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [removed] = newItems.splice(draggedIndex, 1);
        const insertIndex =
          dragOverItem.position === "before" ? targetIndex : targetIndex + 1;
        newItems.splice(
          draggedIndex < targetIndex ? insertIndex - 1 : insertIndex,
          0,
          removed
        );
        setItems(newItems);
      }
    }

    setDraggedItem(null);
    setDragOverItem(null);
  };

  const convertItemsToInput = (
    items: TemplateItem[]
  ): CreateTaskTemplateItemInput[] => {
    return items
      .filter((item) => item.title.trim())
      .map((item, index) => ({
        title: item.title.trim(),
        priority: item.priority,
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
        is_protected: false,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  const totalSubtasks = items.reduce(
    (acc, item) => acc + item.children.length,
    0
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[84vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <PlusIcon className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Create Template
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Template Name & Properties Row */}
            <div className="flex items-start gap-4">
              {/* Template Name */}
              <div className="flex-1">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Template name..."
                  className="w-full text-xl font-semibold text-slate-900 placeholder:text-slate-300 border-none outline-none p-0 bg-transparent"
                  autoFocus
                  required
                />
                {/* Description - compact inline */}
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description (optional)..."
                  className="w-full text-sm text-slate-600 placeholder:text-slate-400 border-none outline-none p-0 bg-transparent mt-1"
                />
              </div>

              {/* Quick Properties */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-400 uppercase">
                    Category
                  </span>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as TaskTemplateCategory)
                      }
                      className="appearance-none pl-2.5 pr-6 py-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <ChevronDownIcon className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-400 uppercase">
                    Priority
                  </span>
                  <PriorityBadge
                    value={defaultPriority}
                    onChange={(val) => val && setDefaultPriority(val)}
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100"></div>

            {/* Tasks Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Tasks ({items.length})
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddTask(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  + Add task
                </button>
              </div>

              {items.length > 0 && (
                <div className="space-y-2 mb-3">
                  {items.map((item) => (
                    <div key={item.id}>
                      <div
                        data-task-item
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragOver={(e) => handleDragOver(e, item.id)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-2 p-3 bg-slate-50 border rounded-xl group transition-all ${
                          dragOverItem?.id === item.id && !dragOverItem.parentId
                            ? dragOverItem.position === "before"
                              ? "border-t-2 border-t-blue-500 border-slate-200"
                              : "border-b-2 border-b-blue-500 border-slate-200"
                            : "border-slate-200"
                        } ${draggedItem?.id === item.id ? "opacity-50" : ""}`}
                      >
                        <div className="cursor-grab text-slate-300 hover:text-slate-400 active:cursor-grabbing">
                          <GripIcon className="w-4 h-4" />
                        </div>

                        {item.children.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            {item.isExpanded ? (
                              <ChevronDownIcon className="w-4 h-4" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <div className="w-4" />
                        )}

                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-slate-900">
                            {item.title}
                          </span>
                          {item.children.length > 0 && (
                            <span className="ml-2 text-xs text-slate-400">
                              ({item.children.length} subtask
                              {item.children.length !== 1 ? "s" : ""})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <PriorityBadge
                            value={item.priority}
                            onChange={(val) => updateTaskPriority(item.id, val)}
                            showLabel={false}
                            size="sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setAddingSubtaskFor(item.id);
                              setNewSubtaskTitle("");
                            }}
                            className="p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                            title="Add subtask"
                          >
                            <PlusIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTask(item.id)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {item.isExpanded && item.children.length > 0 && (
                        <div className="ml-6 mt-1 space-y-1">
                          {item.children.map((subtask) => (
                            <div
                              key={subtask.id}
                              data-task-item
                              draggable
                              onDragStart={(e) =>
                                handleDragStart(e, subtask.id, item.id)
                              }
                              onDragOver={(e) =>
                                handleDragOver(e, subtask.id, item.id)
                              }
                              onDragEnd={handleDragEnd}
                              className={`flex items-center gap-2 p-2 bg-white border rounded-lg group transition-all ${
                                dragOverItem?.id === subtask.id &&
                                dragOverItem.parentId === item.id
                                  ? dragOverItem.position === "before"
                                    ? "border-t-2 border-t-blue-500 border-slate-200"
                                    : "border-b-2 border-b-blue-500 border-slate-200"
                                  : "border-slate-200"
                              } ${
                                draggedItem?.id === subtask.id
                                  ? "opacity-50"
                                  : ""
                              }`}
                            >
                              <div className="cursor-grab text-slate-300 hover:text-slate-400 active:cursor-grabbing">
                                <GripIcon className="w-3 h-3" />
                              </div>

                              <span className="text-slate-300">
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                >
                                  <path
                                    d="M2 0V8H10"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>

                              <span className="flex-1 text-sm text-slate-700">
                                {subtask.title}
                              </span>

                              <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                <PriorityBadge
                                  value={subtask.priority}
                                  onChange={(val) =>
                                    updateSubtaskPriority(
                                      item.id,
                                      subtask.id,
                                      val
                                    )
                                  }
                                  showLabel={false}
                                  size="sm"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeSubtask(item.id, subtask.id)
                                  }
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                >
                                  <XIcon className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {addingSubtaskFor === item.id && (
                        <div className="ml-6 mt-1 flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <span className="text-blue-400">
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 12 12"
                              fill="none"
                            >
                              <path
                                d="M2 0V8H10"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          <input
                            ref={subtaskInputRef}
                            type="text"
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addSubtask(item.id);
                              } else if (e.key === "Escape") {
                                setAddingSubtaskFor(null);
                                setNewSubtaskTitle("");
                              }
                            }}
                            placeholder="Subtask name, press Enter"
                            className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-blue-400"
                          />
                          <button
                            type="button"
                            onClick={() => addSubtask(item.id)}
                            disabled={!newSubtaskTitle.trim()}
                            className="px-2 py-0.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingSubtaskFor(null);
                              setNewSubtaskTitle("");
                            }}
                            className="p-0.5 text-slate-400 hover:text-slate-600"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {showAddTask && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <PlusIcon className="w-4 h-4 text-blue-400" />
                  <input
                    ref={taskInputRef}
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTask();
                      } else if (e.key === "Escape") {
                        setShowAddTask(false);
                        setNewTaskTitle("");
                      }
                    }}
                    placeholder="Task name, press Enter"
                    className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-blue-400"
                  />
                  <button
                    type="button"
                    onClick={addTask}
                    disabled={!newTaskTitle.trim()}
                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddTask(false);
                      setNewTaskTitle("");
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              )}

              {items.length === 0 && !showAddTask && (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                  <TemplateIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-500 mb-2">No tasks yet</p>
                  <button
                    type="button"
                    onClick={() => setShowAddTask(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Add First Task
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 mr-2">
              {items.length} task{items.length !== 1 ? "s" : ""} •{" "}
              {totalSubtasks} subtask{totalSubtasks !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
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
                </span>
              ) : (
                "Create Template"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

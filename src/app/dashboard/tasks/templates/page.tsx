"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type {
  TaskTemplate,
  TaskTemplateCategory,
  TaskPriority,
} from "@/types/tasks";
import {
  TaskTemplateCategoryLabels,
  TaskTemplateCategoryColors,
  TaskPriorityLabels,
  TaskPriorityColors,
} from "@/types/tasks";
import { CreateTemplateModal, EditTemplateModal } from "@/components/tasks";
import { SearchBox } from "@/components/ui/SearchBox";

// Icons
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

const EditIcon = ({ className }: { className?: string }) => (
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
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
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

interface TemplateItem {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  estimated_hours?: number;
  order_index: number;
  isSubtask?: boolean;
}

export default function TaskTemplatesPage() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [templateItems, setTemplateItems] = useState<
    Record<string, TemplateItem[]>
  >({});
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(
    null
  );
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

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<
    TaskTemplateCategory | "all"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch templates from API
  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/tasks/templates");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch templates");
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Toggle row expansion and fetch items if needed
  const toggleExpand = async (templateId: string) => {
    const newExpanded = new Set(expandedRows);

    if (newExpanded.has(templateId)) {
      newExpanded.delete(templateId);
    } else {
      newExpanded.add(templateId);

      // Fetch template items if not already loaded
      if (!templateItems[templateId]) {
        setLoadingItems((prev) => new Set(prev).add(templateId));
        try {
          const response = await fetch(`/api/tasks/templates/${templateId}`);
          if (response.ok) {
            const data = await response.json();
            // Items are nested in template.items, flatten them for display
            const flattenItems = (
              items: any[],
              result: TemplateItem[] = []
            ): TemplateItem[] => {
              for (const item of items) {
                result.push({
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  priority: item.priority,
                  estimated_hours: item.estimated_hours,
                  order_index: item.sort_order || 0,
                  isSubtask: false,
                });
                if (item.children && item.children.length > 0) {
                  // Add children as subtasks with flag
                  for (const child of item.children) {
                    result.push({
                      id: child.id,
                      title: child.title,
                      description: child.description,
                      priority: child.priority,
                      estimated_hours: child.estimated_hours,
                      order_index: child.sort_order || 0,
                      isSubtask: true,
                    });
                  }
                }
              }
              return result;
            };
            setTemplateItems((prev) => ({
              ...prev,
              [templateId]: flattenItems(data.template?.items || []),
            }));
          }
        } catch (err) {
          console.error("Error fetching template items:", err);
        } finally {
          setLoadingItems((prev) => {
            const next = new Set(prev);
            next.delete(templateId);
            return next;
          });
        }
      }
    }

    setExpandedRows(newExpanded);
  };

  // Delete template
  const handleDelete = (templateId: string, templateName: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setConfirmModal({
      show: true,
      title: "Delete Template",
      message: `Are you sure you want to delete "${templateName}"? This action cannot be undone.`,
      confirmText: "Delete",
      confirmStyle: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, show: false }));
        try {
          setDeletingId(templateId);
          const response = await fetch(`/api/tasks/templates/${templateId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Failed to delete template");
          }

          setTemplates((prev) => prev.filter((t) => t.id !== templateId));
        } catch (err) {
          console.error("Error deleting template:", err);
          // Show error in a non-blocking way
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let result = [...templates];

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((t) => t.category === categoryFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (template) =>
          template.name.toLowerCase().includes(query) ||
          template.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [templates, categoryFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredTemplates.length / pageSize);
  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredTemplates.slice(startIndex, startIndex + pageSize);
  }, [filteredTemplates, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, searchQuery]);

  // Get category badge
  const getCategoryBadge = (category: TaskTemplateCategory) => {
    const colors = TaskTemplateCategoryColors[category];
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}
      >
        {TaskTemplateCategoryLabels[category]}
      </span>
    );
  };

  // Get priority badge
  const getPriorityBadge = (priority: TaskPriority) => {
    const colors = TaskPriorityColors[priority];
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
        {TaskPriorityLabels[priority]}
      </span>
    );
  };

  return (
    <div className="h-full bg-slate-50/50">
      <div className="h-full flex flex-col px-4 py-4">
        {/* Main Card - Full Height with integrated header */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
          {/* Elegant Header inside the card */}
          <div className="px-4 py-2.5 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
              <span className="hover:text-slate-700 cursor-pointer">
                Dashboard
              </span>
              <svg
                className="w-3 h-3 text-slate-400"
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
              <span className="hover:text-slate-700 cursor-pointer">Tasks</span>
              <svg
                className="w-3 h-3 text-slate-400"
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
              <span className="text-slate-700 font-medium">Templates</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <TemplateIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-slate-800 leading-tight">
                    Task Templates
                  </h1>
                  <p className="text-[11px] text-slate-500">
                    Reusable task workflows
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-blue-600 to-blue-500 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md"
              >
                <PlusIcon className="w-4 h-4" />
                New Template
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
            {/* Category Pills */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg overflow-x-auto">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  categoryFilter === "all"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                All
                <span
                  className={`ml-1 text-[10px] ${
                    categoryFilter === "all"
                      ? "text-blue-200"
                      : "text-slate-400"
                  }`}
                >
                  {templates.length}
                </span>
              </button>
              {(
                Object.keys(
                  TaskTemplateCategoryLabels
                ) as TaskTemplateCategory[]
              ).map((category) => {
                const count = templates.filter(
                  (t) => t.category === category
                ).length;
                return (
                  <button
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                      categoryFilter === category
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                    }`}
                  >
                    {TaskTemplateCategoryLabels[category]}
                    {count > 0 && (
                      <span
                        className={`ml-1 text-[10px] ${
                          categoryFilter === category
                            ? "text-blue-200"
                            : "text-slate-400"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <SearchBox
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search templates..."
              className="w-52"
            />
          </div>

          {/* Templates Table */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-500">Loading templates...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-2">
                <svg
                  className="w-5 h-5 text-red-600"
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
              <p className="text-sm font-medium text-red-600 mb-1">{error}</p>
              <button
                onClick={fetchTemplates}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                Try Again
              </button>
            </div>
          ) : paginatedTemplates.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <TemplateIcon className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700 mb-1">
                No templates found
              </p>
              <p className="text-xs text-slate-500 mb-3">
                {searchQuery
                  ? "Try adjusting your search or filters"
                  : "Create your first template to standardize workflows"}
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Create Template
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full table-auto">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-200">
                    <th className="w-10 px-2 py-2"></th>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Template
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Category
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Priority
                    </th>
                    <th className="px-2 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Tasks
                    </th>
                    <th className="px-2 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTemplates.map((template) => {
                    const isExpanded = expandedRows.has(template.id);
                    const items = templateItems[template.id] || [];
                    const isLoadingItemsForTemplate = loadingItems.has(
                      template.id
                    );

                    return (
                      <React.Fragment key={template.id}>
                        {/* Main Row */}
                        <tr className="group border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          {/* Expand Toggle */}
                          <td className="px-2 py-1.5">
                            {(template.item_count || 0) > 0 && (
                              <button
                                onClick={() => toggleExpand(template.id)}
                                className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDownIcon className="w-3.5 h-3.5 text-slate-500" />
                                ) : (
                                  <ChevronRightIcon className="w-3.5 h-3.5 text-slate-500" />
                                )}
                              </button>
                            )}
                          </td>

                          {/* Template Name */}
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-2">
                              <TemplateIcon className="w-4 h-4 text-slate-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">
                                  {template.name}
                                </p>
                                {template.description && (
                                  <p className="text-xs text-slate-500 truncate max-w-xs">
                                    {template.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="px-2 py-1.5">
                            {getCategoryBadge(template.category)}
                          </td>

                          {/* Default Priority */}
                          <td className="px-2 py-1.5">
                            {getPriorityBadge(template.default_priority)}
                          </td>

                          {/* Task Count */}
                          <td className="px-2 py-1.5 text-center">
                            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-full">
                              {template.item_count || 0}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {template.is_protected && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700">
                                  <ShieldIcon className="w-2.5 h-2.5" />
                                  Protected
                                </span>
                              )}
                              {!template.is_active && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded-full">
                                  Inactive
                                </span>
                              )}
                              {template.is_active && !template.is_protected && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded-full">
                                  Active
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-2 py-1.5">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTemplate(template);
                                }}
                                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit template"
                              >
                                <EditIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(template.id, template.name, e)}
                                disabled={deletingId === template.id}
                                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                title="Delete template"
                              >
                                {deletingId === template.id ? (
                                  <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <TrashIcon className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Items Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="px-2 py-2">
                              <div className="ml-7 border-l-2 border-blue-200 pl-3">
                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                                  Template Tasks ({template.item_count || 0})
                                </p>
                                {isLoadingItemsForTemplate ? (
                                  <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
                                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    Loading tasks...
                                  </div>
                                ) : items.length === 0 ? (
                                  <p className="text-xs text-slate-500 py-1">
                                    No tasks in this template yet
                                  </p>
                                ) : (
                                  <div className="space-y-1">
                                    {(() => {
                                      let taskIndex = 0;
                                      return items.map((item) => {
                                        if (!item.isSubtask) taskIndex++;
                                        return (
                                          <div
                                            key={item.id}
                                            className={`flex items-center gap-2 py-1.5 px-2 bg-white rounded border border-slate-200 ${item.isSubtask ? 'ml-6' : ''}`}
                                          >
                                            {item.isSubtask ? (
                                              <span className="text-xs text-blue-400 shrink-0">↳</span>
                                            ) : (
                                              <span className="text-xs text-slate-400 font-mono w-4 shrink-0">
                                                {taskIndex}.
                                              </span>
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm text-slate-700 truncate">
                                                {item.title}
                                              </p>
                                            </div>
                                            {getPriorityBadge(item.priority)}
                                            {item.estimated_hours && (
                                              <span className="flex items-center gap-0.5 text-xs text-slate-500">
                                                <ClockIcon className="w-3 h-3" />
                                                {item.estimated_hours}h
                                              </span>
                                            )}
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filteredTemplates.length > 0 && (
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">
                    <span className="font-medium">
                      {Math.min(
                        (currentPage - 1) * pageSize + 1,
                        filteredTemplates.length
                      )}
                    </span>
                    {"-"}
                    <span className="font-medium">
                      {Math.min(
                        currentPage * pageSize,
                        filteredTemplates.length
                      )}
                    </span>
                    {" of "}
                    <span className="font-medium">
                      {filteredTemplates.length}
                    </span>
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-1.5 py-0.5 text-[10px] border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>

                  <div className="flex items-center gap-0.5 mx-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 5) {
                        if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2)
                          pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-6 h-6 text-[10px] font-medium rounded transition-colors ${
                            currentPage === pageNum
                              ? "bg-blue-600 text-white"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Template Modal */}
      <CreateTemplateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchTemplates}
      />

      {/* Edit Template Modal */}
      <EditTemplateModal
        template={editingTemplate}
        isOpen={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        onSuccess={() => {
          fetchTemplates();
          setEditingTemplate(null);
        }}
      />

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
    </div>
  );
}

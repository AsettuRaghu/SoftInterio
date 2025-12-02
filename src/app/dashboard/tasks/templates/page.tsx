"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { CreateTemplateModal } from "@/components/tasks";

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

const PlayIcon = ({ className }: { className?: string }) => (
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
      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
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
}

export default function TaskTemplatesPage() {
  const router = useRouter();
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

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<
    TaskTemplateCategory | "all"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch templates from API
  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (categoryFilter !== "all") {
        params.append("category", categoryFilter);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await fetch(`/api/tasks/templates?${params.toString()}`);
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
  }, [categoryFilter, searchQuery]);

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
          const response = await fetch(
            `/api/tasks/templates/${templateId}/items`
          );
          if (response.ok) {
            const data = await response.json();
            setTemplateItems((prev) => ({
              ...prev,
              [templateId]: data.items || [],
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
  const handleDelete = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (
      !confirm(
        "Are you sure you want to delete this template? This action cannot be undone."
      )
    ) {
      return;
    }

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
      alert(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setDeletingId(null);
    }
  };

  // Process templates (filter locally for search)
  const processedTemplates = useMemo(() => {
    let result = [...templates];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (template) =>
          template.name.toLowerCase().includes(query) ||
          template.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [templates, searchQuery]);

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <Link href="/dashboard" className="hover:text-blue-600">
                Dashboard
              </Link>
              <span>/</span>
              <Link href="/dashboard/tasks" className="hover:text-blue-600">
                Tasks
              </Link>
              <span>/</span>
              <span className="text-slate-700">Templates</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-900">
              Task Templates
            </h1>
          </div>

          {/* Stats pills */}
          {templates.length > 0 && (
            <div className="hidden md:flex items-center gap-2 pl-6 border-l border-slate-200">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                <span className="font-medium">{templates.length}</span>{" "}
                Templates
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
                <span className="font-medium">
                  {templates.filter((t) => t.is_protected).length}
                </span>{" "}
                Protected
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <PlusIcon className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              categoryFilter === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          {(
            Object.keys(TaskTemplateCategoryLabels) as TaskTemplateCategory[]
          ).map((category) => (
            <button
              key={category}
              onClick={() => setCategoryFilter(category)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                categoryFilter === category
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {TaskTemplateCategoryLabels[category]}
            </button>
          ))}
        </div>

        <div className="flex-1 max-w-sm ml-auto">
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
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Templates Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500">Loading templates...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg
              className="w-12 h-12 mb-3 text-red-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm font-medium text-red-600 mb-1">{error}</p>
            <button
              onClick={fetchTemplates}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : processedTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <TemplateIcon className="w-16 h-16 mb-4 text-slate-300" />
            <p className="text-base font-medium mb-1">No templates found</p>
            <p className="text-sm text-slate-400 mb-4">
              {searchQuery
                ? "Try adjusting your search"
                : "Create your first template to standardize task workflows"}
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Create Template
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-10 px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Template Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Default Priority
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tasks
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedTemplates.map((template) => {
                const isExpanded = expandedRows.has(template.id);
                const items = templateItems[template.id] || [];
                const isLoadingItemsForTemplate = loadingItems.has(template.id);

                return (
                  <React.Fragment key={template.id}>
                    {/* Main Row */}
                    <tr
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() =>
                        router.push(`/dashboard/tasks/templates/${template.id}`)
                      }
                    >
                      {/* Expand Toggle */}
                      <td className="px-4 py-3">
                        {(template.item_count || 0) > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(template.id);
                            }}
                            className="p-1 rounded hover:bg-slate-200 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDownIcon className="w-4 h-4 text-slate-500" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4 text-slate-500" />
                            )}
                          </button>
                        )}
                      </td>

                      {/* Template Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <TemplateIcon className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                              {template.name}
                            </p>
                            {template.description && (
                              <p className="text-xs text-slate-500 line-clamp-1 max-w-xs">
                                {template.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        {getCategoryBadge(template.category)}
                      </td>

                      {/* Default Priority */}
                      <td className="px-4 py-3">
                        {getPriorityBadge(template.default_priority)}
                      </td>

                      {/* Task Count */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                          {template.item_count || 0}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {template.is_protected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                              <ShieldIcon className="w-3 h-3" />
                              Protected
                            </span>
                          )}
                          {!template.is_active && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">
                              Inactive
                            </span>
                          )}
                          {template.is_active && !template.is_protected && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/dashboard/tasks/new?template=${template.id}`
                              );
                            }}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Apply template"
                          >
                            <PlayIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/dashboard/tasks/templates/${template.id}`
                              );
                            }}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View & Edit template"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(template.id, e)}
                            disabled={deletingId === template.id}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete template"
                          >
                            {deletingId === template.id ? (
                              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <TrashIcon className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Items Row */}
                    {isExpanded && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="ml-8 border-l-2 border-blue-200 pl-4">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                              Template Tasks ({template.item_count || 0})
                            </p>
                            {isLoadingItemsForTemplate ? (
                              <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                Loading tasks...
                              </div>
                            ) : items.length === 0 ? (
                              <p className="text-sm text-slate-500 py-2">
                                No tasks in this template yet
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {items.map((item, index) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center gap-3 py-2 px-3 bg-white rounded-lg border border-slate-200"
                                  >
                                    <span className="text-xs text-slate-400 font-mono w-6">
                                      #{index + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-slate-700 truncate">
                                        {item.title}
                                      </p>
                                      {item.description && (
                                        <p className="text-xs text-slate-500 truncate">
                                          {item.description}
                                        </p>
                                      )}
                                    </div>
                                    {getPriorityBadge(item.priority)}
                                    {item.estimated_hours && (
                                      <span className="flex items-center gap-1 text-xs text-slate-500">
                                        <ClockIcon className="w-3 h-3" />
                                        {item.estimated_hours}h
                                      </span>
                                    )}
                                  </div>
                                ))}
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
        )}
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
        <svg
          className="w-5 h-5 text-blue-600 shrink-0 mt-0.5"
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
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">About Protected Templates</p>
          <p className="text-xs text-blue-600">
            Protected templates are locked after tasks are created from them.
            Tasks created from protected templates can only have their status
            updated by the assignee, ensuring workflow consistency. Only users
            with Project Manager access can modify these templates.
          </p>
        </div>
      </div>

      {/* Create Template Modal */}
      <CreateTemplateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchTemplates}
      />
    </div>
  );
}

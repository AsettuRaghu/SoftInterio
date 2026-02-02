"use client";

import {
  Project,
  ProjectStatusLabels,
  ProjectCategoryLabels,
} from "@/types/projects";
import React from "react";

export interface EditProjectFormData {
  name: string;
  description: string;
  status: string;
  project_category: string;
  expected_start_date: string;
  expected_end_date: string;
  actual_start_date: string;
  actual_end_date: string;
  notes: string;
}

export function EditProjectModal({
  project,
  editForm,
  setEditForm,
  onClose,
  onSave,
  isSaving,
  validationError,
}: {
  project: Project;
  editForm: EditProjectFormData;
  setEditForm: React.Dispatch<React.SetStateAction<EditProjectFormData>>;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  validationError: string | null;
}) {
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave();
  };

  const getMinStartDate = () => {
    const today = new Date().toISOString().split("T")[0];
    if (project.expected_start_date) {
      return project.expected_start_date;
    }
    return today;
  };

  const getMinEndDate = () => {
    if (!editForm.expected_start_date) return "";
    const startDate = new Date(editForm.expected_start_date);
    startDate.setMonth(startDate.getMonth() + 1);
    return startDate.toISOString().split("T")[0];
  };

  const handleEditStartDateChange = (value: string) => {
    const newForm = { ...editForm, expected_start_date: value };
    if (value) {
      const minEnd = new Date(value);
      minEnd.setMonth(minEnd.getMonth() + 1);
      const minEndStr = minEnd.toISOString().split("T")[0];
      if (
        !editForm.expected_end_date ||
        editForm.expected_end_date < minEndStr
      ) {
        newForm.expected_end_date = minEndStr;
      }
    }
    setEditForm(newForm);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Edit Project</h2>
            <p className="text-sm text-slate-500 mt-1">
              Project:{" "}
              <span className="font-medium">{project.project_number}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <svg
              className="w-5 h-5"
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

        {validationError && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-600">
            {validationError}
          </div>
        )}

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="overflow-y-auto flex-1 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Enter project name"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="">Select status</option>
                  {Object.entries(ProjectStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={editForm.project_category}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      project_category: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="">Select category</option>
                  {Object.entries(ProjectCategoryLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Expected Start Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expected Start Date
                </label>
                <input
                  type="date"
                  value={editForm.expected_start_date}
                  min={getMinStartDate()}
                  onChange={(e) => handleEditStartDateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
                {project.expected_start_date && (
                  <p className="text-xs text-slate-500 mt-1">
                    Current:{" "}
                    {new Date(project.expected_start_date).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Expected End Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expected End Date
                </label>
                <input
                  type="date"
                  value={editForm.expected_end_date}
                  min={getMinEndDate()}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      expected_end_date: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
                {editForm.expected_start_date && (
                  <p className="text-xs text-slate-500 mt-1">
                    Minimum 1 month after start date
                  </p>
                )}
              </div>

              {/* Actual Start Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Actual Start Date
                </label>
                <input
                  type="date"
                  value={editForm.actual_start_date}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      actual_start_date: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Actual End Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Actual End Date
                </label>
                <input
                  type="date"
                  value={editForm.actual_end_date}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      actual_end_date: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  placeholder="Enter project description"
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm({ ...editForm, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  placeholder="Enter project notes"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

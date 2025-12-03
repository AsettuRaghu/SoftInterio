"use client";

import React, { useState } from "react";
import { PrioritySelector } from "./PrioritySelector";
import { AssigneeMultiSelect } from "./AssigneeMultiSelect";

interface SubTask {
  id?: string;
  title: string;
  priority: "urgent" | "high" | "medium" | "low";
  assigned_to: string[];
  start_date: string;
  due_date: string;
  status: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

interface SubTaskListProps {
  subtasks: SubTask[];
  onChange: (subtasks: SubTask[]) => void;
  teamMembers: TeamMember[];
  className?: string;
}

export function SubTaskList({
  subtasks,
  onChange,
  teamMembers,
  className = "",
}: SubTaskListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const addSubTask = () => {
    onChange([
      ...subtasks,
      {
        title: "",
        priority: "medium",
        assigned_to: [],
        start_date: "",
        due_date: "",
        status: "todo",
      },
    ]);
    setIsExpanded(true);
  };

  const updateSubTask = (index: number, field: keyof SubTask, value: any) => {
    const updated = [...subtasks];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeSubTask = (index: number) => {
    onChange(subtasks.filter((_, i) => i !== index));
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          <svg
            className={`w-4 h-4 transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
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
          Sub Tasks ({subtasks.length})
        </button>
        <button
          type="button"
          onClick={addSubTask}
          className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
        >
          + Add Sub Task
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3 pl-4 border-l-2 border-slate-200">
          {subtasks.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No sub tasks added</p>
          ) : (
            subtasks.map((subtask, index) => (
              <div
                key={index}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <div className="grid grid-cols-1 gap-3">
                  {/* Title */}
                  <div>
                    <input
                      type="text"
                      value={subtask.title}
                      onChange={(e) =>
                        updateSubTask(index, "title", e.target.value)
                      }
                      placeholder="Sub task title *"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Priority
                    </label>
                    <PrioritySelector
                      value={subtask.priority}
                      onChange={(value) =>
                        updateSubTask(index, "priority", value)
                      }
                    />
                  </div>

                  {/* Assignees */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Assign To
                    </label>
                    <AssigneeMultiSelect
                      selected={subtask.assigned_to}
                      onChange={(value) =>
                        updateSubTask(index, "assigned_to", value)
                      }
                      teamMembers={teamMembers}
                    />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={subtask.start_date}
                        onChange={(e) =>
                          updateSubTask(index, "start_date", e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={subtask.due_date}
                        onChange={(e) =>
                          updateSubTask(index, "due_date", e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Remove button */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeSubTask(index)}
                      className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { ProjectPhase, ProjectSubPhase } from "@/types/projects";

interface ProjectTasksTabProps {
  projectId: string;
  phases: ProjectPhase[];
  onCreateTask: (phaseId?: string, subPhaseId?: string) => void;
}

interface Task {
  id: string;
  task_number: string;
  title: string;
  description?: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "todo" | "in_progress" | "on_hold" | "completed" | "cancelled";
  start_date?: string;
  due_date?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_to_avatar?: string;
  project_phase_id?: string;
  phase_name?: string;
  project_sub_phase_id?: string;
  sub_phase_name?: string;
  subtask_count: number;
  completed_subtask_count: number;
  created_at: string;
}

const PriorityColors = {
  critical: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
  high: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  medium: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
  },
  low: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
};

const StatusColors = {
  todo: { bg: "bg-slate-100", text: "text-slate-700" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700" },
  on_hold: { bg: "bg-yellow-100", text: "text-yellow-700" },
  completed: { bg: "bg-green-100", text: "text-green-700" },
  cancelled: { bg: "bg-red-100", text: "text-red-700" },
};

const StatusLabels = {
  todo: "To Do",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function ProjectTasksTab({
  projectId,
  phases,
  onCreateTask,
}: ProjectTasksTabProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"none" | "phase" | "status">("phase");

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/tasks?related_type=project&related_id=${projectId}`
      );
      if (!response.ok) throw new Error("Failed to fetch tasks");
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      searchQuery === "" ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.task_number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || task.status === statusFilter;

    const matchesPhase =
      phaseFilter === "all" ||
      (phaseFilter === "unassigned" && !task.project_phase_id) ||
      task.project_phase_id === phaseFilter;

    return matchesSearch && matchesStatus && matchesPhase;
  });

  // Group tasks
  const groupedTasks = React.useMemo(() => {
    if (groupBy === "none") {
      return { "All Tasks": filteredTasks };
    }

    if (groupBy === "status") {
      const groups: Record<string, Task[]> = {};
      filteredTasks.forEach((task) => {
        const key = StatusLabels[task.status] || task.status;
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
      });
      return groups;
    }

    // Group by phase
    const groups: Record<string, Task[]> = {};
    filteredTasks.forEach((task) => {
      const key = task.phase_name || "Unassigned";
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
    return groups;
  }, [filteredTasks, groupBy]);

  // Stats
  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    todo: tasks.filter((t) => t.status === "todo").length,
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-slate-200 rounded w-full"></div>
        <div className="h-20 bg-slate-200 rounded"></div>
        <div className="h-20 bg-slate-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-900">Project Tasks</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tasks linked to this project from the Tasks module
          </p>
        </div>
        <button
          onClick={() => onCreateTask()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          Create Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Total</p>
          <p className="text-lg font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Completed</p>
          <p className="text-lg font-bold text-green-600">{stats.completed}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">In Progress</p>
          <p className="text-lg font-bold text-blue-600">{stats.inProgress}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">To Do</p>
          <p className="text-lg font-bold text-slate-900">{stats.todo}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
        </select>

        {/* Phase Filter */}
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Phases</option>
          <option value="unassigned">Unassigned</option>
          {phases
            .filter((p) => p.is_enabled)
            .map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.name}
              </option>
            ))}
        </select>

        {/* Group By */}
        <select
          value={groupBy}
          onChange={(e) =>
            setGroupBy(e.target.value as "none" | "phase" | "status")
          }
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="none">No Grouping</option>
          <option value="phase">Group by Phase</option>
          <option value="status">Group by Status</option>
        </select>
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12">
          <ClockIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No tasks found</p>
          <p className="text-slate-500 text-sm mt-1">
            {tasks.length === 0
              ? "Create your first task for this project"
              : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
            <div key={groupName}>
              {groupBy !== "none" && (
                <h4 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-2">
                  {groupName} ({groupTasks.length})
                </h4>
              )}
              <div className="space-y-2">
                {groupTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    showPhase={groupBy !== "phase"}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Task Card Component
interface TaskCardProps {
  task: Task;
  showPhase?: boolean;
}

function TaskCard({ task, showPhase = true }: TaskCardProps) {
  return (
    <a
      href={`/dashboard/tasks/${task.id}`}
      className="block p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-500">
              {task.task_number}
            </span>
            <span
              className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                PriorityColors[task.priority].bg
              } ${PriorityColors[task.priority].text}`}
            >
              {task.priority}
            </span>
          </div>
          <h4 className="text-sm font-medium text-slate-900 truncate">
            {task.title}
          </h4>
          {showPhase && task.phase_name && (
            <p className="text-xs text-slate-500 mt-1">
              {task.phase_name}
              {task.sub_phase_name && ` → ${task.sub_phase_name}`}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded ${
              StatusColors[task.status].bg
            } ${StatusColors[task.status].text}`}
          >
            {StatusLabels[task.status]}
          </span>
          {task.due_date && (
            <span className="text-xs text-slate-500">
              {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
          {task.subtask_count > 0 && (
            <span className="text-xs text-slate-400">
              {task.completed_subtask_count}/{task.subtask_count} subtasks
            </span>
          )}
        </div>
      </div>

      {task.assigned_to_name && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600">
            {task.assigned_to_name.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-slate-600">
            {task.assigned_to_name}
          </span>
        </div>
      )}
    </a>
  );
}

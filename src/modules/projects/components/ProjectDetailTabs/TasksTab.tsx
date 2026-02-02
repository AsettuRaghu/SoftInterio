"use client";

import React from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import TaskTableReusable from "@/components/tasks/TaskTableReusable";
import type { Task } from "@/types/tasks";

interface TaskWithUser extends Task {
  assigned_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
    email: string;
  };
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface ProjectTasksTabProps {
  projectId: string;
  tasks: TaskWithUser[];
  projectClosed?: boolean;
  teamMembers?: TeamMember[];
  onEditTask?: (task: TaskWithUser) => void;
  onAddTaskClick?: () => void;
  onRefresh?: () => void;
  onCountChange?: (count: number) => void;
}
export default function TasksTab({
  projectId,
  tasks,
  projectClosed = false,
  teamMembers = [],
  onEditTask,
  onAddTaskClick,
  onRefresh,
  onCountChange,
}: ProjectTasksTabProps) {
  const { user } = useCurrentUser();

  if (!user?.id) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <TaskTableReusable
      // Filter by this project
      relatedType="project"
      relatedId={projectId}
      // Current user for tab filtering
      currentUserId={user.id}
      // Team members for assignee selector
      externalTeamMembers={teamMembers.map((tm) => ({
        id: tm.id,
        full_name: tm.name,
        email: tm.email,
        avatar_url: tm.avatar_url,
      }))}
      // UI Configuration
      showHeader={false}
      compact={true}
      showTabs={true}
      defaultTab="my-tasks"
      allowEdit={!projectClosed}
      readOnly={projectClosed}
      showCreateButton={!projectClosed} // Only show create button if project is open
      // Callbacks
      onTaskClick={(task) => onEditTask?.(task as unknown as TaskWithUser)}
      onCreateTask={onAddTaskClick} // If provided, use custom handler; otherwise uses built-in modal
      // Pass external tasks and refresh
      externalTasks={tasks as any}
      onRefresh={onRefresh}
    />
  );
}

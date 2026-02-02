"use client";

import React from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserPermissions } from "@/hooks/useUserPermissions";
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

interface TasksTabProps {
  tasks: TaskWithUser[];
  leadId: string; // Add leadId to filter tasks
  leadClosed: boolean;
  teamMembers?: TeamMember[];
  onEditTask: (task: TaskWithUser) => void;
  onAddTaskClick?: () => void; // Optional - if not provided, uses built-in modal
  onRefresh?: () => void;
}

export default function TasksTab({
  tasks,
  leadId,
  leadClosed,
  teamMembers = [],
  onEditTask,
  onAddTaskClick,
  onRefresh,
}: TasksTabProps) {
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
      // Filter by this lead
      relatedType="lead"
      relatedId={leadId}
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
      allowEdit={!leadClosed}
      readOnly={leadClosed}
      showCreateButton={!leadClosed} // Only show create button if lead is open
      // Callbacks
      onTaskClick={(task) => onEditTask(task as unknown as TaskWithUser)}
      onCreateTask={onAddTaskClick} // If provided, use custom handler; otherwise uses built-in modal
      // Pass external tasks and refresh
      externalTasks={tasks as any}
      onRefresh={onRefresh}
    />
  );
}

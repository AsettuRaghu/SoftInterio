"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  Project,
  ProjectPhase,
  ProjectNote,
  ProjectDetailTab,
} from "@/types/projects";
import type { Task } from "@/types/tasks";
import type { DocumentWithUrl } from "@/types/documents";

export interface ProjectDetailState {
  project: Project | null;
  phases: ProjectPhase[];
  notes: ProjectNote[];
  tasks: Task[];
  documents: DocumentWithUrl[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

export function useProjectDetail() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  // Main state
  const [state, setState] = useState<ProjectDetailState>({
    project: null,
    phases: [],
    notes: [],
    tasks: [],
    documents: [],
    isLoading: true,
    isSaving: false,
    error: null,
  });

  // Fetch project details
  const fetchProjectDetails = useCallback(async () => {
    if (!projectId) return;
    
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch project");
      
      const data = await response.json();
      setState((prev) => ({
        ...prev,
        project: data.project,
        phases: data.phases || [],
        isLoading: false,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load project";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, [projectId]);

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}/notes`);
      if (!response.ok) throw new Error("Failed to fetch notes");
      
      const data = await response.json();
      setState((prev) => ({
        ...prev,
        notes: data.notes || [],
      }));
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  }, [projectId]);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const response = await fetch(
        `/api/documents?linked_type=project&linked_id=${projectId}`
      );
      if (!response.ok) throw new Error("Failed to fetch documents");
      
      const data = await response.json();
      setState((prev) => ({
        ...prev,
        documents: data.documents || [],
      }));
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  }, [projectId]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/tasks?project_id=${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch tasks");
      
      const data = await response.json();
      setState((prev) => ({
        ...prev,
        tasks: data.tasks || [],
      }));
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }, [projectId]);

  // Initial load
  useEffect(() => {
    fetchProjectDetails();
    fetchNotes();
    fetchDocuments();
    fetchTasks();
  }, [fetchProjectDetails, fetchNotes, fetchDocuments, fetchTasks]);

  // Update project
  const updateProject = useCallback(
    async (updates: Partial<Project>) => {
      setState((prev) => ({ ...prev, isSaving: true, error: null }));
      
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        
        if (!response.ok) throw new Error("Failed to update project");
        
        const data = await response.json();
        setState((prev) => ({
          ...prev,
          project: { ...prev.project, ...data.project },
          isSaving: false,
        }));
        
        return data.project;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update project";
        setState((prev) => ({
          ...prev,
          isSaving: false,
          error: message,
        }));
        throw error;
      }
    },
    [projectId]
  );

  // Refresh all data
  const refreshAllData = useCallback(async () => {
    await Promise.all([
      fetchProjectDetails(),
      fetchNotes(),
      fetchDocuments(),
      fetchTasks(),
    ]);
  }, [fetchProjectDetails, fetchNotes, fetchDocuments, fetchTasks]);

  return {
    ...state,
    fetchProjectDetails,
    fetchNotes,
    fetchDocuments,
    fetchTasks,
    updateProject,
    refreshAllData,
  };
}

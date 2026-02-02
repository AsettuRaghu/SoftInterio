import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type {
  Lead,
  LeadActivity,
  LeadNote,
  LeadStageHistory,
  LeadFamilyMember,
} from "@/types/leads";
import type { Task } from "@/types/tasks";
import type { DocumentWithUrl, Document } from "@/types/documents";
import type { EditFormData } from "../components/EditLeadModal";

export interface TaskWithUser extends Task {
  assigned_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
    email: string;
  };
  created_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
    email: string;
  };
}

export function useLeadDetail() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const leadId = params.id as string;

  // Data states
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [stageHistory, setStageHistory] = useState<LeadStageHistory[]>([]);
  const [tasks, setTasks] = useState<TaskWithUser[]>([]);
  const [documents, setDocuments] = useState<DocumentWithUrl[]>([]);
  const [familyMembers, setFamilyMembers] = useState<LeadFamilyMember[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<
    { id: string; name: string; email: string; avatar_url?: string }[]
  >([]);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] =
    useState<DocumentWithUrl | null>(null);

  // Fetch lead data
  const fetchLead = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sales/leads/${leadId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Lead not found");
        }
        throw new Error("Failed to fetch lead");
      }

      const data = await response.json();
      setLead(data.lead);
      setActivities(data.activities || []);
      setNotes(data.notes || []);
      setStageHistory(data.stageHistory || []);
      setTasks(data.tasks || []);
      setDocuments(data.documents || []);
      setFamilyMembers(data.familyMembers || []);
      setQuotations(data.quotations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  // Fetch only tasks (for granular refresh without full page reload)
  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch(`/api/sales/leads/${leadId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }

      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  }, [leadId]);

  // Fetch only notes (for granular refresh without full page reload)
  const fetchNotes = useCallback(async () => {
    try {
      const response = await fetch(`/api/sales/leads/${leadId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch notes");
      }

      const data = await response.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error("Error fetching notes:", err);
    }
  }, [leadId]);

  // Fetch only activities (for granular refresh without full page reload)
  const fetchActivities = useCallback(async () => {
    try {
      const response = await fetch(`/api/sales/leads/${leadId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch activities");
      }

      const data = await response.json();
      setActivities(data.activities || []);
    } catch (err) {
      console.error("Error fetching activities:", err);
    }
  }, [leadId]);

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/team/members");
      const data = await response.json();
      if (response.ok && data.success && data.data) {
        setTeamMembers(
          data.data.map((m: any) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            avatar_url: m.avatar_url,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    }
  }, []);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoadingDocuments(true);
      const response = await fetch(
        `/api/documents?linked_type=lead&linked_id=${leadId}`
      );
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [leadId]);

  // Save lead edits
  const handleSaveEdit = useCallback(
    async (editForm: EditFormData) => {
      if (!lead) return;

      try {
        setIsSaving(true);
        const response = await fetch(`/api/sales/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: editForm.client_name,
            phone: editForm.phone,
            email: editForm.email || null,
            property_name: editForm.property_name || null,
            unit_number: editForm.unit_number || null,
            property_category: editForm.property_category || null,
            property_type: editForm.property_type || null,
            property_subtype: editForm.property_subtype || null,
            carpet_area: editForm.carpet_area
              ? parseFloat(editForm.carpet_area)
              : null,
            property_address: editForm.property_address || null,
            property_city: editForm.property_city || null,
            property_pincode: editForm.property_pincode || null,
            service_type: editForm.service_type || null,
            lead_source: editForm.lead_source || null,
            budget_range: editForm.budget_range || null,
            target_start_date: editForm.target_start_date || null,
            target_end_date: editForm.target_end_date || null,
            won_amount: editForm.won_amount
              ? parseFloat(editForm.won_amount)
              : null,
            contract_signed_date: editForm.contract_signed_date || null,
            expected_project_start: editForm.expected_project_start || null,
            priority: editForm.priority || null,
            assigned_to: editForm.assigned_to || null,
          }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Failed to update lead");
        }

        // Update local state with the response data (soft update)
        if (data.lead) {
          setLead(data.lead);
        }
        return true;
      } catch (err) {
        console.error("Error updating lead:", err);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [leadId, lead, fetchLead]
  );

  // Update lead from stage transition (soft update)
  const updateLeadFromStageTransition = useCallback(
    async () => {
      try {
        const response = await fetch(`/api/sales/leads/${leadId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch updated lead");
        }

        const data = await response.json();
        // Update only the lead, stage history, and activities
        setLead(data.lead);
        setStageHistory(data.stageHistory || []);
        setActivities(data.activities || []);
        setQuotations(data.quotations || []);
      } catch (err) {
        console.error("Error updating lead after stage transition:", err);
      }
    },
    [leadId]
  );

  // Create quotation revision
  const handleRevise = useCallback(
    async (quotationId: string) => {
      if (revisingId) return;

      try {
        setRevisingId(quotationId);
        const response = await fetch(`/api/quotations/${quotationId}/revision`, {
          method: "POST",
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create revision");
        }

        const data = await response.json();
        router.push(`/dashboard/quotations/${data.id}/edit`);
      } catch (err) {
        console.error("Error creating revision:", err);
        throw err;
      } finally {
        setRevisingId(null);
      }
    },
    [revisingId, router]
  );

  // Delete document
  const handleDocumentDelete = useCallback(async (doc: Document) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      } else {
        throw new Error("Failed to delete document");
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      throw err;
    }
  }, []);

  // Change assignee
  const handleAssigneeChange = useCallback(
    async (userId: string | null) => {
      if (!lead) return;
      try {
        const response = await fetch(`/api/sales/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assigned_user_id: userId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update assignee");
        }

        await fetchLead();
      } catch (err) {
        console.error("Error updating assignee:", err);
        throw err;
      }
    },
    [leadId, lead, fetchLead]
  );

  // Initialize data on mount
  useEffect(() => {
    fetchLead();
    fetchTeamMembers();
  }, [fetchLead, fetchTeamMembers]);

  // Fetch documents when tab changes
  const refetchDocumentsForTab = useCallback(async () => {
    if (leadId) {
      await fetchDocuments();
    }
  }, [leadId, fetchDocuments]);

  // Handle stage modal auto-open
  useEffect(() => {
    if (searchParams.get("openStageModal") === "true" && lead && !isLoading) {
      router.replace(`/dashboard/sales/leads/${leadId}`, { scroll: false });
    }
  }, [searchParams, lead, isLoading, leadId, router]);

  return {
    // Data
    lead,
    activities,
    notes,
    stageHistory,
    tasks,
    documents,
    familyMembers,
    quotations,
    teamMembers,
    previewDocument,
    // UI States
    isLoading,
    isLoadingDocuments,
    error,
    isSaving,
    revisingId,
    // Setters
    setPreviewDocument,
    setLead,
    setActivities,
    setNotes,
    setTasks,
    setDocuments,
    setFamilyMembers,
    setQuotations,
    // Methods
    fetchLead,
    fetchTasks,
    fetchNotes,
    fetchActivities,
    fetchTeamMembers,
    fetchDocuments,
    refetchDocumentsForTab,
    handleSaveEdit,
    updateLeadFromStageTransition,
    handleRevise,
    handleDocumentDelete,
    handleAssigneeChange,
  };
}

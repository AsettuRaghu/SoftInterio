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
import { uiLogger } from "@/lib/logger";
import { useReviseQuotation } from "@/lib/quotations/use-revise-quotation";

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
  subtasks?: any[];
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
  const [previewDocument, setPreviewDocument] =
    useState<DocumentWithUrl | null>(null);

  /**
   * Load the lead and everything the tabs render from.
   *
   * `quiet` skips the page-level loading flag. That flag replaces the entire
   * detail page with a skeleton, which is right on first load and wrong after
   * an action: reassigning a lead, or marking one calendar event complete, blew
   * the whole page away and refetched every tab to reflect a single change.
   *
   * It still refetches everything, because that is what keeps the embeds - the
   * assignee, client and property this page renders from - consistent. What
   * changes is that the person keeps looking at their data while it happens.
   */
  const fetchLead = useCallback(async (options?: { quiet?: boolean }) => {
    try {
      if (!options?.quiet) setIsLoading(true);
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
      if (!options?.quiet) setIsLoading(false);
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
      // Creating or editing a task writes to the lead timeline, and this
      // response already carries the refreshed list - so keep it in step
      // rather than leaving the Timeline tab stale.
      setActivities(data.activities || []);
    } catch (err) {
      uiLogger.error("Error fetching tasks", err);
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
      // Adding, editing or deleting a note - and scheduling or completing a
      // follow-up - all write timeline entries. Same response, no extra call.
      setActivities(data.activities || []);
    } catch (err) {
      uiLogger.error("Error fetching notes", err);
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
      uiLogger.error("Error fetching activities", err);
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
      uiLogger.error("Failed to fetch team members", err);
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
      uiLogger.error("Failed to fetch documents", err);
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
        uiLogger.error("Error updating lead", err);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [leadId, lead]
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
        // Refresh every slice a transition can touch. Notes belong here
        // because moving a lead between stages records the reason as a real
        // note - without this the Notes tab kept its pre-transition list and
        // only a hard refresh revealed the new entry.
        setLead(data.lead);
        setStageHistory(data.stageHistory || []);
        setActivities(data.activities || []);
        setQuotations(data.quotations || []);
        setNotes(data.notes || []);
      } catch (err) {
        uiLogger.error("Error updating lead after stage transition", err);
      }
    },
    [leadId]
  );

  // Create quotation revision
  /*
   * Revising is not lead-specific, so it lives in useReviseQuotation and the
   * project page drives the same handler. Kept on this hook's surface so the
   * lead page's call sites do not change.
   */
  const { revise: handleRevise, revisingId } = useReviseQuotation();

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
      uiLogger.error("Error deleting document", err);
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

        /*
         * Quietly. The assignee is rendered from the `assigned_user` embed, not
         * from the id, so it cannot be reconstructed here - but blanking the
         * whole page to pick that embed up was never the right price. The
         * column is `assigned_to`, incidentally, not `assigned_user_id`.
         */
        await fetchLead({ quiet: true });
      } catch (err) {
        uiLogger.error("Error updating assignee", err);
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

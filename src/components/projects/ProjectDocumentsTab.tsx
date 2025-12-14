"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { DocumentWithUrl, Document } from "@/types/documents";
import {
  AddDocumentModal,
  DocumentList,
  DocumentPreviewModal,
} from "@/components/documents";

interface ProjectDocumentsTabProps {
  projectId: string;
  leadId?: string | null;
  onCountChange?: (count: number) => void;
}

export default function ProjectDocumentsTab({
  projectId,
  leadId,
  onCountChange,
}: ProjectDocumentsTabProps) {
  const [documents, setDocuments] = useState<DocumentWithUrl[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [previewDocument, setPreviewDocument] =
    useState<DocumentWithUrl | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  // Fetch documents from unified documents API
  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoadingDocuments(true);

      // Fetch project documents
      const projectResponse = await fetch(
        `/api/documents?linked_type=project&linked_id=${projectId}`
      );

      let allDocuments: DocumentWithUrl[] = [];

      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        allDocuments = projectData.documents || [];
      }

      // If there's a linked lead, fetch lead documents too
      if (leadId) {
        const leadResponse = await fetch(
          `/api/documents?linked_type=lead&linked_id=${leadId}`
        );

        if (leadResponse.ok) {
          const leadData = await leadResponse.json();
          const leadDocuments = (leadData.documents || []).map(
            (doc: DocumentWithUrl) => ({
              ...doc,
              // Add metadata to indicate this is from the lead
              _isFromLead: true,
              _linkedLeadId: leadId,
            })
          );
          allDocuments = [...allDocuments, ...leadDocuments];
        }
      }

      setDocuments(allDocuments);
      onCountChange?.(allDocuments.length);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [projectId, leadId, onCountChange]);

  // Handle document delete - only allow deleting project documents
  const handleDocumentDelete = useCallback(
    async (doc: Document & { _isFromLead?: boolean }) => {
      // Prevent deletion of lead documents
      if (doc._isFromLead) {
        alert(
          "Cannot delete documents from the linked lead. Please manage them from the lead details page."
        );
        return;
      }

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
        alert("Failed to delete document");
      }
    },
    []
  );

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Documents</h3>
          {leadId && (
            <p className="text-xs text-slate-500 mt-0.5">
              Includes project & linked lead documents
            </p>
          )}
        </div>
        <button
          onClick={() => setShowDocumentModal(true)}
          className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium flex items-center gap-1"
        >
          <svg
            className="w-3.5 h-3.5"
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
          Add Document
        </button>
      </div>

      {/* Document List */}
      <DocumentList
        documents={documents}
        onDelete={handleDocumentDelete}
        onPreview={(doc) => setPreviewDocument(doc)}
        isLoading={isLoadingDocuments}
        emptyMessage="No documents uploaded yet. Click 'Add Document' to upload your first document."
        viewMode="list"
        showCategory
        showUploader
      />

      {/* Document Modals */}
      <AddDocumentModal
        isOpen={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
        onSuccess={() => {
          fetchDocuments();
        }}
        linkedType="project"
        linkedId={projectId}
      />
      <DocumentPreviewModal
        document={previewDocument}
        isOpen={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
    </div>
  );
}

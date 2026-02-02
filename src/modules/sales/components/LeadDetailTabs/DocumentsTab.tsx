"use client";

import { DocumentWithUrl as Document } from "@/types/documents";
import { DocumentTableReusable } from "@/components/documents";

interface DocumentsTabProps {
  documents: Document[];
  isLoadingDocuments: boolean;
  leadId: string;
  leadClosed: boolean;
  onPreviewDocument: (doc: Document) => void;
  onDeleteDocument: (doc: Document) => void;
  onAddDocumentClick?: () => void;
  onRefresh?: () => void;
}

export default function DocumentsTab({
  documents,
  isLoadingDocuments,
  leadId,
  leadClosed,
  onPreviewDocument,
  onDeleteDocument,
  onAddDocumentClick,
  onRefresh,
}: DocumentsTabProps) {
  return (
    <DocumentTableReusable
      // Filter by this lead
      linkedType="lead"
      linkedId={leadId}
      // UI Configuration
      showHeader={false}
      compact={true}
      viewMode="list"
      showCategory={true}
      allowUpload={!leadClosed}
      allowDelete={!leadClosed}
      readOnly={leadClosed}
      // Callbacks
      onPreview={onPreviewDocument}
      onDelete={onDeleteDocument}
      onUpload={onAddDocumentClick}
      // Pass external documents and refresh
      externalDocuments={documents}
      onRefresh={onRefresh}
    />
  );
}

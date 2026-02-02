"use client";

import { DocumentWithUrl as Document } from "@/types/documents";
import { DocumentTableReusable } from "@/components/documents";

interface DocumentsTabProps {
  projectId: string;
  documents: Document[];
  projectClosed?: boolean;
  onPreviewDocument?: (doc: Document) => void;
  onDeleteDocument?: (doc: Document) => void;
  onAddDocumentClick?: () => void;
  onRefresh?: () => void;
  onCountChange?: (count: number) => void;
}

export default function DocumentsTab({
  projectId,
  documents,
  projectClosed = false,
  onPreviewDocument,
  onDeleteDocument,
  onAddDocumentClick,
  onRefresh,
  onCountChange,
}: DocumentsTabProps) {
  return (
    <DocumentTableReusable
      linkedType="project"
      linkedId={projectId}
      showHeader={false}
      compact={true}
      viewMode="list"
      showCategory={true}
      allowUpload={!projectClosed}
      allowDelete={!projectClosed}
      readOnly={projectClosed}
      onPreview={onPreviewDocument}
      onDelete={onDeleteDocument}
      onUpload={onAddDocumentClick}
      externalDocuments={documents}
      onRefresh={onRefresh}
      onCountChange={onCountChange}
    />
  );
}

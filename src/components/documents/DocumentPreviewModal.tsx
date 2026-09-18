"use client";

import { MediaViewer, type MediaItem } from "@/components/ui/MediaViewer";
import type { DocumentWithUrl } from "@/types/documents";

interface DocumentPreviewModalProps {
  document: DocumentWithUrl | null;
  isOpen: boolean;
  onClose: () => void;
  /** The list the document was opened from, so ← → walk it. */
  documents?: DocumentWithUrl[];
}

const toItem = (d: DocumentWithUrl): MediaItem => ({
  id: d.id,
  name: d.title || d.original_name || d.file_name,
  url: d.signed_url ?? null,
  type: d.file_type,
  caption: d.category ? d.category.replace(/_/g, " ") : null,
});

/** A Documents list opened into the app's one viewer (components/ui/MediaViewer). */
export function DocumentPreviewModal({ document, isOpen, onClose, documents }: DocumentPreviewModalProps) {
  if (!isOpen || !document) return null;
  const set = documents && documents.some((d) => d.id === document.id) ? documents : [document];
  const index = Math.max(0, set.findIndex((d) => d.id === document.id));
  return <MediaViewer items={set.map(toItem)} index={index} onClose={onClose} />;
}

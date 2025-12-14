"use client";

import React, { useState } from "react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/Button";
import {
  Document,
  DocumentWithUrl,
  DocumentCategoryLabels,
  formatFileSize,
  getFileTypeIcon,
  isPreviewable,
} from "@/types/documents";

interface DocumentListProps {
  documents: DocumentWithUrl[];
  onDelete?: (document: Document) => void;
  onDownload?: (document: Document) => void;
  onPreview?: (document: DocumentWithUrl) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  viewMode?: "grid" | "list";
  showCategory?: boolean;
  showUploader?: boolean;
}

export function DocumentList({
  documents,
  onDelete,
  onDownload,
  onPreview,
  isLoading = false,
  emptyMessage = "No documents yet",
  className,
  viewMode = "list",
  showCategory = true,
  showUploader = true,
}: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (doc: Document) => {
    if (!onDelete) return;
    if (!confirm(`Are you sure you want to delete "${doc.original_name}"?`))
      return;

    setDeletingId(doc.id);
    try {
      await onDelete(doc);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (doc: Document) => {
    if (onDownload) {
      await onDownload(doc);
    } else {
      // Default download behavior
      try {
        const response = await fetch(`/api/documents/${doc.id}/download`);
        if (!response.ok) throw new Error("Failed to get download URL");
        const data = await response.json();
        window.open(data.download_url, "_blank");
      } catch (error) {
        console.error("Download error:", error);
      }
    }
  };

  const getFileIcon = (doc: Document) => {
    const iconType = getFileTypeIcon(doc.file_type, doc.file_extension);

    const iconMap: Record<string, React.ReactNode> = {
      photo: (
        <svg
          className="h-6 w-6 text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
      pdf: (
        <svg
          className="h-6 w-6 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      ),
      word: (
        <svg
          className="h-6 w-6 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      excel: (
        <svg
          className="h-6 w-6 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      ),
      powerpoint: (
        <svg
          className="h-6 w-6 text-orange-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      ),
      cad: (
        <svg
          className="h-6 w-6 text-purple-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
      ),
      archive: (
        <svg
          className="h-6 w-6 text-yellow-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          />
        </svg>
      ),
      file: (
        <svg
          className="h-6 w-6 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      ),
    };

    return iconMap[iconType] || iconMap.file;
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12 text-center",
          className
        )}
      >
        <svg
          className="h-12 w-12 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <p className="mt-2 text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4",
          className
        )}
      >
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md"
          >
            {/* Preview area */}
            <div
              className="relative aspect-square cursor-pointer bg-slate-100"
              onClick={() => isPreviewable(doc.file_type) && onPreview?.(doc)}
            >
              {doc.file_type?.startsWith("image/") && doc.signed_url ? (
                <img
                  src={doc.signed_url}
                  alt={doc.original_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  {getFileIcon(doc)}
                </div>
              )}
              {/* Hover overlay */}
              {isPreviewable(doc.file_type) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <svg
                    className="h-8 w-8 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </div>
              )}
            </div>
            {/* Info */}
            <div className="p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p
                  className="truncate text-sm font-medium text-slate-700"
                  title={doc.original_name}
                >
                  {doc.title || doc.original_name}
                </p>
                {(doc as any)._isFromLead && (
                  <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    Lead
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {formatFileSize(doc.file_size)}
                {showCategory && doc.category && (
                  <span className="ml-2">
                    • {DocumentCategoryLabels[doc.category]}
                  </span>
                )}
              </p>
            </div>
            {/* Actions */}
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-white/90 shadow-sm"
                onClick={() => handleDownload(doc)}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </Button>
              {onDelete && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-white/90 shadow-sm hover:bg-red-50 hover:text-red-600"
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc.id}
                >
                  {deletingId === doc.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                  ) : (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // List view
  return (
    <div
      className={cn(
        "divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white",
        className
      )}
    >
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-4 p-4 transition-colors hover:bg-slate-50"
        >
          {/* Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            {getFileIcon(doc)}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className="truncate font-medium text-slate-700"
                title={doc.original_name}
              >
                {doc.title || doc.original_name}
              </p>
              {(doc as any)._isFromLead && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  From Lead
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span>{formatFileSize(doc.file_size)}</span>
              {showCategory && doc.category && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                  {DocumentCategoryLabels[doc.category]}
                </span>
              )}
              {showUploader && doc.uploaded_user && (
                <span className="flex items-center gap-1">
                  <span className="text-xs">by</span>
                  {doc.uploaded_user.avatar_url ? (
                    <img
                      src={doc.uploaded_user.avatar_url}
                      alt=""
                      className="h-4 w-4 rounded-full"
                    />
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium text-slate-600">
                      {doc.uploaded_user.name?.[0]?.toUpperCase() || "?"}
                    </span>
                  )}
                  <span className="text-xs">{doc.uploaded_user.name}</span>
                </span>
              )}
              <span className="text-xs">
                {new Date(doc.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            {isPreviewable(doc.file_type) && onPreview && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => onPreview(doc)}
                title="Preview"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => handleDownload(doc)}
              title="Download"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-slate-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => handleDelete(doc)}
                disabled={deletingId === doc.id}
                title="Delete"
              >
                {deletingId === doc.id ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                )}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

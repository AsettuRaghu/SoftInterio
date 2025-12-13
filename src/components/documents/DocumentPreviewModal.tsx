"use client";

import React from "react";
import { cn } from "@/utils/cn";
import { DocumentWithUrl, isPreviewable } from "@/types/documents";

interface DocumentPreviewModalProps {
  document: DocumentWithUrl | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentPreviewModal({
  document,
  isOpen,
  onClose,
}: DocumentPreviewModalProps) {
  if (!isOpen || !document) return null;

  const canPreview = isPreviewable(document.file_type);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        onClick={onClose}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Document info */}
      <div className="absolute left-4 top-4 text-white">
        <p className="font-medium">
          {document.title || document.original_name}
        </p>
        <p className="text-sm text-white/70">{document.file_type}</p>
      </div>

      {/* Preview content */}
      <div
        className="relative max-h-[90vh] max-w-[90vw] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {document.file_type?.startsWith("image/") && document.signed_url ? (
          <img
            src={document.signed_url}
            alt={document.original_name}
            className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
          />
        ) : document.file_type === "application/pdf" && document.signed_url ? (
          <iframe
            src={document.signed_url}
            className="h-[85vh] w-[85vw] rounded-lg bg-white"
            title={document.original_name}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl bg-white p-12 text-center">
            <svg
              className="h-16 w-16 text-slate-400"
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
            <p className="mt-4 text-lg font-medium text-slate-700">
              Preview not available
            </p>
            <p className="mt-2 text-sm text-slate-500">
              This file type cannot be previewed in the browser.
            </p>
            {document.signed_url && (
              <a
                href={document.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                Download File
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

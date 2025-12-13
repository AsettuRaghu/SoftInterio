"use client";

import React, { useCallback, useState, useRef } from "react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/Button";
import {
  DocumentLinkedType,
  DocumentCategory,
  DocumentCategoryLabels,
  formatFileSize,
  isAllowedFileType,
  isFileSizeAllowed,
  ALLOWED_FILE_TYPES,
  DEFAULT_MAX_FILE_SIZE,
} from "@/types/documents";

interface DocumentUploaderProps {
  linkedType: DocumentLinkedType;
  linkedId: string;
  onUploadComplete?: (document: unknown) => void;
  onUploadError?: (error: string) => void;
  className?: string;
  maxFiles?: number;
  allowedCategories?: DocumentCategory[];
  defaultCategory?: DocumentCategory;
  compact?: boolean;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
  category: DocumentCategory;
  title: string;
}

export function DocumentUploader({
  linkedType,
  linkedId,
  onUploadComplete,
  onUploadError,
  className,
  maxFiles = 10,
  allowedCategories,
  defaultCategory = "other",
  compact = false,
}: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<DocumentCategory>(defaultCategory);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!isAllowedFileType(file)) {
      return {
        valid: false,
        error: `File type "${file.type || "unknown"}" is not allowed`,
      };
    }
    if (!isFileSizeAllowed(file)) {
      const config =
        ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES];
      const maxSize = config?.maxSize || DEFAULT_MAX_FILE_SIZE;
      return {
        valid: false,
        error: `File size exceeds ${formatFileSize(maxSize)} limit`,
      };
    }
    return { valid: true };
  };

  const uploadFile = async (uploadingFile: UploadingFile) => {
    const formData = new FormData();
    formData.append("file", uploadingFile.file);
    formData.append("linked_type", linkedType);
    formData.append("linked_id", linkedId);
    formData.append("category", uploadingFile.category);
    if (uploadingFile.title) {
      formData.append("title", uploadingFile.title);
    }

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await response.json();

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id
            ? { ...f, status: "completed" as const, progress: 100 }
            : f
        )
      );

      onUploadComplete?.(data.document);

      // Remove completed file after a short delay
      setTimeout(() => {
        setUploadingFiles((prev) =>
          prev.filter((f) => f.id !== uploadingFile.id)
        );
      }, 2000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id
            ? { ...f, status: "error" as const, error: errorMessage }
            : f
        )
      );

      onUploadError?.(errorMessage);
    }
  };

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).slice(0, maxFiles);

      const newUploadingFiles: UploadingFile[] = [];

      for (const file of fileArray) {
        const validation = validateFile(file);
        const uploadingFile: UploadingFile = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          progress: 0,
          status: validation.valid ? "pending" : "error",
          error: validation.error,
          category: selectedCategory,
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for title
        };

        newUploadingFiles.push(uploadingFile);
      }

      setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);

      // Upload valid files
      for (const uploadingFile of newUploadingFiles) {
        if (uploadingFile.status === "pending") {
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadingFile.id
                ? { ...f, status: "uploading" as const }
                : f
            )
          );
          await uploadFile(uploadingFile);
        }
      }
    },
    [
      linkedType,
      linkedId,
      selectedCategory,
      maxFiles,
      onUploadComplete,
      onUploadError,
    ]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processFiles]
  );

  const removeFile = (id: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const categories =
    allowedCategories ||
    (Object.keys(DocumentCategoryLabels) as DocumentCategory[]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Category selector */}
      {!compact && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">
            Category:
          </label>
          <select
            value={selectedCategory}
            onChange={(e) =>
              setSelectedCategory(e.target.value as DocumentCategory)
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {DocumentCategoryLabels[cat]}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200",
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100",
          compact && "p-4"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept={Object.keys(ALLOWED_FILE_TYPES).join(",")}
        />
        <div className="flex flex-col items-center gap-2">
          <svg
            className={cn(
              "text-slate-400",
              isDragging && "text-blue-500",
              compact ? "h-8 w-8" : "h-12 w-12"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <div>
            <p
              className={cn("font-medium text-slate-700", compact && "text-sm")}
            >
              {isDragging ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-sm text-slate-500">
              or <span className="text-blue-600">browse</span> to upload
            </p>
          </div>
          {!compact && (
            <p className="text-xs text-slate-400">
              Supports images, PDFs, documents, spreadsheets, and CAD files (up
              to 100MB)
            </p>
          )}
        </div>
      </div>

      {/* Upload progress */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uploadingFile) => (
            <div
              key={uploadingFile.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3",
                uploadingFile.status === "error"
                  ? "border-red-200 bg-red-50"
                  : uploadingFile.status === "completed"
                  ? "border-green-200 bg-green-50"
                  : "border-slate-200 bg-white"
              )}
            >
              <div className="shrink-0">
                {uploadingFile.status === "uploading" && (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                )}
                {uploadingFile.status === "completed" && (
                  <svg
                    className="h-5 w-5 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {uploadingFile.status === "error" && (
                  <svg
                    className="h-5 w-5 text-red-500"
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
                )}
                {uploadingFile.status === "pending" && (
                  <svg
                    className="h-5 w-5 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700">
                  {uploadingFile.file.name}
                </p>
                <p className="text-xs text-slate-500">
                  {formatFileSize(uploadingFile.file.size)}
                  {uploadingFile.error && (
                    <span className="ml-2 text-red-600">
                      • {uploadingFile.error}
                    </span>
                  )}
                </p>
              </div>
              {(uploadingFile.status === "error" ||
                uploadingFile.status === "pending") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(uploadingFile.id);
                  }}
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

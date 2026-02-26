"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { cn } from "@/utils/cn";
import { SearchBox } from "@/components/ui/SearchBox";
import { AddDocumentModal } from "./AddDocumentModal";
import {
  DocumentWithUrl,
  Document,
  DocumentCategory,
  DocumentCategoryLabels,
  formatFileSize,
  getFileTypeIcon,
  isPreviewable,
} from "@/types/documents";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  EyeIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

// Types
export interface DocumentTableProps {
  // Optional: Filter by linked entity (lead, project, etc.)
  linkedType?: string;
  linkedId?: string;

  // UI Configuration
  showHeader?: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
  compact?: boolean;
  viewMode?: "list" | "grid";
  showCategory?: boolean;
  allowUpload?: boolean;
  allowDelete?: boolean;
  readOnly?: boolean;

  // Callbacks
  onPreview?: (document: DocumentWithUrl) => void;
  onDownload?: (document: Document) => void;
  onDelete?: (document: Document) => void;
  onUpload?: () => void;
  onCountChange?: (count: number) => void;

  // Optional: External state control
  externalDocuments?: DocumentWithUrl[];
  onRefresh?: () => void;
}

export default function DocumentTable({
  linkedType,
  linkedId,
  showHeader = true,
  headerTitle = "Documents",
  headerSubtitle = "Manage your files and documents",
  compact = false,
  viewMode = "list",
  showCategory = true,
  allowUpload = true,
  allowDelete = true,
  readOnly = false,
  onPreview,
  onDownload,
  onDelete,
  onUpload,
  externalDocuments,
  onRefresh,
}: DocumentTableProps) {
  const [documents, setDocuments] = useState<DocumentWithUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    DocumentCategory | "all"
  >("all");
  const [sortField, setSortField] = useState<string>("uploaded_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Caching
  const lastFetchTimeRef = useRef<number>(0);
  const CACHE_DURATION = 30000; // 30 seconds

  const getCacheKey = useCallback(() => {
    return `documents_${linkedType || "all"}_${linkedId || "all"}`;
  }, [linkedType, linkedId]);

  // Fetch documents with caching
  const fetchDocuments = useCallback(
    async (forceRefresh: boolean = false) => {
      try {
        const cacheKey = getCacheKey();
        const now = Date.now();

        // Check cache unless force refresh
        if (!forceRefresh && now - lastFetchTimeRef.current < CACHE_DURATION) {
          try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
              const cachedData = JSON.parse(cached);
              setDocuments(cachedData);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            // Ignore cache errors
          }
        }

        setIsLoading(true);
        setError(null);

        // Build query params
        const params = new URLSearchParams();
        if (linkedType && linkedId) {
          params.append("linked_type", linkedType);
          params.append("linked_id", linkedId);
        }

        const response = await fetch(`/api/documents?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to fetch documents");

        const data = await response.json();
        const docs = data.documents || [];
        setDocuments(docs);

        // Cache the data
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(docs));
          lastFetchTimeRef.current = now;
        } catch (e) {
          // Ignore cache storage errors
        }
      } catch (err) {
        console.error("Error fetching documents:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load documents"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [linkedType, linkedId, getCacheKey]
  );

  // Initial load
  useEffect(() => {
    if (externalDocuments) {
      setDocuments(externalDocuments);
      setIsLoading(false);
    } else {
      // Try cache first
      const cacheKey = getCacheKey();
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setDocuments(cachedData);
          setIsLoading(false);

          const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
          if (timeSinceLastFetch > CACHE_DURATION) {
            fetchDocuments(false);
          }
        } else {
          fetchDocuments(false);
        }
      } catch (e) {
        fetchDocuments(false);
      }
    }
  }, [externalDocuments, fetchDocuments, getCacheKey]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    } else {
      try {
        sessionStorage.removeItem(getCacheKey());
      } catch (e) {
        // Ignore
      }
      lastFetchTimeRef.current = 0;
      fetchDocuments(true);
    }
  }, [onRefresh, fetchDocuments, getCacheKey]);

  // Invalidate cache
  const invalidateCache = useCallback(() => {
    try {
      sessionStorage.removeItem(getCacheKey());
      lastFetchTimeRef.current = 0;
    } catch (e) {
      // Ignore
    }
  }, [getCacheKey]);

  // Handle delete
  const handleDelete = async (doc: Document) => {
    if (!allowDelete || readOnly) return;
    if (!confirm(`Are you sure you want to delete "${doc.original_name}"?`))
      return;

    setDeletingId(doc.id);
    try {
      if (onDelete) {
        await onDelete(doc);
      } else {
        const response = await fetch(`/api/documents/${doc.id}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete document");

        // Optimistic update
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        invalidateCache();
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  // Handle download
  const handleDownload = async (doc: Document) => {
    if (onDownload) {
      await onDownload(doc);
    } else {
      try {
        const response = await fetch(`/api/documents/${doc.id}/download`);
        if (!response.ok) throw new Error("Failed to get download URL");
        const data = await response.json();
        window.open(data.download_url, "_blank");
      } catch (error) {
        console.error("Download error:", error);
        alert("Failed to download document");
      }
    }
  };

  // Handle preview
  const handlePreview = (doc: DocumentWithUrl) => {
    if (!isPreviewable(doc.file_type)) return;
    if (onPreview) {
      onPreview(doc);
    } else {
      // Default preview: open in new tab
      if (doc.signed_url) {
        window.open(doc.signed_url, "_blank");
      }
    }
  };

  // Sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort indicator component
  const SortIndicator = ({ field }: { field: string }) => (
    <span className="ml-1 inline-flex">
      {sortField === field ? (
        sortDirection === "asc" ? (
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 15l7-7 7 7"
            />
          </svg>
        ) : (
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )
      ) : (
        <svg
          className="w-3 h-3 opacity-0 group-hover:opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      )}
    </span>
  );

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let result = [...documents];

    // Category filter
    if (selectedCategory !== "all") {
      result = result.filter((doc) => doc.category === selectedCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (doc) =>
          doc.original_name?.toLowerCase().includes(query) ||
          doc.title?.toLowerCase().includes(query) ||
          doc.category?.toLowerCase().includes(query) ||
          doc.uploaded_user?.name?.toLowerCase().includes(query)
      );
    }

    // Sorting
    result.sort((a, b) => {
      let aVal: any = "";
      let bVal: any = "";

      switch (sortField) {
        case "name":
          aVal = (a.title || a.original_name || "").toLowerCase();
          bVal = (b.title || b.original_name || "").toLowerCase();
          break;
        case "category":
          aVal = a.category || "";
          bVal = b.category || "";
          break;
        case "size":
          aVal = a.file_size || 0;
          bVal = b.file_size || 0;
          break;
        case "uploaded_by":
          aVal = (a.uploaded_user?.name || "").toLowerCase();
          bVal = (b.uploaded_user?.name || "").toLowerCase();
          break;
        default: // created_at
          aVal = a.created_at || "";
          bVal = b.created_at || "";
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [documents, selectedCategory, searchQuery, sortField, sortDirection]);

  // Get file icon
  const getFileIcon = (doc: Document) => {
    const iconType = getFileTypeIcon(doc.file_type, doc.file_extension);
    const iconClass = "w-5 h-5";

    const iconMap: Record<string, React.ReactNode> = {
      photo: (
        <svg
          className={cn(iconClass, "text-blue-500")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
      pdf: (
        <svg
          className={cn(iconClass, "text-red-500")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      ),
      file: (
        <svg
          className={cn(iconClass, "text-slate-500")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      ),
    };

    return iconMap[iconType] || iconMap.file;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => handleRefresh()}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Header */}
      {showHeader && (
        <div className="px-4 py-3 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-800 leading-tight">
                  {headerTitle}
                </h1>
                <p className="text-[11px] text-slate-500">{headerSubtitle}</p>
              </div>
            </div>
            {allowUpload && !readOnly && (
              <button
                onClick={() =>
                  onUpload ? onUpload() : setIsUploadModalOpen(true)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-blue-600 to-blue-500 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md"
              >
                <PlusIcon className="w-4 h-4" />
                Upload Document
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
        <div className="flex-1">
          <SearchBox
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search documents..."
          />
        </div>
        {showCategory && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {Object.entries(DocumentCategoryLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        )}
        {!showHeader && allowUpload && !readOnly && (
          <button
            onClick={() => (onUpload ? onUpload() : setIsUploadModalOpen(true))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Upload
          </button>
        )}
      </div>

      {/* Document List */}
      {filteredDocuments.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center">
            <svg
              className="w-12 h-12 mx-auto mb-2 text-slate-300"
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
            <p className="text-sm font-medium text-slate-600 mb-1">
              No documents found
            </p>
            <p className="text-xs text-slate-400">
              {searchQuery || selectedCategory !== "all"
                ? "Try adjusting your filters"
                : "Upload your first document to get started"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr>
                <th
                  onClick={() => handleSort("name")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Document Name
                    <SortIndicator field="name" />
                  </div>
                </th>
                {showCategory && (
                  <th
                    onClick={() => handleSort("category")}
                    className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                  >
                    <div className="flex items-center">
                      Category
                      <SortIndicator field="category" />
                    </div>
                  </th>
                )}
                <th
                  onClick={() => handleSort("size")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Size
                    <SortIndicator field="size" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("uploaded_by")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Uploaded By
                    <SortIndicator field="uploaded_by" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("uploaded_at")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Uploaded
                    <SortIndicator field="uploaded_at" />
                  </div>
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredDocuments.map((doc) => (
                <tr
                  key={doc.id}
                  className="group hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {getFileIcon(doc)}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-800 truncate">
                          {doc.title || doc.original_name}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {doc.file_extension?.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </td>
                  {showCategory && (
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                        {doc.category
                          ? DocumentCategoryLabels[doc.category]
                          : "—"}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {doc.file_size ? formatFileSize(doc.file_size) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {doc.uploaded_user?.name || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {doc.created_at
                      ? new Date(doc.created_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {isPreviewable(doc.file_type) && (
                        <button
                          onClick={() => handlePreview(doc)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Preview"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Download"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                      </button>
                      {allowDelete && !readOnly && (
                        <button
                          onClick={() => handleDelete(doc)}
                          disabled={deletingId === doc.id}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {!onUpload && (
        <AddDocumentModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            setIsUploadModalOpen(false);
            handleRefresh();
          }}
          linkedType={linkedType as any}
          linkedId={linkedId as any}
        />
      )}
    </div>
  );
}

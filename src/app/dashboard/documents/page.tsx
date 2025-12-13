"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  DocumentIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  EyeIcon,
  FolderIcon,
  PhotoIcon,
  DocumentTextIcon,
  TableCellsIcon,
  BuildingOfficeIcon,
  UserIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatBadge,
} from "@/components/ui/PageLayout";
import {
  DocumentWithUrl,
  DocumentCategory,
  DocumentCategoryLabels,
  formatFileSize,
  getFileTypeIcon,
} from "@/types/documents";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";

// Extended document type to include linked entity info
interface DocumentWithLinked extends DocumentWithUrl {
  linked_name?: string;
}

// Linked entity for selection
interface LinkedEntity {
  id: string;
  name: string;
  type: "lead" | "project";
  number?: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentWithLinked[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [previewDocument, setPreviewDocument] =
    useState<DocumentWithUrl | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [linkedTypeFilter, setLinkedTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Sorting state
  const [sortField, setSortField] = useState<
    "name" | "type" | "linked" | "size" | "uploaded"
  >("uploaded");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Add document form state
  const [selectedLinkedType, setSelectedLinkedType] = useState<
    "lead" | "project"
  >("lead");
  const [selectedLinkedId, setSelectedLinkedId] = useState<string>("");
  const [leads, setLeads] = useState<LinkedEntity[]>([]);
  const [projects, setProjects] = useState<LinkedEntity[]>([]);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory | "">(
    ""
  );
  const [uploadNotes, setUploadNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch all documents
  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/documents");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      } else {
        throw new Error("Failed to fetch documents");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch leads and projects for the add modal
  const fetchLinkedEntities = useCallback(async () => {
    try {
      const [leadsRes, projectsRes] = await Promise.all([
        fetch("/api/sales/leads?limit=500"),
        fetch("/api/projects?limit=500"),
      ]);

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(
          (data.leads || []).map((l: any) => ({
            id: l.id,
            name: l.client?.name || l.client_name || "Unknown Client",
            type: "lead" as const,
            number: l.lead_number,
          }))
        );
      }

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(
          (data.projects || []).map((p: any) => ({
            id: p.id,
            name: p.name || p.project_name,
            type: "project" as const,
            number: p.project_number,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching linked entities:", err);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchLinkedEntities();
  }, [fetchDocuments, fetchLinkedEntities]);

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    const filtered = documents.filter((doc) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          doc.original_name?.toLowerCase().includes(query) ||
          doc.title?.toLowerCase().includes(query) ||
          doc.description?.toLowerCase().includes(query) ||
          doc.linked_name?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      if (categoryFilter !== "all" && doc.category !== categoryFilter) {
        return false;
      }

      if (linkedTypeFilter !== "all" && doc.linked_type !== linkedTypeFilter) {
        return false;
      }

      return true;
    });

    // Sort documents
    return filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          const nameA = (a.title || a.original_name || "").toLowerCase();
          const nameB = (b.title || b.original_name || "").toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        case "type":
          comparison = (a.category || "").localeCompare(b.category || "");
          break;
        case "linked":
          const linkedA = (a.linked_name || a.linked_type || "").toLowerCase();
          const linkedB = (b.linked_name || b.linked_type || "").toLowerCase();
          comparison = linkedA.localeCompare(linkedB);
          break;
        case "size":
          comparison = (a.file_size || 0) - (b.file_size || 0);
          break;
        case "uploaded":
          comparison =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    documents,
    searchQuery,
    categoryFilter,
    linkedTypeFilter,
    sortField,
    sortDirection,
  ]);

  // Handle sort click
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort indicator component
  const SortIndicator = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) {
      return <span className="ml-1 text-slate-300">⇅</span>;
    }
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="w-3 h-3 ml-1 inline" />
    ) : (
      <ChevronDownIcon className="w-3 h-3 ml-1 inline" />
    );
  };

  // Stats
  const stats = useMemo(() => {
    return {
      total: documents.length,
      leads: documents.filter((d) => d.linked_type === "lead").length,
      projects: documents.filter((d) => d.linked_type === "project").length,
    };
  }, [documents]);

  // Delete document
  const handleDelete = async (doc: DocumentWithLinked) => {
    if (
      !confirm('Are you sure you want to delete "' + doc.original_name + '"?')
    ) {
      return;
    }

    try {
      const response = await fetch("/api/documents/" + doc.id, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Failed to delete document");
    }
  };

  // Download document
  const handleDownload = async (doc: DocumentWithLinked) => {
    try {
      const response = await fetch("/api/documents/" + doc.id + "/download");
      if (!response.ok) throw new Error("Failed to get download URL");
      const data = await response.json();
      window.open(data.download_url, "_blank");
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download document");
    }
  };

  // Preview document
  const handlePreview = async (doc: DocumentWithLinked) => {
    try {
      const response = await fetch("/api/documents/" + doc.id);
      if (response.ok) {
        const data = await response.json();
        setPreviewDocument(data.document);
      }
    } catch (err) {
      console.error("Error fetching document for preview:", err);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  // Handle file from drop or selection
  const processFile = (file: File) => {
    setSelectedFile(file);
    if (!uploadTitle) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  // Upload document
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setUploadError("Please select a file");
      return;
    }

    if (!selectedLinkedId) {
      setUploadError(
        "Please select a " + selectedLinkedType + " to link this document to"
      );
      return;
    }

    if (!uploadCategory) {
      setUploadError("Please select a document type");
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("linked_type", selectedLinkedType);
      formData.append("linked_id", selectedLinkedId);
      formData.append("category", uploadCategory);
      formData.append("title", uploadTitle.trim() || selectedFile.name);
      if (uploadNotes.trim()) {
        formData.append("description", uploadNotes.trim());
      }

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload document");
      }

      // Reset form and close modal
      setSelectedFile(null);
      setUploadTitle("");
      setUploadCategory("");
      setUploadNotes("");
      setSelectedLinkedId("");
      setIsAddModalOpen(false);

      // Refresh documents
      fetchDocuments();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload document"
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Get file icon
  const getFileIcon = (doc: DocumentWithLinked) => {
    const iconType = getFileTypeIcon(doc.file_type, doc.file_extension);

    const iconClasses: Record<string, string> = {
      photo: "text-blue-500",
      pdf: "text-red-500",
      word: "text-blue-600",
      excel: "text-green-600",
      powerpoint: "text-orange-500",
      cad: "text-purple-500",
      archive: "text-amber-500",
      default: "text-slate-500",
    };

    const iconClass = iconClasses[iconType] || iconClasses.default;

    switch (iconType) {
      case "photo":
        return <PhotoIcon className={"w-5 h-5 " + iconClass} />;
      case "pdf":
        return <DocumentTextIcon className={"w-5 h-5 " + iconClass} />;
      case "excel":
        return <TableCellsIcon className={"w-5 h-5 " + iconClass} />;
      default:
        return <DocumentIcon className={"w-5 h-5 " + iconClass} />;
    }
  };

  // Get linked type badge
  const getLinkedTypeBadge = (type: string) => {
    switch (type) {
      case "lead":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
            <UserIcon className="w-3 h-3" />
            Lead
          </span>
        );
      case "project":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
            <BuildingOfficeIcon className="w-3 h-3" />
            Project
          </span>
        );
      default:
        return null;
    }
  };

  // Available entities for the selected type
  const availableEntities = selectedLinkedType === "lead" ? leads : projects;

  return (
    <PageLayout isLoading={isLoading} loadingText="Loading documents...">
      <PageHeader
        title="Documents"
        subtitle="Manage and organize all your project and lead documents"
        breadcrumbs={[{ label: "Documents" }]}
        icon={<FolderIcon className="w-5 h-5 text-white" />}
        iconBgClass="from-emerald-500 to-emerald-600"
        actions={
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-emerald-600 to-emerald-500 text-white text-sm font-medium rounded-lg hover:from-emerald-700 hover:to-emerald-600 transition-all shadow-sm hover:shadow-md"
          >
            <PlusIcon className="w-4 h-4" />
            Add Document
          </button>
        }
        stats={
          documents.length > 0 ? (
            <>
              <StatBadge label="Total" value={stats.total} color="slate" />
              <StatBadge label="Leads" value={stats.leads} color="amber" />
              <StatBadge label="Projects" value={stats.projects} color="blue" />
            </>
          ) : undefined
        }
      />

      <PageContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Filters Bar */}
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white"
            >
              <option value="all">All Types</option>
              {Object.entries(DocumentCategoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {/* Linked Type Filter */}
            <select
              value={linkedTypeFilter}
              onChange={(e) => setLinkedTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white"
            >
              <option value="all">All Sources</option>
              <option value="lead">Leads</option>
              <option value="project">Projects</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={
                  "p-2 transition-colors " +
                  (viewMode === "list"
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-400 hover:bg-slate-50")
                }
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={
                  "p-2 transition-colors " +
                  (viewMode === "grid"
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-400 hover:bg-slate-50")
                }
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Documents List/Grid */}
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-12">
            <FolderIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              {searchQuery ||
              categoryFilter !== "all" ||
              linkedTypeFilter !== "all"
                ? "No documents match your filters"
                : "No documents uploaded yet"}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Upload your first document
            </button>
          </div>
        ) : viewMode === "list" ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    onClick={() => handleSort("name")}
                  >
                    Name
                    <SortIndicator field="name" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    onClick={() => handleSort("type")}
                  >
                    Type
                    <SortIndicator field="type" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    onClick={() => handleSort("linked")}
                  >
                    Linked To
                    <SortIndicator field="linked" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    onClick={() => handleSort("size")}
                  >
                    Size
                    <SortIndicator field="size" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    onClick={() => handleSort("uploaded")}
                  >
                    Uploaded
                    <SortIndicator field="uploaded" />
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                          {getFileIcon(doc)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate max-w-xs">
                            {doc.title || doc.original_name}
                          </p>
                          {doc.title && doc.title !== doc.original_name && (
                            <p className="text-xs text-slate-500 truncate max-w-xs">
                              {doc.original_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                        {DocumentCategoryLabels[
                          doc.category as DocumentCategory
                        ] || doc.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {getLinkedTypeBadge(doc.linked_type)}
                        {doc.linked_name && (
                          <span className="text-xs text-slate-600 truncate max-w-xs">
                            {doc.linked_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatFileSize(doc.file_size)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-900">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                      {doc.uploaded_user && (
                        <p className="text-xs text-slate-500">
                          by {doc.uploaded_user.name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handlePreview(doc)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Preview"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex justify-center mb-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                    {getFileIcon(doc)}
                  </div>
                </div>
                <h3
                  className="font-medium text-slate-900 text-sm truncate mb-1 text-center"
                  title={doc.title || doc.original_name}
                >
                  {doc.title || doc.original_name}
                </h3>
                <p className="text-xs text-slate-500 text-center mb-2">
                  {formatFileSize(doc.file_size)}
                </p>
                <div className="flex justify-center mb-2">
                  {getLinkedTypeBadge(doc.linked_type)}
                </div>
                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handlePreview(doc)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageContent>

      {/* Add Document Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsAddModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Add Document
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {uploadError}
                </div>
              )}

              {/* Link To */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Link To <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLinkedType("lead");
                      setSelectedLinkedId("");
                    }}
                    className={
                      "flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors " +
                      (selectedLinkedType === "lead"
                        ? "bg-amber-50 border-amber-300 text-amber-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")
                    }
                  >
                    <UserIcon className="w-4 h-4 inline mr-1" />
                    Lead
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLinkedType("project");
                      setSelectedLinkedId("");
                    }}
                    className={
                      "flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors " +
                      (selectedLinkedType === "project"
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")
                    }
                  >
                    <BuildingOfficeIcon className="w-4 h-4 inline mr-1" />
                    Project
                  </button>
                </div>
                <select
                  value={selectedLinkedId}
                  onChange={(e) => setSelectedLinkedId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  required
                >
                  <option value="">Select a {selectedLinkedType}...</option>
                  {availableEntities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.number ? entity.number + " - " : ""}
                      {entity.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  File <span className="text-red-500">*</span>
                </label>
                <div
                  className={
                    "border-2 border-dashed rounded-xl p-4 text-center transition-colors " +
                    (isDragging
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-blue-400")
                  }
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DocumentIcon className="w-5 h-5 text-slate-400" />
                        <span className="text-sm text-slate-700 truncate max-w-[200px]">
                          {selectedFile.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({formatFileSize(selectedFile.size)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <div className="py-4">
                        <DocumentIcon
                          className={
                            "w-8 h-8 mx-auto mb-2 " +
                            (isDragging ? "text-blue-500" : "text-slate-300")
                          }
                        />
                        <p
                          className={
                            "text-sm " +
                            (isDragging ? "text-blue-600" : "text-slate-600")
                          }
                        >
                          {isDragging
                            ? "Drop file here"
                            : "Drag and drop or click to select"}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          PDF, images, CAD files up to 20MB
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Document title"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  required
                />
              </div>

              {/* Document Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) =>
                    setUploadCategory(e.target.value as DocumentCategory)
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  required
                >
                  <option value="">Select document type</option>
                  {Object.entries(DocumentCategoryLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Add any notes..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <PlusIcon className="w-4 h-4" />
                      Upload Document
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!previewDocument}
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
    </PageLayout>
  );
}

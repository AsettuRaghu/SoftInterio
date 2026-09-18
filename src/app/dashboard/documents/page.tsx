"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  DocumentIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PencilSquareIcon,
  EyeIcon,
  FolderIcon,
  PhotoIcon,
  DocumentTextIcon,
  TableCellsIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { TagInput, tagColour } from "@/components/ui/TagInput";
import {
  DocumentWithUrl,
  DocumentCategory,
  DocumentCategoryLabels,
  formatFileSize,
  getFileTypeIcon,
} from "@/types/documents";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { EditDocumentModal } from "@/components/documents/EditDocumentModal";

// Extended document type to include linked entity info
interface DocumentWithLinked extends DocumentWithUrl {
  linked_name?: string;
  parent_linked_name?: string;
}

// Linked entity for selection
interface LinkedEntity {
  id: string;
  name: string;
  type: "lead" | "project";
  number?: string;
}

export default function DocumentsPage() {
  const { confirm, confirmDialog } = useConfirm();
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
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocumentWithUrl | null>(null);
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
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of documents) {
      for (const tag of doc.tags || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const filtered = documents.filter((doc) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          doc.original_name?.toLowerCase().includes(query) ||
          doc.title?.toLowerCase().includes(query) ||
          doc.description?.toLowerCase().includes(query) ||
          doc.linked_name?.toLowerCase().includes(query) ||
          doc.tags?.some((t) => t.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      if (tagFilter && !(doc.tags || []).includes(tagFilter)) {
        return false;
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
    tagFilter,
    linkedTypeFilter,
    sortField,
    sortDirection,
  ]);

  // Handle sort click

  // Stats
  const stats = useMemo(() => {
    return {
      total: documents.length,
      leads: documents.filter((d) => d.linked_type === "lead").length,
      projects: documents.filter((d) => d.linked_type === "project").length,
      tasks: documents.filter((d) => d.linked_type === "task").length,
    };
  }, [documents]);

  // Delete document
  const handleDelete = async (doc: DocumentWithLinked) => {
    if (
      !(await confirm({
        title: `Delete "${doc.original_name}"?`,
        message: "The file is removed from storage and cannot be recovered.",
      }))
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
      if (uploadTags.length) {
        formData.append("tags", uploadTags.join(","));
      }
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
      case "task":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 text-xs rounded-full">
            <ClipboardDocumentListIcon className="w-3 h-3" />
            Task
          </span>
        );
      default:
        return null;
    }
  };

  // Available entities for the selected type
  const availableEntities = selectedLinkedType === "lead" ? leads : projects;

  return (
    // The whole page for the files, no header: the facet rail is the left
    // column, the toolbar carries the one action, and only the file area
    // scrolls. Same height arithmetic as the calendar (100vh minus the
    // shell's top bar and padding).
    <div className="h-[calc(100vh-104px)] flex flex-col min-h-0">
      {isLoading && documents.length === 0 && (
        <div className="shrink-0 text-xs text-slate-400 px-1 pb-2">Loading documents…</div>
      )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/*
         * Three parts, left to right: a facet rail (what kind, where it
         * belongs, what it is about - each with counts, each a filter), and
         * the files themselves: a strip of the most recent, then the list or
         * the grid. Filters compose; the active ones are named above the
         * files and cleared in one click.
         */}
        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[220px_1fr] gap-6">
          {/* Facet rail */}
          <aside className="space-y-5 min-h-0 overflow-y-auto pr-1">
            <div className="flex items-center gap-2 px-1">
              <div className="w-9 h-9 rounded-lg bg-linear-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shrink-0">
                <FolderIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-slate-900 leading-tight">Documents</h1>
                <p className="text-[11px] text-slate-500 tabular-nums">{documents.length} files</p>
              </div>
            </div>
            <Facet
              title="Kind"
              options={[
                { value: "all", label: "All files", count: documents.length },
                ...Object.entries(DocumentCategoryLabels)
                  .map(([value, label]) => ({ value, label, count: documents.filter((d) => d.category === value).length }))
                  .filter((o) => o.count > 0),
              ]}
              value={categoryFilter}
              onChange={setCategoryFilter}
            />
            <Facet
              title="Belongs to"
              options={[
                { value: "all", label: "Anything", count: documents.length },
                { value: "project", label: "Projects", count: stats.projects },
                { value: "lead", label: "Leads", count: stats.leads },
                { value: "task", label: "Task steps", count: stats.tasks },
              ].filter((o) => o.count > 0)}
              value={linkedTypeFilter}
              onChange={setLinkedTypeFilter}
            />
            {allTags.length > 0 && (
              <div>
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {allTags.slice(0, 24).map((t) => {
                    const on = tagFilter === t.name;
                    return (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => setTagFilter(on ? null : t.name)}
                        className={
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-colors " +
                          (on ? "bg-slate-800 text-white border-slate-800" : tagColour(t.name) + " border-transparent hover:brightness-95")
                        }
                        title={`${t.count} file${t.count === 1 ? "" : "s"}`}
                      >
                        {t.name}
                        <span className="opacity-60 tabular-nums">{t.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>

          {/* Files */}
          <div className="min-w-0 min-h-0 flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="relative flex-1 min-w-[220px]">
                <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files, tags, leads and projects..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <select
                value={`${sortField}:${sortDirection}`}
                onChange={(e) => {
                  const [f, d] = e.target.value.split(":");
                  setSortField(f as typeof sortField);
                  setSortDirection(d as typeof sortDirection);
                }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white"
              >
                <option value="uploaded:desc">Newest first</option>
                <option value="uploaded:asc">Oldest first</option>
                <option value="name:asc">Name A–Z</option>
                <option value="name:desc">Name Z–A</option>
                <option value="size:desc">Largest first</option>
                <option value="linked:asc">By lead / project</option>
              </select>
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                {(["list", "grid"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setViewMode(m)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      viewMode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {m === "list" ? "List" : "Grid"}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Document
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-0.5">
            {/* Active filters, named */}
            {(categoryFilter !== "all" || linkedTypeFilter !== "all" || tagFilter || searchQuery) && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span>
                  {filteredDocuments.length} of {documents.length} files
                </span>
                {categoryFilter !== "all" && <FilterPill label={DocumentCategoryLabels[categoryFilter as keyof typeof DocumentCategoryLabels] ?? categoryFilter} onClear={() => setCategoryFilter("all")} />}
                {linkedTypeFilter !== "all" && <FilterPill label={{ project: "Projects", lead: "Leads", task: "Task steps" }[linkedTypeFilter] ?? linkedTypeFilter} onClear={() => setLinkedTypeFilter("all")} />}
                {tagFilter && <FilterPill label={`#${tagFilter}`} onClear={() => setTagFilter(null)} />}
                {searchQuery && <FilterPill label={`"${searchQuery}"`} onClear={() => setSearchQuery("")} />}
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("all");
                    setLinkedTypeFilter("all");
                    setTagFilter(null);
                    setSearchQuery("");
                  }}
                  className="text-blue-600 hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Recently added - only when nothing is being filtered, so the
                strip is a welcome rather than a second copy of the list. */}
            {!searchQuery && categoryFilter === "all" && linkedTypeFilter === "all" && !tagFilter && documents.length > 3 && (
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Recently added</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[...documents]
                    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                    .slice(0, 6)
                    .map((doc) => (
                      <DocTile key={doc.id} doc={doc} onOpen={() => handlePreview(doc)} icon={getFileIcon(doc)} />
                    ))}
                </div>
              </section>
            )}

            {filteredDocuments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white py-14 text-center">
                <FolderIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  {documents.length === 0 ? "No documents yet" : "Nothing matches"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {documents.length === 0
                    ? "Files uploaded on leads, projects and plan steps all land here."
                    : "Try another search, or clear the filters."}
                </p>
              </div>
            ) : viewMode === "list" ? (
              <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                {filteredDocuments.map((doc) => (
                  <div key={doc.id} className="group flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <button type="button" onClick={() => handlePreview(doc)} className="shrink-0">
                      <DocGlyph doc={doc} icon={getFileIcon(doc)} size="md" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <button type="button" onClick={() => handlePreview(doc)} className="block text-left max-w-full">
                        <span className="block text-sm font-semibold text-slate-900 truncate">{doc.title || doc.original_name}</span>
                      </button>
                      <p className="text-xs text-slate-600 truncate">
                        {DocumentCategoryLabels[doc.category as keyof typeof DocumentCategoryLabels] ?? doc.category}
                        {doc.linked_name ? ` · ${doc.linked_name}` : ""}
                        {doc.parent_linked_name ? ` · in ${doc.parent_linked_name}` : ""}
                      </p>
                      {(doc.tags?.length ?? 0) > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {doc.tags!.slice(0, 5).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTagFilter(t)}
                              className={"px-1.5 py-0.5 rounded-full text-[10px] " + tagColour(t)}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="hidden md:block w-28 shrink-0">{getLinkedTypeBadge(doc.linked_type)}</div>
                    <div className="hidden md:block w-20 shrink-0 text-right text-xs text-slate-500 tabular-nums">{formatFileSize(doc.file_size)}</div>
                    <div className="hidden lg:block w-36 shrink-0 text-right">
                      <p className="text-xs text-slate-700 tabular-nums">
                        {new Date(doc.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      {doc.uploaded_user?.name && <p className="text-[11px] text-slate-400 truncate">{doc.uploaded_user.name}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => handlePreview(doc)} title="Preview" className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => handleDownload(doc)} title="Download" className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100">
                        <ArrowDownTrayIcon className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setEditingDoc(doc)} title="Edit" className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100">
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(doc)} title="Delete" className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
                {filteredDocuments.map((doc) => (
                  <div key={doc.id} className="group relative">
                    <DocTile doc={doc} onOpen={() => handlePreview(doc)} icon={getFileIcon(doc)} showMeta />
                    <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-md bg-white/95 shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => handleDownload(doc)} title="Download" className="p-1.5 text-slate-500 hover:text-slate-800">
                        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingDoc(doc)} title="Edit" className="p-1.5 text-slate-500 hover:text-slate-800">
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDelete(doc)} title="Delete" className="p-1.5 text-slate-500 hover:text-red-600">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>

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

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tags
                  <span className="ml-1 font-normal text-slate-400">
                    optional
                  </span>
                </label>
                <TagInput
                  value={uploadTags}
                  onChange={setUploadTags}
                  suggestions={allTags.map((t) => t.name)}
                  placeholder="Add tags..."
                />
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
      <EditDocumentModal
        isOpen={!!editingDoc}
        onClose={() => setEditingDoc(null)}
        document={editingDoc}
        onSaved={fetchDocuments}
      />

      <DocumentPreviewModal
        isOpen={!!previewDocument}
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
      {confirmDialog}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Module-scope pieces. Defined inside the page they would be a new
   component type on every render and remount - the TaskRow lesson.      */

function Facet({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { value: string; label: string; count: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{title}</p>
      <ul className="space-y-0.5">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => onChange(o.value)}
                className={
                  "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors " +
                  (on ? "bg-blue-50 text-blue-800 font-medium" : "text-slate-600 hover:bg-slate-100")
                }
              >
                <span className="truncate">{o.label}</span>
                <span className={"text-xs tabular-nums " + (on ? "text-blue-600" : "text-slate-400")}>{o.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-slate-100 text-slate-700">
      {label}
      <button type="button" onClick={onClear} className="p-0.5 rounded-full hover:bg-slate-200" aria-label={`Clear ${label}`}>
        <XMarkIcon className="w-3 h-3" />
      </button>
    </span>
  );
}

const GLYPH_TONE: Record<string, string> = {
  photo: "bg-blue-50",
  pdf: "bg-red-50",
  word: "bg-blue-50",
  excel: "bg-green-50",
  powerpoint: "bg-orange-50",
  cad: "bg-purple-50",
  archive: "bg-amber-50",
  default: "bg-slate-100",
};

/** A file's face: the image itself for a photo, otherwise its type icon on a tinted tile. */
function DocGlyph({ doc, icon, size }: { doc: DocumentWithLinked; icon: React.ReactNode; size: "md" | "lg" }) {
  const isImage = (doc.file_type || "").startsWith("image/") && !!doc.signed_url;
  const tone = GLYPH_TONE[getFileTypeIcon(doc.file_type, doc.file_extension)] ?? GLYPH_TONE.default;
  const box = size === "lg" ? "aspect-4/3 w-full" : "w-11 h-11";
  if (isImage) {
    return <img src={doc.signed_url} alt="" className={box + " object-cover rounded-md bg-slate-100"} loading="lazy" />;
  }
  return (
    <div className={box + " rounded-md flex items-center justify-center " + tone}>
      <span className={size === "lg" ? "scale-[1.8]" : ""}>{icon}</span>
    </div>
  );
}

function DocTile({ doc, icon, onOpen, showMeta = false }: { doc: DocumentWithLinked; icon: React.ReactNode; onOpen: () => void; showMeta?: boolean }) {
  const ext = (doc.file_extension || doc.original_name?.split(".").pop() || "").replace(".", "").toUpperCase();
  return (
    <button type="button" onClick={onOpen} className="w-full text-left rounded-lg border border-slate-200 bg-white p-2 hover:border-blue-300 hover:shadow-sm transition-all">
      <DocGlyph doc={doc} icon={icon} size="lg" />
      <p className="mt-2 text-xs font-semibold text-slate-800 truncate" title={doc.title || doc.original_name}>
        {doc.title || doc.original_name}
      </p>
      <p className="text-[11px] text-slate-500 truncate">
        {ext ? `${ext} · ` : ""}
        {formatFileSize(doc.file_size)}
        {doc.linked_name ? ` · ${doc.linked_name}` : ""}
      </p>
      {showMeta && (
        <p className="text-[10px] text-slate-400 truncate">
          {new Date(doc.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          {doc.uploaded_user?.name ? ` · ${doc.uploaded_user.name}` : ""}
        </p>
      )}
    </button>
  );
}

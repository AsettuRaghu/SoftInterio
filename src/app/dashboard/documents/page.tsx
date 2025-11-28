"use client";

import React, { useState } from "react";

interface Document {
  id: number;
  name: string;
  type: "Contract" | "Drawing" | "Specification" | "Proposal" | "Report" | "Invoice" | "Photo" | "Other";
  project?: string;
  client?: string;
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  version: string;
  tags: string[];
}

export default function DocumentsPage() {
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  const [filterType, setFilterType] = useState("All");

  const documents: Document[] = [
    {
      id: 1,
      name: "Modern Villa - Final Contract.pdf",
      type: "Contract",
      project: "Modern Villa Renovation",
      client: "John & Sarah Smith",
      size: "2.4 MB",
      uploadedBy: "Sarah Williams",
      uploadedAt: "2025-01-26",
      version: "v3.0",
      tags: ["Final", "Signed"],
    },
    {
      id: 2,
      name: "Executive Penthouse - Floor Plans.dwg",
      type: "Drawing",
      project: "Executive Penthouse",
      client: "Marcus & Elena Rodriguez",
      size: "15.8 MB",
      uploadedBy: "David Chen",
      uploadedAt: "2025-01-25",
      version: "v2.1",
      tags: ["CAD", "Approved"],
    },
    {
      id: 3,
      name: "Wellness Spa - Material Specifications.pdf",
      type: "Specification",
      project: "Wellness Spa Center",
      client: "Tranquil Wellness LLC",
      size: "4.2 MB",
      uploadedBy: "Emily Park",
      uploadedAt: "2025-01-24",
      version: "v1.2",
      tags: ["Materials", "Finishes"],
    },
    {
      id: 4,
      name: "Art Gallery - Initial Proposal.pdf",
      type: "Proposal",
      project: "Art Gallery Space",
      client: "Modern Arts Foundation",
      size: "8.5 MB",
      uploadedBy: "Michael Roberts",
      uploadedAt: "2025-01-23",
      version: "v1.0",
      tags: ["Draft", "Review"],
    },
    {
      id: 5,
      name: "Medical Clinic - Progress Report Jan 2025.pdf",
      type: "Report",
      project: "Medical Clinic Interior",
      client: "HealthFirst Clinics",
      size: "3.1 MB",
      uploadedBy: "Jessica Lee",
      uploadedAt: "2025-01-22",
      version: "v1.0",
      tags: ["Monthly", "Progress"],
    },
    {
      id: 6,
      name: "Invoice-INV-2025-0089.pdf",
      type: "Invoice",
      project: "Executive Penthouse",
      client: "Marcus & Elena Rodriguez",
      size: "245 KB",
      uploadedBy: "System",
      uploadedAt: "2025-01-21",
      version: "v1.0",
      tags: ["Financial", "Paid"],
    },
    {
      id: 7,
      name: "Modern Villa - Kitchen Renders.zip",
      type: "Photo",
      project: "Modern Villa Renovation",
      client: "John & Sarah Smith",
      size: "45.2 MB",
      uploadedBy: "David Chen",
      uploadedAt: "2025-01-20",
      version: "v1.0",
      tags: ["3D Render", "Kitchen"],
    },
    {
      id: 8,
      name: "Restaurant Redesign - Lighting Layout.pdf",
      type: "Drawing",
      project: "Downtown Bistro Redesign",
      client: "Downtown Bistro",
      size: "5.6 MB",
      uploadedBy: "Sarah Williams",
      uploadedAt: "2025-01-19",
      version: "v1.3",
      tags: ["Electrical", "Lighting"],
    },
    {
      id: 9,
      name: "Standard Terms & Conditions.pdf",
      type: "Other",
      size: "890 KB",
      uploadedBy: "Admin",
      uploadedAt: "2025-01-01",
      version: "v2.0",
      tags: ["Legal", "Template"],
    },
    {
      id: 10,
      name: "Wellness Spa - Site Photos.zip",
      type: "Photo",
      project: "Wellness Spa Center",
      client: "Tranquil Wellness LLC",
      size: "128 MB",
      uploadedBy: "Emily Park",
      uploadedAt: "2025-01-18",
      version: "v1.0",
      tags: ["Site Visit", "Before"],
    },
  ];

  const filteredDocuments = documents.filter(doc => 
    filterType === "All" || doc.type === filterType
  );

  const typeColors: Record<string, string> = {
    "Contract": "bg-purple-100 text-purple-700",
    "Drawing": "bg-blue-100 text-blue-700",
    "Specification": "bg-green-100 text-green-700",
    "Proposal": "bg-amber-100 text-amber-700",
    "Report": "bg-indigo-100 text-indigo-700",
    "Invoice": "bg-emerald-100 text-emerald-700",
    "Photo": "bg-pink-100 text-pink-700",
    "Other": "bg-slate-100 text-slate-700",
  };

  const typeIcons: Record<string, React.ReactNode> = {
    "Contract": (
      <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    "Drawing": (
      <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    "Specification": (
      <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    "Proposal": (
      <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    "Report": (
      <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    "Invoice": (
      <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    "Photo": (
      <svg className="w-8 h-8 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    "Other": (
      <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  };

  const stats = {
    total: documents.length,
    contracts: documents.filter(d => d.type === "Contract").length,
    drawings: documents.filter(d => d.type === "Drawing").length,
    thisMonth: documents.filter(d => d.uploadedAt.startsWith("2025-01")).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Documents</h1>
          <p className="text-slate-600">Manage contracts, drawings, and project files</p>
        </div>
        <div className="flex gap-3">
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewType("grid")}
              className={`p-2.5 transition-colors ${viewType === "grid" ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewType("list")}
              className={`p-2.5 transition-colors ${viewType === "list" ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-sm text-slate-600">Total Documents</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-purple-600">{stats.contracts}</p>
          <p className="text-sm text-slate-600">Contracts</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-blue-600">{stats.drawings}</p>
          <p className="text-sm text-slate-600">Drawings</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-green-600">{stats.thisMonth}</p>
          <p className="text-sm text-slate-600">This Month</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["All", "Contract", "Drawing", "Specification", "Proposal", "Report", "Invoice", "Photo", "Other"].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              filterType === type
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Grid View */}
      {viewType === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredDocuments.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex justify-center mb-4 pt-2">
                {typeIcons[doc.type]}
              </div>
              <h3 className="font-semibold text-slate-900 text-sm truncate mb-1" title={doc.name}>
                {doc.name}
              </h3>
              <p className="text-xs text-slate-500 mb-2">{doc.size} • {doc.version}</p>
              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${typeColors[doc.type]}`}>
                {doc.type}
              </span>
              <div className="flex gap-1 mt-3 flex-wrap">
                {doc.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-slate-400 hover:text-blue-600 p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button className="text-slate-400 hover:text-blue-600 p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                <button className="text-slate-400 hover:text-red-600 p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Project</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Size</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Uploaded</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center">
                          {typeIcons[doc.type]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{doc.name}</p>
                          <p className="text-xs text-slate-500">{doc.version}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${typeColors[doc.type]}`}>
                        {doc.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">{doc.project || "—"}</p>
                      <p className="text-xs text-slate-500">{doc.client || ""}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{doc.size}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">{doc.uploadedAt}</p>
                      <p className="text-xs text-slate-500">by {doc.uploadedBy}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

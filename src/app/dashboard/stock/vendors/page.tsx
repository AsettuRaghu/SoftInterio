"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CreateVendorModal, EditVendorModal } from "@/components/stock";
import type {
  Vendor,
  CreateVendorInput,
  UpdateVendorInput,
} from "@/types/stock";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatBadge,
} from "@/components/ui/PageLayout";
import {
  AppTable,
  useAppTableSort,
  useAppTableSearch,
  type ColumnDef,
} from "@/components/ui/AppTable";
import {
  PlusIcon,
  PhoneIcon,
  EnvelopeIcon,
  BuildingStorefrontIcon,
} from "@heroicons/react/24/outline";
import {
  StarIcon as StarIconSolid,
  HeartIcon as HeartIconSolid,
} from "@heroicons/react/24/solid";

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Status filter options
const STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "#22c55e" },
  { value: "inactive", label: "Inactive", color: "#94a3b8" },
];

export default function VendorsPage() {
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [preferredFilter, setPreferredFilter] = useState<boolean | null>(null);

  // Use AppTable hooks
  const { sortState, handleSort, sortData } = useAppTableSort<Vendor>();
  const { searchValue, setSearchValue } = useAppTableSearch<Vendor>([]);

  // Custom filter function
  const filterData = useCallback(
    (data: Vendor[], searchTerm: string) => {
      let filtered = data;

      // Apply status filter
      if (statusFilter) {
        filtered = filtered.filter((v) =>
          statusFilter === "active" ? v.is_active : !v.is_active
        );
      }

      // Apply preferred filter
      if (preferredFilter !== null) {
        filtered = filtered.filter((v) =>
          preferredFilter ? v.is_preferred : !v.is_preferred
        );
      }

      // Apply search filter
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (vendor) =>
            vendor.name?.toLowerCase().includes(query) ||
            vendor.code?.toLowerCase().includes(query) ||
            vendor.contact_person?.toLowerCase().includes(query) ||
            vendor.email?.toLowerCase().includes(query) ||
            vendor.phone?.toLowerCase().includes(query) ||
            vendor.city?.toLowerCase().includes(query) ||
            vendor.gst_number?.toLowerCase().includes(query)
        );
      }

      return filtered;
    },
    [statusFilter, preferredFilter]
  );

  // Custom sort value getter
  const getSortValue = useCallback((item: Vendor, column: string) => {
    switch (column) {
      case "name":
        return item.name?.toLowerCase() || "";
      case "city":
        return item.city?.toLowerCase() || "";
      case "rating":
        return item.rating || 0;
      case "credit_days":
        return item.credit_days || 0;
      case "created_at":
      default:
        return item.created_at ? new Date(item.created_at) : null;
    }
  }, []);

  // Process data: filter -> sort
  const processedVendors = useMemo(() => {
    const filtered = filterData(allVendors, searchValue);
    return sortData(filtered, getSortValue);
  }, [allVendors, searchValue, filterData, sortData, getSortValue]);

  // Fetch vendors
  const fetchVendors = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("limit", pagination.limit.toString());
      params.set(
        "offset",
        ((pagination.page - 1) * pagination.limit).toString()
      );

      const response = await fetch(`/api/stock/vendors?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load vendors");
      }

      const data = await response.json();
      setAllVendors(data.vendors || []);
      setPagination((prev) => ({
        ...prev,
        total: data.total || 0,
        totalPages: Math.ceil((data.total || 0) / prev.limit),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vendors");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = allVendors.length;
    const active = allVendors.filter((v) => v.is_active).length;
    const preferred = allVendors.filter((v) => v.is_preferred).length;
    const inactive = allVendors.filter((v) => !v.is_active).length;

    return { total, active, preferred, inactive };
  }, [allVendors]);

  // Create vendor
  const handleCreateVendor = async (vendorData: CreateVendorInput) => {
    const response = await fetch("/api/stock/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vendorData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to create vendor");
    }

    fetchVendors();
  };

  // Update vendor
  const handleUpdateVendor = async (
    vendorId: string,
    updates: UpdateVendorInput
  ) => {
    const response = await fetch(`/api/stock/vendors/${vendorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to update vendor");
    }

    fetchVendors();
  };

  // Render rating stars
  const renderRating = (rating: number | undefined) => {
    const r = rating || 0;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <StarIconSolid
            key={i}
            className={`h-3.5 w-3.5 ${
              i <= r ? "text-amber-400" : "text-slate-200"
            }`}
          />
        ))}
        {r > 0 && <span className="text-xs text-slate-600 ml-1">{r}</span>}
      </div>
    );
  };

  // Define table columns
  const columns: ColumnDef<Vendor>[] = [
    {
      key: "name",
      header: "Vendor",
      width: "22%",
      sortable: true,
      render: (vendor) => (
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 ${
              vendor.is_preferred
                ? "bg-linear-to-br from-amber-500 to-orange-500"
                : "bg-linear-to-br from-blue-500 to-purple-500"
            } rounded-lg flex items-center justify-center text-white font-semibold text-xs shrink-0 relative`}
          >
            {vendor.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
            {vendor.is_preferred && (
              <HeartIconSolid className="absolute -top-1 -right-1 h-4 w-4 text-red-500 drop-shadow" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-900 truncate">
                {vendor.display_name || vendor.name}
              </p>
              {vendor.is_preferred && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                  Preferred
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{vendor.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      width: "20%",
      render: (vendor) => (
        <div className="space-y-1">
          {vendor.contact_person && (
            <p className="text-sm text-slate-900">{vendor.contact_person}</p>
          )}
          {vendor.phone && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <PhoneIcon className="w-3 h-3 text-slate-400" />
              <a href={`tel:${vendor.phone}`} className="hover:text-blue-600">
                {vendor.phone}
              </a>
            </div>
          )}
          {vendor.email && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <EnvelopeIcon className="w-3 h-3 text-slate-400" />
              <a
                href={`mailto:${vendor.email}`}
                className="hover:text-blue-600 truncate max-w-[180px]"
              >
                {vendor.email}
              </a>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "city",
      header: "Location",
      width: "12%",
      sortable: true,
      render: (vendor) =>
        vendor.city ? (
          <div>
            <p className="text-sm text-slate-900">{vendor.city}</p>
            {vendor.state && (
              <p className="text-xs text-slate-500">{vendor.state}</p>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: "gst",
      header: "GST / Terms",
      width: "15%",
      render: (vendor) => (
        <div className="space-y-1">
          {vendor.gst_number && (
            <p className="text-xs font-mono text-slate-700">
              {vendor.gst_number}
            </p>
          )}
          {vendor.payment_terms && (
            <p className="text-xs text-slate-500">{vendor.payment_terms}</p>
          )}
          {vendor.credit_days && vendor.credit_days > 0 && (
            <p className="text-xs text-slate-500">
              {vendor.credit_days} days credit
            </p>
          )}
          {!vendor.gst_number && !vendor.payment_terms && (
            <span className="text-xs text-slate-400">—</span>
          )}
        </div>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      width: "12%",
      sortable: true,
      align: "center",
      render: (vendor) => renderRating(vendor.rating),
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      align: "center",
      render: (vendor) => (
        <span
          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
            vendor.is_active
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {vendor.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "9%",
      render: (vendor) => (
        <div className="flex items-center justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingVendor(vendor);
            }}
            className="px-2 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded font-medium"
          >
            Edit
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageLayout isLoading={isLoading && allVendors.length === 0}>
      <PageHeader
        title="Vendors"
        breadcrumbs={[{ label: "Stock & Procurement" }, { label: "Vendors" }]}
        actions={
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            Add Vendor
          </button>
        }
        stats={
          <>
            <StatBadge label="Total" value={stats.total} color="slate" />
            <StatBadge label="Active" value={stats.active} color="green" />
            <StatBadge
              label="Preferred"
              value={stats.preferred}
              color="amber"
            />
          </>
        }
      />

      <PageContent>
        {/* Toolbar with Search and Filters */}
        <div className="mb-4 flex items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search by name, code, contact, email, phone..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full pl-3 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100"
              >
                <span className="text-slate-400 text-xs">✕</span>
              </button>
            )}
          </div>

          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Preferred Filter Dropdown */}
          <select
            value={
              preferredFilter === null
                ? ""
                : preferredFilter
                ? "preferred"
                : "regular"
            }
            onChange={(e) => {
              const val = e.target.value;
              setPreferredFilter(val === "" ? null : val === "preferred");
            }}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="preferred">Preferred</option>
            <option value="regular">Regular</option>
          </select>
        </div>

        <AppTable
          data={processedVendors}
          columns={columns}
          keyExtractor={(v) => v.id}
          isLoading={isLoading}
          showToolbar={false}
          sortable={true}
          sortState={sortState}
          onSort={handleSort}
          onRowClick={(vendor) => setEditingVendor(vendor)}
          emptyState={{
            title: "No vendors found",
            description:
              statusFilter || preferredFilter !== null || searchValue
                ? "No vendors match your filters. Try a different filter."
                : "Get started by adding your first vendor.",
            icon: <BuildingStorefrontIcon className="w-6 h-6 text-slate-400" />,
          }}
        />
      </PageContent>

      {/* Modals */}
      <CreateVendorModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateVendor}
      />

      <EditVendorModal
        isOpen={!!editingVendor}
        vendor={editingVendor}
        onClose={() => setEditingVendor(null)}
        onSubmit={handleUpdateVendor}
      />
    </PageLayout>
  );
}

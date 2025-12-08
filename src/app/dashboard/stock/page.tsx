"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface StockStats {
  totalMaterials: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  pendingPurchaseOrders: number;
  pendingRequisitions: number;
  activeVendors: number;
  pendingGRN: number;
}

interface RecentMovement {
  id: string;
  type: "in" | "out";
  material_name: string;
  quantity: number;
  unit: string;
  reference: string;
  date: string;
}

interface LowStockAlert {
  id: string;
  name: string;
  sku: string;
  current_quantity: number;
  minimum_quantity: number;
  reorder_quantity: number;
  unit: string;
}

interface CategorySummary {
  category: string;
  item_count: number;
  total_value: number;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export default function StockPage() {
  const [stats, setStats] = useState<StockStats | null>(null);
  const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/stock/overview");
      if (!response.ok) {
        throw new Error("Failed to fetch overview data");
      }
      const data = await response.json();
      setStats(data.stats);
      setRecentMovements(data.recentMovements || []);
      setLowStockAlerts(data.lowStockAlerts || []);
      setCategories(data.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Header Skeleton */}
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
          <div className="animate-pulse">
            <div className="h-5 bg-slate-200 rounded w-48 mb-2"></div>
            <div className="h-3 bg-slate-200 rounded w-32"></div>
          </div>
        </div>
        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-slate-200 p-4"
            >
              <div className="animate-pulse">
                <div className="h-3 bg-slate-200 rounded w-16 mb-2"></div>
                <div className="h-6 bg-slate-200 rounded w-12"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-red-800 mb-1">
          Error Loading Overview
        </h2>
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={fetchOverviewData}
          className="mt-3 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const maxCategoryValue =
    categories.length > 0
      ? Math.max(...categories.map((c) => c.total_value))
      : 1;

  return (
    <div className="space-y-4">
      {/* Compact Header with Quick Stats */}
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/dashboard" className="hover:text-slate-700">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-slate-700">Stock & Procurement</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-slate-900">
                Stock Overview
              </h1>
              {/* Inline Quick Stats */}
              <div className="hidden md:flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
                  {stats?.totalMaterials || 0} Materials
                </span>
                {(stats?.lowStockItems || 0) > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-700">
                    {stats?.lowStockItems} Low Stock
                  </span>
                )}
                {(stats?.pendingPurchaseOrders || 0) > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-purple-50 text-purple-700">
                    {stats?.pendingPurchaseOrders} Pending POs
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50">
              Export
            </button>
            <Link
              href="/dashboard/stock/purchase-orders?action=create"
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + New PO
            </Link>
          </div>
        </div>
      </div>

      {/* Key Metrics - Compact Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">Total Materials</span>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {stats?.totalMaterials?.toLocaleString() || 0}
          </p>
          <p className="text-xs text-slate-500">Items in inventory</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">Total Value</span>
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(stats?.totalValue || 0)}
          </p>
          <p className="text-xs text-slate-500">Inventory worth</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">Low Stock</span>
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600">
            {stats?.lowStockItems || 0}
          </p>
          <p className="text-xs text-slate-500">Need reorder</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">Out of Stock</span>
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600">
            {stats?.outOfStockItems || 0}
          </p>
          <p className="text-xs text-slate-500">Urgent attention</p>
        </div>
      </div>

      {/* Secondary Metrics - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">Pending POs</span>
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-purple-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-purple-600">
            {stats?.pendingPurchaseOrders || 0}
          </p>
          <p className="text-xs text-slate-500">Orders</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">Requisitions</span>
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-orange-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-orange-600">
            {stats?.pendingRequisitions || 0}
          </p>
          <p className="text-xs text-slate-500">Pending</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">Vendors</span>
            <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-cyan-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-cyan-600">
            {stats?.activeVendors || 0}
          </p>
          <p className="text-xs text-slate-500">Active</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">Pending GRN</span>
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-teal-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-teal-600">
            {stats?.pendingGRN || 0}
          </p>
          <p className="text-xs text-slate-500">To receive</p>
        </div>
      </div>

      {/* Quick Actions - Compact Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href="/dashboard/stock/inventory"
          className="bg-white rounded-lg border border-slate-200 p-3 hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100">
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Materials</h3>
              <p className="text-xs text-slate-500">View inventory</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/stock/purchase-orders"
          className="bg-white rounded-lg border border-slate-200 p-3 hover:border-purple-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center group-hover:bg-purple-100">
              <svg
                className="w-4 h-4 text-purple-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">
                Purchase Orders
              </h3>
              <p className="text-xs text-slate-500">Manage orders</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/stock/requisitions"
          className="bg-white rounded-lg border border-slate-200 p-3 hover:border-orange-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center group-hover:bg-orange-100">
              <svg
                className="w-4 h-4 text-orange-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">
                Requisitions
              </h3>
              <p className="text-xs text-slate-500">Material requests</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/stock/vendors"
          className="bg-white rounded-lg border border-slate-200 p-3 hover:border-green-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center group-hover:bg-green-100">
              <svg
                className="w-4 h-4 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Vendors</h3>
              <p className="text-xs text-slate-500">Supplier directory</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Two Column Layout - Compact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Stock Movements */}
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent Movements
            </h2>
            <Link
              href="/dashboard/stock/inventory"
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              View All →
            </Link>
          </div>
          <div className="p-3 space-y-2">
            {recentMovements.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                <p>No recent movements</p>
              </div>
            ) : (
              recentMovements.slice(0, 5).map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-50"
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      movement.type === "in" ? "bg-green-100" : "bg-red-100"
                    }`}
                  >
                    {movement.type === "in" ? (
                      <svg
                        className="w-3.5 h-3.5 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-3.5 h-3.5 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 10l7-7m0 0l7 7m-7-7v18"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {movement.material_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {movement.reference}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        movement.type === "in"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {movement.type === "in" ? "+" : "-"}
                      {movement.quantity} {movement.unit}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(movement.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Low Stock Alerts
            </h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
              {lowStockAlerts.length} items
            </span>
          </div>
          <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
            {lowStockAlerts.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                <p>All stock levels healthy</p>
              </div>
            ) : (
              lowStockAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 border border-amber-200 bg-amber-50 rounded-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {alert.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        SKU: {alert.sku}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        <span className="font-semibold text-red-600">
                          {alert.current_quantity}
                        </span>
                        <span className="text-slate-400"> / </span>
                        <span className="font-semibold">
                          {alert.minimum_quantity}
                        </span>
                        <span className="text-slate-400"> {alert.unit}</span>
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/stock/purchase-orders?action=create&material=${alert.id}`}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                    >
                      Reorder
                    </Link>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-amber-200 rounded-full h-1.5">
                      <div
                        className="bg-red-500 h-1.5 rounded-full"
                        style={{
                          width: `${Math.min(
                            (alert.current_quantity / alert.minimum_quantity) *
                              100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Inventory by Category - Compact */}
      {categories.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Inventory by Category
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {categories.map((category, index) => (
                <Link
                  key={index}
                  href={`/dashboard/stock/inventory?category=${encodeURIComponent(
                    category.category
                  )}`}
                  className="p-3 border border-slate-200 rounded-md hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-medium text-slate-700 truncate">
                      {category.category}
                    </h3>
                    <span className="text-[10px] text-slate-400">
                      {category.item_count}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-slate-900">
                    {formatCurrency(category.total_value)}
                  </p>
                  <div className="mt-2 w-full bg-slate-100 rounded-full h-1">
                    <div
                      className="bg-blue-500 h-1 rounded-full"
                      style={{
                        width: `${
                          (category.total_value / maxCategoryValue) * 100
                        }%`,
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

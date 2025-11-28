"use client";

import React, { useState } from "react";
import Link from "next/link";

interface PurchaseOrder {
  id: number;
  orderNumber: string;
  vendor: string;
  items: number;
  totalAmount: number;
  status: "Draft" | "Pending Approval" | "Approved" | "Ordered" | "In Transit" | "Delivered" | "Cancelled";
  createdDate: string;
  expectedDelivery: string;
  project?: string;
  createdBy: string;
}

export default function PurchaseOrdersPage() {
  const [filterStatus, setFilterStatus] = useState("All");

  const orders: PurchaseOrder[] = [
    {
      id: 1,
      orderNumber: "PO-2025-0048",
      vendor: "Mediterranean Stone Imports",
      items: 3,
      totalAmount: 24500,
      status: "In Transit",
      createdDate: "2025-01-20",
      expectedDelivery: "2025-01-28",
      project: "Luxury Penthouse Project",
      createdBy: "Sarah Mitchell",
    },
    {
      id: 2,
      orderNumber: "PO-2025-0047",
      vendor: "Nordic Designs Co.",
      items: 5,
      totalAmount: 18750,
      status: "Approved",
      createdDate: "2025-01-18",
      expectedDelivery: "2025-02-01",
      project: "Modern Villa Renovation",
      createdBy: "David Anderson",
    },
    {
      id: 3,
      orderNumber: "PO-2025-0046",
      vendor: "Illuminate Studio",
      items: 8,
      totalAmount: 12400,
      status: "Pending Approval",
      createdDate: "2025-01-25",
      expectedDelivery: "2025-02-05",
      project: "Corporate HQ Redesign",
      createdBy: "Emily Parker",
    },
    {
      id: 4,
      orderNumber: "PO-2025-0045",
      vendor: "Artisan Textiles",
      items: 4,
      totalAmount: 8900,
      status: "Delivered",
      createdDate: "2025-01-10",
      expectedDelivery: "2025-01-22",
      project: "Boutique Hotel Suites",
      createdBy: "Sarah Mitchell",
    },
    {
      id: 5,
      orderNumber: "PO-2025-0044",
      vendor: "Premium Hardware Co.",
      items: 12,
      totalAmount: 4200,
      status: "Ordered",
      createdDate: "2025-01-22",
      expectedDelivery: "2025-01-30",
      createdBy: "David Anderson",
    },
    {
      id: 6,
      orderNumber: "PO-2025-0043",
      vendor: "Designer Walls Co.",
      items: 6,
      totalAmount: 6800,
      status: "Draft",
      createdDate: "2025-01-26",
      expectedDelivery: "TBD",
      project: "Restaurant Interior Design",
      createdBy: "Emily Parker",
    },
    {
      id: 7,
      orderNumber: "PO-2025-0042",
      vendor: "Luxe Lighting Studio",
      items: 2,
      totalAmount: 15600,
      status: "Delivered",
      createdDate: "2025-01-05",
      expectedDelivery: "2025-01-18",
      project: "Medical Clinic Interior",
      createdBy: "Sarah Mitchell",
    },
    {
      id: 8,
      orderNumber: "PO-2025-0041",
      vendor: "European Flooring Ltd.",
      items: 1,
      totalAmount: 7500,
      status: "Cancelled",
      createdDate: "2025-01-03",
      expectedDelivery: "2025-01-15",
      createdBy: "David Anderson",
    },
  ];

  const filteredOrders = orders.filter(order => 
    filterStatus === "All" || order.status === filterStatus
  );

  const statusColors: Record<string, string> = {
    "Draft": "bg-slate-100 text-slate-700",
    "Pending Approval": "bg-amber-100 text-amber-700",
    "Approved": "bg-blue-100 text-blue-700",
    "Ordered": "bg-purple-100 text-purple-700",
    "In Transit": "bg-cyan-100 text-cyan-700",
    "Delivered": "bg-green-100 text-green-700",
    "Cancelled": "bg-red-100 text-red-700",
  };

  const stats = {
    total: orders.length,
    pending: orders.filter(o => ["Draft", "Pending Approval"].includes(o.status)).length,
    inProgress: orders.filter(o => ["Approved", "Ordered", "In Transit"].includes(o.status)).length,
    completed: orders.filter(o => o.status === "Delivered").length,
    totalValue: orders.filter(o => o.status !== "Cancelled").reduce((sum, o) => sum + o.totalAmount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard/stock" className="hover:text-blue-600">Stock & Procurement</Link>
            <span>/</span>
            <span className="text-slate-900">Purchase Orders</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Purchase Orders</h1>
          <p className="text-slate-600">Create and track purchase orders from vendors</p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium">
          + Create Purchase Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-sm text-slate-600">Total Orders</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          <p className="text-sm text-slate-600">Pending</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
          <p className="text-sm text-slate-600">In Progress</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-sm text-slate-600">Delivered</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">${(stats.totalValue / 1000).toFixed(1)}K</p>
          <p className="text-sm text-slate-600">Total Value</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["All", "Draft", "Pending Approval", "Approved", "Ordered", "In Transit", "Delivered", "Cancelled"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              filterStatus === status
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Order #</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Vendor</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Items</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Project</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Expected Delivery</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-blue-600">{order.orderNumber}</p>
                    <p className="text-xs text-slate-500">Created: {order.createdDate}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{order.vendor}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-900">{order.items} items</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">${order.totalAmount.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-600">{order.project || "—"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-900">{order.expectedDelivery}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      {order.status === "Draft" && (
                        <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                      {order.status === "Pending Approval" && (
                        <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

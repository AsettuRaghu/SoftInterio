"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Invoice {
  id: number;
  invoiceNumber: string;
  client: string;
  project: string;
  amount: number;
  tax: number;
  total: number;
  status: "Draft" | "Sent" | "Viewed" | "Paid" | "Overdue" | "Cancelled";
  issueDate: string;
  dueDate: string;
  paidDate?: string;
}

export default function InvoicesPage() {
  const [filterStatus, setFilterStatus] = useState("All");

  const invoices: Invoice[] = [
    {
      id: 1,
      invoiceNumber: "INV-2025-0089",
      client: "HealthFirst Clinics",
      project: "Medical Clinic Interior",
      amount: 45000,
      tax: 2500,
      total: 47500,
      status: "Paid",
      issueDate: "2025-01-20",
      dueDate: "2025-02-04",
      paidDate: "2025-01-26",
    },
    {
      id: 2,
      invoiceNumber: "INV-2025-0088",
      client: "John & Sarah Smith",
      project: "Modern Villa Renovation - Milestone 2",
      amount: 59524,
      tax: 2976,
      total: 62500,
      status: "Paid",
      issueDate: "2025-01-18",
      dueDate: "2025-02-02",
      paidDate: "2025-01-24",
    },
    {
      id: 3,
      invoiceNumber: "INV-2025-0087",
      client: "TechVentures Inc.",
      project: "Corporate HQ Redesign - Deposit",
      amount: 107143,
      tax: 5357,
      total: 112500,
      status: "Sent",
      issueDate: "2025-01-15",
      dueDate: "2025-01-30",
    },
    {
      id: 4,
      invoiceNumber: "INV-2025-0086",
      client: "Grand Plaza Hotels",
      project: "Hotel Lobby Redesign - Initial",
      amount: 76190,
      tax: 3810,
      total: 80000,
      status: "Overdue",
      issueDate: "2025-01-05",
      dueDate: "2025-01-20",
    },
    {
      id: 5,
      invoiceNumber: "INV-2025-0085",
      client: "Paradise Resorts",
      project: "Luxury Resort Villas - Consultation",
      amount: 14286,
      tax: 714,
      total: 15000,
      status: "Viewed",
      issueDate: "2025-01-22",
      dueDate: "2025-02-06",
    },
    {
      id: 6,
      invoiceNumber: "INV-2025-0084",
      client: "Urban Oasis Hotels",
      project: "Boutique Hotel Suites - Milestone 1",
      amount: 66667,
      tax: 3333,
      total: 70000,
      status: "Sent",
      issueDate: "2025-01-24",
      dueDate: "2025-02-08",
    },
    {
      id: 7,
      invoiceNumber: "INV-2025-0083",
      client: "Bella Cucina Restaurant",
      project: "Restaurant Interior Design - Proposal",
      amount: 4762,
      tax: 238,
      total: 5000,
      status: "Draft",
      issueDate: "2025-01-26",
      dueDate: "2025-02-10",
    },
    {
      id: 8,
      invoiceNumber: "INV-2024-0082",
      client: "Fashion Forward Boutique",
      project: "Retail Store Design",
      amount: 28571,
      tax: 1429,
      total: 30000,
      status: "Cancelled",
      issueDate: "2024-12-15",
      dueDate: "2024-12-30",
    },
  ];

  const filteredInvoices = invoices.filter(invoice => 
    filterStatus === "All" || invoice.status === filterStatus
  );

  const statusColors: Record<string, string> = {
    "Draft": "bg-slate-100 text-slate-700",
    "Sent": "bg-blue-100 text-blue-700",
    "Viewed": "bg-cyan-100 text-cyan-700",
    "Paid": "bg-green-100 text-green-700",
    "Overdue": "bg-red-100 text-red-700",
    "Cancelled": "bg-gray-100 text-gray-700",
  };

  const stats = {
    total: invoices.reduce((sum, inv) => inv.status !== "Cancelled" ? sum + inv.total : sum, 0),
    paid: invoices.filter(inv => inv.status === "Paid").reduce((sum, inv) => sum + inv.total, 0),
    pending: invoices.filter(inv => ["Sent", "Viewed"].includes(inv.status)).reduce((sum, inv) => sum + inv.total, 0),
    overdue: invoices.filter(inv => inv.status === "Overdue").reduce((sum, inv) => sum + inv.total, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard/finance" className="hover:text-blue-600">Finance</Link>
            <span>/</span>
            <span className="text-slate-900">Invoices</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Invoices</h1>
          <p className="text-slate-600">Create, send, and track client invoices</p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium">
          + Create Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">${(stats.total / 1000).toFixed(0)}K</p>
          <p className="text-sm text-slate-600">Total Invoiced</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-green-600">${(stats.paid / 1000).toFixed(0)}K</p>
          <p className="text-sm text-slate-600">Collected</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-blue-600">${(stats.pending / 1000).toFixed(0)}K</p>
          <p className="text-sm text-slate-600">Pending</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-red-600">${(stats.overdue / 1000).toFixed(0)}K</p>
          <p className="text-sm text-slate-600">Overdue</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["All", "Draft", "Sent", "Viewed", "Paid", "Overdue", "Cancelled"].map((status) => (
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

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Invoice</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Client</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Project</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Due Date</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-blue-600">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-slate-500">Issued: {invoice.issueDate}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{invoice.client}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-600 max-w-xs truncate">{invoice.project}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">${invoice.total.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Tax: ${invoice.tax.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[invoice.status]}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className={`text-sm ${invoice.status === "Overdue" ? "text-red-600 font-medium" : "text-slate-600"}`}>
                      {invoice.dueDate}
                    </p>
                    {invoice.paidDate && (
                      <p className="text-xs text-green-600">Paid: {invoice.paidDate}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Download">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      {invoice.status === "Draft" && (
                        <button className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Send">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
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

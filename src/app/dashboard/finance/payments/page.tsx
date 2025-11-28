"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Payment {
  id: number;
  paymentId: string;
  invoiceNumber: string;
  client: string;
  project: string;
  amount: number;
  method: "Bank Transfer" | "Credit Card" | "Check" | "Cash" | "Wire Transfer";
  status: "Completed" | "Pending" | "Failed" | "Refunded";
  date: string;
  reference?: string;
}

export default function PaymentsPage() {
  const [filterMethod, setFilterMethod] = useState("All");

  const payments: Payment[] = [
    {
      id: 1,
      paymentId: "PAY-2025-0045",
      invoiceNumber: "INV-2025-0089",
      client: "HealthFirst Clinics",
      project: "Medical Clinic Interior",
      amount: 47500,
      method: "Bank Transfer",
      status: "Completed",
      date: "2025-01-26",
      reference: "TRX789456123",
    },
    {
      id: 2,
      paymentId: "PAY-2025-0044",
      invoiceNumber: "INV-2025-0088",
      client: "John & Sarah Smith",
      project: "Modern Villa Renovation - Milestone 2",
      amount: 62500,
      method: "Wire Transfer",
      status: "Completed",
      date: "2025-01-24",
      reference: "WIRE456789",
    },
    {
      id: 3,
      paymentId: "PAY-2025-0043",
      invoiceNumber: "INV-2025-0081",
      client: "Marcus & Elena Rodriguez",
      project: "Executive Penthouse - Final",
      amount: 85000,
      method: "Bank Transfer",
      status: "Completed",
      date: "2025-01-22",
      reference: "TRX456123789",
    },
    {
      id: 4,
      paymentId: "PAY-2025-0042",
      invoiceNumber: "INV-2025-0080",
      client: "Tranquil Wellness LLC",
      project: "Wellness Spa Center - Deposit",
      amount: 48750,
      method: "Credit Card",
      status: "Completed",
      date: "2025-01-20",
      reference: "CC-8745621",
    },
    {
      id: 5,
      paymentId: "PAY-2025-0041",
      invoiceNumber: "INV-2025-0079",
      client: "Modern Arts Foundation",
      project: "Art Gallery Space - Consultation",
      amount: 8500,
      method: "Check",
      status: "Pending",
      date: "2025-01-25",
      reference: "CHK-4521",
    },
    {
      id: 6,
      paymentId: "PAY-2025-0040",
      invoiceNumber: "INV-2025-0078",
      client: "Gourmet Group",
      project: "Restaurant Chain Refresh",
      amount: 35000,
      method: "Bank Transfer",
      status: "Pending",
      date: "2025-01-24",
    },
    {
      id: 7,
      paymentId: "PAY-2025-0039",
      invoiceNumber: "INV-2025-0077",
      client: "Downtown Bistro",
      project: "Restaurant Interior Redesign",
      amount: 12500,
      method: "Credit Card",
      status: "Failed",
      date: "2025-01-18",
    },
    {
      id: 8,
      paymentId: "PAY-2025-0038",
      invoiceNumber: "INV-2024-0076",
      client: "Fashion Forward Boutique",
      project: "Retail Store Design - Deposit",
      amount: 15000,
      method: "Bank Transfer",
      status: "Refunded",
      date: "2024-12-20",
      reference: "REF-2024-001",
    },
  ];

  const filteredPayments = payments.filter(payment => 
    filterMethod === "All" || payment.method === filterMethod
  );

  const methodColors: Record<string, string> = {
    "Bank Transfer": "bg-blue-100 text-blue-700",
    "Wire Transfer": "bg-purple-100 text-purple-700",
    "Credit Card": "bg-green-100 text-green-700",
    "Check": "bg-amber-100 text-amber-700",
    "Cash": "bg-slate-100 text-slate-700",
  };

  const statusColors: Record<string, string> = {
    "Completed": "bg-green-100 text-green-700",
    "Pending": "bg-amber-100 text-amber-700",
    "Failed": "bg-red-100 text-red-700",
    "Refunded": "bg-gray-100 text-gray-700",
  };

  const stats = {
    total: payments.filter(p => p.status === "Completed").reduce((sum, p) => sum + p.amount, 0),
    pending: payments.filter(p => p.status === "Pending").reduce((sum, p) => sum + p.amount, 0),
    thisMonth: payments.filter(p => p.date.startsWith("2025-01") && p.status === "Completed").reduce((sum, p) => sum + p.amount, 0),
    count: payments.filter(p => p.status === "Completed").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard/finance" className="hover:text-blue-600">Finance</Link>
            <span>/</span>
            <span className="text-slate-900">Payments</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Payments</h1>
          <p className="text-slate-600">Track and manage incoming payments</p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium">
          + Record Payment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">${(stats.total / 1000).toFixed(0)}K</p>
          <p className="text-sm text-slate-600">Total Received</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-green-600">${(stats.thisMonth / 1000).toFixed(0)}K</p>
          <p className="text-sm text-slate-600">This Month</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-amber-600">${(stats.pending / 1000).toFixed(0)}K</p>
          <p className="text-sm text-slate-600">Pending</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-blue-600">{stats.count}</p>
          <p className="text-sm text-slate-600">Completed</p>
        </div>
      </div>

      {/* Filter by Method */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["All", "Bank Transfer", "Wire Transfer", "Credit Card", "Check", "Cash"].map((method) => (
          <button
            key={method}
            onClick={() => setFilterMethod(method)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              filterMethod === method
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {method}
          </button>
        ))}
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Payment ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Client</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Invoice</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Method</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{payment.paymentId}</p>
                    {payment.reference && (
                      <p className="text-xs text-slate-500">Ref: {payment.reference}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{payment.client}</p>
                    <p className="text-xs text-slate-500 max-w-xs truncate">{payment.project}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-blue-600 font-medium">{payment.invoiceNumber}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">${payment.amount.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${methodColors[payment.method]}`}>
                      {payment.method}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[payment.status]}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{payment.date}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
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
    </div>
  );
}

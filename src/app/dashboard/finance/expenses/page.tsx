"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Expense {
  id: number;
  expenseId: string;
  description: string;
  category: "Materials" | "Labor" | "Equipment" | "Travel" | "Software" | "Office" | "Marketing" | "Utilities";
  vendor: string;
  project?: string;
  amount: number;
  status: "Approved" | "Pending" | "Rejected" | "Reimbursed";
  date: string;
  submittedBy: string;
  receipt?: boolean;
}

export default function ExpensesPage() {
  const [filterCategory, setFilterCategory] = useState("All");

  const expenses: Expense[] = [
    {
      id: 1,
      expenseId: "EXP-2025-0089",
      description: "Italian Marble Tiles - Executive Penthouse",
      category: "Materials",
      vendor: "Luxury Stone Imports",
      project: "Executive Penthouse",
      amount: 18500,
      status: "Approved",
      date: "2025-01-26",
      submittedBy: "Marcus Chen",
      receipt: true,
    },
    {
      id: 2,
      expenseId: "EXP-2025-0088",
      description: "Custom Furniture Fabrication - Modern Villa",
      category: "Materials",
      vendor: "Artisan Woodworks Co.",
      project: "Modern Villa Renovation",
      amount: 24000,
      status: "Approved",
      date: "2025-01-25",
      submittedBy: "Sarah Williams",
      receipt: true,
    },
    {
      id: 3,
      expenseId: "EXP-2025-0087",
      description: "Electrician Team - Wellness Spa Installation",
      category: "Labor",
      vendor: "Elite Electrical Services",
      project: "Wellness Spa Center",
      amount: 8750,
      status: "Approved",
      date: "2025-01-24",
      submittedBy: "David Park",
      receipt: true,
    },
    {
      id: 4,
      expenseId: "EXP-2025-0086",
      description: "3D Rendering Software - Annual License",
      category: "Software",
      vendor: "Autodesk",
      amount: 4500,
      status: "Approved",
      date: "2025-01-20",
      submittedBy: "Emily Chen",
      receipt: true,
    },
    {
      id: 5,
      expenseId: "EXP-2025-0085",
      description: "Client Site Visit - Chicago Art Gallery",
      category: "Travel",
      vendor: "Various",
      project: "Art Gallery Space",
      amount: 1250,
      status: "Pending",
      date: "2025-01-23",
      submittedBy: "Michael Roberts",
      receipt: true,
    },
    {
      id: 6,
      expenseId: "EXP-2025-0084",
      description: "Industrial Paint Sprayer Rental",
      category: "Equipment",
      vendor: "Pro Equipment Rentals",
      project: "Restaurant Chain Refresh",
      amount: 850,
      status: "Pending",
      date: "2025-01-22",
      submittedBy: "David Park",
      receipt: false,
    },
    {
      id: 7,
      expenseId: "EXP-2025-0083",
      description: "Trade Show Booth - Design Expo 2025",
      category: "Marketing",
      vendor: "Expo Services Inc.",
      amount: 5500,
      status: "Approved",
      date: "2025-01-18",
      submittedBy: "Jessica Lee",
      receipt: true,
    },
    {
      id: 8,
      expenseId: "EXP-2025-0082",
      description: "Studio Electricity - January",
      category: "Utilities",
      vendor: "City Power Co.",
      amount: 680,
      status: "Approved",
      date: "2025-01-15",
      submittedBy: "Admin",
      receipt: true,
    },
    {
      id: 9,
      expenseId: "EXP-2025-0081",
      description: "Lighting Fixtures - Medical Clinic",
      category: "Materials",
      vendor: "Premium Lighting Solutions",
      project: "Medical Clinic Interior",
      amount: 7200,
      status: "Reimbursed",
      date: "2025-01-12",
      submittedBy: "Sarah Williams",
      receipt: true,
    },
    {
      id: 10,
      expenseId: "EXP-2025-0080",
      description: "Unapproved Office Renovation",
      category: "Office",
      vendor: "Quick Fix Contractors",
      amount: 3500,
      status: "Rejected",
      date: "2025-01-10",
      submittedBy: "John Smith",
      receipt: false,
    },
  ];

  const filteredExpenses = expenses.filter(expense => 
    filterCategory === "All" || expense.category === filterCategory
  );

  const categoryColors: Record<string, string> = {
    "Materials": "bg-blue-100 text-blue-700",
    "Labor": "bg-purple-100 text-purple-700",
    "Equipment": "bg-amber-100 text-amber-700",
    "Travel": "bg-green-100 text-green-700",
    "Software": "bg-indigo-100 text-indigo-700",
    "Office": "bg-slate-100 text-slate-700",
    "Marketing": "bg-pink-100 text-pink-700",
    "Utilities": "bg-cyan-100 text-cyan-700",
  };

  const statusColors: Record<string, string> = {
    "Approved": "bg-green-100 text-green-700",
    "Pending": "bg-amber-100 text-amber-700",
    "Rejected": "bg-red-100 text-red-700",
    "Reimbursed": "bg-blue-100 text-blue-700",
  };

  const stats = {
    total: expenses.filter(e => e.status === "Approved" || e.status === "Reimbursed").reduce((sum, e) => sum + e.amount, 0),
    pending: expenses.filter(e => e.status === "Pending").reduce((sum, e) => sum + e.amount, 0),
    materials: expenses.filter(e => e.category === "Materials" && (e.status === "Approved" || e.status === "Reimbursed")).reduce((sum, e) => sum + e.amount, 0),
    projectRelated: expenses.filter(e => e.project && (e.status === "Approved" || e.status === "Reimbursed")).reduce((sum, e) => sum + e.amount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard/finance" className="hover:text-blue-600">Finance</Link>
            <span>/</span>
            <span className="text-slate-900">Expenses</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Expenses</h1>
          <p className="text-slate-600">Track and manage business expenses</p>
        </div>
        <div className="flex gap-3">
          <button className="border border-slate-200 text-slate-700 px-5 py-3 rounded-xl hover:bg-slate-50 transition-all duration-200 font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium">
            + Add Expense
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">${(stats.total / 1000).toFixed(1)}K</p>
          <p className="text-sm text-slate-600">Total Approved</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-amber-600">${(stats.pending / 1000).toFixed(1)}K</p>
          <p className="text-sm text-slate-600">Pending Approval</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-blue-600">${(stats.materials / 1000).toFixed(1)}K</p>
          <p className="text-sm text-slate-600">Materials</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-green-600">${(stats.projectRelated / 1000).toFixed(1)}K</p>
          <p className="text-sm text-slate-600">Project-Related</p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["All", "Materials", "Labor", "Equipment", "Travel", "Software", "Office", "Marketing", "Utilities"].map((category) => (
          <button
            key={category}
            onClick={() => setFilterCategory(category)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              filterCategory === category
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Expense</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Vendor</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Project</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{expense.expenseId}</p>
                        <p className="text-xs text-slate-500 max-w-xs truncate">{expense.description}</p>
                      </div>
                      {expense.receipt && (
                        <span className="text-green-500" title="Receipt attached">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${categoryColors[expense.category]}`}>
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">{expense.vendor}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {expense.project || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">${expense.amount.toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[expense.status]}`}>
                      {expense.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{expense.date}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
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

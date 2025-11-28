"use client";

import React from "react";
import Link from "next/link";

export default function FinancePage() {
  const financeStats = {
    totalRevenue: 2450000,
    monthlyRevenue: 385000,
    outstandingInvoices: 245000,
    overdueAmount: 48500,
    expenses: 156000,
    profit: 229000,
    invoicesPending: 12,
    paymentsDue: 8,
  };

  const recentTransactions = [
    {
      id: 1,
      type: "income",
      description: "Invoice #INV-2025-0089 - Medical Clinic Interior",
      client: "HealthFirst Clinics",
      amount: 47500,
      date: "2025-01-26",
      status: "Completed",
    },
    {
      id: 2,
      type: "expense",
      description: "PO-2025-0048 - Marble Tiles",
      vendor: "Mediterranean Stone Imports",
      amount: 24500,
      date: "2025-01-25",
      status: "Paid",
    },
    {
      id: 3,
      type: "income",
      description: "Invoice #INV-2025-0088 - Villa Project Milestone 2",
      client: "John & Sarah Smith",
      amount: 62500,
      date: "2025-01-24",
      status: "Completed",
    },
    {
      id: 4,
      type: "expense",
      description: "Contractor Payment - Electrical Work",
      vendor: "Elite Contractors",
      amount: 8500,
      date: "2025-01-23",
      status: "Paid",
    },
    {
      id: 5,
      type: "income",
      description: "Invoice #INV-2025-0087 - Office Design Deposit",
      client: "TechVentures Inc.",
      amount: 112500,
      date: "2025-01-22",
      status: "Pending",
    },
  ];

  const cashFlowData = [
    { month: "Aug", income: 320000, expenses: 180000 },
    { month: "Sep", income: 380000, expenses: 195000 },
    { month: "Oct", income: 290000, expenses: 160000 },
    { month: "Nov", income: 420000, expenses: 210000 },
    { month: "Dec", income: 510000, expenses: 245000 },
    { month: "Jan", income: 385000, expenses: 156000 },
  ];

  const maxValue = Math.max(...cashFlowData.map(d => Math.max(d.income, d.expenses)));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Finance Dashboard</h1>
          <p className="text-slate-600 text-base">
            Track revenue, expenses, and financial health
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white text-slate-700 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            Export Report
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            + Create Invoice
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Revenue</p>
              <p className="text-2xl font-bold text-slate-900">
                ${(financeStats.totalRevenue / 1000000).toFixed(2)}M
              </p>
              <p className="text-xs text-green-600 mt-1">↑ 18% from last year</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Outstanding</p>
              <p className="text-2xl font-bold text-amber-600">
                ${(financeStats.outstandingInvoices / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-slate-500 mt-1">{financeStats.invoicesPending} invoices pending</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Monthly Expenses</p>
              <p className="text-2xl font-bold text-slate-900">
                ${(financeStats.expenses / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-red-600 mt-1">↓ 8% from last month</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Net Profit</p>
              <p className="text-2xl font-bold text-blue-600">
                ${(financeStats.profit / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-green-600 mt-1">↑ 24% margin</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/dashboard/finance/invoices" className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Invoices</h3>
              <p className="text-sm text-slate-500">Manage client invoices</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/finance/payments" className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Payments</h3>
              <p className="text-sm text-slate-500">Track received payments</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/finance/expenses" className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Expenses</h3>
              <p className="text-sm text-slate-500">Monitor spending</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Cash Flow (Last 6 Months)</h2>
          <div className="h-64">
            <div className="flex items-end justify-between h-48 gap-4">
              {cashFlowData.map((data, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex gap-1 items-end h-40">
                    <div
                      className="flex-1 bg-green-500 rounded-t"
                      style={{ height: `${(data.income / maxValue) * 100}%` }}
                      title={`Income: $${(data.income / 1000).toFixed(0)}K`}
                    />
                    <div
                      className="flex-1 bg-red-400 rounded-t"
                      style={{ height: `${(data.expenses / maxValue) * 100}%` }}
                      title={`Expenses: $${(data.expenses / 1000).toFixed(0)}K`}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{data.month}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span className="text-sm text-slate-600">Income</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400 rounded" />
                <span className="text-sm text-slate-600">Expenses</span>
              </div>
            </div>
          </div>
        </div>

        {/* Overdue Alert */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Payment Alerts</h2>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-red-800">Overdue Invoices</p>
                  <p className="text-sm text-red-600">${(financeStats.overdueAmount / 1000).toFixed(1)}K overdue</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-amber-800">Payments Due</p>
                  <p className="text-sm text-amber-600">{financeStats.paymentsDue} vendor payments</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-green-800">This Month</p>
                  <p className="text-sm text-green-600">$385K collected</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Transactions</h2>
          <button className="text-blue-600 text-sm hover:text-blue-700">View All →</button>
        </div>
        <div className="divide-y divide-slate-100">
          {recentTransactions.map((transaction) => (
            <div key={transaction.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  transaction.type === "income" ? "bg-green-100" : "bg-red-100"
                }`}>
                  {transaction.type === "income" ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{transaction.description}</p>
                  <p className="text-sm text-slate-500">
                    {transaction.client || transaction.vendor}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${transaction.type === "income" ? "text-green-600" : "text-red-600"}`}>
                  {transaction.type === "income" ? "+" : "-"}${transaction.amount.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">{transaction.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

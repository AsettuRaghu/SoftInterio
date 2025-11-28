"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: "monthly" | "yearly";
  features: string[];
  recommended?: boolean;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: "Paid" | "Pending" | "Failed";
  description: string;
}

export default function BillingSettingsPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const currentPlan = {
    name: "Professional",
    price: 79,
    nextBilling: "February 27, 2025",
    usersIncluded: 10,
    usersUsed: 8,
    storageIncluded: 50,
    storageUsed: 32,
    projectsIncluded: "Unlimited",
  };

  const plans: Plan[] = [
    {
      id: "starter",
      name: "Starter",
      price: billingCycle === "monthly" ? 29 : 290,
      interval: billingCycle,
      features: [
        "Up to 3 team members",
        "10 active projects",
        "5GB storage",
        "Basic reports",
        "Email support",
      ],
    },
    {
      id: "professional",
      name: "Professional",
      price: billingCycle === "monthly" ? 79 : 790,
      interval: billingCycle,
      recommended: true,
      features: [
        "Up to 10 team members",
        "Unlimited projects",
        "50GB storage",
        "Advanced reports",
        "Priority support",
        "Custom workflows",
        "API access",
      ],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: billingCycle === "monthly" ? 199 : 1990,
      interval: billingCycle,
      features: [
        "Unlimited team members",
        "Unlimited projects",
        "500GB storage",
        "Custom reports",
        "Dedicated support",
        "Advanced security",
        "Custom integrations",
        "SLA guarantee",
      ],
    },
  ];

  const invoices: Invoice[] = [
    { id: "INV-2025-0012", date: "Jan 27, 2025", amount: 79, status: "Paid", description: "Professional Plan - Monthly" },
    { id: "INV-2024-0011", date: "Dec 27, 2024", amount: 79, status: "Paid", description: "Professional Plan - Monthly" },
    { id: "INV-2024-0010", date: "Nov 27, 2024", amount: 79, status: "Paid", description: "Professional Plan - Monthly" },
    { id: "INV-2024-0009", date: "Oct 27, 2024", amount: 79, status: "Paid", description: "Professional Plan - Monthly" },
    { id: "INV-2024-0008", date: "Sep 27, 2024", amount: 79, status: "Paid", description: "Professional Plan - Monthly" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard/settings" className="hover:text-blue-600">Settings</Link>
            <span>/</span>
            <span className="text-slate-900">Billing</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Billing & Subscription</h1>
          <p className="text-slate-600">Manage your subscription and payment methods</p>
        </div>
      </div>

      {/* Current Plan */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Current Plan</h2>
            <p className="text-slate-600">You are currently on the <span className="font-semibold text-blue-600">{currentPlan.name}</span> plan</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-900">${currentPlan.price}<span className="text-base font-normal text-slate-500">/mo</span></p>
            <p className="text-sm text-slate-500">Next billing: {currentPlan.nextBilling}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Team Members</p>
              <p className="text-sm font-medium text-slate-900">{currentPlan.usersUsed} / {currentPlan.usersIncluded}</p>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${(currentPlan.usersUsed / currentPlan.usersIncluded) * 100}%` }}
              />
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Storage</p>
              <p className="text-sm font-medium text-slate-900">{currentPlan.storageUsed}GB / {currentPlan.storageIncluded}GB</p>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${(currentPlan.storageUsed / currentPlan.storageIncluded) * 100}%` }}
              />
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Projects</p>
              <p className="text-sm font-medium text-slate-900">{currentPlan.projectsIncluded}</p>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-green-600">No limits</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium">
            Change Plan
          </button>
          <button className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-medium">
            Cancel Subscription
          </button>
        </div>
      </div>

      {/* Available Plans */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Available Plans</h2>
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                billingCycle === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                billingCycle === "yearly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              Yearly <span className="text-green-600 text-xs ml-1">Save 17%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border p-5 ${
                plan.recommended
                  ? "border-blue-500 ring-2 ring-blue-100"
                  : "border-slate-200"
              }`}
            >
              {plan.recommended && (
                <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full mb-3">
                  Recommended
                </span>
              )}
              <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-bold text-slate-900">${plan.price}</span>
                <span className="text-slate-500">/{plan.interval === "monthly" ? "mo" : "yr"}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                  plan.id === "professional"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                disabled={plan.id === "professional"}
              >
                {plan.id === "professional" ? "Current Plan" : "Upgrade"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Payment Method</h2>
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-8 bg-linear-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">
              VISA
            </div>
            <div>
              <p className="font-medium text-slate-900">Visa ending in 4242</p>
              <p className="text-sm text-slate-500">Expires 12/2026</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="text-blue-600 font-medium hover:text-blue-700">Edit</button>
            <span className="text-slate-300">|</span>
            <button className="text-red-600 font-medium hover:text-red-700">Remove</button>
          </div>
        </div>
        <button className="mt-4 text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Payment Method
        </button>
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Billing History</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{invoice.id}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{invoice.date}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{invoice.description}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">${invoice.amount}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      invoice.status === "Paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-blue-600 text-sm font-medium hover:text-blue-700">
                      Download
                    </button>
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

"use client";

import React, { useState } from "react";

interface DataRow {
  startDate: string;
  clientName: string;
  income: number;
  expense: number;
  status: string;
}

const sampleData: DataRow[] = [
  {
    startDate: "2025-11-01",
    clientName: "Acme Corp",
    income: 12000,
    expense: 4000,
    status: "Completed",
  },
  {
    startDate: "2025-11-10",
    clientName: "Design Studio",
    income: 8000,
    expense: 2500,
    status: "In Progress",
  },
  {
    startDate: "2025-11-15",
    clientName: "Home Makeover",
    income: 15000,
    expense: 7000,
    status: "Completed",
  },
  {
    startDate: "2025-11-20",
    clientName: "Office Renovation",
    income: 10000,
    expense: 3000,
    status: "Pending",
  },
];

const columns: { key: keyof DataRow; label: string }[] = [
  { key: "startDate", label: "Start Date" },
  { key: "clientName", label: "Client Name" },
  { key: "income", label: "Income Received" },
  { key: "expense", label: "Expense Spent" },
  { key: "status", label: "Status" },
];

export default function SamplePage() {
  const [search, setSearch] = useState("");
  const filtered = sampleData.filter((row) =>
    columns.some((col) =>
      String(row[col.key]).toLowerCase().includes(search.toLowerCase())
    )
  );

  const totalIncome = filtered.reduce((sum, r) => sum + r.income, 0);
  const totalExpense = filtered.reduce((sum, r) => sum + r.expense, 0);

  return (
    <div className="max-w-4xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Finance Table Example</h1>
      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 px-4 py-2 border rounded w-full"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full border rounded-lg bg-white">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2 border-b text-left bg-gray-50"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-100">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2 border-b">
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="font-semibold bg-blue-50">
              <td className="px-4 py-2 border-b">Total</td>
              <td className="px-4 py-2 border-b"></td>
              <td className="px-4 py-2 border-b">
                ₹{totalIncome.toLocaleString()}
              </td>
              <td className="px-4 py-2 border-b">
                ₹{totalExpense.toLocaleString()}
              </td>
              <td className="px-4 py-2 border-b"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

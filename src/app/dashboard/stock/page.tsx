"use client";

import React from "react";
import Link from "next/link";

export default function StockPage() {
  const stockStats = {
    totalItems: 1247,
    totalValue: 458500,
    lowStockItems: 23,
    outOfStock: 5,
    pendingOrders: 8,
    vendorsActive: 34,
  };

  const recentMovements = [
    {
      id: 1,
      type: "in",
      item: "Italian Marble Tiles - Carrara White",
      quantity: 500,
      unit: "sq ft",
      project: "Luxury Penthouse Project",
      date: "2025-01-26",
    },
    {
      id: 2,
      type: "out",
      item: "Scandinavian Oak Flooring",
      quantity: 320,
      unit: "sq ft",
      project: "Modern Villa Renovation",
      date: "2025-01-25",
    },
    {
      id: 3,
      type: "in",
      item: "Designer Pendant Lights - Brass",
      quantity: 12,
      unit: "pcs",
      project: "Stock Replenishment",
      date: "2025-01-25",
    },
    {
      id: 4,
      type: "out",
      item: "Velvet Upholstery Fabric - Emerald",
      quantity: 45,
      unit: "yards",
      project: "Corporate Office Design",
      date: "2025-01-24",
    },
    {
      id: 5,
      type: "in",
      item: "Custom Cabinet Hardware - Antique Bronze",
      quantity: 200,
      unit: "pcs",
      project: "Stock Replenishment",
      date: "2025-01-24",
    },
  ];

  const lowStockAlerts = [
    { id: 1, item: "Herringbone Parquet Tiles", current: 45, minimum: 100, unit: "sq ft" },
    { id: 2, item: "Brushed Gold Drawer Pulls", current: 12, minimum: 50, unit: "pcs" },
    { id: 3, item: "Linen Drapery Fabric - Natural", current: 8, minimum: 30, unit: "yards" },
    { id: 4, item: "Porcelain Floor Tiles - Matte Black", current: 120, minimum: 200, unit: "sq ft" },
  ];

  const topCategories = [
    { name: "Flooring Materials", items: 234, value: 125000 },
    { name: "Furniture", items: 189, value: 156000 },
    { name: "Lighting Fixtures", items: 156, value: 78500 },
    { name: "Textiles & Fabrics", items: 312, value: 45000 },
    { name: "Hardware & Fittings", items: 256, value: 32000 },
    { name: "Decorative Items", items: 100, value: 22000 },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Stock & Procurement</h1>
          <p className="text-slate-600 text-base">
            Manage inventory, purchase orders, and vendor relationships
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white text-slate-700 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            Export Report
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            + New Purchase Order
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Items</p>
              <p className="text-2xl font-bold text-slate-900">{stockStats.totalItems.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Value</p>
              <p className="text-2xl font-bold text-slate-900">${(stockStats.totalValue / 1000).toFixed(0)}K</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Low Stock</p>
              <p className="text-2xl font-bold text-amber-600">{stockStats.lowStockItems}</p>
            </div>
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">{stockStats.outOfStock}</p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Pending Orders</p>
              <p className="text-2xl font-bold text-purple-600">{stockStats.pendingOrders}</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Active Vendors</p>
              <p className="text-2xl font-bold text-cyan-600">{stockStats.vendorsActive}</p>
            </div>
            <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/dashboard/stock/inventory" className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Inventory</h3>
              <p className="text-sm text-slate-500">Browse all stock items</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/stock/orders" className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Purchase Orders</h3>
              <p className="text-sm text-slate-500">Manage orders & deliveries</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/stock/vendors" className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Vendors</h3>
              <p className="text-sm text-slate-500">Supplier directory</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Stock Movements */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Stock Movements</h2>
            <Link href="/dashboard/stock/inventory" className="text-blue-600 text-sm hover:text-blue-700">
              View All →
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {recentMovements.map((movement) => (
              <div key={movement.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  movement.type === "in" ? "bg-green-100" : "bg-red-100"
                }`}>
                  {movement.type === "in" ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{movement.item}</p>
                  <p className="text-sm text-slate-500">{movement.project}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${movement.type === "in" ? "text-green-600" : "text-red-600"}`}>
                    {movement.type === "in" ? "+" : "-"}{movement.quantity} {movement.unit}
                  </p>
                  <p className="text-xs text-slate-400">{movement.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Low Stock Alerts</h2>
            <span className="inline-flex px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
              {lowStockAlerts.length} items
            </span>
          </div>
          <div className="p-4 space-y-3">
            {lowStockAlerts.map((alert) => (
              <div key={alert.id} className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{alert.item}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Current: <span className="font-semibold text-red-600">{alert.current}</span> / 
                      Min: <span className="font-semibold">{alert.minimum}</span> {alert.unit}
                    </p>
                  </div>
                  <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    Reorder
                  </button>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-amber-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${(alert.current / alert.minimum) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory by Category */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Inventory by Category</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topCategories.map((category, index) => (
              <div key={index} className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-slate-900">{category.name}</h3>
                  <span className="text-sm text-slate-500">{category.items} items</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">${(category.value / 1000).toFixed(0)}K</p>
                <div className="mt-3 w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${(category.value / 156000) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

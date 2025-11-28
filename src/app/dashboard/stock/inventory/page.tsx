"use client";

import React, { useState } from "react";
import Link from "next/link";

interface InventoryItem {
  id: number;
  name: string;
  sku: string;
  category: string;
  subcategory: string;
  quantity: number;
  unit: string;
  minStock: number;
  costPrice: number;
  sellingPrice: number;
  supplier: string;
  location: string;
  lastRestocked: string;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  image?: string;
}

export default function StockInventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  const categories = [
    "All",
    "Flooring",
    "Furniture",
    "Lighting",
    "Textiles",
    "Hardware",
    "Wall Finishes",
    "Decorative",
  ];

  const inventory: InventoryItem[] = [
    {
      id: 1,
      name: "Italian Marble Tiles - Carrara White",
      sku: "FLR-MAR-001",
      category: "Flooring",
      subcategory: "Natural Stone",
      quantity: 850,
      unit: "sq ft",
      minStock: 200,
      costPrice: 45,
      sellingPrice: 85,
      supplier: "Mediterranean Stone Imports",
      location: "Warehouse A - Section 3",
      lastRestocked: "2025-01-26",
      status: "In Stock",
    },
    {
      id: 2,
      name: "Scandinavian Oak Flooring - Natural",
      sku: "FLR-WOD-002",
      category: "Flooring",
      subcategory: "Hardwood",
      quantity: 1200,
      unit: "sq ft",
      minStock: 300,
      costPrice: 28,
      sellingPrice: 55,
      supplier: "Nordic Designs Co.",
      location: "Warehouse A - Section 2",
      lastRestocked: "2025-01-20",
      status: "In Stock",
    },
    {
      id: 3,
      name: "Herringbone Parquet Tiles",
      sku: "FLR-PAR-003",
      category: "Flooring",
      subcategory: "Engineered Wood",
      quantity: 45,
      unit: "sq ft",
      minStock: 100,
      costPrice: 35,
      sellingPrice: 68,
      supplier: "European Flooring Ltd.",
      location: "Warehouse A - Section 2",
      lastRestocked: "2025-01-10",
      status: "Low Stock",
    },
    {
      id: 4,
      name: "Mid-Century Modern Armchair - Walnut",
      sku: "FRN-CHR-001",
      category: "Furniture",
      subcategory: "Seating",
      quantity: 24,
      unit: "pcs",
      minStock: 10,
      costPrice: 450,
      sellingPrice: 895,
      supplier: "Vintage Furniture Makers",
      location: "Showroom - Living",
      lastRestocked: "2025-01-15",
      status: "In Stock",
    },
    {
      id: 5,
      name: "Contemporary Dining Table - 8 Seater",
      sku: "FRN-TBL-002",
      category: "Furniture",
      subcategory: "Tables",
      quantity: 8,
      unit: "pcs",
      minStock: 3,
      costPrice: 1200,
      sellingPrice: 2450,
      supplier: "Artisan Woodworks",
      location: "Showroom - Dining",
      lastRestocked: "2025-01-18",
      status: "In Stock",
    },
    {
      id: 6,
      name: "Designer Pendant Light - Brass Globe",
      sku: "LGT-PND-001",
      category: "Lighting",
      subcategory: "Pendant",
      quantity: 35,
      unit: "pcs",
      minStock: 15,
      costPrice: 180,
      sellingPrice: 320,
      supplier: "Illuminate Studio",
      location: "Warehouse B - Section 1",
      lastRestocked: "2025-01-25",
      status: "In Stock",
    },
    {
      id: 7,
      name: "Crystal Chandelier - Contemporary",
      sku: "LGT-CHN-002",
      category: "Lighting",
      subcategory: "Chandeliers",
      quantity: 4,
      unit: "pcs",
      minStock: 5,
      costPrice: 2500,
      sellingPrice: 4850,
      supplier: "Luxe Lighting Studio",
      location: "Warehouse B - Premium",
      lastRestocked: "2025-01-05",
      status: "Low Stock",
    },
    {
      id: 8,
      name: "Velvet Upholstery Fabric - Emerald",
      sku: "TXT-VLV-001",
      category: "Textiles",
      subcategory: "Upholstery",
      quantity: 120,
      unit: "yards",
      minStock: 50,
      costPrice: 45,
      sellingPrice: 85,
      supplier: "Artisan Textiles",
      location: "Warehouse C - Textiles",
      lastRestocked: "2025-01-22",
      status: "In Stock",
    },
    {
      id: 9,
      name: "Linen Drapery Fabric - Natural",
      sku: "TXT-LIN-002",
      category: "Textiles",
      subcategory: "Drapery",
      quantity: 8,
      unit: "yards",
      minStock: 30,
      costPrice: 32,
      sellingPrice: 58,
      supplier: "Premium Fabrics Inc.",
      location: "Warehouse C - Textiles",
      lastRestocked: "2024-12-15",
      status: "Low Stock",
    },
    {
      id: 10,
      name: "Brushed Gold Drawer Pulls",
      sku: "HDW-DRP-001",
      category: "Hardware",
      subcategory: "Cabinet Hardware",
      quantity: 12,
      unit: "pcs",
      minStock: 50,
      costPrice: 18,
      sellingPrice: 35,
      supplier: "Premium Hardware Co.",
      location: "Warehouse B - Section 4",
      lastRestocked: "2024-12-20",
      status: "Low Stock",
    },
    {
      id: 11,
      name: "Matte Black Door Handles - Modern",
      sku: "HDW-DRH-002",
      category: "Hardware",
      subcategory: "Door Hardware",
      quantity: 85,
      unit: "pcs",
      minStock: 30,
      costPrice: 42,
      sellingPrice: 78,
      supplier: "Designer Hardware Ltd.",
      location: "Warehouse B - Section 4",
      lastRestocked: "2025-01-12",
      status: "In Stock",
    },
    {
      id: 12,
      name: "Textured Wallpaper - Geometric",
      sku: "WLL-WPP-001",
      category: "Wall Finishes",
      subcategory: "Wallpaper",
      quantity: 0,
      unit: "rolls",
      minStock: 20,
      costPrice: 85,
      sellingPrice: 145,
      supplier: "Designer Walls Co.",
      location: "Warehouse C - Wall",
      lastRestocked: "2024-11-30",
      status: "Out of Stock",
    },
  ];

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = searchQuery === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "All" || item.category === filterCategory;
    const matchesStatus = filterStatus === "All" || item.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const statusColors = {
    "In Stock": "bg-green-100 text-green-700",
    "Low Stock": "bg-amber-100 text-amber-700",
    "Out of Stock": "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard/stock" className="hover:text-blue-600">Stock & Procurement</Link>
            <span>/</span>
            <span className="text-slate-900">Inventory</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Inventory Management</h1>
          <p className="text-slate-600">Track and manage all design materials and products</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white text-slate-700 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            Export
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            + Add Item
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setFilterCategory(category)}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  filterCategory === category
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          {["All", "In Stock", "Low Stock", "Out of Stock"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                filterStatus === status
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Item</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">SKU</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Quantity</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Cost</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Sell Price</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Supplier</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.location}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">{item.sku}</code>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-slate-900">{item.category}</p>
                      <p className="text-xs text-slate-500">{item.subcategory}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-slate-900">{item.quantity.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">{item.unit} (min: {item.minStock})</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[item.status]}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">${item.costPrice}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">${item.sellingPrice}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{item.supplier}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
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

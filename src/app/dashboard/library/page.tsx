"use client";

import React, { useState } from "react";

interface LibraryItem {
  id: number;
  name: string;
  category: "Furniture" | "Lighting" | "Flooring" | "Wall Finishes" | "Fabrics" | "Decor" | "Fixtures" | "Hardware";
  brand?: string;
  supplier?: string;
  price?: string;
  image?: string;
  colors?: string[];
  dimensions?: string;
  material?: string;
  style: "Modern" | "Contemporary" | "Traditional" | "Minimalist" | "Industrial" | "Scandinavian" | "Luxury";
  savedBy: string;
  savedAt: string;
  projects?: string[];
}

export default function LibraryPage() {
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStyle, setFilterStyle] = useState("All");

  const libraryItems: LibraryItem[] = [
    {
      id: 1,
      name: "Eames Lounge Chair",
      category: "Furniture",
      brand: "Herman Miller",
      supplier: "Design Within Reach",
      price: "$5,495",
      colors: ["#2C2C2C", "#8B4513", "#F5DEB3"],
      dimensions: "33\"W x 33\"D x 33\"H",
      material: "Leather, Molded Plywood",
      style: "Modern",
      savedBy: "Sarah Williams",
      savedAt: "2025-01-25",
      projects: ["Executive Penthouse", "Modern Villa"],
    },
    {
      id: 2,
      name: "Sputnik Chandelier",
      category: "Lighting",
      brand: "Jonathan Adler",
      supplier: "Lumens",
      price: "$1,895",
      colors: ["#FFD700", "#C0C0C0"],
      dimensions: "30\"W x 30\"H",
      material: "Brass, Glass",
      style: "Contemporary",
      savedBy: "Emily Chen",
      savedAt: "2025-01-24",
      projects: ["Art Gallery Space"],
    },
    {
      id: 3,
      name: "Calacatta Gold Marble",
      category: "Flooring",
      brand: "ABC Stone",
      supplier: "Luxury Stone Imports",
      price: "$85/sq ft",
      colors: ["#FFFFFF", "#D4AF37"],
      material: "Natural Marble",
      style: "Luxury",
      savedBy: "David Park",
      savedAt: "2025-01-23",
      projects: ["Wellness Spa Center", "Executive Penthouse"],
    },
    {
      id: 4,
      name: "Venetian Plaster - Pearl",
      category: "Wall Finishes",
      brand: "Venetian Plaster Art",
      supplier: "Specialty Coatings Inc",
      price: "$12/sq ft",
      colors: ["#F8F8FF", "#E8E4C9"],
      material: "Lime-based Plaster",
      style: "Traditional",
      savedBy: "Sarah Williams",
      savedAt: "2025-01-22",
      projects: ["Modern Villa Renovation"],
    },
    {
      id: 5,
      name: "Velvet Performance Fabric",
      category: "Fabrics",
      brand: "Kravet",
      supplier: "Designer Fabrics Direct",
      price: "$125/yard",
      colors: ["#1E3A5F", "#8B0000", "#2E8B57", "#4B0082"],
      material: "Performance Velvet",
      style: "Luxury",
      savedBy: "Jessica Lee",
      savedAt: "2025-01-21",
      projects: ["Downtown Bistro Redesign"],
    },
    {
      id: 6,
      name: "Ceramic Sculptural Vase Set",
      category: "Decor",
      brand: "West Elm",
      supplier: "West Elm Pro",
      price: "$350",
      colors: ["#F5F5DC", "#D2691E"],
      dimensions: "Various sizes",
      material: "Handmade Ceramic",
      style: "Contemporary",
      savedBy: "Emily Chen",
      savedAt: "2025-01-20",
      projects: ["Medical Clinic Interior"],
    },
    {
      id: 7,
      name: "Rainfall Shower System",
      category: "Fixtures",
      brand: "Kohler",
      supplier: "Ferguson",
      price: "$2,450",
      colors: ["#C0C0C0", "#1C1C1C", "#B87333"],
      dimensions: "12\" head",
      material: "Brushed Nickel",
      style: "Modern",
      savedBy: "David Park",
      savedAt: "2025-01-19",
      projects: ["Wellness Spa Center"],
    },
    {
      id: 8,
      name: "Leather Pull Handles",
      category: "Hardware",
      brand: "Turnstyle Designs",
      supplier: "Hardware Renaissance",
      price: "$85 each",
      colors: ["#8B4513", "#000000", "#C4A484"],
      dimensions: "6\" length",
      material: "Brass & Leather",
      style: "Scandinavian",
      savedBy: "Sarah Williams",
      savedAt: "2025-01-18",
      projects: ["Modern Villa Renovation"],
    },
    {
      id: 9,
      name: "Noguchi Coffee Table",
      category: "Furniture",
      brand: "Herman Miller",
      supplier: "Design Within Reach",
      price: "$2,195",
      colors: ["#8B4513", "#2C2C2C"],
      dimensions: "50\"W x 36\"D x 15.75\"H",
      material: "Walnut, Glass",
      style: "Modern",
      savedBy: "Michael Roberts",
      savedAt: "2025-01-17",
      projects: ["Executive Penthouse"],
    },
    {
      id: 10,
      name: "Herringbone Oak Flooring",
      category: "Flooring",
      brand: "Havwoods",
      supplier: "Elite Hardwoods",
      price: "$28/sq ft",
      colors: ["#DEB887", "#A0522D"],
      material: "Engineered Oak",
      style: "Traditional",
      savedBy: "David Park",
      savedAt: "2025-01-16",
      projects: ["Modern Villa Renovation", "Art Gallery Space"],
    },
    {
      id: 11,
      name: "Arc Floor Lamp",
      category: "Lighting",
      brand: "FLOS",
      supplier: "Lumens",
      price: "$2,795",
      colors: ["#C0C0C0", "#1C1C1C"],
      dimensions: "82\"H",
      material: "Marble Base, Steel",
      style: "Minimalist",
      savedBy: "Emily Chen",
      savedAt: "2025-01-15",
      projects: ["Executive Penthouse"],
    },
    {
      id: 12,
      name: "Industrial Pendant Light",
      category: "Lighting",
      brand: "Restoration Hardware",
      supplier: "RH Trade",
      price: "$695",
      colors: ["#4A4A4A", "#B87333"],
      dimensions: "18\" diameter",
      material: "Iron, Brass",
      style: "Industrial",
      savedBy: "Michael Roberts",
      savedAt: "2025-01-14",
      projects: ["Downtown Bistro Redesign"],
    },
  ];

  const filteredItems = libraryItems.filter(item => 
    (filterCategory === "All" || item.category === filterCategory) &&
    (filterStyle === "All" || item.style === filterStyle)
  );

  const categoryColors: Record<string, string> = {
    "Furniture": "bg-amber-100 text-amber-700",
    "Lighting": "bg-yellow-100 text-yellow-700",
    "Flooring": "bg-stone-100 text-stone-700",
    "Wall Finishes": "bg-purple-100 text-purple-700",
    "Fabrics": "bg-pink-100 text-pink-700",
    "Decor": "bg-teal-100 text-teal-700",
    "Fixtures": "bg-blue-100 text-blue-700",
    "Hardware": "bg-slate-100 text-slate-700",
  };

  const styleColors: Record<string, string> = {
    "Modern": "bg-blue-50 text-blue-600 border border-blue-200",
    "Contemporary": "bg-purple-50 text-purple-600 border border-purple-200",
    "Traditional": "bg-amber-50 text-amber-600 border border-amber-200",
    "Minimalist": "bg-slate-50 text-slate-600 border border-slate-200",
    "Industrial": "bg-stone-50 text-stone-600 border border-stone-200",
    "Scandinavian": "bg-green-50 text-green-600 border border-green-200",
    "Luxury": "bg-yellow-50 text-yellow-700 border border-yellow-200",
  };

  const stats = {
    total: libraryItems.length,
    furniture: libraryItems.filter(i => i.category === "Furniture").length,
    lighting: libraryItems.filter(i => i.category === "Lighting").length,
    materials: libraryItems.filter(i => ["Flooring", "Wall Finishes", "Fabrics"].includes(i.category)).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Design Library</h1>
          <p className="text-slate-600">Curated collection of materials, furniture, and finishes</p>
        </div>
        <div className="flex gap-3">
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewType("grid")}
              className={`p-2.5 transition-colors ${viewType === "grid" ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewType("list")}
              className={`p-2.5 transition-colors ${viewType === "list" ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add to Library
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-sm text-slate-600">Total Items</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-amber-600">{stats.furniture}</p>
          <p className="text-sm text-slate-600">Furniture</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-yellow-600">{stats.lighting}</p>
          <p className="text-sm text-slate-600">Lighting</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-stone-600">{stats.materials}</p>
          <p className="text-sm text-slate-600">Materials & Finishes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-600 mb-2">Category</label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {["All", "Furniture", "Lighting", "Flooring", "Wall Finishes", "Fabrics", "Decor", "Fixtures", "Hardware"].map((category) => (
                <button
                  key={category}
                  onClick={() => setFilterCategory(category)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
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
          <div className="md:w-64">
            <label className="block text-sm font-medium text-slate-600 mb-2">Style</label>
            <select
              value={filterStyle}
              onChange={(e) => setFilterStyle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Styles</option>
              <option value="Modern">Modern</option>
              <option value="Contemporary">Contemporary</option>
              <option value="Traditional">Traditional</option>
              <option value="Minimalist">Minimalist</option>
              <option value="Industrial">Industrial</option>
              <option value="Scandinavian">Scandinavian</option>
              <option value="Luxury">Luxury</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewType === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
              {/* Placeholder Image Area */}
              <div className="h-40 bg-linear-to-br from-slate-100 to-slate-50 flex items-center justify-center relative overflow-hidden">
                <div className="text-center">
                  <svg className="w-12 h-12 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-slate-400">Image Preview</p>
                </div>
                {/* Color Swatches */}
                {item.colors && (
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    {item.colors.slice(0, 4).map((color, idx) => (
                      <div
                        key={idx}
                        className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${categoryColors[item.category]}`}>
                    {item.category}
                  </span>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${styleColors[item.style]}`}>
                    {item.style}
                  </span>
                </div>
                
                <h3 className="font-semibold text-slate-900 mb-1">{item.name}</h3>
                <p className="text-sm text-slate-500 mb-2">{item.brand}</p>
                
                {item.price && (
                  <p className="text-lg font-bold text-blue-600 mb-2">{item.price}</p>
                )}
                
                <div className="text-xs text-slate-500 space-y-1">
                  {item.material && <p>Material: {item.material}</p>}
                  {item.dimensions && <p>Size: {item.dimensions}</p>}
                </div>
                
                {item.projects && item.projects.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-400 mb-1">Used in:</p>
                    <div className="flex flex-wrap gap-1">
                      {item.projects.slice(0, 2).map((project) => (
                        <span key={project} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                          {project}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Item</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Brand/Supplier</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Price</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Style</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.material}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${categoryColors[item.category]}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">{item.brand}</p>
                      <p className="text-xs text-slate-500">{item.supplier}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-blue-600">{item.price}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded ${styleColors[item.style]}`}>
                        {item.style}
                      </span>
                    </td>
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
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
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Vendor {
  id: number;
  name: string;
  category: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  status: "Active" | "Inactive" | "Pending";
  rating: number;
  totalOrders: number;
  totalSpent: number;
  paymentTerms: string;
  leadTime: string;
  specialties: string[];
}

export default function VendorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const categories = [
    "All",
    "Flooring",
    "Furniture",
    "Lighting",
    "Textiles",
    "Hardware",
    "Stone & Tile",
    "Custom Millwork",
  ];

  const vendors: Vendor[] = [
    {
      id: 1,
      name: "Nordic Designs Co.",
      category: "Furniture",
      contactPerson: "Thomas Bergström",
      email: "thomas@nordicdesigns.com",
      phone: "+1 (555) 234-5670",
      address: "123 Scandinavian Way, Portland, OR 97201",
      status: "Active",
      rating: 4.9,
      totalOrders: 45,
      totalSpent: 156000,
      paymentTerms: "Net 30",
      leadTime: "4-6 weeks",
      specialties: ["Scandinavian Design", "Sustainable Wood", "Custom Orders"],
    },
    {
      id: 2,
      name: "Mediterranean Stone Imports",
      category: "Stone & Tile",
      contactPerson: "Marco Rossi",
      email: "marco@medstoneimports.com",
      phone: "+1 (555) 345-6780",
      address: "456 Marble Lane, Miami, FL 33101",
      status: "Active",
      rating: 4.8,
      totalOrders: 32,
      totalSpent: 248000,
      paymentTerms: "Net 45",
      leadTime: "6-8 weeks",
      specialties: ["Italian Marble", "Natural Stone", "Custom Cutting"],
    },
    {
      id: 3,
      name: "Illuminate Studio",
      category: "Lighting",
      contactPerson: "Jessica Light",
      email: "jessica@illuminatestudio.com",
      phone: "+1 (555) 456-7891",
      address: "789 Bright Street, Los Angeles, CA 90001",
      status: "Active",
      rating: 4.7,
      totalOrders: 58,
      totalSpent: 89500,
      paymentTerms: "Net 30",
      leadTime: "2-4 weeks",
      specialties: ["Modern Fixtures", "Custom Designs", "Smart Lighting"],
    },
    {
      id: 4,
      name: "Artisan Textiles",
      category: "Textiles",
      contactPerson: "Elena Vasquez",
      email: "elena@artisantextiles.com",
      phone: "+1 (555) 567-8902",
      address: "321 Fabric Row, New York, NY 10001",
      status: "Active",
      rating: 4.6,
      totalOrders: 67,
      totalSpent: 48000,
      paymentTerms: "Net 15",
      leadTime: "1-2 weeks",
      specialties: ["Luxury Fabrics", "Custom Drapery", "Upholstery"],
    },
    {
      id: 5,
      name: "Premium Hardware Co.",
      category: "Hardware",
      contactPerson: "Michael Chen",
      email: "mchen@premiumhardware.com",
      phone: "+1 (555) 678-9013",
      address: "555 Hardware Blvd, Chicago, IL 60601",
      status: "Active",
      rating: 4.5,
      totalOrders: 89,
      totalSpent: 34500,
      paymentTerms: "Net 30",
      leadTime: "1-3 weeks",
      specialties: ["Cabinet Hardware", "Door Hardware", "Custom Finishes"],
    },
    {
      id: 6,
      name: "Luxe Lighting Studio",
      category: "Lighting",
      contactPerson: "Jennifer Wu",
      email: "jennifer@luxelighting.com",
      phone: "+1 (555) 789-0124",
      address: "888 Chandelier Ave, San Francisco, CA 94102",
      status: "Active",
      rating: 4.9,
      totalOrders: 24,
      totalSpent: 185000,
      paymentTerms: "50% Upfront",
      leadTime: "8-12 weeks",
      specialties: ["Crystal Chandeliers", "Bespoke Designs", "High-End Fixtures"],
    },
    {
      id: 7,
      name: "European Flooring Ltd.",
      category: "Flooring",
      contactPerson: "Hans Mueller",
      email: "hans@euroflooring.com",
      phone: "+1 (555) 890-1235",
      address: "222 Parquet Place, Boston, MA 02101",
      status: "Active",
      rating: 4.7,
      totalOrders: 41,
      totalSpent: 178000,
      paymentTerms: "Net 30",
      leadTime: "4-6 weeks",
      specialties: ["Engineered Wood", "Parquet", "European Oak"],
    },
    {
      id: 8,
      name: "Custom Millwork Masters",
      category: "Custom Millwork",
      contactPerson: "Robert Carpenter",
      email: "robert@millworkmasters.com",
      phone: "+1 (555) 901-2346",
      address: "444 Workshop Drive, Seattle, WA 98101",
      status: "Pending",
      rating: 0,
      totalOrders: 0,
      totalSpent: 0,
      paymentTerms: "TBD",
      leadTime: "6-10 weeks",
      specialties: ["Custom Cabinetry", "Built-ins", "Trim & Molding"],
    },
    {
      id: 9,
      name: "Designer Walls Co.",
      category: "Textiles",
      contactPerson: "Amanda Sterling",
      email: "amanda@designerwalls.com",
      phone: "+1 (555) 012-3457",
      address: "777 Pattern Lane, Atlanta, GA 30301",
      status: "Inactive",
      rating: 4.2,
      totalOrders: 12,
      totalSpent: 28000,
      paymentTerms: "Net 30",
      leadTime: "2-3 weeks",
      specialties: ["Wallpaper", "Wall Coverings", "Murals"],
    },
  ];

  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch = searchQuery === "" ||
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.contactPerson.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "All" || vendor.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const statusColors = {
    Active: "bg-green-100 text-green-700",
    Inactive: "bg-slate-100 text-slate-700",
    Pending: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard/stock" className="hover:text-blue-600">Stock & Procurement</Link>
            <span>/</span>
            <span className="text-slate-900">Vendors</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Vendor Directory</h1>
          <p className="text-slate-600">Manage supplier relationships and performance</p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium">
          + Add Vendor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{vendors.length}</p>
          <p className="text-sm text-slate-600">Total Vendors</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-green-600">{vendors.filter(v => v.status === "Active").length}</p>
          <p className="text-sm text-slate-600">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-blue-600">
            ${(vendors.reduce((sum, v) => sum + v.totalSpent, 0) / 1000000).toFixed(2)}M
          </p>
          <p className="text-sm text-slate-600">Total Spend</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-amber-600">
            {(vendors.filter(v => v.rating > 0).reduce((sum, v) => sum + v.rating, 0) / vendors.filter(v => v.rating > 0).length).toFixed(1)}
          </p>
          <p className="text-sm text-slate-600">Avg. Rating</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto">
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
      </div>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVendors.map((vendor) => (
          <div key={vendor.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                  {vendor.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{vendor.name}</h3>
                  <p className="text-sm text-slate-500">{vendor.category}</p>
                </div>
              </div>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[vendor.status]}`}>
                {vendor.status}
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-slate-600">{vendor.contactPerson}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-slate-600">{vendor.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="text-slate-600">{vendor.phone}</span>
              </div>
            </div>

            {vendor.rating > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`w-4 h-4 ${star <= vendor.rating ? "text-amber-400" : "text-slate-200"}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-medium text-slate-600">{vendor.rating}</span>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-slate-900">{vendor.totalOrders}</p>
                  <p className="text-xs text-slate-500">Orders</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">${(vendor.totalSpent / 1000).toFixed(0)}K</p>
                  <p className="text-xs text-slate-500">Total Spent</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1">
              {vendor.specialties.slice(0, 3).map((specialty) => (
                <span key={specialty} className="inline-flex px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                  {specialty}
                </span>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                View Details
              </button>
              <button className="flex-1 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                Create Order
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

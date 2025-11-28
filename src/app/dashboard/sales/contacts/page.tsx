"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Contact {
  id: number;
  name: string;
  company: string;
  role: string;
  email: string;
  phone: string;
  type: "Client" | "Prospect" | "Vendor" | "Partner";
  projects: number;
  totalValue: number;
  lastInteraction: string;
  tags: string[];
  avatar?: string;
}

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("All");

  const contacts: Contact[] = [
    {
      id: 1,
      name: "John Smith",
      company: "Personal",
      role: "Homeowner",
      email: "john.smith@email.com",
      phone: "+1 (555) 123-4567",
      type: "Client",
      projects: 3,
      totalValue: 275000,
      lastInteraction: "2025-01-25",
      tags: ["VIP", "Residential"],
    },
    {
      id: 2,
      name: "Sarah Smith",
      company: "Personal",
      role: "Homeowner",
      email: "sarah.smith@email.com",
      phone: "+1 (555) 123-4568",
      type: "Client",
      projects: 3,
      totalValue: 275000,
      lastInteraction: "2025-01-25",
      tags: ["VIP", "Residential"],
    },
    {
      id: 3,
      name: "Robert Chang",
      company: "Grand Plaza Hotels",
      role: "Facilities Director",
      email: "r.chang@grandplazahotels.com",
      phone: "+1 (555) 876-5432",
      type: "Prospect",
      projects: 0,
      totalValue: 0,
      lastInteraction: "2025-01-25",
      tags: ["Hospitality", "Enterprise"],
    },
    {
      id: 4,
      name: "Dr. Amanda Foster",
      company: "HealthFirst Clinics",
      role: "CEO",
      email: "a.foster@healthfirst.com",
      phone: "+1 (555) 345-6789",
      type: "Client",
      projects: 1,
      totalValue: 95000,
      lastInteraction: "2025-01-24",
      tags: ["Healthcare", "New Client"],
    },
    {
      id: 5,
      name: "James Morrison",
      company: "TechVentures Inc.",
      role: "COO",
      email: "j.morrison@techventures.com",
      phone: "+1 (555) 567-8901",
      type: "Prospect",
      projects: 0,
      totalValue: 0,
      lastInteraction: "2025-01-26",
      tags: ["Corporate", "High Priority"],
    },
    {
      id: 6,
      name: "Maria Santos",
      company: "Bella Cucina Restaurant",
      role: "Owner",
      email: "maria@bellacucina.com",
      phone: "+1 (555) 678-9012",
      type: "Prospect",
      projects: 0,
      totalValue: 0,
      lastInteraction: "2025-01-23",
      tags: ["F&B", "Small Business"],
    },
    {
      id: 7,
      name: "Thomas Bergström",
      company: "Nordic Designs Co.",
      role: "Sales Manager",
      email: "thomas@nordicdesigns.com",
      phone: "+1 (555) 234-5670",
      type: "Vendor",
      projects: 8,
      totalValue: 156000,
      lastInteraction: "2025-01-22",
      tags: ["Furniture", "Preferred Vendor"],
    },
    {
      id: 8,
      name: "Elena Vasquez",
      company: "Artisan Textiles",
      role: "Account Executive",
      email: "elena@artisantextiles.com",
      phone: "+1 (555) 345-6780",
      type: "Vendor",
      projects: 5,
      totalValue: 48000,
      lastInteraction: "2025-01-20",
      tags: ["Textiles", "Custom Fabrics"],
    },
    {
      id: 9,
      name: "Michael Chen",
      company: "Chen & Associates Architects",
      role: "Principal Architect",
      email: "mchen@chenarchitects.com",
      phone: "+1 (555) 456-7891",
      type: "Partner",
      projects: 4,
      totalValue: 520000,
      lastInteraction: "2025-01-24",
      tags: ["Architect", "Referral Partner"],
    },
    {
      id: 10,
      name: "Jennifer Wu",
      company: "Luxe Lighting Studio",
      role: "Lighting Designer",
      email: "jennifer@luxelighting.com",
      phone: "+1 (555) 567-8902",
      type: "Partner",
      projects: 6,
      totalValue: 89000,
      lastInteraction: "2025-01-21",
      tags: ["Lighting", "Specialist"],
    },
  ];

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = searchQuery === "" ||
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "All" || contact.type === filterType;
    return matchesSearch && matchesType;
  });

  const typeColors = {
    Client: "bg-green-100 text-green-700",
    Prospect: "bg-blue-100 text-blue-700",
    Vendor: "bg-purple-100 text-purple-700",
    Partner: "bg-amber-100 text-amber-700",
  };

  const stats = {
    total: contacts.length,
    clients: contacts.filter(c => c.type === "Client").length,
    prospects: contacts.filter(c => c.type === "Prospect").length,
    vendors: contacts.filter(c => c.type === "Vendor").length,
    partners: contacts.filter(c => c.type === "Partner").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard/sales" className="hover:text-blue-600">Sales</Link>
            <span>/</span>
            <span className="text-slate-900">Contacts</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Contacts Directory</h1>
          <p className="text-slate-600">Manage clients, vendors, and business partners</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white text-slate-700 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            Import Contacts
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            + Add Contact
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-sm text-slate-600">Total Contacts</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.clients}</p>
          <p className="text-sm text-slate-600">Clients</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.prospects}</p>
          <p className="text-sm text-slate-600">Prospects</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{stats.vendors}</p>
          <p className="text-sm text-slate-600">Vendors</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.partners}</p>
          <p className="text-sm text-slate-600">Partners</p>
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
                placeholder="Search contacts by name, company, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {["All", "Client", "Prospect", "Vendor", "Partner"].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  filterType === type
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts.map((contact) => (
          <div key={contact.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                {contact.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{contact.name}</h3>
                    <p className="text-sm text-slate-500">{contact.role}</p>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${typeColors[contact.type]}`}>
                    {contact.type}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{contact.company}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-slate-600 truncate">{contact.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="text-slate-600">{contact.phone}</span>
              </div>
            </div>

            {contact.projects > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{contact.projects} project(s)</span>
                  <span className="font-semibold text-slate-900">${(contact.totalValue / 1000).toFixed(0)}K total</span>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-1">
              {contact.tags.map((tag) => (
                <span key={tag} className="inline-flex px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">Last contact: {contact.lastInteraction}</span>
              <div className="flex gap-1">
                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
                <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

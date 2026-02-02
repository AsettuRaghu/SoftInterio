"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Client, CreateClientInput } from "@/types/clients";
import { ClientTypeLabels } from "@/types/clients";

interface ClientSelectorProps {
  selectedClientId: string | null;
  onClientSelect: (
    clientId: string | null,
    clientData?: Partial<Client>
  ) => void;
  // Initial values for new client (from lead form)
  initialName?: string;
  initialPhone?: string;
  initialEmail?: string;
  disabled?: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  display_name: string | null;
  phone: string;
  email: string | null;
  client_type: string;
  city: string | null;
}

export function ClientSelector({
  selectedClientId,
  onClientSelect,
  initialName = "",
  initialPhone = "",
  initialEmail = "",
  disabled = false,
}: ClientSelectorProps) {
  const [mode, setMode] = useState<"search" | "create" | "selected">(
    selectedClientId ? "selected" : "search"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<SearchResult | null>(
    null
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Create form data
  const [createForm, setCreateForm] = useState<CreateClientInput>({
    name: initialName,
    phone: initialPhone,
    email: initialEmail,
    client_type: "individual",
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Fetch selected client details on mount if clientId provided
  useEffect(() => {
    if (selectedClientId && mode === "selected" && !selectedClient) {
      fetchClientDetails(selectedClientId);
    }
  }, [selectedClientId, mode, selectedClient]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search clients with debounce
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/clients?search=${encodeURIComponent(searchQuery)}&limit=10`
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.clients || []);
        }
      } catch (error) {
        console.error("Error searching clients:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery]);

  const fetchClientDetails = async (clientId: string) => {
    try {
      const response = await fetch(`/api/clients/${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedClient(data.client);
      }
    } catch (error) {
      console.error("Error fetching client details:", error);
    }
  };

  const handleSelectClient = (client: SearchResult) => {
    setSelectedClient(client);
    setMode("selected");
    setShowDropdown(false);
    setSearchQuery("");
    onClientSelect(client.id, {
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email || undefined,
    } as Client);
  };

  const handleClearSelection = () => {
    setSelectedClient(null);
    setMode("search");
    onClientSelect(null);
  };

  const handleCreateClient = async () => {
    if (!createForm.name || !createForm.phone) {
      setCreateError("Name and phone are required");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.existingClientId) {
          // Client with phone already exists - select that one
          setCreateError(`Client already exists. Selecting existing client.`);
          fetchClientDetails(data.existingClientId);
          setTimeout(() => {
            setMode("selected");
            onClientSelect(data.existingClientId);
          }, 1500);
          return;
        }
        throw new Error(data.error || "Failed to create client");
      }

      // Success - select the new client
      setSelectedClient(data.client);
      setMode("selected");
      onClientSelect(data.client.id, data.client);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "An error occurred"
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (disabled) {
    return (
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-sm text-slate-500">
          {selectedClient ? selectedClient.name : "No client selected"}
        </p>
      </div>
    );
  }

  // Selected state
  if (mode === "selected" && selectedClient) {
    return (
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">
              {selectedClient.display_name || selectedClient.name}
            </p>
            <p className="text-sm text-slate-600">{selectedClient.phone}</p>
            {selectedClient.email && (
              <p className="text-sm text-slate-500">{selectedClient.email}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClearSelection}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Create mode
  if (mode === "create") {
    return (
      <div className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-green-800">
            Create New Client
          </h4>
          <button
            type="button"
            onClick={() => setMode("search")}
            className="text-xs text-green-600 hover:text-green-800"
          >
            Cancel
          </button>
        </div>

        {createError && (
          <div className="p-2 bg-red-50 text-red-600 text-xs rounded">
            {createError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) =>
                setCreateForm({ ...createForm, name: e.target.value })
              }
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
              placeholder="Client name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={createForm.phone}
              onChange={(e) =>
                setCreateForm({ ...createForm, phone: e.target.value })
              }
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Email
            </label>
            <input
              type="email"
              value={createForm.email || ""}
              onChange={(e) =>
                setCreateForm({ ...createForm, email: e.target.value })
              }
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Type
            </label>
            <select
              value={createForm.client_type}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  client_type: e.target
                    .value as CreateClientInput["client_type"],
                })
              }
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 bg-white"
            >
              {Object.entries(ClientTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreateClient}
          disabled={isCreating}
          className="w-full px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50"
        >
          {isCreating ? "Creating..." : "Create Client"}
        </button>
      </div>
    );
  }

  // Search mode (default)
  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Search clients by name, phone, or email..."
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateForm({
              name: initialName || searchQuery,
              phone: initialPhone,
              email: initialEmail,
              client_type: "individual",
            });
            setMode("create");
          }}
          className="px-3 py-2 text-sm font-medium text-green-600 border border-green-200 hover:bg-green-50 rounded-lg transition-colors whitespace-nowrap"
        >
          + New Client
        </button>
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && searchQuery.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {searchResults.length === 0 ? (
            <div className="p-3 text-sm text-slate-500 text-center">
              {isSearching ? "Searching..." : "No clients found"}
            </div>
          ) : (
            searchResults.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => handleSelectClient(client)}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">
                      {client.display_name || client.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {client.phone}
                      {client.email && ` • ${client.email}`}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 capitalize">
                    {ClientTypeLabels[
                      client.client_type as keyof typeof ClientTypeLabels
                    ] || client.client_type}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ClientSelector;

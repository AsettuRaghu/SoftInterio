"use client";

import React, { useState, useEffect, useRef } from "react";
import type {
  Property,
  CreatePropertyInput,
  PropertyCategory,
  PropertyTypeV2,
} from "@/types/properties";
import {
  PropertyCategoryLabels,
  PropertyTypeLabelsV2,
} from "@/types/properties";

interface PropertySelectorProps {
  selectedPropertyId: string | null;
  onPropertySelect: (
    propertyId: string | null,
    propertyData?: Partial<Property>
  ) => void;
  // Initial values for new property (from lead form)
  initialPropertyName?: string;
  initialCity?: string;
  initialUnitNumber?: string;
  initialCarpetArea?: number;
  disabled?: boolean;
}

interface SearchResult {
  id: string;
  property_name: string;
  category: PropertyCategory;
  property_type: PropertyTypeV2;
  city: string | null;
  locality: string | null;
  unit_number: string | null;
  carpet_area: number | null;
  project_name: string | null;
}

export function PropertySelector({
  selectedPropertyId,
  onPropertySelect,
  initialPropertyName = "",
  initialCity = "",
  initialUnitNumber = "",
  initialCarpetArea,
  disabled = false,
}: PropertySelectorProps) {
  const [mode, setMode] = useState<"search" | "create" | "selected">(
    selectedPropertyId ? "selected" : "search"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<SearchResult | null>(
    null
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Create form data
  const [createForm, setCreateForm] = useState<CreatePropertyInput>({
    property_name: initialPropertyName,
    category: "residential",
    property_type: "apartment",
    city: initialCity,
    unit_number: initialUnitNumber,
    carpet_area: initialCarpetArea,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Fetch selected property details on mount if propertyId provided
  useEffect(() => {
    if (selectedPropertyId && mode === "selected" && !selectedProperty) {
      fetchPropertyDetails(selectedPropertyId);
    }
  }, [selectedPropertyId, mode, selectedProperty]);

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

  // Search properties with debounce
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
          `/api/properties?search=${encodeURIComponent(searchQuery)}&limit=10`
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.properties || []);
        }
      } catch (error) {
        console.error("Error searching properties:", error);
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

  const fetchPropertyDetails = async (propertyId: string) => {
    try {
      const response = await fetch(`/api/properties/${propertyId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedProperty(data.property);
      }
    } catch (error) {
      console.error("Error fetching property details:", error);
    }
  };

  const handleSelectProperty = (property: SearchResult) => {
    setSelectedProperty(property);
    setMode("selected");
    setShowDropdown(false);
    setSearchQuery("");
    onPropertySelect(property.id, {
      id: property.id,
      property_name: property.property_name,
      category: property.category,
      property_type: property.property_type,
      city: property.city,
      locality: property.locality,
      unit_number: property.unit_number,
      carpet_area: property.carpet_area,
    } as Partial<Property>);
  };

  const handleClearSelection = () => {
    setSelectedProperty(null);
    setMode("search");
    onPropertySelect(null);
  };

  const handleCreateProperty = async () => {
    if (!createForm.property_name) {
      setCreateError("Property name is required");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create property");
      }

      // Success - select the new property
      setSelectedProperty(data.property);
      setMode("selected");
      onPropertySelect(data.property.id, data.property);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "An error occurred"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const formatPropertyDisplay = (property: SearchResult) => {
    const parts = [property.property_name];
    if (property.unit_number) parts.push(`Unit ${property.unit_number}`);
    if (property.locality) parts.push(property.locality);
    if (property.city) parts.push(property.city);
    return parts.join(", ");
  };

  if (disabled) {
    return (
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-sm text-slate-500">
          {selectedProperty
            ? formatPropertyDisplay(selectedProperty)
            : "No property selected"}
        </p>
      </div>
    );
  }

  // Selected state
  if (mode === "selected" && selectedProperty) {
    return (
      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">
              {selectedProperty.property_name}
            </p>
            <p className="text-sm text-slate-600">
              {selectedProperty.unit_number &&
                `Unit ${selectedProperty.unit_number}`}
              {selectedProperty.locality && ` • ${selectedProperty.locality}`}
              {selectedProperty.city && ` • ${selectedProperty.city}`}
            </p>
            <p className="text-xs text-slate-500">
              {PropertyCategoryLabels[selectedProperty.category]} •{" "}
              {PropertyTypeLabelsV2[selectedProperty.property_type]}
              {selectedProperty.carpet_area &&
                ` • ${selectedProperty.carpet_area.toLocaleString()} sq.ft`}
            </p>
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
      <div className="space-y-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-purple-800">
            Create New Property
          </h4>
          <button
            type="button"
            onClick={() => setMode("search")}
            className="text-xs text-purple-600 hover:text-purple-800"
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
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Property Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={createForm.property_name}
              onChange={(e) =>
                setCreateForm({ ...createForm, property_name: e.target.value })
              }
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., Prestige Lakeside"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Category
            </label>
            <select
              value={createForm.category}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  category: e.target.value as PropertyCategory,
                })
              }
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 bg-white"
            >
              {(
                Object.entries(PropertyCategoryLabels) as [string, string][]
              ).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Type
            </label>
            <select
              value={createForm.property_type}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  property_type: e.target.value as PropertyTypeV2,
                })
              }
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 bg-white"
            >
              {(Object.entries(PropertyTypeLabelsV2) as [string, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              City
            </label>
            <input
              type="text"
              value={createForm.city || ""}
              onChange={(e) =>
                setCreateForm({ ...createForm, city: e.target.value })
              }
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., Bangalore"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Unit Number
            </label>
            <input
              type="text"
              value={createForm.unit_number || ""}
              onChange={(e) =>
                setCreateForm({ ...createForm, unit_number: e.target.value })
              }
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., A-1502"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Carpet Area (sq.ft)
            </label>
            <input
              type="number"
              value={createForm.carpet_area || ""}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  carpet_area: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., 1500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Locality
            </label>
            <input
              type="text"
              value={createForm.locality || ""}
              onChange={(e) =>
                setCreateForm({ ...createForm, locality: e.target.value })
              }
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., Whitefield"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreateProperty}
          disabled={isCreating}
          className="w-full px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors disabled:opacity-50"
        >
          {isCreating ? "Creating..." : "Create Property"}
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
            placeholder="Search properties by name, city, locality..."
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateForm({
              property_name: initialPropertyName || searchQuery,
              category: "residential",
              property_type: "apartment",
              city: initialCity,
              unit_number: initialUnitNumber,
              carpet_area: initialCarpetArea,
            });
            setMode("create");
          }}
          className="px-3 py-2 text-sm font-medium text-purple-600 border border-purple-200 hover:bg-purple-50 rounded-lg transition-colors whitespace-nowrap"
        >
          + New Property
        </button>
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && searchQuery.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {searchResults.length === 0 ? (
            <div className="p-3 text-sm text-slate-500 text-center">
              {isSearching ? "Searching..." : "No properties found"}
            </div>
          ) : (
            searchResults.map((property) => (
              <button
                key={property.id}
                type="button"
                onClick={() => handleSelectProperty(property)}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">
                      {property.property_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {property.unit_number && `Unit ${property.unit_number}`}
                      {property.locality && ` • ${property.locality}`}
                      {property.city && ` • ${property.city}`}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {PropertyTypeLabelsV2[property.property_type]}
                    {property.carpet_area &&
                      ` • ${property.carpet_area.toLocaleString()} sqft`}
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

export default PropertySelector;

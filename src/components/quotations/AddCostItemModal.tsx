"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { CostItem, CostItemCategory, getMeasurementInfo } from "./types";

interface AddCostItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (costItem: CostItem) => void;
  costItems: CostItem[];
  categories: CostItemCategory[];
}

export function AddCostItemModal({
  isOpen,
  onClose,
  onAdd,
  costItems,
  categories,
}: AddCostItemModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setActiveCategory(null);
    }
  }, [isOpen]);

  // Group cost items by category
  const itemsByCategory = useMemo(() => {
    return costItems.reduce((acc, item) => {
      const catId = item.category_id || "uncategorized";
      if (!acc[catId]) acc[catId] = [];
      acc[catId].push(item);
      return acc;
    }, {} as Record<string, CostItem[]>);
  }, [costItems]);

  // Filter items based on search query
  const filteredItemsByCategory = useMemo(() => {
    if (!searchQuery.trim()) return itemsByCategory;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, CostItem[]> = {};

    Object.entries(itemsByCategory).forEach(([catId, items]) => {
      const matchingItems = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.unit_code?.toLowerCase().includes(query)
      );
      if (matchingItems.length > 0) {
        filtered[catId] = matchingItems;
      }
    });

    return filtered;
  }, [itemsByCategory, searchQuery]);

  // Scroll to category when tab is clicked
  const scrollToCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    setSearchQuery(""); // Clear search when clicking category

    const element = categoryRefs.current[categoryId];
    if (element && listContainerRef.current) {
      const container = listContainerRef.current;
      const elementTop = element.offsetTop - container.offsetTop;
      container.scrollTo({
        top: elementTop - 10,
        behavior: "smooth",
      });
    }
  };

  // Count items per category (filtered)
  const getCategoryCount = (categoryId: string) => {
    return filteredItemsByCategory[categoryId]?.length || 0;
  };

  // Total filtered items
  const totalFilteredItems = Object.values(filteredItemsByCategory).reduce(
    (sum, items) => sum + items.length,
    0
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Add Cost Item
            </h2>
            <p className="text-sm text-slate-500">
              {totalFilteredItems} items available
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <svg
              className="w-6 h-6"
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

        {/* Search Input */}
        <div className="relative mb-4">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveCategory(null);
            }}
            placeholder="Search cost items..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <svg
                className="w-5 h-5"
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
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-slate-200">
          <button
            onClick={() => {
              setActiveCategory(null);
              setSearchQuery("");
              listContainerRef.current?.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
            className={`text-sm px-3 py-1.5 rounded-full transition-colors ${
              !activeCategory && !searchQuery
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({costItems.length})
          </button>
          {categories.map((category) => {
            const count = getCategoryCount(category.id);
            const isActive = activeCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => scrollToCategory(category.id)}
                className={`text-sm px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                  isActive ? "ring-2 ring-offset-1" : "hover:opacity-80"
                }`}
                style={{
                  backgroundColor: isActive
                    ? category.color || "#718096"
                    : `${category.color || "#718096"}20`,
                  color: isActive ? "white" : category.color || "#718096",
                  ...(isActive
                    ? { ringColor: category.color || "#718096" }
                    : {}),
                }}
              >
                {category.name}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? "bg-white/30 text-white"
                      : "bg-white text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Cost Items List */}
        <div ref={listContainerRef} className="flex-1 overflow-auto">
          {totalFilteredItems === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <svg
                className="w-12 h-12 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm">No cost items found for "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery("")}
                className="text-sm text-amber-600 hover:text-amber-700 mt-2"
              >
                Clear search
              </button>
            </div>
          ) : (
            categories.map((category) => {
              const items = filteredItemsByCategory[category.id] || [];
              if (items.length === 0) return null;

              return (
                <div
                  key={category.id}
                  ref={(el) => {
                    categoryRefs.current[category.id] = el;
                  }}
                  id={`category-${category.id}`}
                  className="mb-6"
                >
                  <div
                    className="flex items-center gap-2 mb-3 px-1 sticky top-0 bg-white py-2"
                    style={{
                      borderBottom: `2px solid ${category.color || "#718096"}`,
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color || "#718096" }}
                    />
                    <h3
                      className="text-sm font-semibold uppercase tracking-wide"
                      style={{ color: category.color || "#718096" }}
                    >
                      {category.name}
                    </h3>
                    <span className="text-xs text-slate-400">
                      ({items.length} items)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((item) => {
                      const measureInfo = getMeasurementInfo(item.unit_code);
                      return (
                        <button
                          key={item.id}
                          onClick={() => onAdd(item)}
                          className="p-3 text-left border border-slate-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-colors group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="font-medium text-slate-900 text-sm group-hover:text-amber-700">
                              {item.name}
                            </div>
                            <svg
                              className="w-4 h-4 text-slate-300 group-hover:text-amber-500 shrink-0 ml-2"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-500 uppercase">
                                {item.unit_code}
                              </span>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${measureInfo.color}`}
                              >
                                {measureInfo.label}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-slate-700">
                              ₹{item.default_rate?.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-4">
          <p className="text-xs text-slate-500">
            Click on an item to add it to the component
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

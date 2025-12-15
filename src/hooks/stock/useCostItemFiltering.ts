'use client';

import { useMemo } from 'react';

interface CostItem {
  id: string;
  name: string;
  category: string;
  unitCode: string;
  costPerUnit: number;
  qualityTier?: string;
  lastProcurementDate?: string;
}

interface FilterOptions {
  searchTerm: string;
  category: string;
  unitCode: string;
  qualityTier: string;
}

interface FilterStats {
  total: number;
  byCategory: Record<string, number>;
  byUnit: Record<string, number>;
}

/**
 * Hook for filtering and searching cost items
 * Provides multi-field search, category filtering, unit filtering, and statistics
 */
export function useCostItemFiltering(
  items: CostItem[],
  initialFilters?: Partial<FilterOptions>
) {
  const filters: FilterOptions = {
    searchTerm: initialFilters?.searchTerm || '',
    category: initialFilters?.category || '',
    unitCode: initialFilters?.unitCode || '',
    qualityTier: initialFilters?.qualityTier || '',
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search term filter (name and category)
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const matchesSearch =
          item.name.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (filters.category && item.category !== filters.category) {
        return false;
      }

      // Unit code filter
      if (filters.unitCode && item.unitCode !== filters.unitCode) {
        return false;
      }

      // Quality tier filter
      if (filters.qualityTier && item.qualityTier !== filters.qualityTier) {
        return false;
      }

      return true;
    });
  }, [items, filters]);

  const stats = useMemo<FilterStats>(() => {
    return {
      total: items.length,
      byCategory: items.reduce(
        (acc, item) => {
          acc[item.category] = (acc[item.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      byUnit: items.reduce(
        (acc, item) => {
          acc[item.unitCode] = (acc[item.unitCode] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }, [items]);

  return {
    filteredItems,
    filters,
    stats,
    filteredCount: filteredItems.length,
  };
}

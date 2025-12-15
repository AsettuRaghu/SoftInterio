'use client';

import { useState, useCallback } from 'react';

interface Vendor {
  id: string;
  name: string;
  status: string;
  authorizationLevel?: string;
}

interface FilterOptions {
  searchTerm: string;
  status: string;
  authorizationLevel: string;
}

interface FilterStats {
  total: number;
  byStatus: Record<string, number>;
  byAuthLevel: Record<string, number>;
}

/**
 * Hook for filtering and searching vendors
 * Provides search, status filtering, authorization level filtering, and statistics
 */
export function useVendorFiltering(
  vendors: Vendor[],
  initialFilters?: Partial<FilterOptions>
) {
  const [filters, setFilters] = useState<FilterOptions>({
    searchTerm: initialFilters?.searchTerm || '',
    status: initialFilters?.status || '',
    authorizationLevel: initialFilters?.authorizationLevel || '',
  });

  const updateFilter = useCallback(
    (key: keyof FilterOptions, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const filteredVendors = vendors.filter((vendor) => {
    // Search term filter (name)
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      if (!vendor.name.toLowerCase().includes(term)) return false;
    }

    // Status filter
    if (filters.status && vendor.status !== filters.status) {
      return false;
    }

    // Authorization level filter
    if (
      filters.authorizationLevel &&
      vendor.authorizationLevel !== filters.authorizationLevel
    ) {
      return false;
    }

    return true;
  });

  const stats: FilterStats = {
    total: vendors.length,
    byStatus: vendors.reduce(
      (acc, vendor) => {
        acc[vendor.status] = (acc[vendor.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
    byAuthLevel: vendors.reduce(
      (acc, vendor) => {
        const authLevel = vendor.authorizationLevel || 'none';
        acc[authLevel] = (acc[authLevel] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
  };

  return {
    filteredVendors,
    filters,
    updateFilter,
    stats,
    filteredCount: filteredVendors.length,
  };
}

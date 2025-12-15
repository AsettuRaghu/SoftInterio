'use client';

import { useMemo } from 'react';

interface POItem {
  id: string;
  referenceNumber: string;
  vendorId: string;
  status: string;
  totalAmount: number;
  createdAt?: string;
  deliveryDate?: string;
}

interface FilterOptions {
  searchTerm: string;
  status: string;
  dateRange: { from?: Date; to?: Date };
}

interface FilterStats {
  total: number;
  byStatus: Record<string, number>;
}

/**
 * Hook for filtering and searching purchase orders
 * Provides search, status filtering, date range filtering, and statistics
 */
export function usePurchaseOrderFiltering(
  purchaseOrders: POItem[],
  initialFilters?: Partial<FilterOptions>
) {
  const filters: FilterOptions = {
    searchTerm: initialFilters?.searchTerm || '',
    status: initialFilters?.status || '',
    dateRange: initialFilters?.dateRange || {},
  };

  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      // Search term filter (reference number and vendor)
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const matchesSearch = po.referenceNumber.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status && po.status !== filters.status) {
        return false;
      }

      // Date range filter
      if (filters.dateRange.from || filters.dateRange.to) {
        const poDate = po.createdAt ? new Date(po.createdAt) : null;
        if (!poDate) return false;

        if (filters.dateRange.from && poDate < filters.dateRange.from) {
          return false;
        }

        if (filters.dateRange.to && poDate > filters.dateRange.to) {
          return false;
        }
      }

      return true;
    });
  }, [purchaseOrders, filters]);

  const stats = useMemo<FilterStats>(() => {
    return {
      total: purchaseOrders.length,
      byStatus: purchaseOrders.reduce(
        (acc, po) => {
          acc[po.status] = (acc[po.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }, [purchaseOrders]);

  return {
    filteredPOs,
    filters,
    stats,
    filteredCount: filteredPOs.length,
  };
}

/**
 * useQuotationFiltering Hook
 * Manages quotation filtering, searching, and sorting logic
 */

import { useState, useCallback, useMemo } from "react";
import type { Quotation, QuotationStatus } from "@/types/quotations";
import { PropertyTypeLabels, QuotationStatusLabels } from "@/types/quotations";

export interface UseQuotationFilteringOptions {
  initialStatusFilter?: QuotationStatus | "";
  initialSearchValue?: string;
  filterableFields?: (keyof Quotation)[];
}

export function useQuotationFiltering(
  quotations: Quotation[],
  options: UseQuotationFilteringOptions = {}
) {
  const {
    initialStatusFilter = "",
    initialSearchValue = "",
    filterableFields = [
      "client_name",
      "property_name",
      "quotation_number",
      "title",
    ],
  } = options;

  const [statusFilter, setStatusFilter] = useState<QuotationStatus | "">(
    initialStatusFilter
  );
  const [searchValue, setSearchValue] = useState(initialSearchValue);

  const filterData = useCallback(
    (data: Quotation[], searchTerm: string) => {
      let filtered = data;

      // Apply status filter
      if (statusFilter) {
        filtered = filtered.filter((q) => q.status === statusFilter);
      }

      // Apply search filter
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        filtered = filtered.filter((quotation) => {
          // Check each filterable field
          for (const field of filterableFields) {
            const value = quotation[field];
            if (typeof value === "string" && value.toLowerCase().includes(query)) {
              return true;
            }
          }

          // Also search in derived fields
          if (
            quotation.property_type &&
            PropertyTypeLabels[quotation.property_type]
              ?.toLowerCase()
              .includes(query)
          ) {
            return true;
          }

          if (
            QuotationStatusLabels[quotation.status]
              ?.toLowerCase()
              .includes(query)
          ) {
            return true;
          }

          return false;
        });
      }

      return filtered;
    },
    [statusFilter, filterableFields]
  );

  const filteredData = useMemo(
    () => filterData(quotations, searchValue),
    [quotations, searchValue, filterData]
  );

  const resetFilters = useCallback(() => {
    setStatusFilter("");
    setSearchValue("");
  }, []);

  const hasActiveFilters = statusFilter !== "" || searchValue !== "";

  return {
    // State
    statusFilter,
    searchValue,
    filteredData,
    hasActiveFilters,

    // Setters
    setStatusFilter,
    setSearchValue,
    resetFilters,

    // Stats
    totalCount: quotations.length,
    filteredCount: filteredData.length,
  };
}

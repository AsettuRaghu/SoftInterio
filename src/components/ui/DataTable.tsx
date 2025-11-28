"use client";

import React, { useState, useMemo, useCallback } from "react";

// =====================================================
// TYPES
// =====================================================

export type SortDirection = "asc" | "desc" | null;

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render?: (item: T, index: number) => React.ReactNode;
  getValue?: (item: T) => string | number | Date | null;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: string;
  // Sorting
  defaultSortField?: string;
  defaultSortDirection?: SortDirection;
  onSort?: (field: string, direction: SortDirection) => void;
  // Pagination
  pagination?: boolean;
  itemsPerPage?: number;
  itemsPerPageOptions?: number[];
  // Search
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFields?: string[];
  onSearch?: (query: string) => void;
  // Filtering
  filters?: React.ReactNode;
  // Styling
  className?: string;
  rowClassName?: string | ((item: T, index: number) => string);
  emptyMessage?: string;
  // Loading
  loading?: boolean;
}

// =====================================================
// SORT ICON COMPONENT - Clean, minimal design
// =====================================================

interface SortIconProps {
  direction: SortDirection;
  active: boolean;
}

export const SortIcon: React.FC<SortIconProps> = ({ direction, active }) => {
  return (
    <span className="ml-1.5 inline-flex items-center">
      {direction === "asc" && active ? (
        <svg
          className="w-3.5 h-3.5 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 15l7-7 7 7"
          />
        </svg>
      ) : direction === "desc" && active ? (
        <svg
          className="w-3.5 h-3.5 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      ) : (
        <svg
          className="w-3.5 h-3.5 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 9l4-4 4 4M16 15l-4 4-4-4"
          />
        </svg>
      )}
    </span>
  );
};

// =====================================================
// PAGINATION COMPONENT
// =====================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  startIndex: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (count: number) => void;
  itemsPerPageOptions: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  startIndex,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions,
}) => {
  if (totalItems === 0) return null;

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
      for (let i = 1; i <= maxVisible; i++) pages.push(i);
    } else if (currentPage >= totalPages - 2) {
      for (let i = totalPages - maxVisible + 1; i <= totalPages; i++)
        pages.push(i);
    } else {
      for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
    }

    return pages;
  };

  return (
    <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
      <div className="flex items-center gap-4">
        <p className="text-xs text-slate-600">
          Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
          <span className="font-medium">
            {Math.min(startIndex + itemsPerPage, totalItems)}
          </span>{" "}
          of <span className="font-medium">{totalItems}</span>
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Show:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {itemsPerPageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        {getPageNumbers().map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors min-w-7 ${
              currentPage === pageNum
                ? "bg-blue-600 text-white"
                : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {pageNum}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
};

// =====================================================
// SEARCH INPUT COMPONENT
// =====================================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = "Search...",
}) => {
  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
      )}
    </div>
  );
};

// =====================================================
// FILTER PILLS COMPONENT
// =====================================================

interface FilterPillsProps<T extends string> {
  options: T[];
  selected: T;
  onChange: (value: T) => void;
}

export function FilterPills<T extends string>({
  options,
  selected,
  onChange,
}: FilterPillsProps<T>) {
  return (
    <div className="flex gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            selected === option
              ? "bg-blue-600 text-white"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

// =====================================================
// MAIN DATA TABLE COMPONENT
// =====================================================

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyField,
  defaultSortField,
  defaultSortDirection = "asc",
  onSort,
  pagination = true,
  itemsPerPage: defaultItemsPerPage = 10,
  itemsPerPageOptions = [10, 25, 50, 100],
  searchable = false,
  searchPlaceholder = "Search...",
  searchFields = [],
  onSearch,
  filters,
  className = "",
  rowClassName,
  emptyMessage = "No data found",
  loading = false,
}: DataTableProps<T>) {
  // State
  const [sortField, setSortField] = useState<string | null>(
    defaultSortField || null
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    defaultSortField ? defaultSortDirection : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);

  // Handle sort
  const handleSort = useCallback(
    (field: string) => {
      let newDirection: SortDirection;
      if (sortField !== field) {
        newDirection = "asc";
      } else if (sortDirection === "asc") {
        newDirection = "desc";
      } else {
        newDirection = null;
      }

      setSortField(newDirection ? field : null);
      setSortDirection(newDirection);
      setCurrentPage(1);
      onSort?.(field, newDirection);
    },
    [sortField, sortDirection, onSort]
  );

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setCurrentPage(1);
      onSearch?.(query);
    },
    [onSearch]
  );

  // Handle items per page change
  const handleItemsPerPageChange = useCallback((count: number) => {
    setItemsPerPage(count);
    setCurrentPage(1);
  }, []);

  // Process data (search, sort, paginate)
  const processedData = useMemo(() => {
    let result = [...data];

    // Search filter (client-side if no onSearch handler)
    if (searchQuery && !onSearch && searchFields.length > 0) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        searchFields.some((field) => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(query);
        })
      );
    }

    // Sort
    if (sortField && sortDirection) {
      const column = columns.find((c) => c.key === sortField);
      result.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (column?.getValue) {
          aValue = column.getValue(a);
          bValue = column.getValue(b);
        } else {
          aValue = a[sortField];
          bValue = b[sortField];
        }

        // Handle nulls
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return sortDirection === "asc" ? 1 : -1;
        if (bValue == null) return sortDirection === "asc" ? -1 : 1;

        // Compare
        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortDirection === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (aValue instanceof Date && bValue instanceof Date) {
          return sortDirection === "asc"
            ? aValue.getTime() - bValue.getTime()
            : bValue.getTime() - aValue.getTime();
        }

        return sortDirection === "asc"
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      });
    }

    return result;
  }, [
    data,
    searchQuery,
    onSearch,
    searchFields,
    sortField,
    sortDirection,
    columns,
  ]);

  // Pagination
  const totalItems = processedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = pagination
    ? processedData.slice(startIndex, startIndex + itemsPerPage)
    : processedData;

  // Loading skeleton
  if (loading) {
    return (
      <div
        className={`bg-white rounded-lg border border-slate-200 overflow-hidden ${className}`}
      >
        <div className="animate-pulse">
          <div className="h-12 bg-slate-100 border-b border-slate-200" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 border-b border-slate-100 px-4 py-3">
              <div className="h-4 bg-slate-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 overflow-hidden ${className}`}
    >
      {/* Toolbar */}
      {(searchable || filters) && (
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3 flex-wrap">
          {filters}
          {searchable && (
            <div className="flex-1 max-w-xs ml-auto">
              <SearchInput
                value={searchQuery}
                onChange={handleSearch}
                placeholder={searchPlaceholder}
              />
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={
                    column.sortable ? () => handleSort(column.key) : undefined
                  }
                  className={`px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase ${
                    column.sortable
                      ? "cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      : ""
                  } ${column.headerClassName || ""}`}
                >
                  <div className="flex items-center">
                    {column.header}
                    {column.sortable && (
                      <SortIcon
                        direction={
                          sortField === column.key ? sortDirection : null
                        }
                        active={sortField === column.key}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-slate-500 text-sm"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => {
                const rowClass =
                  typeof rowClassName === "function"
                    ? rowClassName(item, startIndex + index)
                    : rowClassName;

                return (
                  <tr
                    key={item[keyField]}
                    className={`hover:bg-slate-50 transition-colors ${
                      rowClass || ""
                    }`}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-2.5 ${column.className || ""}`}
                      >
                        {column.render
                          ? column.render(item, startIndex + index)
                          : item[column.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          startIndex={startIndex}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={handleItemsPerPageChange}
          itemsPerPageOptions={itemsPerPageOptions}
        />
      )}
    </div>
  );
}

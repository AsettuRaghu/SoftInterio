"use client";

import React, { ReactNode, useState, useMemo } from "react";
import { cn } from "@/utils/cn";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

// =====================================================
// TYPES
// =====================================================

export type SortDirection = "asc" | "desc" | null;

export interface ColumnDefinition<T> {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface SortState {
  column: string | null;
  direction: SortDirection;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

// =====================================================
// SETTINGS TABLE HEADER COMPONENT
// =====================================================

interface TableHeaderProps<T> {
  columns: ColumnDefinition<T>[];
  sortState?: SortState;
  onSort?: (column: string) => void;
  selectable?: boolean;
  allSelected?: boolean;
  onSelectAll?: () => void;
}

function TableHeader<T>({
  columns,
  sortState,
  onSort,
  selectable,
  allSelected,
  onSelectAll,
}: TableHeaderProps<T>) {
  return (
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        {selectable && (
          <th className="w-10 px-3 py-2.5">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onSelectAll}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </th>
        )}
        {columns.map((column) => (
          <th
            key={column.key}
            className={cn(
              "px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider",
              column.sortable &&
                "cursor-pointer select-none hover:bg-slate-100 transition-colors",
              column.headerClassName
            )}
            style={{ width: column.width }}
            onClick={() => column.sortable && onSort?.(column.key)}
          >
            <div className="flex items-center gap-1">
              <span>{column.header}</span>
              {column.sortable && sortState && (
                <span className="flex flex-col">
                  <ChevronUpIcon
                    className={cn(
                      "w-3 h-3 -mb-1",
                      sortState.column === column.key &&
                        sortState.direction === "asc"
                        ? "text-blue-600"
                        : "text-slate-300"
                    )}
                  />
                  <ChevronDownIcon
                    className={cn(
                      "w-3 h-3 -mt-1",
                      sortState.column === column.key &&
                        sortState.direction === "desc"
                        ? "text-blue-600"
                        : "text-slate-300"
                    )}
                  />
                </span>
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
}

// =====================================================
// SETTINGS TABLE ROW COMPONENT
// =====================================================

interface TableRowProps<T> {
  item: T;
  index: number;
  columns: ColumnDefinition<T>[];
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  isClickable?: boolean;
}

function TableRow<T>({
  item,
  index,
  columns,
  selectable,
  selected,
  onSelect,
  onClick,
  isClickable,
}: TableRowProps<T>) {
  return (
    <tr
      className={cn(
        "border-b border-slate-100 last:border-b-0 transition-colors",
        isClickable && "cursor-pointer hover:bg-slate-50",
        selected && "bg-blue-50"
      )}
      onClick={onClick}
    >
      {selectable && (
        <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
        </td>
      )}
      {columns.map((column) => (
        <td
          key={column.key}
          className={cn("px-3 py-3 text-sm text-slate-700", column.className)}
        >
          {column.render
            ? column.render(item, index)
            : (item as Record<string, unknown>)[column.key]?.toString() || "—"}
        </td>
      ))}
    </tr>
  );
}

// =====================================================
// PAGINATION COMPONENT
// =====================================================

interface PaginationProps {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

function Pagination({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const { page, pageSize, total } = pagination;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
      <div className="flex items-center gap-4 text-sm text-slate-600">
        <span>
          Showing {start} to {end} of {total} results
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            page <= 1
              ? "text-slate-300 cursor-not-allowed"
              : "text-slate-600 hover:bg-slate-200"
          )}
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (page <= 3) {
            pageNum = i + 1;
          } else if (page >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = page - 2 + i;
          }
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={cn(
                "w-8 h-8 text-sm rounded-md transition-colors",
                page === pageNum
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-200"
              )}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            page >= totalPages
              ? "text-slate-300 cursor-not-allowed"
              : "text-slate-600 hover:bg-slate-200"
          )}
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// =====================================================
// SEARCH BAR COMPONENT
// =====================================================

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function TableSearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: SearchBarProps) {
  return (
    <div className={cn("relative", className)}>
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

// =====================================================
// EMPTY STATE COMPONENT
// =====================================================

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function TableEmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 text-center max-w-sm mb-4">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

// =====================================================
// TABLE LOADING STATE
// =====================================================

interface TableLoadingProps {
  rows?: number;
  columns?: number;
}

export function TableLoading({ rows = 5, columns = 4 }: TableLoadingProps) {
  return (
    <div className="animate-pulse">
      <div className="border-b border-slate-200 bg-slate-50 py-3 px-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-slate-200 rounded"
              style={{ width: `${100 / columns}%` }}
            />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="border-b border-slate-100 py-4 px-4">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="h-4 bg-slate-100 rounded"
                style={{ width: `${100 / columns}%` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// =====================================================
// MAIN SETTINGS TABLE COMPONENT
// =====================================================

export interface SettingsTableProps<T> {
  data: T[];
  columns: ColumnDefinition<T>[];
  // Identification
  keyExtractor: (item: T) => string | number;
  // Sorting
  sortable?: boolean;
  sortState?: SortState;
  onSort?: (column: string) => void;
  // Selection
  selectable?: boolean;
  selectedKeys?: Set<string | number>;
  onSelectionChange?: (keys: Set<string | number>) => void;
  // Pagination
  pagination?: PaginationState;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  // Search
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  // States
  isLoading?: boolean;
  // Row interaction
  onRowClick?: (item: T) => void;
  // Empty state
  emptyState?: {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
  };
  // Styling
  className?: string;
  containerClassName?: string;
}

export function SettingsTable<T>({
  data,
  columns,
  keyExtractor,
  sortable = false,
  sortState,
  onSort,
  selectable = false,
  selectedKeys = new Set(),
  onSelectionChange,
  pagination,
  onPageChange,
  onPageSizeChange,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  isLoading = false,
  onRowClick,
  emptyState,
  className,
  containerClassName,
}: SettingsTableProps<T>) {
  const allSelected = useMemo(
    () =>
      data.length > 0 &&
      data.every((item) => selectedKeys.has(keyExtractor(item))),
    [data, selectedKeys, keyExtractor]
  );

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange?.(new Set());
    } else {
      const newKeys = new Set(data.map((item) => keyExtractor(item)));
      onSelectionChange?.(newKeys);
    }
  };

  const handleSelect = (key: string | number) => {
    const newKeys = new Set(selectedKeys);
    if (newKeys.has(key)) {
      newKeys.delete(key);
    } else {
      newKeys.add(key);
    }
    onSelectionChange?.(newKeys);
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          "bg-white rounded-lg border border-slate-200 overflow-hidden",
          containerClassName
        )}
      >
        <TableLoading rows={5} columns={columns.length} />
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return (
      <div
        className={cn(
          "bg-white rounded-lg border border-slate-200 overflow-hidden",
          containerClassName
        )}
      >
        <TableEmptyState {...emptyState} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-slate-200 overflow-hidden",
        containerClassName
      )}
    >
      {/* Search Bar */}
      {onSearchChange && (
        <div className="px-4 py-3 border-b border-slate-200">
          <TableSearchBar
            value={searchValue || ""}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            className="max-w-xs"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className={cn("w-full", className)}>
          <TableHeader
            columns={columns}
            sortState={sortable ? sortState : undefined}
            onSort={sortable ? onSort : undefined}
            selectable={selectable}
            allSelected={allSelected}
            onSelectAll={handleSelectAll}
          />
          <tbody className="divide-y divide-slate-100">
            {data.map((item, index) => (
              <TableRow
                key={keyExtractor(item)}
                item={item}
                index={index}
                columns={columns}
                selectable={selectable}
                selected={selectedKeys.has(keyExtractor(item))}
                onSelect={() => handleSelect(keyExtractor(item))}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                isClickable={!!onRowClick}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && onPageChange && (
        <Pagination
          pagination={pagination}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}

// =====================================================
// UTILITY HOOK FOR TABLE SORTING
// =====================================================

export function useTableSort<T>(
  initialColumn: string | null = null,
  initialDirection: SortDirection = null
) {
  const [sortState, setSortState] = useState<SortState>({
    column: initialColumn,
    direction: initialDirection,
  });

  const handleSort = (column: string) => {
    setSortState((prev) => {
      if (prev.column === column) {
        // Cycle through: asc -> desc -> null
        if (prev.direction === "asc") return { column, direction: "desc" };
        if (prev.direction === "desc") return { column: null, direction: null };
      }
      return { column, direction: "asc" };
    });
  };

  const sortData = (
    data: T[],
    sortFn?: (a: T, b: T, column: string, direction: SortDirection) => number
  ) => {
    if (!sortState.column || !sortState.direction) return data;

    return [...data].sort((a, b) => {
      if (sortFn) {
        return sortFn(a, b, sortState.column!, sortState.direction);
      }
      // Default sort by string comparison
      const aVal = (a as Record<string, unknown>)[sortState.column!];
      const bVal = (b as Record<string, unknown>)[sortState.column!];
      const comparison = String(aVal || "").localeCompare(String(bVal || ""));
      return sortState.direction === "asc" ? comparison : -comparison;
    });
  };

  return { sortState, handleSort, sortData };
}

// =====================================================
// UTILITY HOOK FOR TABLE PAGINATION
// =====================================================

export function useTablePagination(initialPageSize = 10) {
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: initialPageSize,
    total: 0,
  });

  const setTotal = (total: number) => {
    setPagination((prev) => ({ ...prev, total }));
  };

  const setPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const setPageSize = (pageSize: number) => {
    setPagination((prev) => ({ ...prev, pageSize, page: 1 }));
  };

  const paginateData = <T,>(data: T[]): T[] => {
    const start = (pagination.page - 1) * pagination.pageSize;
    return data.slice(start, start + pagination.pageSize);
  };

  return { pagination, setTotal, setPage, setPageSize, paginateData };
}

// =====================================================
// UTILITY HOOK FOR TABLE SEARCH
// =====================================================

export function useTableSearch() {
  const [searchValue, setSearchValue] = useState("");

  const filterData = <T,>(
    data: T[],
    searchFields: (keyof T)[],
    customFilter?: (item: T, query: string) => boolean
  ): T[] => {
    if (!searchValue.trim()) return data;

    const query = searchValue.toLowerCase();
    return data.filter((item) => {
      if (customFilter) return customFilter(item, query);
      return searchFields.some((field) => {
        const value = item[field];
        return String(value || "")
          .toLowerCase()
          .includes(query);
      });
    });
  };

  return { searchValue, setSearchValue, filterData };
}

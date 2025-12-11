"use client";

import React, {
  ReactNode,
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { cn } from "@/utils/cn";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";

// =====================================================
// STYLE CONSTANTS (to avoid Tailwind linter conflicts)
// =====================================================

const FILTER_BUTTON_ACTIVE = "bg-blue-50 border-blue-200 text-blue-700";
const FILTER_BUTTON_INACTIVE =
  "bg-white border-slate-200 text-slate-700 hover:bg-slate-50";
const BULK_ACTION_DANGER = "text-red-700 bg-red-50 hover:bg-red-100";
const BULK_ACTION_DEFAULT = "text-slate-700 bg-slate-100 hover:bg-slate-200";

// =====================================================
// TYPES
// =====================================================

export type SortDirection = "asc" | "desc" | null;

export interface ColumnDef<T> {
  /** Unique column key */
  key: string;
  /** Column header text */
  header: string;
  /** Fixed width (e.g., "120px", "10%") */
  width?: string;
  /** Min width */
  minWidth?: string;
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Custom cell renderer */
  render?: (item: T, index: number) => ReactNode;
  /** Cell className */
  className?: string;
  /** Header className */
  headerClassName?: string;
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Hide on mobile screens */
  hideOnMobile?: boolean;
  /** Make column sticky */
  sticky?: "left" | "right";
  /** Get sortable value (for custom sorting) */
  getValue?: (item: T) => string | number | Date | null;
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

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
  multiple?: boolean;
}

export interface BulkAction {
  key: string;
  label: string;
  icon?: ReactNode;
  variant?: "default" | "danger";
  onClick: (selectedKeys: Set<string | number>) => void;
}

// =====================================================
// SORT ICON COMPONENT
// =====================================================

function SortIcon({
  column,
  sortState,
}: {
  column: string;
  sortState?: SortState;
}) {
  const isActive = sortState?.column === column;

  return (
    <span className="flex flex-col ml-1">
      <ChevronUpIcon
        className={cn(
          "w-3 h-3 -mb-1 transition-colors",
          isActive && sortState?.direction === "asc"
            ? "text-blue-600"
            : "text-slate-300"
        )}
      />
      <ChevronDownIcon
        className={cn(
          "w-3 h-3 -mt-1 transition-colors",
          isActive && sortState?.direction === "desc"
            ? "text-blue-600"
            : "text-slate-300"
        )}
      />
    </span>
  );
}

// =====================================================
// TABLE TOOLBAR COMPONENT
// =====================================================

interface TableToolbarProps {
  // Search
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  // Filters
  filters?: FilterDef[];
  filterValues?: Record<string, string | string[]>;
  onFilterChange?: (key: string, value: string | string[]) => void;
  // Tabs
  tabs?: FilterOption[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  // Bulk actions
  selectedCount?: number;
  bulkActions?: BulkAction[];
  selectedKeys?: Set<string | number>;
  // Export
  onExport?: () => void;
  // Custom actions
  actions?: ReactNode;
}

function TableToolbar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  filterValues = {},
  onFilterChange,
  tabs,
  activeTab,
  onTabChange,
  selectedCount = 0,
  bulkActions,
  selectedKeys,
  onExport,
  actions,
}: TableToolbarProps) {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = useMemo(() => {
    return Object.values(filterValues).some((v) =>
      Array.isArray(v) ? v.length > 0 : v !== ""
    );
  }, [filterValues]);

  return (
    <div className="border-b border-slate-200 shrink-0">
      {/* Tabs Row */}
      {tabs && tabs.length > 0 && (
        <div className="px-4 pt-2 flex items-center gap-1 border-b border-slate-100">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onTabChange?.(tab.value)}
              className={cn(
                "px-3 py-2 text-xs font-medium rounded-t-lg transition-colors relative",
                activeTab === tab.value
                  ? "text-blue-600 bg-blue-50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full",
                    activeTab === tab.value
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  {tab.count}
                </span>
              )}
              {activeTab === tab.value && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main Toolbar Row */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          {/* Bulk Actions (when items selected) */}
          {selectedCount > 0 && bulkActions && bulkActions.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-700">
                {selectedCount} selected
              </span>
              {bulkActions.map((action) => {
                const variantClasses =
                  action.variant === "danger"
                    ? BULK_ACTION_DANGER
                    : BULK_ACTION_DEFAULT;
                return (
                  <button
                    key={action.key}
                    onClick={() => selectedKeys && action.onClick(selectedKeys)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors",
                      variantClasses
                    )}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {/* Search */}
              {onSearchChange && (
                <div className="relative w-64">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-8 pr-8 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                  {searchValue && (
                    <button
                      onClick={() => onSearchChange("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100"
                    >
                      <XMarkIcon className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}
                </div>
              )}

              {/* Filter Button */}
              {filters &&
                filters.length > 0 &&
                (() => {
                  const filterButtonClasses = hasActiveFilters
                    ? FILTER_BUTTON_ACTIVE
                    : FILTER_BUTTON_INACTIVE;
                  return (
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${filterButtonClasses}`}
                    >
                      <FunnelIcon className="w-3.5 h-3.5" />
                      Filters
                      {hasActiveFilters && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      )}
                    </button>
                  );
                })()}
            </>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {onExport && (
            <button
              onClick={onExport}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />
              Export
            </button>
          )}
          {actions}
        </div>
      </div>

      {/* Expanded Filters Panel */}
      {showFilters && filters && (
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-3">
          {filters.map((filter) => (
            <div key={filter.key} className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">
                {filter.label}:
              </label>
              <select
                value={
                  Array.isArray(filterValues[filter.key])
                    ? (filterValues[filter.key] as string[])[0] || ""
                    : (filterValues[filter.key] as string) || ""
                }
                onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
                className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {hasActiveFilters && (
            <button
              onClick={() => {
                filters.forEach((f) => onFilterChange?.(f.key, ""));
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================
// TABLE HEADER COMPONENT
// =====================================================

interface TableHeaderProps<T> {
  columns: ColumnDef<T>[];
  sortState?: SortState;
  onSort?: (column: string) => void;
  selectable?: boolean;
  allSelected?: boolean;
  someSelected?: boolean;
  onSelectAll?: () => void;
}

function TableHeader<T>({
  columns,
  sortState,
  onSort,
  selectable,
  allSelected,
  someSelected,
  onSelectAll,
}: TableHeaderProps<T>) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = Boolean(someSelected && !allSelected);
    }
  }, [someSelected, allSelected]);

  return (
    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
      <tr>
        {selectable && (
          <th className="w-10 px-3 py-2.5">
            <input
              ref={checkboxRef}
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
              column.align === "center" && "text-center",
              column.align === "right" && "text-right",
              column.hideOnMobile && "hidden md:table-cell",
              column.sticky && "sticky bg-slate-50 z-20",
              column.sticky === "left" && "left-0",
              column.sticky === "right" && "right-0",
              column.headerClassName
            )}
            style={{ width: column.width, minWidth: column.minWidth }}
            onClick={() => column.sortable && onSort?.(column.key)}
          >
            <div
              className={cn(
                "flex items-center gap-1",
                column.align === "center" && "justify-center",
                column.align === "right" && "justify-end"
              )}
            >
              <span>{column.header}</span>
              {column.sortable && (
                <SortIcon column={column.key} sortState={sortState} />
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
}

// =====================================================
// TABLE ROW COMPONENT
// =====================================================

interface TableRowProps<T> {
  item: T;
  index: number;
  columns: ColumnDef<T>[];
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  isClickable?: boolean;
  rowClassName?: string;
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
  rowClassName,
}: TableRowProps<T>) {
  return (
    <tr
      className={cn(
        "border-b border-slate-100 last:border-b-0 transition-colors",
        isClickable && "cursor-pointer hover:bg-slate-50",
        selected && "bg-blue-50 hover:bg-blue-50",
        rowClassName
      )}
      onClick={onClick}
    >
      {selectable && (
        <td className="w-10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
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
          className={cn(
            "px-3 py-2.5 text-sm text-slate-700",
            column.align === "center" && "text-center",
            column.align === "right" && "text-right",
            column.hideOnMobile && "hidden md:table-cell",
            column.sticky && "sticky z-10",
            column.sticky === "left" && "left-0",
            column.sticky === "right" && "right-0",
            column.sticky && !selected && "bg-white",
            selected && column.sticky && "bg-blue-50",
            column.className
          )}
        >
          {column.render
            ? column.render(item, index)
            : String((item as Record<string, unknown>)[column.key] ?? "—")}
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

function TablePagination({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const { page, pageSize, total } = pagination;
  const totalPages = Math.ceil(total / pageSize);
  const start = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/50 shrink-0">
      <div className="flex items-center gap-4 text-xs text-slate-600">
        <span>
          Showing <span className="font-medium">{start}</span> to{" "}
          <span className="font-medium">{end}</span> of{" "}
          <span className="font-medium">{total}</span>
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                "w-8 h-8 text-xs font-medium rounded-md transition-colors",
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
// LOADING SKELETON
// =====================================================

interface TableLoadingProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

function TableLoading({
  rows = 5,
  columns = 4,
  showHeader = true,
}: TableLoadingProps) {
  return (
    <div className="animate-pulse flex-1">
      {showHeader && (
        <div className="border-b border-slate-200 bg-slate-50 py-3 px-4">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, i) => (
              <div
                key={i}
                className="h-3 bg-slate-200 rounded"
                style={{ width: `${100 / columns}%` }}
              />
            ))}
          </div>
        </div>
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="border-b border-slate-100 py-3.5 px-4">
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
// EMPTY STATE
// =====================================================

interface TableEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

function TableEmptyState({
  icon,
  title,
  description,
  action,
}: TableEmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
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
// ROW ACTIONS DROPDOWN
// =====================================================

interface RowAction<T> {
  key: string;
  label: string;
  icon?: ReactNode;
  variant?: "default" | "danger";
  onClick: (item: T) => void;
}

interface RowActionsDropdownProps<T> {
  item: T;
  actions: RowAction<T>[];
}

export function RowActionsDropdown<T>({
  item,
  actions,
}: RowActionsDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
      >
        <EllipsisVerticalIcon className="w-4 h-4 text-slate-500" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-50">
          {actions.map((action) => (
            <button
              key={action.key}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick(item);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors",
                action.variant === "danger"
                  ? "text-red-600 hover:bg-red-50"
                  : "text-slate-700 hover:bg-slate-50"
              )}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// MAIN APP TABLE COMPONENT
// =====================================================

export interface AppTableProps<T> {
  /** Data items to display */
  data: T[];
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Unique key extractor */
  keyExtractor: (item: T) => string | number;

  // Toolbar
  /** Show toolbar */
  showToolbar?: boolean;
  /** Search value */
  searchValue?: string;
  /** Search change handler */
  onSearchChange?: (value: string) => void;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Filter definitions */
  filters?: FilterDef[];
  /** Filter values */
  filterValues?: Record<string, string | string[]>;
  /** Filter change handler */
  onFilterChange?: (key: string, value: string | string[]) => void;
  /** Tab filters */
  tabs?: FilterOption[];
  /** Active tab */
  activeTab?: string;
  /** Tab change handler */
  onTabChange?: (value: string) => void;
  /** Export handler */
  onExport?: () => void;
  /** Custom toolbar actions */
  toolbarActions?: ReactNode;

  // Sorting
  /** Enable sorting */
  sortable?: boolean;
  /** Sort state */
  sortState?: SortState;
  /** Sort change handler */
  onSort?: (column: string) => void;

  // Selection
  /** Enable row selection */
  selectable?: boolean;
  /** Selected item keys */
  selectedKeys?: Set<string | number>;
  /** Selection change handler */
  onSelectionChange?: (keys: Set<string | number>) => void;
  /** Bulk actions */
  bulkActions?: BulkAction[];

  // Pagination
  /** Pagination state */
  pagination?: PaginationState;
  /** Page change handler */
  onPageChange?: (page: number) => void;
  /** Page size change handler */
  onPageSizeChange?: (pageSize: number) => void;

  // Row interaction
  /** Row click handler */
  onRowClick?: (item: T) => void;
  /** Row className function */
  rowClassName?: (item: T, index: number) => string;

  // States
  /** Loading state */
  isLoading?: boolean;
  /** Empty state config */
  emptyState?: {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
  };

  // Styling
  /** Table className */
  className?: string;
  /** Container className */
  containerClassName?: string;
  /** Make table fit within container height */
  stickyHeader?: boolean;
}

export function AppTable<T>({
  data,
  columns,
  keyExtractor,
  showToolbar = true,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  filterValues,
  onFilterChange,
  tabs,
  activeTab,
  onTabChange,
  onExport,
  toolbarActions,
  sortable = false,
  sortState,
  onSort,
  selectable = false,
  selectedKeys = new Set(),
  onSelectionChange,
  bulkActions,
  pagination,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  rowClassName,
  isLoading = false,
  emptyState,
  className,
  containerClassName,
  stickyHeader = true,
}: AppTableProps<T>) {
  // Selection state
  const allSelected = useMemo(
    () =>
      data.length > 0 &&
      data.every((item) => selectedKeys.has(keyExtractor(item))),
    [data, selectedKeys, keyExtractor]
  );

  const someSelected = useMemo(
    () => data.some((item) => selectedKeys.has(keyExtractor(item))),
    [data, selectedKeys, keyExtractor]
  );

  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      const newKeys = new Set(data.map((item) => keyExtractor(item)));
      onSelectionChange(newKeys);
    }
  }, [allSelected, data, keyExtractor, onSelectionChange]);

  const handleSelect = useCallback(
    (key: string | number) => {
      if (!onSelectionChange) return;
      const newKeys = new Set(selectedKeys);
      if (newKeys.has(key)) {
        newKeys.delete(key);
      } else {
        newKeys.add(key);
      }
      onSelectionChange(newKeys);
    },
    [selectedKeys, onSelectionChange]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex flex-col", containerClassName)}>
        {showToolbar && (
          <div className="px-4 py-2.5 border-b border-slate-200 shrink-0">
            <div className="h-8 w-64 bg-slate-100 rounded animate-pulse" />
          </div>
        )}
        <TableLoading rows={5} columns={columns.length} showHeader />
      </div>
    );
  }

  // Empty state
  if (data.length === 0 && emptyState) {
    return (
      <div className={cn("flex flex-col", containerClassName)}>
        {showToolbar && (onSearchChange || tabs) && (
          <TableToolbar
            searchValue={searchValue}
            onSearchChange={onSearchChange}
            searchPlaceholder={searchPlaceholder}
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
            actions={toolbarActions}
          />
        )}
        <TableEmptyState {...emptyState} />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", containerClassName)}>
      {/* Toolbar */}
      {showToolbar &&
        (onSearchChange || tabs || filters || onExport || toolbarActions) && (
          <TableToolbar
            searchValue={searchValue}
            onSearchChange={onSearchChange}
            searchPlaceholder={searchPlaceholder}
            filters={filters}
            filterValues={filterValues}
            onFilterChange={onFilterChange}
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
            selectedCount={selectedKeys.size}
            bulkActions={bulkActions}
            selectedKeys={selectedKeys}
            onExport={onExport}
            actions={toolbarActions}
          />
        )}

      {/* Table - overflow-x-auto for horizontal scroll, overflow-y-visible for dropdowns */}
      <div className={cn("flex-1 overflow-x-auto", stickyHeader && "relative")}>
        <table className={cn("w-full", className)}>
          <TableHeader
            columns={columns}
            sortState={sortable ? sortState : undefined}
            onSort={sortable ? onSort : undefined}
            selectable={selectable}
            allSelected={allSelected}
            someSelected={someSelected}
            onSelectAll={handleSelectAll}
          />
          <tbody>
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
                rowClassName={rowClassName?.(item, index)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && onPageChange && (
        <TablePagination
          pagination={pagination}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}

// =====================================================
// UTILITY HOOKS
// =====================================================

/**
 * Hook for managing table sort state
 */
export function useAppTableSort<T = unknown>(
  initialColumn: string | null = null,
  initialDirection: SortDirection = null
) {
  const [sortState, setSortState] = useState<SortState>({
    column: initialColumn,
    direction: initialDirection,
  });

  const handleSort = useCallback((column: string) => {
    setSortState((prev) => {
      if (prev.column === column) {
        if (prev.direction === "asc") return { column, direction: "desc" };
        if (prev.direction === "desc") return { column: null, direction: null };
      }
      return { column, direction: "asc" };
    });
  }, []);

  const sortData = useCallback(
    (
      data: T[],
      getValue?: (item: T, column: string) => string | number | Date | null
    ) => {
      if (!sortState.column || !sortState.direction) return data;

      return [...data].sort((a, b) => {
        let aVal: unknown;
        let bVal: unknown;

        if (getValue) {
          aVal = getValue(a, sortState.column!);
          bVal = getValue(b, sortState.column!);
        } else {
          aVal = (a as Record<string, unknown>)[sortState.column!];
          bVal = (b as Record<string, unknown>)[sortState.column!];
        }

        // Handle nulls
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortState.direction === "asc" ? 1 : -1;
        if (bVal == null) return sortState.direction === "asc" ? -1 : 1;

        // Compare
        if (typeof aVal === "string" && typeof bVal === "string") {
          const result = aVal.localeCompare(bVal);
          return sortState.direction === "asc" ? result : -result;
        }

        if (aVal instanceof Date && bVal instanceof Date) {
          const result = aVal.getTime() - bVal.getTime();
          return sortState.direction === "asc" ? result : -result;
        }

        const result = (aVal as number) - (bVal as number);
        return sortState.direction === "asc" ? result : -result;
      });
    },
    [sortState]
  );

  return { sortState, handleSort, sortData, setSortState };
}

/**
 * Hook for managing table pagination
 */
export function useAppTablePagination<T = unknown>(
  data: T[] = [],
  initialPageSize = 10
) {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const total = data.length;
  const totalPages = Math.ceil(total / pageSize);

  // Auto-adjust page if out of bounds
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPageState(totalPages);
    }
  }, [page, totalPages]);

  const pagination: PaginationState = useMemo(
    () => ({ page, pageSize, total }),
    [page, pageSize, total]
  );

  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, newPage));
  }, []);

  const setPageSize = useCallback((newSize: number) => {
    setPageSizeState(newSize);
    setPageState(1);
  }, []);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  return { paginatedData, pagination, setPage, setPageSize, totalPages };
}

/**
 * Hook for managing table search/filter
 */
export function useAppTableSearch<T = unknown>(searchFields: (keyof T)[] = []) {
  const [searchValue, setSearchValue] = useState("");

  const filterData = useCallback(
    (data: T[], customFilter?: (item: T, query: string) => boolean): T[] => {
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
    },
    [searchValue, searchFields]
  );

  return { searchValue, setSearchValue, filterData };
}

/**
 * Hook for managing table selection
 */
export function useAppTableSelection<T>(
  keyExtractor: (item: T) => string | number
) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string | number>>(
    new Set()
  );

  const isSelected = useCallback(
    (item: T) => selectedKeys.has(keyExtractor(item)),
    [selectedKeys, keyExtractor]
  );

  const toggleSelection = useCallback(
    (item: T) => {
      const key = keyExtractor(item);
      setSelectedKeys((prev) => {
        const newKeys = new Set(prev);
        if (newKeys.has(key)) {
          newKeys.delete(key);
        } else {
          newKeys.add(key);
        }
        return newKeys;
      });
    },
    [keyExtractor]
  );

  const selectAll = useCallback(
    (items: T[]) => {
      setSelectedKeys(new Set(items.map(keyExtractor)));
    },
    [keyExtractor]
  );

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  return {
    selectedKeys,
    setSelectedKeys,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
  };
}

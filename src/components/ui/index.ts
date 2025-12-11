// =====================================================
// UI COMPONENTS INDEX
// =====================================================

// Layout Components
export {
  PageLayout,
  PageHeader,
  PageContent,
  Breadcrumbs,
  StatusBadge,
  StatBadge,
  Alert,
  EmptyState,
} from "./PageLayout";

export type { BreadcrumbItem } from "./PageLayout";

export {
  SettingsPageLayout,
  SettingsPageHeader,
  SettingsPageContent,
} from "./SettingsPageLayout";

// Table Components
export {
  AppTable,
  useAppTableSort,
  useAppTablePagination,
  useAppTableSearch,
  useAppTableSelection,
} from "./AppTable";

export type {
  ColumnDef,
  SortState,
  PaginationState,
  FilterOption,
  FilterDef,
  BulkAction,
} from "./AppTable";

export {
  SettingsTable,
  useTableSort,
  useTablePagination,
  useTableSearch,
  TableSearchBar,
  TableEmptyState,
  TableLoading,
} from "./SettingsTable";

export { DataTable } from "./DataTable";

/**
 * Central export for all types
 */

// Database types
export * from "./database.types";

// Lead types (has PropertyType, PropertyCategory, Client, Property for leads)
export * from "./leads";

// Property types - explicit exports to avoid conflicts with leads.ts
export type {
  PropertyTypeV2,
  Property as PropertyRecord,
  PropertyDetails,
  CreatePropertyInput,
  PropertyCategory,
  PropertySubtype,
} from "./properties";

export {
  PropertyTypeLabelsV2,
  PropertyTypeCategory,
  ResidentialPropertyTypes,
  CommercialPropertyTypes,
  PropertyCategoryLabels,
  PropertySubtypeLabels,
} from "./properties";

// Client types - explicit exports to avoid conflicts with leads.ts
export type {
  ClientType,
  ClientStatus,
  Client as ClientRecord,
  ClientDetails,
  CreateClientInput,
  UpdateClientInput,
  PreferredContactMethod,
  PreferredContactTime,
} from "./clients";

export {
  ClientTypeLabels,
  ClientStatusLabels,
  ClientStatusColors,
  PreferredContactMethodLabels,
  PreferredContactTimeLabels,
} from "./clients";

// Notification types
export * from "./notifications";

// Task types
export * from "./tasks";

// Note: Quotation types are NOT re-exported here due to naming conflicts with leads.
// Import directly from "@/types/quotations" when needed.
// The conflict is: PropertyType and PropertyTypeLabels exist in both leads.ts and quotations.ts

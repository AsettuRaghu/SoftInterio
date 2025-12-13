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
  OwnershipType,
  PropertyStatus,
  FacingDirection,
  AreaUnit,
  FurnishingStatus,
  Property as PropertyRecord,
  PropertyDetails,
  CreatePropertyInput,
} from "./properties";

export {
  PropertyTypeLabelsV2,
  OwnershipTypeLabels,
  PropertyStatusLabels,
  FacingDirectionLabels,
  AreaUnitLabels,
  FurnishingStatusLabels,
  PropertyTypeCategory,
  ResidentialPropertyTypes,
  CommercialPropertyTypes,
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

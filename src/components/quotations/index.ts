// Export all quotation builder components
export * from "./types";
export { AddSpaceModal } from "./AddSpaceModal";
export { AddComponentModal } from "./AddComponentModal";
export { AddCostItemModal } from "./AddCostItemModal";
export { LineItemRow } from "./LineItemRow";
export { ComponentCard } from "./ComponentCard";
export { SpaceCard } from "./SpaceCard";
export { BuilderSidebar } from "./BuilderSidebar";
export { TemplateSelector, TemplateModal } from "./TemplateSelector";
export type { Template } from "./TemplateSelector";
export { ScopeSelector, isInScope, defaultScope } from "./ScopeSelector";
export type { ScopeMode, ScopeSelection } from "./ScopeSelector";
export { PricingScenariosModal } from "./PricingScenariosModal";
// Legacy exports (deprecated - use PricingScenariosModal instead)
export { PriceAdjustmentModal } from "./PriceAdjustmentModal";
export { MaterialSwapModal } from "./MaterialSwapModal";

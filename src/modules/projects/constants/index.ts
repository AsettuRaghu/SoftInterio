// Export all project constants
export {
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_OPTIONS,
  ACTIVE_STATUSES,
  PROJECT_PRIORITY_COLORS,
  PROJECT_PRIORITY_OPTIONS,
  PROJECT_PHASE_COLORS,
  PROJECT_PHASE_OPTIONS,
  PROJECT_CATEGORY_COLORS,
  PROJECT_CATEGORY_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  PHASE_STATUS_COLORS,
  SUB_PHASE_STATUS_COLORS,
  STANDARD_PHASES,
  type TeamMember,
} from "./projectsConstants";

// ProjectDetailTab lives in @/types/projects, which is where the detail page
// reads it. Two more copies used to sit here - one an eleven-key union, one a
// nine-key ProjectDetailTabType with its own tab array - and none of the three
// agreed. Nothing outside this directory imported either of the local ones.

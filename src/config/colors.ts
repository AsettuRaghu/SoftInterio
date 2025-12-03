/**
 * Master Color Configuration
 * Central color palette for consistent theming across the application
 */

export const colors = {
  // Page Backgrounds
  page: {
    background: "bg-white",
    backgroundAlt: "bg-slate-50",
  },

  // Text Colors
  text: {
    primary: "text-slate-900",
    secondary: "text-slate-600",
    tertiary: "text-slate-500",
    muted: "text-slate-400",
    link: "text-blue-600",
    linkHover: "hover:text-blue-700",
  },

  // Borders
  border: {
    default: "border-slate-200",
    light: "border-slate-100",
    focus: "border-blue-500",
    hover: "hover:border-slate-300",
  },

  // Buttons
  button: {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary:
      "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    active: "bg-blue-600 text-white shadow-sm",
    disabled: "opacity-50 cursor-not-allowed",
  },

  // Status Colors
  status: {
    todo: "bg-slate-50 text-slate-700 border-slate-200",
    inProgress: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-green-50 text-green-700 border-green-200",
    onHold: "bg-yellow-50 text-yellow-700 border-yellow-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
  },

  // Priority Colors
  priority: {
    low: "bg-slate-50 text-slate-700 border-slate-200",
    medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    urgent: "bg-red-50 text-red-700 border-red-200",
  },

  // State Colors
  state: {
    success: "text-green-600",
    error: "text-red-600",
    warning: "text-yellow-600",
    info: "text-blue-600",
  },

  // Component Backgrounds
  component: {
    card: "bg-white border border-slate-200",
    hover: "hover:bg-slate-50",
    active: "bg-slate-50",
    focus: "focus:ring-2 focus:ring-blue-500",
  },

  // Table
  table: {
    header: "bg-white text-slate-600",
    row: "hover:bg-slate-50",
    border: "divide-slate-100 border-slate-200",
  },

  // Form Elements
  form: {
    input:
      "bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
    inputHover: "hover:border-slate-300",
    label: "text-slate-700",
    error: "border-red-300 text-red-600",
  },
} as const;

/**
 * Spacing Configuration
 * Consistent spacing values across the application
 */
export const spacing = {
  page: {
    padding: "px-6 py-3",
    paddingCompact: "px-4 py-2",
    gap: "space-y-3",
  },
  section: {
    padding: "p-4",
    paddingCompact: "p-3",
    gap: "space-y-2",
  },
  component: {
    padding: "px-3 py-1.5",
    paddingSmall: "px-2 py-1",
    gap: "gap-2",
    gapSmall: "gap-1",
  },
} as const;

/**
 * Typography Configuration
 */
export const typography = {
  heading: {
    h1: "text-xl font-semibold",
    h2: "text-lg font-semibold",
    h3: "text-base font-semibold",
  },
  body: {
    default: "text-sm",
    small: "text-xs",
    large: "text-base",
  },
  weight: {
    normal: "font-normal",
    medium: "font-medium",
    semibold: "font-semibold",
    bold: "font-bold",
  },
} as const;

/**
 * Border Radius Configuration
 */
export const radius = {
  none: "rounded-none",
  small: "rounded",
  default: "rounded-md",
  large: "rounded-lg",
  full: "rounded-full",
} as const;

/**
 * Shadow Configuration
 */
export const shadows = {
  none: "",
  small: "shadow-sm",
  default: "shadow",
  medium: "shadow-md",
  large: "shadow-lg",
} as const;

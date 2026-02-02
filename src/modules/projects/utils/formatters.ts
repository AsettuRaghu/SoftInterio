// Format currency in INR
export const formatCurrency = (amount: number | null | undefined): string => {
  if (!amount) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date to DD MMM YYYY
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

// Format date and time to DD MMM YYYY, HH:MM
export const formatDateTime = (
  dateString: string | null | undefined
): string => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

// Format percentage
export const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  return `${Math.min(100, Math.max(0, value)).toFixed(0)}%`;
};

// Format duration in days
export const formatDuration = (days: number | null | undefined): string => {
  if (!days) return "—";
  return `${days} day${days !== 1 ? "s" : ""}`;
};

// Format project number
export const formatProjectNumber = (projectNumber: string): string => {
  return projectNumber || "—";
};

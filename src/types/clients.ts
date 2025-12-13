// =====================================================
// Client Module Types
// =====================================================

// Enums matching database
export type ClientType =
  | "individual"
  | "company"
  | "partnership"
  | "huf"
  | "trust"
  | "other";

export type ClientStatus = "active" | "inactive" | "blacklisted";

export type PreferredContactMethod = "phone" | "email" | "whatsapp";

export type PreferredContactTime = "morning" | "afternoon" | "evening" | "anytime";

// =====================================================
// Display Labels
// =====================================================

export const ClientTypeLabels: Record<ClientType, string> = {
  individual: "Individual",
  company: "Company",
  partnership: "Partnership Firm",
  huf: "HUF",
  trust: "Trust",
  other: "Other",
};

export const ClientStatusLabels: Record<ClientStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
};

export const ClientStatusColors: Record<ClientStatus, { bg: string; text: string }> = {
  active: { bg: "bg-green-100", text: "text-green-800" },
  inactive: { bg: "bg-gray-100", text: "text-gray-800" },
  blacklisted: { bg: "bg-red-100", text: "text-red-800" },
};

export const PreferredContactMethodLabels: Record<PreferredContactMethod, string> = {
  phone: "Phone Call",
  email: "Email",
  whatsapp: "WhatsApp",
};

export const PreferredContactTimeLabels: Record<PreferredContactTime, string> = {
  morning: "Morning (9 AM - 12 PM)",
  afternoon: "Afternoon (12 PM - 5 PM)",
  evening: "Evening (5 PM - 9 PM)",
  anytime: "Anytime",
};

// =====================================================
// Main Client Interface
// =====================================================

export interface Client {
  id: string;
  tenant_id: string;

  // Client Type
  client_type: ClientType;
  status: ClientStatus;

  // Primary Information
  name: string;
  display_name: string | null;

  // Contact Information
  phone: string;
  phone_secondary: string | null;
  email: string | null;
  email_secondary: string | null;

  // Company Details (for company clients)
  company_name: string | null;
  gst_number: string | null;
  pan_number: string | null;

  // Contact Person (for companies)
  contact_person_name: string | null;
  contact_person_phone: string | null;
  contact_person_email: string | null;
  contact_person_designation: string | null;

  // Address
  address_line1: string | null;
  address_line2: string | null;
  landmark: string | null;
  locality: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string;

  // Additional Information
  date_of_birth: string | null;
  anniversary_date: string | null;
  occupation: string | null;
  company_industry: string | null;

  // Referral Information
  referred_by_client_id: string | null;
  referral_source: string | null;
  referral_notes: string | null;

  // Preferences
  preferred_contact_method: PreferredContactMethod | null;
  preferred_contact_time: PreferredContactTime | null;
  communication_language: string;

  // Notes
  notes: string | null;
  internal_notes: string | null;

  // Tags
  tags: string[];

  // Metadata
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Client with stats (from view)
// =====================================================

export interface ClientDetails extends Client {
  lead_count: number;
  won_lead_count: number;
  total_business_value: number;
  referred_by_name: string | null;
  created_by_name: string | null;
}

// =====================================================
// Create/Update DTOs
// =====================================================

export interface CreateClientInput {
  // Required
  name: string;
  phone: string;

  // Optional - Type
  client_type?: ClientType;
  status?: ClientStatus;

  // Optional - Contact
  display_name?: string;
  phone_secondary?: string;
  email?: string;
  email_secondary?: string;

  // Optional - Company Details
  company_name?: string;
  gst_number?: string;
  pan_number?: string;

  // Optional - Contact Person
  contact_person_name?: string;
  contact_person_phone?: string;
  contact_person_email?: string;
  contact_person_designation?: string;

  // Optional - Address
  address_line1?: string;
  address_line2?: string;
  landmark?: string;
  locality?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;

  // Optional - Additional
  date_of_birth?: string;
  anniversary_date?: string;
  occupation?: string;
  company_industry?: string;

  // Optional - Referral
  referred_by_client_id?: string;
  referral_source?: string;
  referral_notes?: string;

  // Optional - Preferences
  preferred_contact_method?: PreferredContactMethod;
  preferred_contact_time?: PreferredContactTime;
  communication_language?: string;

  // Optional - Notes
  notes?: string;
  internal_notes?: string;

  // Optional - Tags
  tags?: string[];
}

export type UpdateClientInput = Partial<CreateClientInput>;

// =====================================================
// Utility Functions
// =====================================================

/**
 * Format client display name
 */
export function getClientDisplayName(client: Client): string {
  return client.display_name || client.name;
}

/**
 * Format client full address
 */
export function formatClientAddress(client: Client): string {
  const parts = [
    client.address_line1,
    client.address_line2,
    client.landmark,
    client.locality,
    client.city,
    client.state,
    client.pincode,
  ].filter(Boolean);

  return parts.join(", ");
}

/**
 * Check if client is a company type
 */
export function isCompanyClient(client: Client): boolean {
  return ["company", "partnership", "huf", "trust"].includes(client.client_type);
}

/**
 * Get initials from client name
 */
export function getClientInitials(client: Client): string {
  const name = client.display_name || client.name;
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

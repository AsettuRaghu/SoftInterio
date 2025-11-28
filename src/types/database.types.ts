/**
 * Database Types
 * TypeScript interfaces matching the Supabase database schema
 */

// =====================================================
// ENUMS
// =====================================================

export type TenantType =
  | "client"
  | "architect"
  | "interiors"
  | "vendor"
  | "factory";

export type TenantStatus =
  | "active"
  | "suspended"
  | "trial"
  | "expired"
  | "closed";

export type UserStatus =
  | "active"
  | "invited"
  | "pending_verification"
  | "disabled"
  | "deleted";

export type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

export type BillingCycle = "monthly" | "yearly";

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

// =====================================================
// CORE TABLES
// =====================================================

export interface Tenant {
  id: string;
  tenant_type: TenantType;
  company_name: string;
  company_registration_number?: string | null;
  email: string;
  phone?: string | null;
  gst_number?: string | null;
  country_code?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  logo_url?: string | null;
  subscription_plan_id?: string | null;
  status: TenantStatus;
  onboarding_completed: boolean;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string | null;
}

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  status: UserStatus;
  is_super_admin: boolean;
  email_verified_at?: string | null;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string | null;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  expires_at: string;
  created_at: string;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used_at?: string | null;
  created_at: string;
}

export interface EmailVerificationToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  verified_at?: string | null;
  created_at: string;
}

export interface UserInvitation {
  id: string;
  tenant_id: string;
  email: string;
  invited_by_user_id: string;
  role_id?: string | null;
  token: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// ROLES & PERMISSIONS
// =====================================================

export interface Role {
  id: string;
  tenant_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  is_system_role: boolean;
  is_default: boolean;
  hierarchy_level: number;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  key: string;
  module: string;
  description?: string | null;
  is_system_permission: boolean;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  granted: boolean;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
  assigned_by_user_id?: string | null;
}

// =====================================================
// SUBSCRIPTION SYSTEM
// =====================================================

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  tenant_type: TenantType;
  description?: string | null;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_projects?: number | null;
  max_storage_gb: number;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlanFeature {
  id: string;
  plan_id: string;
  feature_key: string;
  feature_name: string;
  included: boolean;
  limit_value?: number | null;
  created_at: string;
}

export interface TenantSubscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  is_trial: boolean;
  trial_start_date?: string | null;
  trial_end_date?: string | null;
  current_period_start: string;
  current_period_end: string;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionAddon {
  id: string;
  tenant_id: string;
  addon_key: string;
  addon_name: string;
  quantity: number;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// SETTINGS & LOGS
// =====================================================

export interface TenantSettings {
  id: string;
  tenant_id: string;
  timezone: string;
  date_format: string;
  currency: string;
  language: string;
  business_hours?: Record<string, any> | null;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  action: string;
  description?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

// =====================================================
// JOINED TYPES (for queries with relationships)
// =====================================================

export interface UserWithRoles extends User {
  roles?: Role[];
  tenant?: Tenant;
}

export interface RoleWithPermissions extends Role {
  permissions?: Permission[];
}

export interface TenantWithSubscription extends Tenant {
  subscription?: TenantSubscription;
  subscription_plan?: SubscriptionPlan;
  settings?: TenantSettings;
}

export interface UserInvitationWithDetails extends UserInvitation {
  invited_by?: User;
  role?: Role;
  tenant?: Tenant;
}

// =====================================================
// INPUT TYPES (for forms and API requests)
// =====================================================

export interface CreateTenantInput {
  tenant_type: TenantType;
  company_name: string;
  email: string;
  company_registration_number?: string;
  phone?: string;
  country_code?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  selected_plan?: string;
}

export interface CreateUserInput {
  tenant_id: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  avatar_url?: string;
}

export interface InviteUserInput {
  tenant_id: string;
  email: string;
  role_id?: string;
}

export interface UpdateTenantInput {
  company_name?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  logo_url?: string;
}

export interface UpdateTenantSettingsInput {
  timezone?: string;
  date_format?: string;
  currency?: string;
  language?: string;
  business_hours?: Record<string, any>;
  notifications_enabled?: boolean;
}

// =====================================================
// RESPONSE TYPES (for API responses)
// =====================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// =====================================================
// AUTH TYPES
// =====================================================

export interface SignUpData {
  email: string;
  password: string;
  name: string;
  company_name: string;
  tenant_type: TenantType;
  phone?: string;
  selected_plan?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface ResetPasswordData {
  email: string;
}

export interface UpdatePasswordData {
  password: string;
  token: string;
}

export interface Session {
  user: User;
  tenant: Tenant;
  roles: Role[];
  permissions: Permission[];
}

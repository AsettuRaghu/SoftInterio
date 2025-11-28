/**
 * Authentication Service
 * Business logic for authentication operations
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  SignUpData,
  Tenant,
  User,
  CreateTenantInput,
} from "@/types/database.types";

/**
 * Create a new tenant (company account)
 */
export async function createTenant(data: CreateTenantInput): Promise<Tenant> {
  console.log("[AUTH SERVICE] createTenant called with:", {
    tenant_type: data.tenant_type,
    company_name: data.company_name,
    email: data.email,
    selected_plan: data.selected_plan,
  });

  const supabase = createAdminClient();

  // Look up subscription plan by slug if provided
  let subscriptionPlanId = null;
  if (data.selected_plan) {
    console.log(
      "[AUTH SERVICE] Looking up subscription plan:",
      data.selected_plan
    );
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("id")
      .eq("slug", data.selected_plan)
      .eq("tenant_type", data.tenant_type)
      .eq("is_active", true)
      .single();

    if (planError) {
      console.error("[AUTH SERVICE] Error looking up plan:", planError);
    } else if (plan) {
      console.log("[AUTH SERVICE] Found plan:", plan.id);
    } else {
      console.warn(
        "[AUTH SERVICE] No plan found for slug:",
        data.selected_plan
      );
    }

    subscriptionPlanId = plan?.id || null;
  }

  console.log("[AUTH SERVICE] Inserting tenant into database...");
  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({
      tenant_type: data.tenant_type,
      company_name: data.company_name,
      email: data.email,
      phone: data.phone,
      company_registration_number: data.company_registration_number,
      country_code: data.country_code,
      address_line1: data.address_line1,
      address_line2: data.address_line2,
      city: data.city,
      state: data.state,
      postal_code: data.postal_code,
      subscription_plan_id: subscriptionPlanId,
      status: "trial",
      onboarding_completed: false,
      onboarding_step: 1,
    })
    .select()
    .single();

  if (error) {
    console.error("[AUTH SERVICE] Error creating tenant:", error);
    console.error(
      "[AUTH SERVICE] Error details:",
      JSON.stringify(error, null, 2)
    );
    throw new Error(`Failed to create tenant account: ${error.message}`);
  }

  console.log("[AUTH SERVICE] Tenant created:", tenant.id);

  // Create default tenant settings
  console.log("[AUTH SERVICE] Creating tenant settings...");
  const { error: settingsError } = await supabase
    .from("tenant_settings")
    .insert({
      tenant_id: tenant.id,
      timezone: "Asia/Kolkata",
      date_format: "DD-MM-YYYY",
      currency: "INR",
      language: "en",
      notifications_enabled: true,
    });

  if (settingsError) {
    console.error(
      "[AUTH SERVICE] Error creating tenant settings:",
      settingsError
    );
    throw new Error(
      `Failed to create tenant settings: ${settingsError.message}`
    );
  }
  console.log("[AUTH SERVICE] Tenant settings created successfully");

  // Create tenant subscription record if plan was selected
  if (subscriptionPlanId) {
    console.log("[AUTH SERVICE] Creating tenant subscription...");
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14); // 14-day trial

    const { error: subscriptionError } = await supabase
      .from("tenant_subscriptions")
      .insert({
        tenant_id: tenant.id,
        plan_id: subscriptionPlanId,
        status: "trial",
        billing_cycle: "yearly",
        is_trial: true,
        trial_start_date: new Date().toISOString(),
        trial_end_date: trialEndDate.toISOString(),
        current_period_start: new Date().toISOString(),
        current_period_end: trialEndDate.toISOString(),
      });

    if (subscriptionError) {
      console.error(
        "[AUTH SERVICE] Error creating subscription:",
        subscriptionError
      );
      throw new Error(
        `Failed to create subscription: ${subscriptionError.message}`
      );
    }
    console.log("[AUTH SERVICE] Tenant subscription created successfully");
  }

  console.log("[AUTH SERVICE] createTenant completed successfully");
  return tenant;
}

/**
 * Register a new user with Supabase Auth and create user record
 */
export async function registerUser(
  signUpData: SignUpData,
  tenantId: string
): Promise<{ user: User; authUserId: string }> {
  console.log(
    "[AUTH SERVICE] registerUser called for:",
    signUpData.email,
    "tenant:",
    tenantId
  );
  const supabase = createAdminClient();

  // 1. Create user in Supabase Auth
  console.log("[AUTH SERVICE] Creating Supabase Auth user...");
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: signUpData.email,
      password: signUpData.password,
      email_confirm: false, // We'll send verification email separately
      user_metadata: {
        name: signUpData.name,
        tenant_id: tenantId,
      },
    });

  if (authError || !authData.user) {
    console.error("[AUTH SERVICE] Error creating auth user:", authError);
    console.error(
      "[AUTH SERVICE] Auth error details:",
      JSON.stringify(authError, null, 2)
    );
    throw new Error(authError?.message || "Failed to create user account");
  }
  console.log("[AUTH SERVICE] Auth user created:", authData.user.id);

  // 2. Create user record in our users table
  console.log("[AUTH SERVICE] Creating user record in database...");
  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({
      id: authData.user.id, // Link to Supabase auth user
      tenant_id: tenantId,
      name: signUpData.name,
      email: signUpData.email,
      phone: signUpData.phone,
      status: "pending_verification",
      is_super_admin: true, // First user is super admin
    })
    .select()
    .single();

  if (userError || !user) {
    // Rollback: Delete auth user if user record creation fails
    console.error("[AUTH SERVICE] Error creating user record:", userError);
    console.error("[AUTH SERVICE] Rolling back auth user...");
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(`Failed to create user record: ${userError?.message}`);
  }
  console.log("[AUTH SERVICE] User record created:", user.id);

  // 3. Assign Owner role to first user (tenant creator)
  console.log("[AUTH SERVICE] Assigning Owner role...");
  const { data: ownerRole, error: roleQueryError } = await supabase
    .from("roles")
    .select("id")
    .eq("slug", "owner")
    .eq("is_system_role", true)
    .single();

  if (roleQueryError) {
    console.error("[AUTH SERVICE] Error finding Owner role:", roleQueryError);
  } else if (ownerRole) {
    const { error: roleAssignError } = await supabase
      .from("user_roles")
      .insert({
        user_id: user.id,
        role_id: ownerRole.id,
        assigned_by_user_id: user.id,
      });

    if (roleAssignError) {
      console.error("[AUTH SERVICE] Error assigning role:", roleAssignError);
    } else {
      console.log("[AUTH SERVICE] Owner role assigned successfully");
    }
  } else {
    console.warn("[AUTH SERVICE] Owner role not found in database");
  }

  // 4. Update tenant with created_by_user_id
  console.log("[AUTH SERVICE] Updating tenant with creator user ID...");
  const { error: tenantUpdateError } = await supabase
    .from("tenants")
    .update({ created_by_user_id: user.id })
    .eq("id", tenantId);

  if (tenantUpdateError) {
    console.error("[AUTH SERVICE] Error updating tenant:", tenantUpdateError);
  } else {
    console.log("[AUTH SERVICE] Tenant updated successfully");
  }

  console.log("[AUTH SERVICE] registerUser completed successfully");
  return { user, authUserId: authData.user.id };
}

/**
 * Send email verification link
 */
export async function sendVerificationEmail(email: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirmation`,
    },
  });

  if (error) {
    console.error("Error sending verification email:", error);
    // Don't throw - email sending failure shouldn't block registration
  }
}

/**
 * Sign in user with email and password
 */
export async function signInWithEmail(email: string, password: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  // Update last login timestamp
  if (data.user) {
    const adminClient = createAdminClient();
    await adminClient
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", data.user.id);
  }

  return data;
}

/**
 * Sign out current user
 */
export async function signOut() {
  console.log("[AUTH SERVICE] signOut called");
  const supabase = await createClient();

  console.log("[AUTH SERVICE] Calling Supabase signOut...");
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[AUTH SERVICE] Error signing out:", error);
    throw new Error(error.message);
  }

  console.log("[AUTH SERVICE] signOut completed successfully");
}

/**
 * Get current user session with tenant and roles
 */
export async function getCurrentSession() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  // Get user with tenant information
  const { data: user } = await supabase
    .from("users")
    .select(
      `
      *,
      tenant:tenants(*),
      user_roles(
        role:roles(
          *,
          role_permissions(
            permission:permissions(*)
          )
        )
      )
    `
    )
    .eq("id", authUser.id)
    .single();

  if (!user) {
    return null;
  }

  // Extract roles and permissions
  const roles = user.user_roles?.map((ur: any) => ur.role) || [];
  const permissions = roles.flatMap(
    (role: any) => role.role_permissions?.map((rp: any) => rp.permission) || []
  );

  return {
    authUser,
    user,
    tenant: user.tenant,
    roles,
    permissions,
  };
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(permissionKey: string): Promise<boolean> {
  const session = await getCurrentSession();

  if (!session) {
    return false;
  }

  // Super admins have all permissions
  if (session.user.is_super_admin) {
    return true;
  }

  // Check if user has the specific permission
  return session.permissions.some((p: any) => p.key === permissionKey);
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string) {
  console.log("[AUTH SERVICE] requestPasswordReset called for:", email);
  const supabase = await createClient();

  const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`;
  console.log("[AUTH SERVICE] Reset redirect URL:", redirectUrl);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  if (error) {
    console.error("[AUTH SERVICE] Error requesting password reset:", error);
    throw new Error(error.message);
  }

  console.log("[AUTH SERVICE] Password reset email sent successfully");
}

/**
 * Update password with reset token
 */
export async function updatePassword(
  newPassword: string,
  code?: string,
  accessToken?: string
) {
  console.log("[AUTH SERVICE] updatePassword called");
  const adminClient = createAdminClient();
  let userId: string;

  if (code) {
    // Handle PKCE flow - exchange code for session
    console.log("[AUTH SERVICE] Exchanging code for session...");
    const regularClient = await createClient();

    const { data: sessionData, error: exchangeError } =
      await regularClient.auth.exchangeCodeForSession(code);

    if (exchangeError || !sessionData.user) {
      console.error("[AUTH SERVICE] Error exchanging code:", exchangeError);
      throw new Error("Invalid or expired reset link");
    }

    console.log(
      "[AUTH SERVICE] Code exchanged successfully for user:",
      sessionData.user.id
    );
    userId = sessionData.user.id;
  } else if (accessToken) {
    // Handle legacy access token flow
    console.log("[AUTH SERVICE] Getting user from access token...");

    const { data: userData, error: verifyError } =
      await adminClient.auth.getUser(accessToken);

    if (verifyError || !userData.user) {
      console.error("[AUTH SERVICE] Invalid or expired token:", verifyError);
      throw new Error("Invalid or expired reset link");
    }

    console.log("[AUTH SERVICE] Token verified for user:", userData.user.id);
    userId = userData.user.id;
  } else {
    throw new Error("No reset code or token provided");
  }

  console.log("[AUTH SERVICE] Updating password via admin client...");

  // Update password using admin client
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    console.error("[AUTH SERVICE] Error updating password:", error);
    throw new Error(error.message);
  }

  console.log("[AUTH SERVICE] Password updated successfully");
}

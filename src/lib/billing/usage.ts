/**
 * Billing Usage Validation Service
 * Checks if tenant can add new users, projects, or storage
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface UsageCheckResult {
  canAdd: boolean;
  current: number;
  limit: number | -1; // -1 means unlimited
  percentage: number;
  message?: string;
}

const authLogger = {
  debug: (msg: string, data?: any) => console.log(`[BILLING USAGE] ${msg}`, data || ""),
  warn: (msg: string, data?: any) => console.warn(`[BILLING USAGE] ${msg}`, data || ""),
  error: (msg: string, data?: any) => console.error(`[BILLING USAGE] ${msg}`, data || ""),
};

/**
 * Check if tenant can add a new user
 */
export async function canAddUser(tenantId: string): Promise<UsageCheckResult> {
  authLogger.debug("Checking if can add user", { tenantId });

  try {
    const adminClient = createAdminClient();

    // Get current subscription and plan
    const { data: sub, error: subError } = await adminClient
      .from("tenant_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (subError || !sub?.plan) {
      authLogger.warn("No active plan found", { tenantId, error: subError });
      return {
        canAdd: false,
        current: 0,
        limit: 0,
        percentage: 0,
        message: "No active subscription plan found",
      };
    }

    // Get current usage
    const { data: usage, error: usageError } = await adminClient
      .from("tenant_usage")
      .select("current_users")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (usageError) {
      authLogger.error("Failed to fetch usage", { error: usageError });
      return {
        canAdd: false,
        current: 0,
        limit: 0,
        percentage: 0,
        message: "Failed to check usage limits",
      };
    }

    const currentUsers = usage?.current_users || 0;
    const limit = sub.plan.max_users;

    // -1 means unlimited
    if (limit === -1) {
      return {
        canAdd: true,
        current: currentUsers,
        limit: -1,
        percentage: 0,
      };
    }

    const percentage = (currentUsers / limit) * 100;
    const canAdd = currentUsers < limit;

    if (!canAdd) {
      authLogger.warn("User limit reached", {
        current: currentUsers,
        limit,
        tenantId,
      });
    }

    return {
      canAdd,
      current: currentUsers,
      limit,
      percentage,
      message: !canAdd
        ? `You've reached the user limit of ${limit}. Please upgrade your plan to add more users.`
        : undefined,
    };
  } catch (error) {
    authLogger.error("Exception in canAddUser", error);
    return {
      canAdd: false,
      current: 0,
      limit: 0,
      percentage: 0,
      message: "Failed to check user limit",
    };
  }
}

/**
 * Check if tenant can add a new project
 */
export async function canAddProject(tenantId: string): Promise<UsageCheckResult> {
  authLogger.debug("Checking if can add project", { tenantId });

  try {
    const adminClient = createAdminClient();

    // Get current subscription and plan
    const { data: sub, error: subError } = await adminClient
      .from("tenant_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (subError || !sub?.plan) {
      authLogger.warn("No active plan found", { tenantId });
      return {
        canAdd: false,
        current: 0,
        limit: 0,
        percentage: 0,
        message: "No active subscription plan found",
      };
    }

    // Get current usage
    const { data: usage } = await adminClient
      .from("tenant_usage")
      .select("current_projects")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const currentProjects = usage?.current_projects || 0;
    const limit = sub.plan.max_projects;

    // -1 means unlimited
    if (limit === -1 || limit === null) {
      return {
        canAdd: true,
        current: currentProjects,
        limit: -1,
        percentage: 0,
      };
    }

    const percentage = (currentProjects / limit) * 100;
    const canAdd = currentProjects < limit;

    if (!canAdd) {
      authLogger.warn("Project limit reached", {
        current: currentProjects,
        limit,
        tenantId,
      });
    }

    return {
      canAdd,
      current: currentProjects,
      limit,
      percentage,
      message: !canAdd
        ? `You've reached the project limit of ${limit}. Please upgrade your plan to create more projects.`
        : undefined,
    };
  } catch (error) {
    authLogger.error("Exception in canAddProject", error);
    return {
      canAdd: false,
      current: 0,
      limit: 0,
      percentage: 0,
      message: "Failed to check project limit",
    };
  }
}

/**
 * Check if tenant can upload a document
 */
export async function canUploadDocument(
  tenantId: string,
  fileSizeBytes: number
): Promise<UsageCheckResult> {
  authLogger.debug("Checking if can upload document", {
    tenantId,
    fileSizeBytes,
  });

  try {
    const adminClient = createAdminClient();

    // Get current subscription and plan
    const { data: sub, error: subError } = await adminClient
      .from("tenant_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (subError || !sub?.plan) {
      authLogger.warn("No active plan found", { tenantId });
      return {
        canAdd: false,
        current: 0,
        limit: 0,
        percentage: 0,
        message: "No active subscription plan found",
      };
    }

    // Get current usage
    const { data: usage } = await adminClient
      .from("tenant_usage")
      .select("storage_used_bytes")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const storageUsedBytes = usage?.storage_used_bytes || 0;
    const storageUsedGb = storageUsedBytes / (1024 * 1024 * 1024);
    const maxStorageGb = sub.plan.max_storage_gb;
    const fileSizeGb = fileSizeBytes / (1024 * 1024 * 1024);

    // -1 means unlimited
    if (maxStorageGb === -1) {
      return {
        canAdd: true,
        current: Math.round(storageUsedGb * 100) / 100,
        limit: -1,
        percentage: 0,
      };
    }

    const projectedUsageGb = storageUsedGb + fileSizeGb;
    const percentage = (projectedUsageGb / maxStorageGb) * 100;
    const canAdd = projectedUsageGb <= maxStorageGb;

    if (!canAdd) {
      authLogger.warn("Storage limit exceeded", {
        current: storageUsedGb.toFixed(2),
        limit: maxStorageGb,
        fileSize: fileSizeGb.toFixed(2),
        tenantId,
      });
    }

    return {
      canAdd,
      current: Math.round(storageUsedGb * 100) / 100,
      limit: maxStorageGb,
      percentage,
      message: !canAdd
        ? `Uploading this file would exceed your storage limit. Current: ${storageUsedGb.toFixed(1)}GB, Limit: ${maxStorageGb}GB. Please upgrade your plan.`
        : undefined,
    };
  } catch (error) {
    authLogger.error("Exception in canUploadDocument", error);
    return {
      canAdd: false,
      current: 0,
      limit: 0,
      percentage: 0,
      message: "Failed to check storage limit",
    };
  }
}

/**
 * Get all usage limits for a tenant
 */
export async function getTenantUsageLimits(tenantId: string) {
  authLogger.debug("Getting usage limits", { tenantId });

  try {
    const adminClient = createAdminClient();

    // Get subscription and plan
    const { data: sub } = await adminClient
      .from("tenant_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!sub?.plan) {
      return null;
    }

    // Get usage
    const { data: usage } = await adminClient
      .from("tenant_usage")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!usage) {
      return null;
    }

    const storageUsedGb = (usage.storage_used_bytes || 0) / (1024 * 1024 * 1024);

    return {
      users: {
        current: usage.current_users || 0,
        limit: sub.plan.max_users,
        percentage:
          sub.plan.max_users === -1
            ? 0
            : ((usage.current_users || 0) / sub.plan.max_users) * 100,
        unlimited: sub.plan.max_users === -1,
      },
      projects: {
        current: usage.current_projects || 0,
        limit: sub.plan.max_projects,
        percentage:
          sub.plan.max_projects === -1 || sub.plan.max_projects === null
            ? 0
            : ((usage.current_projects || 0) / sub.plan.max_projects) * 100,
        unlimited: sub.plan.max_projects === -1 || sub.plan.max_projects === null,
      },
      storage: {
        current: Math.round(storageUsedGb * 100) / 100,
        limit: sub.plan.max_storage_gb,
        percentage:
          sub.plan.max_storage_gb === -1
            ? 0
            : (storageUsedGb / sub.plan.max_storage_gb) * 100,
        unlimited: sub.plan.max_storage_gb === -1,
      },
    };
  } catch (error) {
    authLogger.error("Exception in getTenantUsageLimits", error);
    return null;
  }
}

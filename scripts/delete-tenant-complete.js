/**
 * DELETE ENTIRE TENANT
 * Completely removes a tenant and all associated data
 * ⚠️  THIS IS PERMANENT - Tenant, users, subscriptions, everything deleted
 *
 * Usage: node scripts/delete-tenant-complete.js <tenant-id>
 * Example: node scripts/delete-tenant-complete.js 12345678-1234-1234-1234-123456789012
 */

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");

const env = {};
envContent.split("\n").forEach((line) => {
  if (line && !line.startsWith("#")) {
    const [key, value] = line.split("=");
    if (key && value) {
      env[key.trim()] = value.trim();
    }
  }
});

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

async function deleteTenantComplete(tenantId) {
  console.log("\n🗑️  DELETING ENTIRE TENANT\n");
  console.log(`Tenant ID: ${tenantId}\n`);

  try {
    // 1. Get tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("company_name, email")
      .eq("id", tenantId)
      .single();

    if (!tenant) {
      console.log("❌ Tenant not found");
      return;
    }

    console.log(`Tenant: ${tenant.company_name} (${tenant.email})\n`);

    // 2. Get all users in this tenant
    const { data: users } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("tenant_id", tenantId);

    console.log(`Found ${users?.length || 0} user(s):\n`);
    users?.forEach((u) => console.log(`  - ${u.email} (${u.name})`));

    // 3. Delete auth users for all tenant users
    console.log("\n🔄 Deleting auth users...");
    if (users && users.length > 0) {
      for (const user of users) {
        try {
          await supabase.auth.admin.deleteUser(user.id);
          console.log(`   ✓ Deleted auth user: ${user.email}`);
        } catch (err) {
          console.log(`   ⚠️  Could not delete auth user ${user.email}`);
        }
      }
    }

    // 4. Delete all database records for this tenant
    console.log("\n🔄 Deleting database records...");

    // Delete user_roles
    await supabase
      .from("user_roles")
      .delete()
      .in("user_id", users?.map((u) => u.id) || []);
    console.log("   ✓ Deleted user_roles");

    // Delete user_invitations
    await supabase.from("user_invitations").delete().eq("tenant_id", tenantId);
    console.log("   ✓ Deleted user_invitations");

    // Delete users
    await supabase.from("users").delete().eq("tenant_id", tenantId);
    console.log("   ✓ Deleted users");

    // Delete tenant_users
    await supabase.from("tenant_users").delete().eq("tenant_id", tenantId);
    console.log("   ✓ Deleted tenant_users");

    // Delete tenant_subscriptions
    await supabase
      .from("tenant_subscriptions")
      .delete()
      .eq("tenant_id", tenantId);
    console.log("   ✓ Deleted tenant_subscriptions");

    // Delete tenant_settings
    await supabase.from("tenant_settings").delete().eq("tenant_id", tenantId);
    console.log("   ✓ Deleted tenant_settings");

    // Delete tenant
    await supabase.from("tenants").delete().eq("id", tenantId);
    console.log("   ✓ Deleted tenant");

    console.log("\n✅ TENANT COMPLETELY DELETED\n");
    console.log(`Email "${tenant.email}" is now available for signup/invite\n`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

const tenantId = process.argv[2];
if (!tenantId) {
  console.error("❌ Usage: node scripts/delete-tenant-complete.js <tenant-id>");
  console.error(
    "Example: node scripts/delete-tenant-complete.js 12345678-1234-1234-1234-123456789012\n",
  );
  process.exit(1);
}

deleteTenantComplete(tenantId);

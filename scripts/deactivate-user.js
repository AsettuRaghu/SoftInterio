/**
 * DEACTIVATE USER FROM TENANT
 * Removes a user from a tenant (like deactivating)
 * ⚠️  Keeps the auth user intact - user can be re-invited later
 *
 * Usage: node scripts/deactivate-user.js <email> <tenant-id>
 * Example: node scripts/deactivate-user.js user@example.com 12345678-1234-1234-1234-123456789012
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

async function deactivateUser(email, tenantId) {
  const normalizedEmail = email.toLowerCase();
  console.log("\n🔴 DEACTIVATING USER FROM TENANT\n");
  console.log(`Email: ${email}`);
  console.log(`Tenant ID: ${tenantId}\n`);

  try {
    // 1. Find the user
    const { data: user } = await supabase
      .from("users")
      .select("id, name, email, status")
      .eq("email", normalizedEmail)
      .eq("tenant_id", tenantId)
      .single();

    if (!user) {
      console.log(`❌ User not found in this tenant\n`);
      return;
    }

    console.log(`Found: ${user.name} (${user.email})`);
    console.log(`Current Status: ${user.status}\n`);

    // 2. Delete user_roles for this user
    console.log("🔄 Removing roles...");
    await supabase.from("user_roles").delete().eq("user_id", user.id);
    console.log("   ✓ Deleted user_roles");

    // 3. Delete user_invitations for this user
    console.log("🔄 Removing invitations...");
    await supabase
      .from("user_invitations")
      .delete()
      .eq("email", normalizedEmail);
    console.log("   ✓ Deleted user_invitations");

    // 4. Delete tenant_users membership
    console.log("🔄 Removing tenant membership...");
    await supabase.from("tenant_users").delete().eq("user_id", user.id);
    console.log("   ✓ Deleted tenant_users");

    // 5. Delete the user record
    console.log("🔄 Removing user record...");
    await supabase.from("users").delete().eq("id", user.id);
    console.log("   ✓ Deleted user");

    console.log("\n✅ USER DEACTIVATED\n");
    console.log(`Auth user (${user.id}) kept intact`);
    console.log(`User can be re-invited to this tenant later\n`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

const email = process.argv[2];
const tenantId = process.argv[3];

if (!email || !tenantId) {
  console.error(
    "❌ Usage: node scripts/deactivate-user.js <email> <tenant-id>",
  );
  console.error(
    "Example: node scripts/deactivate-user.js user@example.com 12345678-1234-1234-1234-123456789012\n",
  );
  process.exit(1);
}

deactivateUser(email, tenantId);

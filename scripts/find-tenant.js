/**
 * FIND TENANT BY EMAIL
 * Shows which tenant an email belongs to
 * Useful for getting tenant-id before running delete or deactivate scripts
 *
 * Usage: node scripts/find-tenant.js <email>
 * Example: node scripts/find-tenant.js user@example.com
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

async function findTenant(email) {
  const normalizedEmail = email.toLowerCase();
  console.log(`\n🔍 Finding tenant for: ${email}\n`);

  try {
    // Find user
    const { data: user } = await supabase
      .from("users")
      .select("id, name, email, tenant_id, status")
      .ilike("email", normalizedEmail)
      .single();

    if (!user) {
      console.log("❌ User not found\n");
      return;
    }

    // Get tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, company_name, email, status")
      .eq("id", user.tenant_id)
      .single();

    if (!tenant) {
      console.log("❌ Tenant not found\n");
      return;
    }

    console.log("✅ FOUND:\n");
    console.log(`User:`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Status: ${user.status}\n`);

    console.log(`Tenant:`);
    console.log(`  ID: ${tenant.id}`);
    console.log(`  Name: ${tenant.company_name}`);
    console.log(`  Email: ${tenant.email}`);
    console.log(`  Status: ${tenant.status}\n`);

    console.log("📋 NEXT STEPS:\n");
    console.log("To DELETE entire tenant:");
    console.log(`  node scripts/delete-tenant-complete.js ${tenant.id}\n`);

    console.log("To DEACTIVATE this user:");
    console.log(
      `  node scripts/deactivate-user.js ${user.email} ${tenant.id}\n`,
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

const email = process.argv[2];

if (!email) {
  console.error("❌ Usage: node scripts/find-tenant.js <email>");
  console.error("Example: node scripts/find-tenant.js user@example.com\n");
  process.exit(1);
}

findTenant(email);

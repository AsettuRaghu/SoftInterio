/**
 * COMPREHENSIVE EMAIL CHECK
 * Shows EXACTLY where an email exists in the system
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

async function comprehensiveCheck(email) {
  const normalizedEmail = email.toLowerCase();
  console.log(`\n📍 COMPREHENSIVE CHECK FOR: ${email}\n`);

  try {
    // 1. Check auth.users
    console.log("1️⃣  AUTH.USERS:");
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUser = authData?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail,
    );
    if (authUser) {
      console.log(`   ✅ FOUND - ID: ${authUser.id}`);
      console.log(`      Confirmed: ${authUser.confirmed_at ? "YES" : "NO"}`);
    } else {
      console.log(`   ❌ Not found`);
    }

    // 2. Check users table
    console.log("\n2️⃣  USERS TABLE:");
    const { data: users } = await supabase
      .from("users")
      .select("id, email, tenant_id")
      .ilike("email", normalizedEmail);
    if (users?.length) {
      console.log(`   ✅ FOUND - ${users.length} record(s)`);
      users.forEach((u) =>
        console.log(`      ID: ${u.id}, Tenant: ${u.tenant_id}`),
      );
    } else {
      console.log(`   ❌ Not found`);
    }

    // 3. Check tenants table
    console.log("\n3️⃣  TENANTS TABLE:");
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, email, company_name")
      .ilike("email", normalizedEmail);
    if (tenants?.length) {
      console.log(`   ✅ FOUND - ${tenants.length} record(s)`);
      tenants.forEach((t) =>
        console.log(`      ID: ${t.id}, Company: ${t.company_name}`),
      );
    } else {
      console.log(`   ❌ Not found`);
    }

    // 4. Check user_invitations table
    console.log("\n4️⃣  USER_INVITATIONS TABLE:");
    const { data: invitations } = await supabase
      .from("user_invitations")
      .select("id, email, status")
      .ilike("email", normalizedEmail);
    if (invitations?.length) {
      console.log(`   ✅ FOUND - ${invitations.length} record(s)`);
      invitations.forEach((i) =>
        console.log(`      ID: ${i.id}, Status: ${i.status}`),
      );
    } else {
      console.log(`   ❌ Not found`);
    }

    console.log("\n" + "=".repeat(60));
    if (authUser || users?.length || tenants?.length || invitations?.length) {
      console.log("⚠️  EMAIL IS IN USE\n");
    } else {
      console.log("✅ EMAIL IS COMPLETELY FREE\n");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/email-check.js <email>");
  process.exit(1);
}

comprehensiveCheck(email);

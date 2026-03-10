/**
 * DELETE AUTH USER ONLY
 * Removes just the auth user (not the database user record)
 * Use when db user is already deleted but auth user remains
 * 
 * Usage: node scripts/delete-auth-user.js <email>
 * Example: node scripts/delete-auth-user.js user@example.com
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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function deleteAuthUser(email) {
  console.log(`\n🔐 Deleting auth user for: ${email}\n`);

  try {
    // Find auth user
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUser = authData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!authUser) {
      console.log("❌ Auth user not found\n");
      return;
    }

    console.log(`Found auth user: ${authUser.id}`);
    console.log(`Email: ${authUser.email}\n`);

    // Delete auth user
    console.log("🔄 Deleting auth user...");
    const { error } = await supabase.auth.admin.deleteUser(authUser.id);

    if (error) {
      console.log(`❌ Error: ${error.message}\n`);
      return;
    }

    console.log("✅ Auth user deleted\n");
    console.log(`Email "${email}" is now free for signup\n`);

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

const email = process.argv[2];

if (!email) {
  console.error("❌ Usage: node scripts/delete-auth-user.js <email>");
  console.error("Example: node scripts/delete-auth-user.js user@example.com\n");
  process.exit(1);
}

deleteAuthUser(email);

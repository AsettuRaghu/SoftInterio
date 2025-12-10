// Check invite status script
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Read env from .env.local
const envPath = path.join(__dirname, ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2];
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

console.log("URL:", supabaseUrl ? "Found" : "Missing");
console.log("Key:", serviceRoleKey ? "Found" : "Missing");

if (!supabaseUrl || !serviceRoleKey) {
  console.log("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = process.argv[2] || "vishruthvarma.k@gmail.com";
  console.log("\n🔍 Checking:", email);

  // Invitation
  const { data: inv, error: invErr } = await supabase
    .from("user_invitations")
    .select("*")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1);

  console.log("\n📧 INVITATION:");
  if (inv && inv[0]) {
    console.log("  Status:", inv[0].status);
    console.log("  Created:", inv[0].created_at);
    console.log("  Expires:", inv[0].expires_at);
    console.log(
      "  Expired?:",
      new Date(inv[0].expires_at) < new Date() ? "YES ❌" : "No ✅"
    );
    console.log("  Accepted:", inv[0].accepted_at || "Not yet");
  } else {
    console.log("  None found", invErr?.message || "");
  }

  // Auth user
  const { data: auth, error: authErr } =
    await supabase.auth.admin.getUserByEmail(email);
  console.log("\n👤 AUTH USER:");
  if (auth?.user) {
    console.log("  ID:", auth.user.id);
    console.log(
      "  Email confirmed:",
      auth.user.email_confirmed_at ? "Yes ✅" : "No ❌"
    );
    console.log("  Created:", auth.user.created_at);
    console.log("  Last sign in:", auth.user.last_sign_in_at || "Never");
    console.log(
      "  Password set:",
      auth.user.user_metadata?.password_set ? "Yes ✅" : "No ❌"
    );
    console.log(
      "  Metadata:",
      JSON.stringify(auth.user.user_metadata || {}, null, 4)
    );
  } else {
    console.log("  None found", authErr?.message || "");
  }

  // Users table
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("*")
    .ilike("email", email)
    .single();

  console.log("\n📋 USERS TABLE:");
  if (user) {
    console.log("  ID:", user.id);
    console.log("  Name:", user.name);
    console.log(
      "  Status:",
      user.status,
      user.status === "active" ? "✅" : "⚠️"
    );
    console.log("  Tenant:", user.tenant_id);
  } else {
    console.log("  None found", userErr?.message || "");
  }

  // Analysis
  console.log("\n📊 ANALYSIS:");
  if (!inv || inv.length === 0) {
    console.log("  ❌ No invitation found");
  } else if (new Date(inv[0].expires_at) < new Date()) {
    console.log("  ❌ Invitation EXPIRED - need to resend");
  } else if (inv[0].status === "pending") {
    console.log("  ⏳ Invitation pending - user has not clicked the link yet");
  } else if (inv[0].status === "accepted") {
    console.log("  ✅ Invitation accepted");
  }

  if (!auth?.user) {
    console.log("  ❌ No auth user - invite link not clicked or failed");
  } else {
    if (!auth.user.email_confirmed_at) {
      console.log("  ⚠️ Email not confirmed");
    }
    if (!auth.user.user_metadata?.password_set) {
      console.log("  ⚠️ Password not set - user needs to complete setup");
    }
  }

  if (user && user.status === "invited") {
    console.log(
      '  ⚠️ User status still "invited" - complete-invite API not called'
    );
  }

  console.log("\n");
}

main().catch(console.error);

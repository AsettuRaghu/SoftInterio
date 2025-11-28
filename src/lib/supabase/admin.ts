/**
 * Supabase Admin Client
 * Use this ONLY in server-side code for administrative operations
 * NEVER use this in client components or expose the service role key
 */

import { createClient } from "@supabase/supabase-js";

// This client bypasses Row Level Security (RLS)
// Use with extreme caution and only for admin operations
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

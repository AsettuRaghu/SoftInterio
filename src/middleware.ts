/**
 * Next.js Middleware (migrated from deprecated middleware convention)
 * Runs on every request to handle authentication and session refresh
 */

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

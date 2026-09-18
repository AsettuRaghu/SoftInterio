import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { getDefaultMeasurementUnit } from "@/lib/settings/measurement-unit";

/** The tenant-wide defaults every signed-in user's screens start from. */
export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request);
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();
  return NextResponse.json({ data: { default_measurement_unit: await getDefaultMeasurementUnit(supabase, guard.user.tenantId) } });
}

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The unit a business measures in - Settings → Config. The four both the
 * scope and the quotation builder understand. Every place a unit is chosen
 * starts on this; the row can always be changed.
 */
export const MEASUREMENT_UNITS = ["mm", "cm", "inch", "ft"] as const;
export type DefaultMeasurementUnit = (typeof MEASUREMENT_UNITS)[number];
export const MEASUREMENT_UNIT_LABELS: Record<DefaultMeasurementUnit, string> = {
  mm: "Millimetres (mm)",
  cm: "Centimetres (cm)",
  inch: "Inches",
  ft: "Feet",
};
export const FALLBACK_UNIT: DefaultMeasurementUnit = "ft";
export const isMeasurementUnit = (v: unknown): v is DefaultMeasurementUnit =>
  typeof v === "string" && (MEASUREMENT_UNITS as readonly string[]).includes(v);

/** Server side: the tenant's default, or ft when no settings row exists. */
export async function getDefaultMeasurementUnit(supabase: SupabaseClient, tenantId: string): Promise<DefaultMeasurementUnit> {
  const { data } = await supabase.from("tenant_settings").select("default_measurement_unit").eq("tenant_id", tenantId).maybeSingle();
  return isMeasurementUnit(data?.default_measurement_unit) ? data.default_measurement_unit : FALLBACK_UNIT;
}

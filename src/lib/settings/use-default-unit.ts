"use client";

import { useEffect, useState } from "react";
import { fetchConfigOnce } from "@/lib/quotations/config-cache";
import { FALLBACK_UNIT, isMeasurementUnit, type DefaultMeasurementUnit } from "./measurement-unit";

/**
 * The tenant's default unit, for a client component that creates rows.
 * Cached with the rest of the config; Settings → Config invalidates it.
 * Answers the fallback until loaded, so a row made in the first instant
 * is still a valid row.
 */
export function useDefaultMeasurementUnit(): DefaultMeasurementUnit {
  const [unit, setUnit] = useState<DefaultMeasurementUnit>(FALLBACK_UNIT);
  useEffect(() => {
    let live = true;
    fetchConfigOnce<{ data?: { default_measurement_unit?: string } }>("/api/settings/defaults")
      .then((j) => {
        if (live && isMeasurementUnit(j?.data?.default_measurement_unit)) setUnit(j.data.default_measurement_unit);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return unit;
}

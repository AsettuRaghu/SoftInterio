import { redirect } from "next/navigation";

/** Presets are a tab of the Catalogue since 2026-09-22; the old address forwards. */
export default function ScopePresetsPage() {
  redirect("/dashboard/settings/catalogue?tab=presets");
}

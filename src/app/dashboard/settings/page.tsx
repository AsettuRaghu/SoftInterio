import { redirect } from "next/navigation";

/**
 * Settings index page - redirects to profile as the default settings page
 */
export default function SettingsPage() {
  redirect("/dashboard/settings/profile");
}

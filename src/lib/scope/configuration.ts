/** The home's configuration: a property fact, required to qualify a lead. */
export const CONFIGURATIONS = ["studio", "1bhk", "2bhk", "3bhk", "4bhk", "5bhk_plus", "other"] as const;
export type Configuration = (typeof CONFIGURATIONS)[number];
export const CONFIGURATION_LABELS: Record<Configuration, string> = {
  studio: "Studio",
  "1bhk": "1 BHK",
  "2bhk": "2 BHK",
  "3bhk": "3 BHK",
  "4bhk": "4 BHK",
  "5bhk_plus": "5+ BHK",
  other: "Other",
};
export const isConfiguration = (v: unknown): v is Configuration =>
  typeof v === "string" && (CONFIGURATIONS as readonly string[]).includes(v);

/** "3 BHK" / "3BHK" / "3 bhk modular" all match 3bhk; "Villa" matches a villa. */
export function presetMatches(presetName: string, configuration: Configuration, propertyType?: string | null): boolean {
  const n = presetName.toLowerCase().replace(/\s+/g, "");
  if (propertyType && ["villa", "independent_house", "farmhouse"].includes(propertyType) && n.includes("villa")) return true;
  if (configuration === "studio") return n.includes("studio");
  if (configuration === "5bhk_plus") return /5\+?bhk/.test(n) || n.includes("5bhk");
  if (configuration === "other") return false;
  return n.startsWith(configuration) || n.includes(configuration);
}

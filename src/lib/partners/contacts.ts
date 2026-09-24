/** The owner of the relationship first, then alphabetical. */
export function sortContacts<T extends { is_primary?: boolean | null; name: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => Number(!!b.is_primary) - Number(!!a.is_primary) || a.name.localeCompare(b.name)
  );
}

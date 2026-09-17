/**
 * Who is the same person.
 *
 * Within a business the phone number says "same partner"; the email is a
 * second hint; a name on its own is never enough. Identifiers are kept as a
 * list so a third (a platform identity, a GST number) is an addition, not
 * a rebuild. See docs/plans/partners.md §3.
 */

/** Digits only, the last ten - an Indian mobile with or without +91 / 0. */
export function normalisePhone(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export type Identifier = { kind: "phone" | "email"; value: string };

export function identifiersOf(input: { phone?: unknown; email?: unknown }): Identifier[] {
  const out: Identifier[] = [];
  const phone = normalisePhone(input.phone);
  if (phone && phone.length >= 10) out.push({ kind: "phone", value: phone });
  const email = String(input.email ?? "").trim().toLowerCase();
  if (email && email.includes("@")) out.push({ kind: "email", value: email });
  return out;
}

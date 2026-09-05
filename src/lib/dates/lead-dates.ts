/**
 * Date rules for lead forms and stage transitions.
 *
 * Two directions, and they are not interchangeable:
 *   - forward-looking fields (target dates, expected project start) must not
 *     sit in the past
 *   - recorded facts (the date a contract was signed) must not sit in the
 *     future - backdating one is routine, postdating one is not
 *
 * Comparisons run on YYYY-MM-DD strings rather than Date objects. Every column
 * involved is a plain `date`, so PostgREST returns the string unchanged and a
 * lexical compare is a calendar compare. Parsing into a Date would read it as
 * midnight UTC and shift the day for anyone behind UTC.
 */

/** Today on the caller's own calendar, as YYYY-MM-DD. */
export function todayISO(): string {
  const now = new Date();
  // Shift by the local offset before formatting. toISOString() is UTC, which
  // rolls the date back a day for anyone ahead of UTC in the small hours.
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

export function isPastDate(value?: string | null): boolean {
  return !!value && value < todayISO();
}

export function isFutureDate(value?: string | null): boolean {
  return !!value && value > todayISO();
}

export interface LeadDateFields {
  target_start_date?: string | null;
  target_end_date?: string | null;
  contract_signed_date?: string | null;
  expected_project_start?: string | null;
  expected_project_end?: string | null;
}

/**
 * Returns a readable problem for every date rule the change would break.
 *
 * Only dates the caller is actually *changing* are held to the "not in the
 * past" rule. Leads already carry target dates that have since gone by - a
 * lead opened in January with a February start is perfectly valid in
 * September - and re-validating those on every save would block edits to
 * unrelated fields on any lead more than a few months old.
 *
 * Ordering rules (end after start) are checked whenever either side of the
 * pair moves, since changing one can invalidate a pair that was fine before.
 */
export function validateLeadDates(
  incoming: LeadDateFields,
  existing: LeadDateFields = {}
): string[] {
  const problems: string[] = [];

  const changed = (field: keyof LeadDateFields) =>
    field in incoming && !!incoming[field] && incoming[field] !== existing[field];

  // The value that will be stored once this change lands. A field the caller
  // left out (or sent as undefined) keeps whatever the lead already holds.
  const effective = (field: keyof LeadDateFields) =>
    (incoming[field] ?? existing[field]) || null;

  if (changed("target_start_date") && isPastDate(incoming.target_start_date)) {
    problems.push("Target Start Date cannot be in the past");
  }

  const targetStart = effective("target_start_date");
  const targetEnd = effective("target_end_date");
  if (
    (changed("target_start_date") || changed("target_end_date")) &&
    targetStart &&
    targetEnd &&
    targetEnd <= targetStart
  ) {
    problems.push("Target End Date must be after the Target Start Date");
  }

  // A contract is signed on or before today - never after it.
  if (changed("contract_signed_date") && isFutureDate(incoming.contract_signed_date)) {
    problems.push("Contract Signed Date cannot be in the future");
  }

  if (
    changed("expected_project_start") &&
    isPastDate(incoming.expected_project_start)
  ) {
    problems.push("Expected Project Start cannot be in the past");
  }

  const signed = effective("contract_signed_date");
  const projectStart = effective("expected_project_start");
  if (
    (changed("contract_signed_date") || changed("expected_project_start")) &&
    signed &&
    projectStart &&
    projectStart < signed
  ) {
    problems.push(
      "Expected Project Start cannot be before the Contract Signed Date"
    );
  }

  const projectEnd = effective("expected_project_end");
  if (
    (changed("expected_project_start") || changed("expected_project_end")) &&
    projectStart &&
    projectEnd &&
    projectEnd <= projectStart
  ) {
    problems.push(
      "Expected Project End must be after the Expected Project Start"
    );
  }

  return problems;
}

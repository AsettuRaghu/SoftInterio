/**
 * A hold says who we are waiting on, why, and until when.
 *
 * Both task status routes accept these alongside `status` and hand them to
 * task_transition, which stores them on the task and - through the history
 * trigger - on the status-history row, in the same write as the status. That
 * is what makes "days waiting on the client at the Design stage because of
 * approval_pending" answerable later without anyone having recorded it twice.
 */
const HOLD_OWNERS = new Set(["client", "vendor", "internal", "third_party"]);

/** The hold fields a caller may send, shaped as task_transition's parameters. */
export function readHold(body: Record<string, unknown>) {
  const owner = typeof body.hold_owner === "string" && HOLD_OWNERS.has(body.hold_owner) ? body.hold_owner : null;
  return {
    p_hold_owner: owner,
    p_hold_reason_code: typeof body.hold_reason_code === "string" && body.hold_reason_code ? body.hold_reason_code : null,
    p_hold_expected_until:
      typeof body.hold_expected_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.hold_expected_until)
        ? body.hold_expected_until
        : null,
    p_hold_counterpart: typeof body.hold_counterpart === "string" && body.hold_counterpart.trim() ? body.hold_counterpart.trim() : null,
  };
}

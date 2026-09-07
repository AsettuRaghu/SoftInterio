import type { NextRequest } from "next/server";
import { apiLogger } from "@/lib/logger";

/**
 * A logger bound to one request, so its lines can be found together.
 *
 * The problem this solves: the sales API had eighty-three console.* calls and
 * no structured logging at all. In production those lines are
 * indistinguishable - "Error updating lead" tells you a lead failed to update,
 * not which lead, for whom, or which of the four things that request also did.
 * Two users hitting the same endpoint interleave and cannot be separated.
 *
 * Every line from one request carries the same requestId, plus the route, the
 * method, the user and the tenant. Grep the id and you have the whole story of
 * one action in order.
 */
export interface RequestLogger {
  requestId: string;
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => void;
  /** Milliseconds since the request logger was created. */
  elapsed: () => number;
}

export function requestLogger(
  request: NextRequest,
  extra?: { userId?: string; tenantId?: string }
): RequestLogger {
  // Honour an inbound trace header when there is one, so a request that
  // crossed a boundary keeps its identity instead of starting a new story.
  const requestId =
    request.headers.get("x-request-id") ||
    globalThis.crypto?.randomUUID?.().slice(0, 8) ||
    Math.random().toString(36).slice(2, 10);

  const base = {
    requestId,
    route: request.nextUrl.pathname,
    method: request.method,
    ...(extra?.userId ? { userId: extra.userId } : {}),
    ...(extra?.tenantId ? { tenantId: extra.tenantId } : {}),
  };

  const startedAt = Date.now();

  return {
    requestId,
    debug: (m, c) => apiLogger.debug(m, { ...base, ...c }),
    info: (m, c) => apiLogger.info(m, { ...base, ...c }),
    warn: (m, c) => apiLogger.warn(m, { ...base, ...c }),
    error: (m, e, c) =>
      apiLogger.error(m, e, { ...base, ...c, elapsedMs: Date.now() - startedAt }),
    elapsed: () => Date.now() - startedAt,
  };
}

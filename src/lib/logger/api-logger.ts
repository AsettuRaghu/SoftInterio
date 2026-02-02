/**
 * API Request/Response Logger
 * Provides unified, beautiful logging for API routes with timing and metrics
 * Designed to be the ONLY logging system visible during debugging
 */

import { NextRequest, NextResponse } from "next/server";

export interface ApiLogContext {
  /** API endpoint path */
  endpoint: string;
  /** HTTP method */
  method: string;
  /** User ID if authenticated */
  userId?: string;
  /** Tenant ID if available */
  tenantId?: string;
  /** Request ID for tracing */
  requestId?: string;
}

export interface ApiLogMetrics {
  /** Total request time in milliseconds */
  duration: number;
  /** HTTP status code */
  statusCode: number;
  /** Number of records affected/returned */
  recordCount?: number;
  /** Query time if applicable */
  queryTime?: number;
  /** Serialization time if applicable */
  serializeTime?: number;
  /** Custom metrics */
  [key: string]: unknown;
}

// Color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

/**
 * Format duration with intelligent unit selection
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Log API request start with context - compact format
 */
export function logApiRequestStart(
  context: ApiLogContext,
  details?: Record<string, unknown>
): void {
  const { endpoint, method, userId } = context;
  
  // Build details summary
  const detailsParts = [];
  if (userId) {
    detailsParts.push(`user=${userId.substring(0, 8)}`);
  }
  
  if (details) {
    Object.entries(details).forEach(([key, value]) => {
      if (typeof value === 'object') {
        const objStr = JSON.stringify(value);
        if (objStr.length > 30) {
          detailsParts.push(`${key}=${objStr.substring(0, 27)}...`);
        } else {
          detailsParts.push(`${key}=${objStr}`);
        }
      } else {
        detailsParts.push(`${key}=${value}`);
      }
    });
  }

  const methodColor = method === 'GET' ? COLORS.cyan : COLORS.blue;
  const detailsStr = detailsParts.length > 0 ? ` ${detailsParts.join(' • ')}` : '';
  
  console.log(
    `${COLORS.dim}▶${COLORS.reset} ${methodColor}${COLORS.bright}${method}${COLORS.reset} ${endpoint}${detailsStr}`
  );
}

/**
 * Log API request completion with beautiful formatting
 */
export function logApiRequestEnd(
  context: ApiLogContext,
  metrics: ApiLogMetrics
): void {
  const { endpoint, method } = context;

  // Status color and icon
  const statusOk = metrics.statusCode >= 200 && metrics.statusCode < 300;
  const statusColor = statusOk ? COLORS.green : COLORS.red;
  const statusIcon = statusOk ? '✓' : '✗';
  
  // Build metrics summary
  const metricsParts = [];
  metricsParts.push(`${metrics.statusCode}`);
  metricsParts.push(formatDuration(metrics.duration));

  if (metrics.recordCount !== undefined && metrics.recordCount > 0) {
    metricsParts.push(`${COLORS.cyan}${metrics.recordCount}${COLORS.reset} records`);
  }
  
  if (metrics.queryTime !== undefined) {
    metricsParts.push(`query ${formatDuration(metrics.queryTime)}`);
  }
  
  if (metrics.serializeTime !== undefined) {
    metricsParts.push(`serialize ${formatDuration(metrics.serializeTime)}`);
  }

  // Extract custom metrics
  const customMetrics: Record<string, unknown> = {};
  Object.entries(metrics).forEach(([key, value]) => {
    if (!["duration", "statusCode", "recordCount", "queryTime", "serializeTime"].includes(key)) {
      customMetrics[key] = value;
    }
  });

  const methodColor = method === 'GET' ? COLORS.cyan : COLORS.blue;
  const separator = ` ${COLORS.dim}|${COLORS.reset} `;
  const metricsStr = metricsParts.join(separator);
  
  let logLine = `${COLORS.dim}◀${COLORS.reset} ${methodColor}${COLORS.bright}${method}${COLORS.reset} ${endpoint} ${statusColor}${statusIcon}${COLORS.reset} ${metricsStr}`;
  
  // Add custom metrics if present
  if (Object.keys(customMetrics).length > 0) {
    const customStr = Object.entries(customMetrics)
      .map(([k, v]) => {
        if (typeof v === 'object') {
          return `${k}: ${JSON.stringify(v)}`;
        }
        return `${k}: ${v}`;
      })
      .join(', ');
    logLine += ` ${COLORS.dim}[${customStr}]${COLORS.reset}`;
  }

  console.log(logLine);
}

/**
 * Log API error with full context
 */
export function logApiError(
  context: ApiLogContext,
  error: unknown,
  metrics?: Partial<ApiLogMetrics>
): void {
  const { endpoint, method } = context;
  const errorMsg = error instanceof Error ? error.message : String(error);
  const duration = metrics?.duration || 0;

  const methodColor = method === 'GET' ? COLORS.cyan : COLORS.blue;
  const durationStr = duration > 0 ? ` ${formatDuration(duration)}` : '';
  
  console.error(
    `${COLORS.dim}✘${COLORS.reset} ${methodColor}${COLORS.bright}${method}${COLORS.reset} ${endpoint} ${COLORS.red}ERROR${COLORS.reset}${durationStr}`
  );
  console.error(`  ${COLORS.red}${errorMsg}${COLORS.reset}`);
  
  if (error instanceof Error && error.stack) {
    // Only show stack in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`  ${COLORS.dim}${error.stack.split('\n').slice(1, 3).join('\n  ')}${COLORS.reset}`);
    }
  }
}

/**
 * High-order function to wrap an API route handler with automatic logging
 * (Optional - routes can log manually if preferred)
 */
export function withApiLogging<T extends (...args: any[]) => any>(
  handler: T,
  context: Omit<ApiLogContext, "userId" | "tenantId" | "requestId">
): T {
  return (async (request: NextRequest) => {
    const startTime = performance.now();
    let statusCode = 500;
    let recordCount: number | undefined;

    try {
      // Extract optional context from request
      const userId = (request as any).userId;
      const tenantId = (request as any).tenantId;
      const requestId =
        request.headers.get("x-request-id") ||
        crypto.randomUUID?.() ||
        undefined;

      logApiRequestStart(
        { ...context, userId, tenantId, requestId },
        {
          params: Object.fromEntries(request.nextUrl.searchParams),
        }
      );

      // Call handler
      const response = await handler(request);
      statusCode = response.status;

      // Try to extract record count from response
      if (response.status === 200) {
        try {
          const clone = response.clone();
          const data = await clone.json();
          if (typeof data.leads?.length === "number") {
            recordCount = data.leads.length;
          } else if (typeof data.data?.length === "number") {
            recordCount = data.data.length;
          } else if (typeof data.length === "number") {
            recordCount = data.length;
          } else if (data.count !== undefined) {
            recordCount = data.count;
          }
        } catch {
          // Could not parse response, skip record count
        }
      }

      // Log completion
      const duration = Math.round(performance.now() - startTime);
      logApiRequestEnd(
        { ...context, userId, tenantId, requestId },
        { duration, statusCode, recordCount }
      );

      return response;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      logApiError(context, error, { duration, statusCode });

      // Return error response
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Internal server error",
        },
        { status: statusCode }
      );
    }
  }) as T;
}

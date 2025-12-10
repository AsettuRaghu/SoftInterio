/**
 * Centralized Logger Utility
 *
 * A structured logging system that provides:
 * - Log levels (debug, info, warn, error)
 * - Environment-aware logging (suppresses debug in production)
 * - Structured metadata support
 * - Consistent formatting
 * - Future-ready for external logging services (e.g., Sentry, LogRocket, Datadog)
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  /** Module or component name */
  module?: string;
  /** Action being performed */
  action?: string;
  /** User ID if available */
  userId?: string;
  /** Tenant ID if available */
  tenantId?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

// Environment configuration
const isDevelopment = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";
const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

// Log level priority for filtering
const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be output based on current configuration
 */
function shouldLog(level: LogLevel): boolean {
  // In test environment, suppress all logs unless explicitly enabled
  if (isTest && !process.env.ENABLE_TEST_LOGS) {
    return false;
  }

  // In production, suppress debug logs unless explicitly enabled
  if (!isDevelopment && level === "debug" && !process.env.ENABLE_DEBUG_LOGS) {
    return false;
  }

  return LOG_PRIORITY[level] >= LOG_PRIORITY[LOG_LEVEL];
}

/**
 * Format error object for logging
 */
function formatError(
  error: unknown
): LogEntry["error"] | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: isDevelopment ? error.stack : undefined,
      code: (error as any).code,
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
    };
  }

  return {
    name: "UnknownError",
    message: JSON.stringify(error),
  };
}

/**
 * Create a formatted log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: context ? { ...context } : undefined,
    error: formatError(error),
  };
}

/**
 * Format log output for console
 */
function formatConsoleOutput(entry: LogEntry): string {
  const parts: string[] = [];

  // Add module prefix if available
  if (entry.context?.module) {
    parts.push(`[${entry.context.module}]`);
  }

  // Add action if available
  if (entry.context?.action) {
    parts.push(`[${entry.context.action}]`);
  }

  // Add message
  parts.push(entry.message);

  return parts.join(" ");
}

/**
 * Output log to console with appropriate styling
 */
function outputToConsole(entry: LogEntry): void {
  const formattedMessage = formatConsoleOutput(entry);

  // Filter out internal context keys for cleaner console output
  const metadata: Record<string, unknown> = {};
  if (entry.context) {
    Object.entries(entry.context).forEach(([key, value]) => {
      if (!["module", "action"].includes(key) && value !== undefined) {
        metadata[key] = value;
      }
    });
  }

  const hasMetadata = Object.keys(metadata).length > 0;

  switch (entry.level) {
    case "debug":
      if (hasMetadata) {
        console.debug(formattedMessage, metadata);
      } else {
        console.debug(formattedMessage);
      }
      break;
    case "info":
      if (hasMetadata) {
        console.info(formattedMessage, metadata);
      } else {
        console.info(formattedMessage);
      }
      break;
    case "warn":
      if (hasMetadata) {
        console.warn(formattedMessage, metadata);
      } else {
        console.warn(formattedMessage);
      }
      break;
    case "error":
      if (entry.error) {
        console.error(formattedMessage, { ...metadata, error: entry.error });
      } else if (hasMetadata) {
        console.error(formattedMessage, metadata);
      } else {
        console.error(formattedMessage);
      }
      break;
  }
}

/**
 * Send log to external service (placeholder for future integration)
 * Can integrate with Sentry, LogRocket, Datadog, etc.
 */
function sendToExternalService(entry: LogEntry): void {
  // TODO: Integrate with external logging service
  // Example integrations:
  //
  // Sentry (for errors):
  // if (entry.level === 'error' && entry.error) {
  //   Sentry.captureException(new Error(entry.error.message), {
  //     extra: entry.context,
  //   });
  // }
  //
  // DataDog:
  // datadogLogs.logger.log(entry.message, entry.context, entry.level);
  //
  // LogRocket:
  // LogRocket.log(entry.level, entry.message, entry.context);
}

/**
 * Core logging function
 */
function log(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): void {
  if (!shouldLog(level)) return;

  const entry = createLogEntry(level, message, context, error);

  // Output to console
  outputToConsole(entry);

  // Send to external service for warn and error levels in production
  if (!isDevelopment && (level === "warn" || level === "error")) {
    sendToExternalService(entry);
  }
}

/**
 * Logger instance with all log level methods
 */
export const logger = {
  /**
   * Debug level - detailed information for debugging
   * Suppressed in production unless explicitly enabled
   */
  debug: (message: string, context?: LogContext) => {
    log("debug", message, context);
  },

  /**
   * Info level - general operational messages
   */
  info: (message: string, context?: LogContext) => {
    log("info", message, context);
  },

  /**
   * Warning level - potential issues that don't prevent operation
   */
  warn: (message: string, context?: LogContext) => {
    log("warn", message, context);
  },

  /**
   * Error level - errors that need attention
   */
  error: (message: string, error?: unknown, context?: LogContext) => {
    log("error", message, context, error);
  },

  /**
   * Create a child logger with preset context
   * Useful for module-specific logging
   */
  child: (defaultContext: LogContext) => ({
    debug: (message: string, context?: LogContext) => {
      log("debug", message, { ...defaultContext, ...context });
    },
    info: (message: string, context?: LogContext) => {
      log("info", message, { ...defaultContext, ...context });
    },
    warn: (message: string, context?: LogContext) => {
      log("warn", message, { ...defaultContext, ...context });
    },
    error: (message: string, error?: unknown, context?: LogContext) => {
      log("error", message, { ...defaultContext, ...context }, error);
    },
  }),
};

/**
 * Pre-configured loggers for common modules
 */
export const authLogger = logger.child({ module: "AUTH" });
export const apiLogger = logger.child({ module: "API" });
export const dbLogger = logger.child({ module: "DB" });
export const emailLogger = logger.child({ module: "EMAIL" });
export const uiLogger = logger.child({ module: "UI" });

export default logger;

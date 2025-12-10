/**
 * Centralized Error Handling Utility
 *
 * Provides:
 * - Custom error classes for different error types
 * - Error normalization for consistent handling
 * - API error response formatting
 * - Client-side error handling utilities
 * - Error recovery strategies
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base application error with additional context
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly originalCause?: Error;

  constructor(
    message: string,
    options: {
      code?: string;
      statusCode?: number;
      isOperational?: boolean;
      context?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = "AppError";
    this.code = options.code || "UNKNOWN_ERROR";
    this.statusCode = options.statusCode || 500;
    this.isOperational = options.isOperational ?? true;
    this.context = options.context;
    this.originalCause = options.cause;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Authentication errors (401)
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string = "Authentication required",
    options: { code?: string; context?: Record<string, unknown> } = {}
  ) {
    super(message, {
      code: options.code || "AUTHENTICATION_ERROR",
      statusCode: 401,
      isOperational: true,
      context: options.context,
    });
    this.name = "AuthenticationError";
  }
}

/**
 * Authorization errors (403)
 */
export class AuthorizationError extends AppError {
  constructor(
    message: string = "You do not have permission to perform this action",
    options: { code?: string; context?: Record<string, unknown> } = {}
  ) {
    super(message, {
      code: options.code || "AUTHORIZATION_ERROR",
      statusCode: 403,
      isOperational: true,
      context: options.context,
    });
    this.name = "AuthorizationError";
  }
}

/**
 * Validation errors (400)
 */
export class ValidationError extends AppError {
  public readonly fields?: Record<string, string[]>;

  constructor(
    message: string = "Validation failed",
    options: {
      code?: string;
      fields?: Record<string, string[]>;
      context?: Record<string, unknown>;
    } = {}
  ) {
    super(message, {
      code: options.code || "VALIDATION_ERROR",
      statusCode: 400,
      isOperational: true,
      context: options.context,
    });
    this.name = "ValidationError";
    this.fields = options.fields;
  }
}

/**
 * Not found errors (404)
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = "Resource not found",
    options: { code?: string; context?: Record<string, unknown> } = {}
  ) {
    super(message, {
      code: options.code || "NOT_FOUND",
      statusCode: 404,
      isOperational: true,
      context: options.context,
    });
    this.name = "NotFoundError";
  }
}

/**
 * Conflict errors (409) - e.g., duplicate entries
 */
export class ConflictError extends AppError {
  constructor(
    message: string = "Resource already exists",
    options: { code?: string; context?: Record<string, unknown> } = {}
  ) {
    super(message, {
      code: options.code || "CONFLICT",
      statusCode: 409,
      isOperational: true,
      context: options.context,
    });
    this.name = "ConflictError";
  }
}

/**
 * Rate limit errors (429)
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(
    message: string = "Too many requests. Please try again later.",
    options: {
      code?: string;
      retryAfter?: number;
      context?: Record<string, unknown>;
    } = {}
  ) {
    super(message, {
      code: options.code || "RATE_LIMIT_EXCEEDED",
      statusCode: 429,
      isOperational: true,
      context: options.context,
    });
    this.name = "RateLimitError";
    this.retryAfter = options.retryAfter;
  }
}

/**
 * Database errors (500)
 */
export class DatabaseError extends AppError {
  constructor(
    message: string = "Database operation failed",
    options: {
      code?: string;
      context?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: options.code || "DATABASE_ERROR",
      statusCode: 500,
      isOperational: true,
      context: options.context,
      cause: options.cause,
    });
    this.name = "DatabaseError";
  }
}

/**
 * External service errors (502)
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(
    service: string,
    message: string = "External service unavailable",
    options: {
      code?: string;
      context?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: options.code || "EXTERNAL_SERVICE_ERROR",
      statusCode: 502,
      isOperational: true,
      context: { ...options.context, service },
      cause: options.cause,
    });
    this.name = "ExternalServiceError";
    this.service = service;
  }
}

// ============================================================================
// Error Normalization
// ============================================================================

/**
 * Normalized error structure for consistent handling
 */
export interface NormalizedError {
  message: string;
  code: string;
  statusCode: number;
  isOperational: boolean;
  fields?: Record<string, string[]>;
  context?: Record<string, unknown>;
  stack?: string;
}

/**
 * Normalize any error to a consistent structure
 */
export function normalizeError(error: unknown): NormalizedError {
  // Already an AppError
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      fields: error instanceof ValidationError ? error.fields : undefined,
      context: error.context,
      stack: error.stack,
    };
  }

  // Standard Error
  if (error instanceof Error) {
    // Check for common error patterns
    const message = error.message.toLowerCase();

    // Supabase auth errors
    if (message.includes("invalid login credentials")) {
      return {
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
        statusCode: 401,
        isOperational: true,
        stack: error.stack,
      };
    }

    if (message.includes("email not confirmed")) {
      return {
        message: "Please verify your email address",
        code: "EMAIL_NOT_CONFIRMED",
        statusCode: 401,
        isOperational: true,
        stack: error.stack,
      };
    }

    if (message.includes("jwt expired") || message.includes("token expired")) {
      return {
        message: "Your session has expired. Please sign in again.",
        code: "SESSION_EXPIRED",
        statusCode: 401,
        isOperational: true,
        stack: error.stack,
      };
    }

    // Network errors
    if (message.includes("fetch failed") || message.includes("network")) {
      return {
        message: "Network error. Please check your connection.",
        code: "NETWORK_ERROR",
        statusCode: 503,
        isOperational: true,
        stack: error.stack,
      };
    }

    // Generic error
    return {
      message: error.message || "An unexpected error occurred",
      code: "UNKNOWN_ERROR",
      statusCode: 500,
      isOperational: false,
      stack: error.stack,
    };
  }

  // String error
  if (typeof error === "string") {
    return {
      message: error,
      code: "UNKNOWN_ERROR",
      statusCode: 500,
      isOperational: false,
    };
  }

  // Unknown error type
  return {
    message: "An unexpected error occurred",
    code: "UNKNOWN_ERROR",
    statusCode: 500,
    isOperational: false,
  };
}

// ============================================================================
// API Error Response Handling
// ============================================================================

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    fields?: Record<string, string[]>;
  };
}

/**
 * Create a standardized API error response
 */
export function createApiErrorResponse(
  error: unknown,
  options: {
    logError?: boolean;
    module?: string;
    action?: string;
  } = {}
): NextResponse<ApiErrorResponse> {
  const normalized = normalizeError(error);

  // Log the error
  if (options.logError !== false) {
    logger.error(normalized.message, error, {
      module: options.module || "API",
      action: options.action,
      code: normalized.code,
      statusCode: normalized.statusCode,
    });
  }

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === "development";
  const userMessage =
    normalized.isOperational || isDevelopment
      ? normalized.message
      : "An unexpected error occurred. Please try again later.";

  return NextResponse.json(
    {
      success: false,
      error: {
        message: userMessage,
        code: normalized.code,
        fields: normalized.fields,
      },
    },
    { status: normalized.statusCode }
  );
}

/**
 * Wrap an API handler with error handling
 */
export function withErrorHandling<T>(
  handler: () => Promise<NextResponse<T>>,
  options: {
    module?: string;
    action?: string;
  } = {}
): Promise<NextResponse<T | ApiErrorResponse>> {
  return handler().catch((error) => {
    return createApiErrorResponse(error, options);
  });
}

// ============================================================================
// Client-Side Error Handling
// ============================================================================

/**
 * User-friendly error messages for common scenarios
 */
const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  AUTHENTICATION_ERROR: "Please sign in to continue.",
  AUTHORIZATION_ERROR: "You don't have permission to do this.",
  VALIDATION_ERROR: "Please check your input and try again.",
  NOT_FOUND: "The requested item was not found.",
  CONFLICT: "This item already exists.",
  RATE_LIMIT_EXCEEDED: "Too many requests. Please wait a moment.",
  NETWORK_ERROR: "Connection problem. Please check your internet.",
  SESSION_EXPIRED: "Your session has expired. Please sign in again.",
  UNKNOWN_ERROR: "Something went wrong. Please try again.",
};

/**
 * Get a user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  const normalized = normalizeError(error);

  // Use predefined message if available
  if (USER_FRIENDLY_MESSAGES[normalized.code]) {
    return USER_FRIENDLY_MESSAGES[normalized.code];
  }

  // Return the error message if it's operational
  if (normalized.isOperational) {
    return normalized.message;
  }

  // Default message for non-operational errors
  return USER_FRIENDLY_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Parse API error response
 */
export async function parseApiError(
  response: Response
): Promise<NormalizedError> {
  try {
    const data = await response.json();

    if (data.error) {
      return {
        message: data.error.message || data.error || "Request failed",
        code: data.error.code || "API_ERROR",
        statusCode: response.status,
        isOperational: true,
        fields: data.error.fields,
      };
    }

    return {
      message: data.message || "Request failed",
      code: "API_ERROR",
      statusCode: response.status,
      isOperational: true,
    };
  } catch {
    return {
      message: `Request failed with status ${response.status}`,
      code: "API_ERROR",
      statusCode: response.status,
      isOperational: true,
    };
  }
}

/**
 * Handle API response and throw on error
 */
export async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new AppError(error.message, {
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
    });
  }

  return response.json();
}

// ============================================================================
// Error Recovery
// ============================================================================

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const normalized = normalizeError(error);

  // Network errors are typically retryable
  if (normalized.code === "NETWORK_ERROR") {
    return true;
  }

  // Rate limit errors are retryable after waiting
  if (normalized.code === "RATE_LIMIT_EXCEEDED") {
    return true;
  }

  // 5xx errors might be temporary
  if (normalized.statusCode >= 500 && normalized.statusCode < 600) {
    return true;
  }

  return false;
}

/**
 * Get recommended retry delay in milliseconds
 */
export function getRetryDelay(
  error: unknown,
  attempt: number
): number {
  const normalized = normalizeError(error);

  // Rate limit - use server-provided delay or exponential backoff
  if (error instanceof RateLimitError && error.retryAfter) {
    return error.retryAfter * 1000;
  }

  // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
  const baseDelay = 1000;
  const maxDelay = 30000;
  return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
}

export default {
  // Error classes
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  // Functions
  normalizeError,
  createApiErrorResponse,
  withErrorHandling,
  getUserFriendlyMessage,
  parseApiError,
  handleApiResponse,
  isRetryableError,
  getRetryDelay,
};

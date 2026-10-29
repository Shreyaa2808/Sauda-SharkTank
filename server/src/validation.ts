/**
 * Standardized HTTP Input Validation & Error Sanitization Helpers
 * Phase 5: Security, Validation and Operational Reliability
 */

export class ValidationError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Validates that the input is a valid non-null, non-array JSON object.
 */
export function validateJsonObject(body: unknown, label = 'Request body'): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError(400, 'INVALID_BODY', `${label} must be a JSON object.`);
  }
  return body as Record<string, unknown>;
}

/**
 * Parses and validates a path, query, or body identifier as a safe positive integer (>= 1).
 * Rejects non-integers, negative numbers, zero, oversized values, booleans, arrays, and null/undefined.
 */
export function parsePositiveIntegerId(value: unknown, label: string): number {
  if (value === null || value === undefined) {
    throw new ValidationError(400, 'INVALID_ID', `${label} is required.`);
  }

  // Reject boolean, object, array, or empty string
  if (typeof value === 'boolean' || typeof value === 'object' || (typeof value === 'string' && value.trim() === '')) {
    throw new ValidationError(400, 'INVALID_ID', `${label} must be a positive integer.`);
  }

  const num = typeof value === 'number' ? value : Number(value);

  // Check if it is a strict safe integer >= 1
  if (!Number.isSafeInteger(num) || num < 1) {
    throw new ValidationError(400, 'INVALID_ID', `${label} must be a positive integer.`);
  }

  return num;
}

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

export interface ParsedPagination {
  limit: number;
  offset: number;
}

/**
 * Validates pagination parameters (limit and offset) and applies a safe upper bound.
 * Rejects invalid non-integer or negative inputs rather than silently coercing them.
 */
export function parsePagination(
  query: Record<string, unknown>,
  options: PaginationOptions = {},
): ParsedPagination {
  const defaultLimit = options.defaultLimit ?? 50;
  const maxLimit = options.maxLimit ?? 100;

  let limit = defaultLimit;
  let offset = 0;

  if (query.limit !== undefined && query.limit !== '') {
    if (typeof query.limit === 'boolean' || typeof query.limit === 'object') {
      throw new ValidationError(400, 'INVALID_PAGINATION', 'limit must be a positive integer.');
    }
    const parsedLimit = Number(query.limit);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1) {
      throw new ValidationError(400, 'INVALID_PAGINATION', 'limit must be a positive integer.');
    }
    limit = Math.min(maxLimit, parsedLimit);
  }

  if (query.offset !== undefined && query.offset !== '') {
    if (typeof query.offset === 'boolean' || typeof query.offset === 'object') {
      throw new ValidationError(400, 'INVALID_PAGINATION', 'offset must be a non-negative integer.');
    }
    const parsedOffset = Number(query.offset);
    if (!Number.isSafeInteger(parsedOffset) || parsedOffset < 0) {
      throw new ValidationError(400, 'INVALID_PAGINATION', 'offset must be a non-negative integer.');
    }
    offset = parsedOffset;
  }

  return { limit, offset };
}

/**
 * Validates that an object does not contain unknown/unexpected keys.
 */
export function validateAllowedFields(
  obj: Record<string, unknown>,
  allowedFields: string[],
  label = 'Input',
): void {
  const allowedSet = new Set(allowedFields);
  for (const key of Object.keys(obj)) {
    if (!allowedSet.has(key)) {
      throw new ValidationError(400, 'UNKNOWN_FIELD', `${label} contains unrecognized field: '${key}'.`);
    }
  }
}

/**
 * Validates a string input with length bounds.
 */
export function validateBoundedString(
  value: unknown,
  fieldName: string,
  options: { minLength?: number; maxLength?: number; required?: boolean } = {},
): string | null {
  const { minLength = 0, maxLength = 1000, required = false } = options;

  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(400, 'MISSING_FIELD', `${fieldName} is required.`);
    }
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(400, 'INVALID_TYPE', `${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (required && trimmed.length < Math.max(1, minLength)) {
    throw new ValidationError(400, 'INVALID_STRING_LENGTH', `${fieldName} cannot be blank.`);
  }

  if (trimmed.length > maxLength) {
    throw new ValidationError(
      400,
      'STRING_TOO_LONG',
      `${fieldName} must not exceed ${maxLength} characters.`,
    );
  }

  return trimmed;
}

/**
 * Sanitizes any error to prevent leaking SQL queries, stack traces, credentials, or internals to clients.
 */
export function formatSafeErrorResponse(
  error: unknown,
  fallbackMessage = 'Unexpected server error.',
): { status: number; body: { error: string; message: string } } {
  if (error instanceof ValidationError) {
    return {
      status: error.status,
      body: {
        error: error.code,
        message: error.message,
      },
    };
  }

  // Check if it is a known application error with explicit status & code
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as any).status === 'number' &&
    'code' in error &&
    typeof (error as any).code === 'string' &&
    'message' in error &&
    typeof (error as any).message === 'string'
  ) {
    const appErr = error as { status: number; code: string; message: string };
    // Redact any accidental SQL snippets in message
    const cleanMessage = appErr.message.replace(/SELECT\s+.*|INSERT\s+.*|UPDATE\s+.*|DELETE\s+.*/gi, '[query redacted]');
    return {
      status: appErr.status,
      body: {
        error: appErr.code,
        message: cleanMessage,
      },
    };
  }

  // Generic 500 error: NEVER expose SQL queries, stack traces, or credentials
  return {
    status: 500,
    body: {
      error: 'SERVER_ERROR',
      message: fallbackMessage,
    },
  };
}
